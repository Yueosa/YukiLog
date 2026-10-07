/** 文章页结构增强（仅 Lit 沉浸版）：标题编号/锚点、代码窗口卡与复制、
 * 写法角标复制、同族多图 niri 平铺带、旁注 Tufte 对齐、剧透点按。
 * 对每份新正文幂等（按 prose 元素打标），KaTeX/mermaid 归 enhance.ts。 */

export interface ArticleFx {
  /** 旁注重新对齐（窗口缩放、图片加载后调用）。 */
  relayout: () => void;
  destroy: () => void;
}

const COPY_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
const CHECK_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5L19.5 7"/></svg>';
const CHEVRON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5.5 15.5 12 9 18.5"/></svg>';

const RAIL_QUERY = '(min-width: 1340px)';

export function enhanceArticlePage(root: ParentNode): ArticleFx | null {
  const prose = root.querySelector<HTMLElement>('.prose');
  if (!prose) return null;
  let stripLayouts: Array<() => void> = [];
  if (!prose.dataset.fxDone) {
    prose.dataset.fxDone = '1';
    numberHeadings(prose);
    wrapCodeBlocks(prose);
    addCopyChips(prose);
    stripLayouts = buildImageStrips(prose);
    bindSpoilers(prose);
    bindSidenoteHighlight(root);
  }

  const relayout = () => {
    layoutSidenotes(root);
    stripLayouts.forEach((layout) => layout());
  };
  const onResize = () => relayout();
  window.addEventListener('resize', onResize);
  const media = window.matchMedia(RAIL_QUERY);
  media.addEventListener('change', onResize);
  prose.querySelectorAll('img').forEach((img) => {
    if (!img.complete) img.addEventListener('load', relayout, { once: true });
  });
  relayout();
  return {
    relayout,
    destroy: () => {
      window.removeEventListener('resize', onResize);
      media.removeEventListener('change', onResize);
    },
  };
}

/** h2 序号 + 悬停锚点（h3-h6 只要锚点）。容器块（分栏/折叠/callout/引用）里的
 * 标题不进服务端 TOC，客户端编号必须同样跳过，否则两边序号对不上。 */
function numberHeadings(prose: HTMLElement) {
  let index = 0;
  prose.querySelectorAll<HTMLHeadingElement>('h2, h3, h4, h5, h6').forEach((heading) => {
    if (heading.closest('.lm-cols, .lm-fold, .lm-callout, blockquote')) return;
    if (heading.tagName !== 'H2') {
      if (heading.id) {
        const anchor = document.createElement('a');
        anchor.className = 'h-anchor';
        anchor.href = `#${heading.id}`;
        anchor.textContent = '#';
        anchor.title = '小节链接';
        anchor.addEventListener('click', (event) => event.stopPropagation());
        heading.append(anchor);
      }
      return;
    }
    if (heading.tagName === 'H2') {
      index += 1;
      const no = document.createElement('span');
      no.className = 'h-no';
      no.textContent = String(index).padStart(2, '0');
      heading.prepend(no);
    }
    if (heading.id) {
      const anchor = document.createElement('a');
      anchor.className = 'h-anchor';
      anchor.href = `#${heading.id}`;
      anchor.textContent = '#';
      anchor.title = '小节链接';
      anchor.addEventListener('click', (event) => event.stopPropagation());
      heading.append(anchor);
    }
  });
}

/** 服务端高亮后的 pre[data-lang] 包窗口卡：语言标签 + 复制按钮。 */
function wrapCodeBlocks(prose: HTMLElement) {
  prose.querySelectorAll<HTMLElement>('pre[data-lang]').forEach((pre) => {
    const box = document.createElement('div');
    box.className = 'codebox';
    const head = document.createElement('div');
    head.className = 'codebox-head';
    const lang = document.createElement('span');
    lang.className = 'codebox-lang';
    lang.textContent = pre.dataset.lang ?? 'text';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'codebox-copy';
    button.innerHTML = `${COPY_SVG}<span>复制</span>`;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      void copyText(pre.innerText, button, '<span>已复制</span>');
    });
    head.append(lang, button);
    pre.parentNode?.insertBefore(box, pre);
    box.append(head, pre);
  });
}

