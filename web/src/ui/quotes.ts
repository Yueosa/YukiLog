// /api/hitokoto 不可达时的本地句库。首屏先展示本地一句，接口返回后无缝替换。

export interface LocalQuote {
  text: string;
  from: string;
}

export const LOCAL_QUOTES: LocalQuote[] = [
  { text: '把每一个今天过得比昨天好一点，这样就够了。', from: '《比宇宙更远的地方》' },
  { text: '这里分享她所热爱的技术、思考，以及情绪、挣扎', from: '' },
  { text: '夜色降下来的时候，星星就开始写信。', from: '' },
  { text: '慢慢来，比较快。', from: '' },
  { text: '有些话只说给恰好路过的人听。', from: '' },
  { text: '愿长夜里的灯，都等到想等的人。', from: '' },
  { text: '写下来的一切，都不会真正消失。', from: '' },
  { text: '风经过的地方，时间会慢下来。', from: '' },
];

/** 按日期确定性地挑一句，同一天内多次进入首屏保持一致。 */
export function fallbackQuote(seed: string = new Date().toISOString().slice(0, 10)): LocalQuote {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) % 997;
  return LOCAL_QUOTES[hash % LOCAL_QUOTES.length];
}
