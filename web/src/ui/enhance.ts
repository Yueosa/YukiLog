/** LianMarkup 正文增强：KaTeX 公式与 mermaid 图的客户端渲染。
 * Lit 与 SSR 文章页共用（SSR 在有标记时注入本模块）。katex/mermaid
 * 按需动态加载，不进首包。 */
import katexCss from 'katex/dist/katex.min.css?inline';

const KATEX_STYLE_ATTR = 'data-katex-css';

/** 渲染 root 内所有未处理的 .lm-math 与 pre.lm-mermaid（幂等，可重复调用）。 */
export async function enhanceProse(root: ParentNode): Promise<void> {
  const maths = [...root.querySelectorAll<HTMLElement>('.lm-math:not([data-lm-done])')];
  const mermaids = [...root.querySelectorAll<HTMLElement>('pre.lm-mermaid:not([data-lm-done])')];
  // 必须同步打标：updated() 高频触发，动态 import 挂起期间会有几十个
  // enhanceProse 排队，全部拿到同一批元素重复渲染（KaTeX 内容翻倍、
  // mermaid 被自己产出的内容覆盖成空图）
  for (const element of [...maths, ...mermaids]) {
    element.dataset.lmDone = '1';
  }
  const tasks: Promise<unknown>[] = [];
  if (maths.length > 0) {
    // 文档级样式进不了 shadow tree（shadow DOM 封装，只有继承属性和
    // CSS 变量能穿透），katex 样式必须以 inline 形式注进 shadow root；
    // SSR（document 树）由 vite preload 注入的 <link> 覆盖，不重复注入
    if (root instanceof ShadowRoot && !root.querySelector(`style[${KATEX_STYLE_ATTR}]`)) {
      const style = document.createElement('style');
      style.setAttribute(KATEX_STYLE_ATTR, '');
      style.textContent = katexCss;
      root.prepend(style);
    }
    tasks.push(renderMath(maths));
  }
  if (mermaids.length > 0) tasks.push(renderMermaid(mermaids));
  await Promise.allSettled(tasks);
}

async function renderMath(elements: HTMLElement[]): Promise<void> {
  const katex = (await import('katex')).default;
  for (const element of elements) {
    const raw = element.textContent ?? '';
    const displayMode = element.tagName === 'DIV';
    // 解析器保留定界符（$...$ / $$...$$），KaTeX 不需要
    const tex = displayMode
      ? raw.replace(/^\s*\$\$\s*/, '').replace(/\s*\$\$\s*$/, '')
      : raw.replace(/^\$/, '').replace(/\$$/, '');
    try {
      katex.render(
        // 零宽字符（\u200B 等）会让 KaTeX 报错并输出残影，先清掉
        tex.replace(/[\u200B\u200C\u200D\uFEFF]/g, ''),
        element,
        { displayMode, throwOnError: false },
      );
    } catch {
      // 渲染失败保留 TeX 源码，不打扰阅读
    }
  }
}

async function renderMermaid(elements: HTMLElement[]): Promise<void> {
  const mermaid = (await import('mermaid')).default;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'neutral',
    fontFamily: 'inherit',
  });
  for (const [index, element] of elements.entries()) {
    const source = element.textContent ?? '';
    try {
      // mermaid.run 在 shadow DOM 里产出空图（它用 document.getElementById
      // 做后处理，够不到 shadow root）；render() 内部在 document 里建沙箱，
      // 返回自包含 SVG 字符串，直接塞回 shadow 里
      const { svg } = await mermaid.render(`lm-mermaid-${Date.now()}-${index}`, source);
      element.innerHTML = normalizeMermaidSvg(svg);
      element.dataset.processed = 'true';
    } catch {
      // 渲染失败保留图源码，不打扰阅读
    }
  }
}

/** 部分图型（时序图等）只给固定像素宽、不给 viewBox：内容不随容器缩放，
 * 页内和灯箱都会被裁。补 viewBox 并放开宽度，让 SVG 始终可缩放。 */
function normalizeMermaidSvg(markup: string): string {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const svg = doc.documentElement;
  if (svg.tagName.toLowerCase() !== 'svg') return markup;
  if (!svg.getAttribute('viewBox')) {
    const width = parseFloat(svg.getAttribute('width') ?? '') || 800;
    const height = parseFloat(svg.getAttribute('height') ?? '') || 400;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', '100%');
    svg.removeAttribute('height');
  }
  // mermaid 把双向边标签画在节点矩形之前，长标签会被节点盖住；
  // 把 edgeLabels 组挪到节点之后绘制（标签压在节点上）。
  // 用 classList 判定而不是 :scope 选择器（SVG 上下文里 :scope 匹配不可靠）
  const root = svg.querySelector('g.root') ?? svg;
  for (const child of [...root.children]) {
    if (child.classList.contains('edgeLabels')) {
      root.appendChild(child);
    }
  }
  return new XMLSerializer().serializeToString(svg);
}