/** 原样块 / 示例块原文栏：悬停复制角标（写法就是要给人抄的）。 */
function addCopyChips(prose: HTMLElement) {
  prose.querySelectorAll<HTMLElement>('pre.lm-verbatim').forEach((pre) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-chip';
    button.innerHTML = COPY_SVG;
    button.title = '复制写法';
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      void copyText(pre.innerText, button, '');
    });
    pre.append(button);
  });
}

async function copyText(text: string, button: HTMLElement, doneLabel: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  const old = button.innerHTML;
  button.classList.add('done');
  button.innerHTML = CHECK_SVG + doneLabel;
  setTimeout(() => {
    button.classList.remove('done');
    button.innerHTML = old;
  }, 1600);
}

/** 同 data-group 的图片（≥2）收进 niri 式平铺带：中间放大、两侧半掩。
 * 返回各平铺带的重排函数，由调用方挂 resize。 */
function buildImageStrips(prose: HTMLElement): Array<() => void> {
  const layouts: Array<() => void> = [];
  const groups = new Map<string, HTMLImageElement[]>();
  prose.querySelectorAll<HTMLImageElement>('img[data-group]').forEach((img) => {
    const key = img.dataset.group ?? '';
    if (!key) return;
    const list = groups.get(key) ?? [];
    list.push(img);
    groups.set(key, list);
  });
  for (const [name, images] of groups) {
    if (images.length < 2) continue;
    const first = images[0];
    const anchorBlock = first.closest('p, figure') ?? first;
    const strip = document.createElement('div');
    strip.className = 'imgstrip';
    strip.dataset.group = name;
    const viewport = document.createElement('div');
    viewport.className = 'imgstrip-viewport';
    const track = document.createElement('div');
    track.className = 'imgstrip-track';
    viewport.append(track);
    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'imgstrip-nav prev';
    prev.setAttribute('aria-label', '上一张');
    prev.innerHTML = CHEVRON_SVG.replace('<path d="M9 5.5 15.5 12 9 18.5"', '<path d="M15 5.5 8.5 12l6.5 6.5"');
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'imgstrip-nav next';
    next.setAttribute('aria-label', '下一张');
    next.innerHTML = CHEVRON_SVG;
    const counter = document.createElement('p');
    counter.className = 'imgstrip-count';
    strip.append(viewport, prev, next, counter);
    anchorBlock.parentNode?.insertBefore(strip, anchorBlock);
    // 把组内图片挪进轨道，并清掉变空的段落壳
    const shells = new Set<Element>();
    for (const img of images) {
      const shell = img.closest('p, figure');
      track.append(img);
      if (shell && shell !== strip && shell.textContent?.trim() === '') shells.add(shell);
    }
    shells.forEach((shell) => shell.remove());
    layouts.push(initStrip(strip, images, prev, next, counter));
  }
  return layouts;
}

