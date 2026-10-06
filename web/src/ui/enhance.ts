/** LianMarkup 正文增强：KaTeX 公式与 mermaid 图的客户端渲染。
 * Lit 与 SSR 文章页共用（SSR 在有标记时注入本模块）。katex/mermaid
 * 按需动态加载，不进首包。 */

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
  if (maths.length > 0) tasks.push(renderMath(maths));
  if (mermaids.length > 0) tasks.push(renderMermaid(mermaids));
  await Promise.allSettled(tasks);
}

async function renderMath(elements: HTMLElement[]): Promise<void> {
  const katex = (await import('katex')).default;
  await import('katex/dist/katex.min.css');
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
  try {
    await mermaid.run({ nodes: elements });
  } catch {
    // 渲染失败保留图源码，不打扰阅读
  }
}