function initStrip(
  strip: HTMLElement,
  images: HTMLImageElement[],
  prev: HTMLButtonElement,
  next: HTMLButtonElement,
  counter: HTMLElement,
): () => void {
  const count = images.length;
  let active = 0;
  const scaleOf = (ad: number) => (ad === 0 ? 1.16 : ad === 1 ? 0.88 : ad === 2 ? 0.74 : 0.6);
  const stateOf = (ad: number) => {
    if (ad === 0) return { s: 1.16, o: 1, z: 3, sat: 1 };
    if (ad === 1) return { s: 0.88, o: 0.55, z: 2, sat: 0.72 };
    if (ad === 2) return { s: 0.74, o: 0.28, z: 1, sat: 0.6 };
    return { s: 0.6, o: 0, z: 0, sat: 0.5 };
  };
  const layout = () => {
    const height = images[0].offsetHeight || 305;
    const widths = images.map((img) => {
      const naturalW = img.naturalWidth || 4;
      const naturalH = img.naturalHeight || 3;
      return Math.min(height * 1.9, Math.max(height * 0.45, (height * naturalW) / naturalH));
    });
    const offsets = new Array<number>(count).fill(0);
    const dists = new Array<number>(count).fill(0);
    for (const side of [1, -1]) {
      let edge = (widths[active] * scaleOf(0)) / 2;
      const maxAd = side === 1 ? Math.floor(count / 2) : Math.floor((count - 1) / 2);
      for (let ad = 1; ad <= maxAd; ad += 1) {
        const index = (((active + side * ad) % count) + count) % count;
        const half = (widths[index] * scaleOf(ad)) / 2;
        const tuck = half * (ad === 1 ? 0.55 : 0.9);
        const off = edge + half - tuck;
        offsets[index] = side * off;
        dists[index] = side * ad;
        edge = off + half;
      }
    }
    images.forEach((img, index) => {
      const dist = dists[index];
      const state = stateOf(Math.abs(dist));
      img.style.width = `${widths[index]}px`;
      img.style.setProperty('--off', `${offsets[index]}px`);
      img.style.setProperty('--s', String(state.s));
      img.style.setProperty('--o', String(state.o));
      img.style.setProperty('--z', String(state.z));
      img.style.setProperty('--sat', String(state.sat));
      img.classList.toggle('is-center', dist === 0);
      img.onclick = (event) => {
        if (dist === 0) return; // 中间图交给正文灯箱
        event.stopPropagation();
        active = (((active + dist) % count) + count) % count;
        layout();
      };
    });
    counter.textContent = `${active + 1} / ${count}`;
  };
  prev.addEventListener('click', (event) => {
    event.stopPropagation();
    active = (active - 1 + count) % count;
    layout();
  });
  next.addEventListener('click', (event) => {
    event.stopPropagation();
    active = (active + 1) % count;
    layout();
  });
  strip.addEventListener('click', (event) => {
    // 侧图点击已在 img.onclick 处理，导航按钮之外不冒泡到正文灯箱
    if ((event.target as HTMLElement).closest('.imgstrip-nav')) event.stopPropagation();
  });
  images.forEach((img) => {
    if (!img.complete) img.addEventListener('load', layout, { once: true });
  });
  layout();
  return layout;
}

/** 旁注 ref ↔ note 悬停双向高亮（其余变暗）。 */
function bindSidenoteHighlight(root: ParentNode) {
  const aside = root.querySelector('.post-notes');
  if (!aside) return;
  const notes = [...aside.querySelectorAll<HTMLElement>('.post-note')];
  root.querySelectorAll<HTMLAnchorElement>('.lm-noteref a').forEach((ref) => {
    const anchor = ref.getAttribute('href')?.slice(1) ?? '';
    const note = anchor ? notes.find((n) => n.id === anchor) : undefined;
    if (!note) return;
    ref.addEventListener('mouseenter', () => {
      note.classList.add('hl');
      notes.forEach((n) => {
        if (n !== note) n.classList.add('dim');
      });
    });
    ref.addEventListener('mouseleave', () => {
      note.classList.remove('hl');
      notes.forEach((n) => n.classList.remove('dim'));
    });
    note.addEventListener('mouseenter', () => ref.classList.add('hl'));
    note.addEventListener('mouseleave', () => ref.classList.remove('hl'));
  });
}

/** 剧透黑条：点按切换揭示。 */
function bindSpoilers(prose: HTMLElement) {
  prose.querySelectorAll<HTMLElement>('.lm-spoiler').forEach((spoiler) => {
    spoiler.addEventListener('click', (event) => {
      event.stopPropagation();
      spoiler.classList.toggle('revealed');
    });
  });
}

/** 宽屏（≥1340px）旁注 Tufte 对齐：每条旁注垂直对齐它的上标，碰撞下移。 */
function layoutSidenotes(root: ParentNode) {
  const aside = root.querySelector<HTMLElement>('.post-notes');
  if (!aside) return;
  const notes = [...aside.querySelectorAll<HTMLElement>('.post-note')];
  const wide = window.matchMedia(RAIL_QUERY).matches;
  aside.classList.toggle('is-railed', wide);
  if (!wide) {
    notes.forEach((note) => {
      note.style.top = '';
    });
    return;
  }
  const asideTop = aside.getBoundingClientRect().top;
  let previousBottom = -Infinity;
  for (const note of notes) {
    const anchor = note.id.replace(/^note-/, 'noteref-');
    const ref = root.querySelector(`#${CSS.escape(anchor)}`);
    if (!ref) continue;
    let top = ref.getBoundingClientRect().top - asideTop - 4;
    top = Math.max(top, previousBottom + 10);
    note.style.top = `${top}px`;
    previousBottom = top + note.offsetHeight;
  }
}
