import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { styleMap } from 'lit/directives/style-map.js';
import {
  componentRegistry,
  flattenLayout,
  toPageLayout,
  validateLayout,
} from '../layout/registry.js';
import {
  LayoutCommandError,
  indexLayout,
  validDropPositions,
  type DropPosition,
} from '../layout/commands.js';
import { layoutPresets } from '../layout/presets.js';
import { LayoutStudioStore, type StudioMutation } from '../layout/studio-store.js';
import type {
  ArticleField,
  ComponentType,
  LayoutDocument,
  LayoutNode,
  PageLayoutDocument,
  PropertySchema,
} from '../layout/types.js';

const articles = [
  {
    slug: 'october-wind',
    orientation: 'landscape' as const,
    title: '在十月的晚风里，重新搭一座小小的站',
    summary: '旧服务器消失以后，我终于有机会重新想一遍：一个博客究竟应该留下什么。',
    date: '2026 · 10 · 04',
    category: '生活随笔',
    tags: ['夜色', '重逢'],
    views: 128,
    likes: 16,
    cover: 'cover-one',
    featured: true,
  },
  {
    slug: 'unpushed-nights',
    orientation: 'landscape' as const,
    title: '那些没有被算法推送的夜晚',
    summary: '有些文字并不期待抵达很多人，只希望在某一个恰好的时刻，被某个人读到。',
    date: '2026 · 09 · 17',
    category: '写作',
    tags: ['回忆', '长信'],
    views: 96,
    likes: 21,
    cover: 'cover-two',
    featured: false,
  },
  {
    slug: 'scattered-stars',
    orientation: 'portrait' as const,
    title: '把动态写成散落在时间里的星',
    summary: '短句不再是假装完整的文章，它们只是当天留下的一点光。',
    date: '2026 · 08 · 29',
    category: '动态',
    tags: ['星轨', '片刻'],
    views: 73,
    likes: 12,
    cover: 'cover-three',
    featured: false,
  },
  {
    slug: 'blog-system',
    orientation: 'landscape' as const,
    title: '一套不替创作者做决定的博客系统',
    summary: '组件、布局和设计语言应当可以被更换，而内容不必跟着重新搬家。',
    date: '2026 · 08 · 11',
    category: '开发手记',
    tags: ['Rust', '组件引擎'],
    views: 184,
    likes: 28,
    cover: 'cover-four',
    featured: true,
  },
  {
    slug: 'rain-photos',
    orientation: 'portrait' as const,
    title: '雨落在窗边的时候，适合整理旧照片',
    summary: '我没有试图把每张照片都解释清楚，只给它们留下了时间和地点。',
    date: '2026 · 07 · 26',
    category: '日常',
    tags: ['雨天', '照片'],
    views: 61,
    likes: 9,
    cover: 'cover-five',
    featured: false,
  },
  {
    slug: 'blank-page',
    orientation: 'landscape' as const,
    title: '从一张空白页面开始',
    summary: '这一次不修补旧站。重新决定哪些东西值得存在，也允许一些东西永远离开。',
    date: '2026 · 07 · 08',
    category: '站务',
    tags: ['重构', 'YukiLog'],
    views: 142,
    likes: 24,
    cover: 'cover-six',
    featured: false,
  },
];

interface MomentComment {
  name: string;
  site?: string;
  agent?: string;
  time: string;
  text: string;
  owner?: boolean;
  children?: MomentComment[];
}

const dynamics: Array<{
  text: string;
  time: string;
  rel: string;
  likes: number;
  images?: string[];
  comments?: MomentComment[];
}> = [
  {
    text: '雨停以后，窗沿留下了一小段很亮的晚霞。',
    time: '2026.10.04 / 22:17',
    rel: '12 小时前',
    likes: 12,
    comments: [
      {
        name: '远岸',
        site: 'https://yeastar.xin',
        agent: 'Desktop Edge 146 · Windows 10',
        time: '23:02',
        text: '这句真好，像一小片被忘了收起来的光。',
      },
      {
        name: '栖迟',
        agent: 'Mobile Safari · iPhone',
        time: '昨天 08:41',
        text: '看来晚霞也知道自己被看见了。',
      },
    ],
  },
  {
    text: '重新整理了书桌，也重新整理了一些念头。',
    time: '2026.10.02 / 16:40',
    rel: '3 天前',
    likes: 9,
    images: ['cover-four'],
  },
  {
    text: '正在为新的 YukiLog 选择它应有的样子。候选有三个，但心里其实早有答案。',
    time: '2026.09.28 / 23:05',
    rel: '1 周前',
    likes: 21,
    comments: [
      {
        name: '栖迟',
        agent: 'Desktop Firefox 128 · Arch Linux',
        time: '09.29 / 00:12',
        text: '是夜航那个吗？首屏的月亮一出来就觉得是它了。',
        children: [
          {
            name: '恋',
            owner: true,
            time: '09.29 / 00:47',
            text: '是它。另外两位候选也很优秀，但月亮一升起来就没得选了。',
          },
        ],
      },
    ],
  },
  {
    text: '凌晨两点，终于把恢复演练完整跑通。睡个好觉。',
    time: '2026.09.20 / 02:03',
    rel: '2 周前',
    likes: 16,
    images: ['cover-five', 'cover-two', 'cover-one'],
  },
  { text: '今天的风很轻，适合慢一点做决定。', time: '2026.09.15 / 19:26', rel: '3 周前', likes: 8 },
];

// 文章详情页排版预览用的富文本 mock（正式内容由后端 Markdown 渲染输出）。
const articleProseMock = html`
  <p>
    十月四日下午，云厂商发来最后一封提醒邮件的时候，我其实已经知道来不及了。机器被回收，磁盘被清空，那个跑了两年的旧站，连同它所有的文章、评论和访问统计，一起变成了账单页面上的一行小字。
  </p>
  <p>难过是有一点的。但更多的是一种奇怪的轻松——好像有人替我按下了那个我一直舍不得按的删除键。</p>
  <h2>旧站的问题，我一直都知道</h2>
  <p>
    旧的前端是写死的。想换一个组件的位置，要改模板；想换一套配色，要翻遍所有样式表。数据库的更新方式更原始，<code>ALTER TABLE</code>
    语句散在各个角落里，没有人能说清线上到底跑到了哪一版。
  </p>
  <blockquote>
    <p>重写不是否定过去，而是承认现在的自己，已经能做得更好一点了。</p>
  </blockquote>
  <p>所以这一次，布局是存在数据库里的文档，主题是可以整体更换的设计语言，而建库只有一份从零开始的基线：</p>
  <pre><code>cargo run -p yukilog-migration
  ✓ create baseline      42 ms
  ✓ seed nightflight      3 ms</code></pre>
  <p>重写的清单其实很短，但每一条都是旧站做不到的事：</p>
  <ul>
    <li>界面可以配置，而不是写死在模板里</li>
    <li>响应式和媒体播放要流畅，手机和电脑都一样</li>
    <li>管理页要像样，至少能和公开页坐在一起不心虚</li>
  </ul>
  <h2>重新开始，而不是修补</h2>
  <p>
    有人问我为什么不在旧站上继续修。答案是：修补只能解决「坏了」的问题，解决不了「一开始就没长对」的问题。这一次从数据模型开始就是新的，连这篇测试排版的文章，也是系统自己种下来的。
  </p>
  <h3>留下来的东西</h3>
  <p>
    备份里找回了几篇长文，但重读之后我决定不整包导入。那些文字更像是当时的流水账，而不是现在的我还想再说一遍的话。真正留下来的，只有写它们的那几个夜晚。
  </p>
  <hr />
  <p>如果你也曾弄丢过什么东西，希望你也能在某个十月，把它重新搭成自己喜欢的样子。</p>
`;

type IconName =
  | 'home'
  | 'article'
  | 'dynamic'
  | 'friends'
  | 'search'
  | 'menu'
  | 'close'
  | 'github'
  | 'chat'
  | 'video'
  | 'x'
  | 'music'
  | 'mail'
  | 'rss'
  | 'arrow-down';

const publicNavigation = [
  { label: '首页', href: '/', icon: 'home' },
  { label: '文章', href: '/articles', icon: 'article' },
  { label: '动态', href: '/dynamics', icon: 'dynamic' },
  { label: '友链', href: '/friends', icon: 'friends' },
] as const;

function icon(name: IconName) {
  switch (name) {
    case 'home':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5v8a1.5 1.5 0 0 1-1.5 1.5h-5v-6h-5v6h-5A1.5 1.5 0 0 1 3 19.5z" /></svg>`;
    case 'article':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6zM9 10h6M9 14h6M9 18h4M15 3v4h4" /></svg>`;
    case 'dynamic':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H8l-4 4zM8 9h8M8 13h5" /></svg>`;
    case 'friends':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="3" /><circle cx="17" cy="10" r="2.5" /><path d="M3.5 20c.6-3.3 2.4-5 5.5-5s4.9 1.7 5.5 5M14 15.5c3.7-.8 5.8.7 6.5 3.5" /></svg>`;
    case 'search':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>`;
    case 'menu':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>`;
    case 'close':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>`;
    case 'github':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .5A11.5 11.5 0 0 0 .5 12.3c0 5.2 3.4 9.6 8.1 11.2.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.5-1.4-1.3-1.8-1.3-1.8-1.1-.8.1-.8.1-.8 1.2.1 1.8 1.2 1.8 1.2 1.1 1.9 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.4-1.3-5.4-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.7-2.8 5.7-5.4 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z"/></svg>`;
    case 'chat':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.1 2C6.6 2 2.2 6.1 2.2 11.2c0 2.9 1.5 5.5 3.9 7.2-.2.8-.7 2.1-1.6 3.3 1.8-.2 3.5-1 4.6-1.8 1 .3 2 .4 3 .4 5.5 0 9.9-4.1 9.9-9.1S17.6 2 12.1 2Z"/></svg>`;
    case 'video':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7.2l-2.3 2.7a1 1 0 0 1-1.6 0L6.6 17H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm6.2 3.2v5.6l5-2.8-5-2.8Z"/></svg>`;
    case 'x':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 10.3 22 2h-2.2l-6.2 7.1L8.7 2H2l7.7 11.1L2 22h2.2l6.8-7.8L15.3 22H22l-7.3-11.7Zm-2.4 2.8-.8-1.1L5 3.6h2.7l5 7.2.8 1.1 6.5 9.3h-2.7l-5.4-7.1Z"/></svg>`;
    case 'music':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18.5A3.5 3.5 0 1 1 5.5 15V6.8l12-2.4v9.6a3.5 3.5 0 1 1-2 3.1V8.2l-6.5 1.3v9Z"/></svg>`;
    case 'mail':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm9 7.2L20.2 7H3.8L12 12.2Z"/></svg>`;
    case 'rss':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-1-8a1 1 0 0 1 1-1 8 8 0 0 1 8 8 1 1 0 1 1-2 0 6 6 0 0 0-6-6 1 1 0 0 1-1-1Zm0-6a1 1 0 0 1 1-1 14 14 0 0 1 14 14 1 1 0 1 1-2 0A12 12 0 0 0 5 7a1 1 0 0 1-1-1Z"/></svg>`;
    case 'arrow-down':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 9 7 7 7-7" /></svg>`;
  }
}

const propertyLabels: Record<string, string> = {
  variant: '外观',
  title: '标题',
  accent: '强调字',
  kicker: '眉题',
  lead: '说明',
  text: '文字',
  attribution: '署名',
  source: '内容来源',
  alignment: '对齐',
  align: '子项对齐',
  gap: '间距',
  maxWidth: '最大宽度',
  columns: '列',
  sidebarWidth: '侧栏宽度',
  side: '侧栏方向',
  sticky: '滚动吸附',
  rowHeight: '行高',
  padding: '内边距',
  radius: '圆角',
  shadow: '阴影',
  showSocials: '显示社交链接',
  showEnter: '显示进入按钮',
  backgroundMediaId: '首屏背景',
  backgroundPosition: '背景焦点',
  overlay: '背景遮罩',
  showStatus: '显示状态',
  flip: '允许翻转',
  size: '尺寸',
  shape: '形状',
  label: '替代文字',
  tone: '语气',
  fields: '显示字段',
  limit: '数量',
  sort: '排序',
  compact: '紧凑显示',
};

export interface StudioMedia {
  id: string;
  url: string;
  mediaType: string;
  name: string;
}

export interface PublicSiteData {
  siteTitle: string;
  siteDescription: string;
  ownerName: string;
  ownerBio: string;
  avatarUrl: string;
  socialLinks: Array<{ label: string; url: string }>;
}

const defaultSiteData: PublicSiteData = {
  siteTitle: 'YukiLog',
  siteDescription: '记录技术、思考、情绪与挣扎',
  ownerName: 'Lian（恋）',
  ownerBio: '我能走到这里，是因为你没有放弃',
  avatarUrl: 'https://q1.qlogo.cn/g?b=qq&nk=1303028790&s=640',
  socialLinks: [
    { label: 'GitHub', url: 'https://github.com/Yueosa' },
    { label: 'QQ', url: 'https://qm.qq.com/cgi-bin/qm/qr?k=O6KD1bt5WDvQw47kzjaDuYIASzar_y-F' },
    { label: 'Bilibili', url: 'https://space.bilibili.com/433677987' },
    { label: 'X', url: 'https://x.com/Yosa04942475621' },
    { label: '网易云音乐', url: 'https://music.163.com/#/user/home?id=630887153' },
    { label: 'Gmail', url: 'mailto:yichengxin7@gmail.com' },
  ],
};

function socialIcon(label: string, index: number): IconName {
  const normalized = label.toLowerCase();
  if (normalized.includes('github')) return 'github';
  if (normalized.includes('qq')) return 'chat';
  if (normalized.includes('bili') || normalized.includes('视频')) return 'video';
  if (normalized === 'x' || normalized.includes('twitter')) return 'x';
  if (normalized.includes('音乐') || normalized.includes('music')) return 'music';
  if (normalized.includes('mail') || normalized.includes('邮箱')) return 'mail';
  return (['github', 'chat', 'video', 'x', 'music', 'mail'] as const)[index % 6];
}

// 首屏社交图标：旧版 YukiLog 的填充式品牌图标
function socialGlyph(label: string, index: number) {
  if (label === 'RSS') return icon('rss');
  const normalized = label.toLowerCase();
  if (normalized.includes('github')) {
    return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.884 18.653c-.3-.2-.558-.455-.86-.816a51 51 0 0 1-.466-.579c-.463-.575-.755-.841-1.056-.95a1 1 0 1 1 .675-1.882c.752.27 1.261.735 1.947 1.588c-.094-.117.34.427.433.539c.19.227.33.365.44.438c.204.137.588.196 1.15.14c.024-.382.094-.753.202-1.095c-2.968-.726-4.648-2.64-4.648-6.396c0-1.24.37-2.356 1.058-3.292c-.218-.894-.185-1.975.302-3.192a1 1 0 0 1 .63-.582c.081-.024.127-.035.208-.047c.803-.124 1.937.17 3.415 1.096a11.7 11.7 0 0 1 2.687-.308c.912 0 1.819.104 2.684.308c1.477-.933 2.614-1.227 3.422-1.096q.128.02.218.05a1 1 0 0 1 .616.58c.487 1.216.52 2.296.302 3.19c.691.936 1.058 2.045 1.058 3.293c0 3.757-1.674 5.665-4.642 6.392c.125.415.19.878.19 1.38c0 .665-.002 1.299-.007 2.01c0 .19-.002.394-.005.706a1 1 0 0 1-.018 1.958c-1.14.227-1.984-.532-1.984-1.525l.002-.447l.005-.705c.005-.707.008-1.337.008-1.997c0-.697-.184-1.152-.426-1.361c-.661-.57-.326-1.654.541-1.751c2.966-.333 4.336-1.482 4.336-4.66c0-.955-.312-1.744-.913-2.404A1 1 0 0 1 17.2 6.19c.166-.414.236-.957.095-1.614l-.01.003c-.491.139-1.11.44-1.858.949a1 1 0 0 1-.833.135a9.6 9.6 0 0 0-2.592-.349c-.89 0-1.772.118-2.592.35a1 1 0 0 1-.829-.134c-.753-.507-1.374-.807-1.87-.947c-.143.653-.072 1.194.093 1.607a1 1 0 0 1-.189 1.045c-.597.655-.913 1.458-.913 2.404c0 3.172 1.371 4.328 4.322 4.66c.865.097 1.202 1.177.545 1.748c-.193.168-.43.732-.43 1.364v3.15c0 .985-.834 1.725-1.96 1.528a1 1 0 0 1-.04-1.962v-.99c-.91.061-1.661-.088-2.254-.485"/></svg>`;
  }
  if (normalized.includes('qq')) {
    return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m17.536 12.514l-.696-1.796c0-.021.01-.375.01-.558C16.85 7.088 15.447 4 12 4s-4.848 3.088-4.848 6.16c0 .183.009.537.01.557l-.696 1.797c-.19.515-.38 1.05-.517 1.51c-.657 2.189-.444 3.095-.282 3.115c.348.043 1.354-1.648 1.354-1.648c0 .98.487 2.258 1.542 3.18c-.394.127-.878.32-1.188.557c-.28.214-.245.431-.194.52c.22.385 3.79.245 4.82.125c1.03.12 4.599.26 4.82-.126c.05-.088.085-.305-.194-.519c-.311-.237-.795-.43-1.19-.556c1.055-.923 1.542-2.202 1.542-3.181c0 0 1.007 1.691 1.355 1.648c.162-.02.378-.928-.283-3.116a27 27 0 0 0-.516-1.509m1.021 8.227c-.373.652-.833.892-1.438 1.057a5 5 0 0 1-.794.138c-.44.045-.986.065-1.613.064a33 33 0 0 1-2.71-.116c-.692.065-1.785.114-2.71.116a16 16 0 0 1-1.614-.064a5 5 0 0 1-.793-.138c-.605-.164-1.065-.405-1.44-1.059a2.27 2.27 0 0 1-.239-1.652c-.592-.132-1.001-.482-1.279-.911a2.4 2.4 0 0 1-.309-.71a4 4 0 0 1-.116-1.106c.013-.785.187-1.762.532-2.912c.14-.466.327-1.008.567-1.655l.554-1.43l-.002-.203C5.153 5.605 7.589 2 12 2c4.413 0 6.848 3.605 6.848 8.16l-.001.203l.553 1.43l.01.026c.225.606.413 1.153.556 1.626c.348 1.15.522 2.128.535 2.916q.012.61-.118 1.108c-.066.246-.161.48-.31.708c-.276.427-.684.776-1.277.91c.13.554.055 1.14-.24 1.654"/></svg>`;
  }
  if (normalized.includes('bili') || normalized.includes('视频')) {
    return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.172 2.757L10.414 6h3.171l3.243-3.242a1 1 0 1 1 1.415 1.415L16.414 6H18.5A3.5 3.5 0 0 1 22 9.5v8a3.5 3.5 0 0 1-3.5 3.5h-13A3.5 3.5 0 0 1 2 17.5v-8A3.5 3.5 0 0 1 5.5 6h2.085L5.757 4.171a1 1 0 0 1 1.415-1.415M18.5 8h-13a1.5 1.5 0 0 0-1.493 1.356L4 9.5v8a1.5 1.5 0 0 0 1.356 1.493L5.5 19h13a1.5 1.5 0 0 0 1.493-1.355L20 17.5v-8A1.5 1.5 0 0 0 18.5 8M8 11a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1m8 0a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1"/></svg>`;
  }
  if (normalized === 'x' || normalized.includes('twitter')) {
    return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m17.687 3.063l-4.996 5.711l-4.32-5.711H2.112l7.477 9.776l-7.086 8.099h3.034l5.469-6.25l4.78 6.25h6.102l-7.794-10.304l6.625-7.571zm-1.064 16.06L5.654 4.782h1.803l10.846 14.34z"/></svg>`;
  }
  if (normalized.includes('音乐') || normalized.includes('music')) {
    return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.422 11.375c-.294 1.028.012 2.065.784 2.653c1.061.81 2.565.3 2.874-.995c.08-.337.103-.722.027-1.056c-.23-1.001-.521-1.988-.792-2.996c-1.33.154-2.543 1.172-2.893 2.394m5.548-.287c.273 1.012.285 2.017-.127 3c-1.128 2.69-4.722 3.14-6.573.826c-1.302-1.627-1.28-3.961.06-5.734c.78-1.032 1.804-1.707 3.048-2.054l.379-.104c-.084-.415-.188-.816-.243-1.224c-.176-1.317.512-2.503 1.744-3.04c1.226-.535 2.708-.216 3.53.76c.406.479.395 1.08-.025 1.464c-.412.377-.997.346-1.435-.09c-.247-.246-.51-.44-.877-.436c-.525.006-.987.418-.945.937c.037.468.172.93.3 1.386c.022.078.216.135.338.153c1.333.197 2.504.731 3.472 1.676c2.558 2.493 2.861 6.531.672 9.44c-1.529 2.032-3.61 3.169-6.127 3.409c-4.621.44-8.664-2.53-9.7-7.058C2.516 10.255 4.84 5.831 8.796 4.25c.586-.234 1.143-.031 1.371.498c.232.537-.019 1.086-.61 1.35c-2.368 1.06-3.817 2.855-4.215 5.424c-.533 3.433 1.656 6.776 5 7.72c2.723.77 5.658-.166 7.308-2.33c1.586-2.08 1.4-5.099-.427-6.873A4 4 0 0 0 15.4 9.026c.198.716.389 1.388.57 2.062"/></svg>`;
  }
  if (normalized.includes('mail') || normalized.includes('邮箱') || normalized.includes('gmail')) {
    return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1m17 4.238l-7.928 7.1L4 7.216V19h16zM4.511 5l7.55 6.662L19.502 5z"/></svg>`;
  }
  return icon(socialIcon(label, index));
}

export class YukiApp extends LitElement {
  private readonly studioStore = new LayoutStudioStore<LayoutDocument>(layoutPresets[0]);
  private readonly previewOnly = new URLSearchParams(window.location.search).get('preview') === '1';
  private studio = false;
  private previewSelectedNodeId: string | null = null;
  private flippedProfiles = new Set<string>();
  private draggingNodeId: string | null = null;
  private draggingComponentType: ComponentType | null = null;
  private dropTarget: { nodeId: string; position: DropPosition } | null = null;
  private studioAnnouncement = '';
  private moveTargetId: string | null = null;
  private studioViewport: 'desktop' | 'tablet' | 'mobile' = 'desktop';
  // 生产环境由工作室从媒体库注入真实媒体；仓库不提供默认图片（版权考虑）
  private mediaLibrary: StudioMedia[] = [];
  private siteData: PublicSiteData = structuredClone(defaultSiteData);
  private mobileMenuOpen = false;
  private nodeSequence = 0;
  private navPastHero = false;
  private spaNavigated = false;
  private revealInstant = false;
  private feedSort: 'featured' | 'popular' | 'recent' = 'featured';
  private likedDynamics = new Set<number>();
  private likedArticles = new Set<string>();
  private commentFormOpen = false;
  private subscribeBusy = false;
  private subscribeDone = new Set<string>();
  private subscribeFailed = new Set<string>();
  private friendApplyBusy = false;
  private friendApplyDone = false;
  private friendApplyError = '';
  private momentReplyOpen = new Set<number>();
  private momentReplySent = new Set<number>();
  private tocItems: { id: string; text: string; level: number }[] = [];
  private tocActive = '';
  private tocPath = '';
  private tocObserver: IntersectionObserver | null = null;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private revealObserver: IntersectionObserver | null = null;

  private get layout(): LayoutDocument {
    return this.studioStore.document;
  }

  private get selectedNodeId(): string {
    return this.studioStore.selectedNodeId;
  }

  private readonly handleRouteChange = () => {
    this.mobileMenuOpen = false;
    document.body.style.overflow = '';
    if (this.spaNavigated) this.revealInstant = true;
    this.handleViewportScroll();
    this.requestUpdate();
  };

  private readonly handleViewportScroll = () => {
    this.updateScrollRing();
    const home = window.location.pathname === '/' || this.previewOnly;
    if (!home) {
      if (!this.navPastHero) {
        this.navPastHero = true;
        this.requestUpdate();
      }
      return;
    }
    const pastHero = window.scrollY >= window.innerHeight * 0.72;
    if (pastHero !== this.navPastHero) {
      this.navPastHero = pastHero;
      this.requestUpdate();
    }
    this.updateHeroParallax();
  };

  private updateScrollRing() {
    const ring = this.renderRoot?.querySelector<SVGCircleElement>('.to-top .ring-fg');
    if (!ring) return;
    const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    const progress = Math.min(window.scrollY / max, 1);
    ring.style.strokeDashoffset = String(125.66 * (1 - progress));
  }

  private updateHeroParallax() {
    if (this.reducedMotion) return;
    const y = window.scrollY;
    const vh = window.innerHeight;
    if (y >= vh) return;
    const background = this.renderRoot.querySelector<HTMLElement>('.hero-background');
    const inner = this.renderRoot.querySelector<HTMLElement>('.hero-inner');
    if (background) background.style.transform = `translateY(${y * 0.28}px)`;
    if (inner) {
      const progress = Math.min(y / (vh * 0.62), 1);
      inner.style.opacity = String(1 - progress);
      inner.style.transform = `translateY(${y * 0.12}px)`;
    }
  }

  private readonly handleStudioKeydown = (event: KeyboardEvent) => {
    if (!this.studio || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault();
    if (event.shiftKey) this.redoStudio();
    else this.undoStudio();
  };

  private readonly handlePreviewMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || event.data?.source !== 'yukilog-studio') return;
    if (this.previewOnly && event.data.type === 'render-layout') {
      this.studioStore.reset(
        event.data.layout as LayoutDocument,
        typeof event.data.selectedNodeId === 'string'
          ? event.data.selectedNodeId
          : event.data.layout.root.id,
      );
      this.previewSelectedNodeId =
        typeof event.data.selectedNodeId === 'string' ? event.data.selectedNodeId : null;
      this.mediaLibrary = Array.isArray(event.data.mediaLibrary)
        ? (event.data.mediaLibrary as StudioMedia[])
        : [];
      this.siteData = event.data.siteData
        ? (event.data.siteData as PublicSiteData)
        : structuredClone(defaultSiteData);
      this.requestUpdate();
      return;
    }
    if (!this.previewOnly && this.studio && event.data.type === 'select-node') {
      if (this.studioStore.select(String(event.data.nodeId))) {
        this.studioAnnouncement = `已选择 ${String(event.data.nodeId)}`;
        this.requestUpdate();
      }
    }
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('popstate', this.handleRouteChange);
    window.addEventListener('scroll', this.handleViewportScroll, { passive: true });
    this.addEventListener('click', this.handleSiteClick);
    this.addEventListener('submit', this.handleSiteSubmit);
    window.addEventListener('keydown', this.handleStudioKeydown);
    window.addEventListener('message', this.handlePreviewMessage);
    this.handleViewportScroll();
  }

  disconnectedCallback() {
    window.removeEventListener('popstate', this.handleRouteChange);
    window.removeEventListener('scroll', this.handleViewportScroll);
    this.removeEventListener('click', this.handleSiteClick);
    this.removeEventListener('submit', this.handleSiteSubmit);
    window.removeEventListener('keydown', this.handleStudioKeydown);
    window.removeEventListener('message', this.handlePreviewMessage);
    this.revealObserver?.disconnect();
    this.revealObserver = null;
    document.body.style.overflow = '';
    super.disconnectedCallback();
  }

  // 站内路由：同一自定义元素内 pushState，避免整页重建导致导航与首屏动画重放。
  // 注意：shadow DOM 事件重定向会让 event.target 指向宿主，必须从 composedPath 里找锚点。
  private readonly handleSiteClick = (event: MouseEvent) => {
    if (
      this.previewOnly ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const anchor = event
      .composedPath()
      .find((node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement);
    if (!anchor || anchor.target) return;
    const href = anchor.getAttribute('href') ?? '';
    if (!href.startsWith('/') || href.startsWith('//')) return;
    if (/^\/(admin|api|media|subscriptions|feeds|feed\.xml)/.test(href)) return;
    event.preventDefault();
    if (href === window.location.pathname + window.location.search) return;
    window.history.pushState(null, '', href);
    this.spaNavigated = true;
    window.scrollTo(0, 0);
    this.handleRouteChange();
  };

  private readonly handleSiteSubmit = (event: SubmitEvent) => {
    if (this.previewOnly) return;
    const form = event
      .composedPath()
      .find((node): node is HTMLFormElement => node instanceof HTMLFormElement);
    if (!form || form.method.toLowerCase() !== 'get') return;
    const action = form.getAttribute('action') ?? '';
    if (!action.startsWith('/')) return;
    event.preventDefault();
    const params = new URLSearchParams();
    new FormData(form).forEach((value, key) => {
      if (typeof value === 'string' && value) params.set(key, value);
    });
    const search = params.toString();
    window.history.pushState(null, '', `${action}${search ? `?${search}` : ''}`);
    this.spaNavigated = true;
    this.handleRouteChange();
  };

  // 公开表单：邮件订阅 / 友链申请。后端不可达时给出内联错误，不打断浏览。
  private async submitSubscribe(event: SubmitEvent, kind: 'articles' | 'dynamics') {
    event.preventDefault();
    if (this.subscribeBusy) return;
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const email = String(data.get('email') ?? '').trim();
    if (!email) return;
    const withOther = data.get('with_other') === 'on';
    this.subscribeBusy = true;
    this.subscribeFailed.delete(kind);
    this.requestUpdate();
    try {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          subscribe_articles: kind === 'articles' || withOther,
          subscribe_dynamics: kind === 'dynamics' || withOther,
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      this.subscribeDone.add(kind);
    } catch {
      this.subscribeFailed.add(kind);
    } finally {
      this.subscribeBusy = false;
      this.requestUpdate();
    }
  }

  // 动态评论：开发环境无后端时仅演示交互，展示已寄出提示。
  private submitMomentReply(event: SubmitEvent, index: number) {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const content = String(data.get('content') ?? '').trim();
    const displayName = String(data.get('display_name') ?? '').trim();
    if (!content || !displayName) return;
    this.momentReplySent.add(index);
    this.requestUpdate();
  }

  private async submitFriendApplication(event: SubmitEvent) {
    event.preventDefault();
    if (this.friendApplyBusy) return;
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const name = String(data.get('name') ?? '').trim();
    const url = String(data.get('url') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const description = String(data.get('description') ?? '').trim();
    const avatarUrl = String(data.get('avatar_url') ?? '').trim();
    if (!name || !url || !email) return;
    this.friendApplyBusy = true;
    this.friendApplyError = '';
    this.requestUpdate();
    try {
      const response = await fetch('/api/friend-link-applications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          url,
          email,
          description: description || null,
          avatar_url: avatarUrl || null,
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      this.friendApplyDone = true;
    } catch {
      this.friendApplyError = '提交失败，请检查站点地址格式后重试。';
    } finally {
      this.friendApplyBusy = false;
      this.requestUpdate();
    }
  }

  private observeReveals() {
    if (this.revealInstant) {
      // SPA 换页：内容直接就位，不重放浮现动画（避免闪烁感）。
      this.revealInstant = false;
      this.renderRoot.querySelectorAll('[data-reveal]').forEach((element) => {
        (element as HTMLElement).style.transitionDelay = '0ms';
        element.classList.add('in');
      });
      return;
    }
    if (this.reducedMotion || !('IntersectionObserver' in window)) return;
    if (!this.revealObserver) {
      this.classList.add('reveal-ready');
      this.revealObserver = new IntersectionObserver(
        (entries) => {
          entries
            .filter((entry) => entry.isIntersecting)
            .forEach((entry, index) => {
              const element = entry.target as HTMLElement;
              element.style.transitionDelay = `${index * 80}ms`;
              element.classList.add('in');
              this.revealObserver?.unobserve(element);
            });
        },
        { threshold: 0.1, rootMargin: '0px 0px -5% 0px' },
      );
    }
    this.renderRoot
      .querySelectorAll('[data-reveal]:not(.in)')
      .forEach((element) => this.revealObserver?.observe(element));
  }

  protected updated() {
    if (this.studio && !this.previewOnly) this.syncStudioPreview();
    this.observeReveals();
    this.scanToc();
  }

  // 目录：从已渲染的正文里扫描 h2/h3，注入锚点 id，并用 IO 做滚动高亮。
  private scanToc() {
    const path = window.location.pathname;
    if (path === this.tocPath) return;
    this.tocPath = path;
    const prose = this.renderRoot.querySelector('.prose');
    const items = prose
      ? [...prose.querySelectorAll('h2, h3')].map((heading, index) => {
          if (!heading.id) heading.id = `h-${index + 1}`;
          return {
            id: heading.id,
            text: heading.textContent ?? '',
            level: heading.tagName === 'H2' ? 2 : 3,
          };
        })
      : [];
    this.tocItems = items;
    this.tocActive = items[0]?.id ?? '';
    this.tocObserver?.disconnect();
    this.tocObserver = null;
    if (items.length === 0) return;
    this.tocObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.tocActive = entry.target.id;
            this.requestUpdate();
          }
        });
      },
      { rootMargin: '-96px 0px -65% 0px', threshold: 0 },
    );
    items.forEach((item) => {
      const heading = this.renderRoot.querySelector(`#${CSS.escape(item.id)}`);
      if (heading) this.tocObserver?.observe(heading);
    });
    this.requestUpdate();
  }

  // 评论头像兜底：按昵称哈希选一个夜航配色的小插画（星星 / 月夜 / 海浪）。
  private avatarFallback(name: string) {
    let hash = 0;
    for (const ch of name) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) % 997;
    switch (hash % 3) {
      case 0:
        return html`<svg viewBox="0 0 36 36" aria-hidden="true"><defs><linearGradient id="av-g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7eb6d9" /><stop offset="1" stop-color="#e8a4b4" /></linearGradient></defs><rect width="36" height="36" rx="12" fill="url(#av-g1)" /><path d="M18 8l2.4 7.6L28 18l-7.6 2.4L18 28l-2.4-7.6L8 18l7.6-2.4z" fill="#f7f8f7" /></svg>`;
      case 1:
        return html`<svg viewBox="0 0 36 36" aria-hidden="true"><rect width="36" height="36" rx="18" fill="#1c2733" /><path d="M23.5 9.5a8.5 8.5 0 1 0 4.2 16.2A10 10 0 0 1 23.5 9.5z" fill="#7eb6d9" /><circle cx="13" cy="13" r="1.6" fill="#e8a4b4" /></svg>`;
      default:
        return html`<svg viewBox="0 0 36 36" aria-hidden="true"><rect width="36" height="36" rx="18" fill="#e8a4b4" /><circle cx="24.5" cy="11.5" r="3.5" fill="#f7f8f7" /><path d="M5 24c3-2.6 6-2.6 9 0s6 2.6 9 0 5 2.2 8 .6V31H5z" fill="#f7f8f7" /></svg>`;
    }
  }

  // 头像优先级：website 的 favicon → 兜底插画。公开评论接口另下发合并后的
  // avatar_url（favicon 优先，其次 email 的 Gravatar），接入真实数据时优先使用它。
  private commentAvatar(name: string, site?: string) {
    if (!site) return html`<span class="comment-avatar">${this.avatarFallback(name)}</span>`;
    const host = site.replace(/^https?:\/\//, '').split('/')[0];
    return html`<span class="comment-avatar has-img">
      <img
        src="https://${host}/favicon.ico"
        alt=""
        loading="lazy"
        @error=${(event: Event) => (event.currentTarget as HTMLElement).classList.add('is-broken')}
      />
      ${this.avatarFallback(name)}
    </span>`;
  }

  // 动态卡片（朋友圈形态）：头像+昵称+相对时间 → 正文 → 配图 → 点赞/评论 → 灰底内联评论区。
  private renderMoment(item: (typeof dynamics)[number], index: number) {
    const liked = this.likedDynamics.has(index);
    const comments = item.comments ?? [];
    const images = item.images ?? [];
    return html`
      <div class="moment" data-reveal>
        <div class="moment-card">
          <header class="moment-head">
            <span class="comment-avatar moment-avatar">${this.avatarFallback('恋')}</span>
            <div class="moment-who">
              <span class="moment-author">恋</span>
              <time title=${item.time}>${item.rel}</time>
            </div>
          </header>
          <p class="moment-text">${item.text}</p>
          ${images.length === 1
            ? html`<div class="m-media"><i class=${images[0]}></i></div>`
            : images.length > 1
              ? html`<div class="m-grid count-${images.length}">
                  ${images.map((cover) => html`<i class=${cover}></i>`)}
                </div>`
              : nothing}
          <div class="mfoot">
            <button
              class="heart-button${liked ? ' liked' : ''}"
              type="button"
              aria-pressed=${liked}
              aria-label=${liked ? '取消喜欢' : '喜欢'}
              @click=${() => {
                if (liked) this.likedDynamics.delete(index);
                else this.likedDynamics.add(index);
                this.requestUpdate();
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 20.3C7.2 16.9 3.5 13.6 3.5 9.9 3.5 7.2 5.6 5 8.3 5c1.5 0 2.9.7 3.7 1.9C12.8 5.7 14.2 5 15.7 5c2.7 0 4.8 2.2 4.8 4.9 0 3.7-3.7 7-8.5 10.4Z"
                />
              </svg>
              ${item.likes + (liked ? 1 : 0)}
            </button>
            <span class="m-count">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 12a8 8 0 0 1-8 8H4l2.3-2.9A8 8 0 1 1 21 12Z" />
              </svg>
              ${comments.length}
            </span>
          </div>
          <div class="m-comments">
            ${comments.map((comment) => this.renderMomentComment(comment))}
            ${this.momentReplySent.has(index)
              ? html`<p class="m-reply-sent">评论已寄出，审核通过后会显示在这里。</p>`
              : html`
                  <form class="m-reply" @submit=${(event: SubmitEvent) => this.submitMomentReply(event, index)}>
                    <input
                      name="content"
                      type="text"
                      maxlength="5000"
                      placeholder="说点什么…"
                      aria-label="评论这条动态"
                      autocomplete="off"
                      required
                      @focus=${() => {
                        if (!this.momentReplyOpen.has(index)) {
                          this.momentReplyOpen.add(index);
                          this.requestUpdate();
                        }
                      }}
                    />
                    <button type="submit">发送</button>
                    ${this.momentReplyOpen.has(index)
                      ? html`
                          <div class="m-reply-more">
                            <input
                              name="display_name"
                              type="text"
                              maxlength="80"
                              placeholder="昵称（必填）"
                              aria-label="昵称"
                              autocomplete="nickname"
                              required
                            />
                            <input
                              name="email"
                              type="email"
                              maxlength="254"
                              placeholder="邮箱（选填，会公开）"
                              aria-label="邮箱"
                              autocomplete="email"
                            />
                            <input
                              name="website"
                              type="url"
                              maxlength="2048"
                              placeholder="网站（选填）"
                              aria-label="网站"
                              autocomplete="url"
                            />
                          </div>
                          <p class="m-reply-note">评论会在审核后显示；昵称和邮箱会公开展示。</p>
                        `
                      : nothing}
                  </form>
                `}
          </div>
        </div>
      </div>
    `;
  }

  private renderMomentComment(comment: MomentComment): TemplateResult {
    return html`
      <div class="m-comment">
        ${this.commentAvatar(comment.name, comment.site)}
        <div class="m-comment-body">
          <div class="m-comment-line">
            ${comment.site
              ? html`<a
                  class="comment-name${comment.owner ? ' is-owner' : ''}"
                  href=${comment.site}
                  target="_blank"
                  rel="noopener noreferrer"
                  >${comment.name}</a
                >`
              : html`<span class="comment-name${comment.owner ? ' is-owner' : ''}"
                  >${comment.name}</span
                >`}
            ${comment.owner ? html`<span class="comment-badge">作者</span>` : nothing}
            <time>${comment.time}</time>
          </div>
          <p>${comment.text}</p>
          ${comment.agent ? html`<span class="m-comment-agent">${comment.agent}</span>` : nothing}
          ${comment.children?.length
            ? html`<div class="m-children">
                ${comment.children.map((child) => this.renderMomentComment(child))}
              </div>`
            : nothing}
        </div>
      </div>
    `;
  }

  loadPageLayout(page: PageLayoutDocument) {
    this.studioStore.reset({ ...this.layout, ...structuredClone(page) });
    this.studio = true;
    this.requestUpdate();
  }

  setMediaLibrary(media: StudioMedia[]) {
    this.mediaLibrary = media.filter((item) => item.mediaType.startsWith('image/'));
    this.requestUpdate();
  }

  /** 管理端上传完成后回写：收入媒体库并设为当前选中节点的背景图。 */
  applyUploadedMedia(media: StudioMedia) {
    if (!media.mediaType.startsWith('image/')) return;
    this.mediaLibrary = [...this.mediaLibrary.filter((item) => item.id !== media.id), media];
    const selected = indexLayout(this.layout.root).get(this.selectedNodeId)?.node;
    if (
      selected &&
      componentRegistry[selected.type]?.properties.backgroundMediaId?.kind === 'media-image'
    ) {
      this.setSelectedProperty('backgroundMediaId', media.id);
    } else {
      this.requestUpdate();
    }
  }

  private requestMediaUpload(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.dispatchEvent(
      new CustomEvent('yuki-media-upload', { detail: { file }, bubbles: true, composed: true }),
    );
  }

  setSiteData(siteData: PublicSiteData) {
    this.siteData = structuredClone(siteData);
    this.requestUpdate();
  }

  exportPageLayout(): PageLayoutDocument {
    return structuredClone(toPageLayout(this.layout));
  }

  private syncStudioPreview() {
    const frame = this.renderRoot.querySelector<HTMLIFrameElement>('.studio-preview');
    frame?.contentWindow?.postMessage(
      {
        source: 'yukilog-studio',
        type: 'render-layout',
        layout: this.layout,
        selectedNodeId: this.selectedNodeId,
        mediaLibrary: this.mediaLibrary,
        siteData: this.siteData,
      },
      window.location.origin,
    );
  }

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      min-height: 100dvh;
      color: var(--ink);
      background: var(--page);
      font-family:
        'Noto Sans CJK SC', 'Noto Sans CJK HK', 'PingFang SC', 'Microsoft YaHei', system-ui,
        sans-serif;
      --serif: 'LXGW WenKai GB', 'Noto Serif SC', 'Songti SC', Georgia, serif;
      --mono: ui-monospace, 'SFMono-Regular', Consolas, monospace;
      scroll-behavior: smooth;
    }

    button,
    input {
      font: inherit;
    }

    button {
      cursor: pointer;
    }

    a {
      color: inherit;
      text-decoration: none;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .caps {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.26em;
      text-transform: uppercase;
    }

    .lab-bar {
      position: fixed;
      z-index: 200;
      bottom: 14px;
      left: 14px;
      display: var(--studio-lab-display, flex);
      width: auto;
      max-width: calc(100% - 28px);
      align-items: center;
      gap: 6px;
      padding: 7px;
      transform: none;
      border: 1px solid rgb(255 255 255 / 15%);
      border-radius: 20px;
      background: rgb(12 17 25 / 82%);
      box-shadow: 0 16px 48px rgb(0 0 0 / 28%);
      color: #e9edf5;
      backdrop-filter: blur(18px);
    }

    .lab-title {
      padding: 0 10px;
      color: #909bad;
      font-size: 12px;
      white-space: nowrap;
    }

    .lab-bar button {
      min-height: 34px;
      padding: 6px 11px;
      border: 0;
      border-radius: 11px;
      background: transparent;
      color: #c5ccda;
      font-size: 13px;
    }

    .lab-bar button[aria-pressed='true'] {
      background: #f5f7fb;
      color: #171c25;
      box-shadow: 0 5px 18px rgb(0 0 0 / 18%);
    }

    .lab-spacer {
      flex: 1;
    }

    .mode-button {
      border: 1px solid rgb(255 255 255 / 14%) !important;
    }

    .site {
      --page: #f7f8f7;
      --surface: #ffffff;
      --surface-soft: #eef2f5;
      --ink: #1c2733;
      --muted: #6d7f90;
      --faint: #a7b5c2;
      --line: #dde5ec;
      --primary: #7eb6d9;
      --primary-d: #4a93c2;
      --secondary: #e8a4b4;
      --secondary-d: #d57f95;
      --radius: 14px;
      min-height: 100dvh;
      background: var(--page);
      color: var(--ink);
      overflow: clip;
    }

    .site-nav {
      z-index: 50;
    }

    /* 首屏角落导航：品牌 + 文字链接，随首屏离场 */
    .nav-corners {
      position: fixed;
      z-index: 51;
      top: 0;
      right: 0;
      left: 0;
      display: grid;
      height: 84px;
      align-items: center;
      grid-template-columns: 1fr auto 1fr;
      padding: 0 52px;
      color: rgb(238 243 248 / 92%);
      text-shadow: 0 2px 12px rgb(0 0 0 / 28%);
      pointer-events: none;
      transition:
        opacity 380ms ease,
        translate 380ms cubic-bezier(0.22, 0.61, 0.36, 1),
        visibility 380ms;
    }

    .nav-corners.hidden {
      opacity: 0;
      visibility: hidden;
      translate: 0 -10px;
    }

    .nav-corners > * {
      pointer-events: auto;
    }

    .nav-corners.hidden > * {
      pointer-events: none;
    }

    .brand {
      flex-shrink: 0;
      color: inherit;
      font-size: 20px;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-decoration: none;
      white-space: nowrap;
    }

    .nav-corners .brand {
      justify-self: start;
      font-size: 20px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .nav-links {
      display: flex;
      min-width: 0;
      align-items: center;
      flex-wrap: nowrap;
      gap: 4px;
    }

    .nav-corners .nav-links {
      justify-self: center;
      gap: 26px;
    }

    .nav-corners .nav-actions {
      justify-self: end;
    }

    .nav-corners .nav-item {
      padding: 4px 0;
      color: rgb(238 243 248 / 80%);
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.18em;
      transition: color 250ms ease;
    }

    .nav-corners .nav-item:hover {
      color: #fff;
    }

    .nav-corners .nav-icon {
      display: none;
    }

    /* 胶囊悬浮导航：滚过首屏后淡入 */
    .nav-topbar {
      position: fixed;
      top: 14px;
      left: 50%;
      display: flex;
      width: auto;
      align-items: center;
      gap: 2px;
      padding: 6px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgb(255 255 255 / 92%);
      box-shadow: 0 8px 28px rgb(28 39 51 / 10%);
      color: var(--ink);
      opacity: 0;
      visibility: hidden;
      translate: -50% -12px;
      backdrop-filter: blur(12px);
      transition:
        opacity 380ms ease,
        translate 380ms cubic-bezier(0.22, 0.61, 0.36, 1),
        visibility 380ms;
    }

    .nav-topbar.nav-sticky {
      opacity: 1;
      visibility: visible;
      translate: -50% 0;
    }

    .nav-topbar .brand {
      display: none;
    }

    .nav-topbar .nav-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 18px;
      border-radius: 999px;
      color: var(--muted);
      font-size: 13.5px;
      font-weight: 500;
      white-space: nowrap;
      transition:
        color 250ms ease,
        background 250ms ease;
    }

    .nav-topbar .nav-item:hover {
      color: var(--ink);
    }

    .nav-topbar .nav-item.active {
      background: var(--ink);
      color: #fff;
    }

    .nav-topbar .nav-icon {
      display: none;
    }

    /* 悬浮顶栏：搜索用文字，与旁边条目保持一致；首屏角落仍用图标 */
    .nav-search .search-text {
      display: none;
    }

    .nav-topbar .nav-search {
      display: flex;
      width: auto;
      height: auto;
      padding: 8px 18px;
      border-radius: 999px;
      color: var(--muted);
      font-size: 13.5px;
      font-weight: 500;
      place-items: center;
    }

    .nav-topbar .nav-search:hover {
      background: transparent;
      color: var(--ink);
    }

    .nav-topbar .nav-search.active {
      background: var(--ink);
      color: #fff;
    }

    .nav-topbar .nav-search .search-icon {
      display: none;
    }

    .nav-topbar .nav-search .search-text {
      display: inline;
      line-height: 1;
      white-space: nowrap;
    }

    .nav-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .nav-corners .nav-action:hover {
      background: rgb(255 255 255 / 14%);
      color: #fff;
    }

    .nav-inner-actions {
      display: flex;
    }

    .nav-action {
      display: grid;
      width: 32px;
      height: 32px;
      padding: 6px;
      place-items: center;
      border: 0;
      border-radius: 16px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      text-decoration: none;
      transition:
        color 200ms ease,
        background 200ms ease;
    }

    .nav-action:hover {
      background: var(--surface-soft);
      color: var(--primary-d);
    }

    .nav-icon {
      display: flex;
      width: 20px;
      height: 20px;
      flex: 0 0 20px;
      align-items: center;
      justify-content: center;
    }

    .nav-icon svg,
    .nav-action svg,
    .enter-button svg {
      width: 100%;
      height: 100%;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .social-icon svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
      stroke: none;
    }

    .nav-label {
      line-height: 1;
    }

    .nav-hamburger {
      display: none;
    }

    .mobile-menu-overlay {
      position: fixed;
      z-index: 220;
      inset: 0;
      display: flex;
      align-items: flex-end;
      background: rgb(0 0 0 / 45%);
      backdrop-filter: blur(6px);
    }

    .mobile-menu {
      width: 100%;
      padding: 24px 32px calc(48px + env(safe-area-inset-bottom));
      border-radius: 28px 28px 0 0;
      background: var(--surface);
      color: var(--ink);
      box-shadow: 0 -8px 32px rgb(0 0 0 / 16%);
      animation: mobile-menu-up 280ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
    }

    @keyframes mobile-menu-up {
      from {
        transform: translateY(48px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .mobile-menu-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--line);
      font-size: 20px;
    }

    .mobile-menu-nav {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .mobile-nav-item {
      display: flex;
      min-height: 88px;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 8px;
      border: 1px solid var(--line);
      border-radius: 20px;
      background: var(--page);
      color: var(--ink);
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
    }

    .mobile-menu-nav .nav-icon {
      display: flex;
    }

    .mobile-nav-item:hover {
      border-color: var(--primary);
      background: var(--surface);
      color: var(--primary-d);
    }

    .mobile-nav-item.active {
      border-color: var(--secondary);
      background: var(--surface);
      color: var(--secondary-d);
    }

    .nav-sidebar {
      position: fixed;
      top: 0;
      bottom: 0;
      left: 0;
      display: flex;
      width: 238px;
      flex-direction: column;
      padding: 100px 30px 36px;
      border-right: 1px solid var(--line);
      background: color-mix(in srgb, var(--surface) 94%, transparent);
    }

    .nav-sidebar .nav-links {
      align-items: stretch;
      flex-direction: column;
      margin-top: 48px;
    }

    .nav-sidebar .nav-links a {
      padding: 8px 4px;
      border-radius: 4px;
      transition:
        padding 180ms ease,
        color 180ms ease;
    }

    .nav-sidebar .nav-links a:hover {
      padding-left: 18px;
      color: var(--secondary-d);
    }

    .nav-sidebar .nav-foot {
      margin-top: auto;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.7;
    }

    .shell-sidebar .page-root {
      margin-left: 238px;
    }

    .nav-dock {
      position: fixed;
      bottom: 22px;
      left: 50%;
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 8px 10px;
      transform: translateX(-50%);
      border: 1px solid var(--line);
      border-radius: 18px;
      background: rgb(23 29 39 / 82%);
      color: #eff3f8;
      box-shadow: 0 18px 50px rgb(0 0 0 / 34%);
      backdrop-filter: blur(18px);
      transition: transform 200ms ease;
    }

    .nav-dock .brand {
      padding: 0 12px;
      color: var(--primary);
    }

    .nav-dock .nav-links a {
      display: grid;
      width: 40px;
      height: 40px;
      place-items: center;
      padding: 8px;
      font-size: 0;
      transition:
        background 160ms ease,
        transform 160ms ease;
    }

    .nav-dock .nav-links a::first-letter {
      font-size: 14px;
    }

    .nav-dock .nav-links a:hover {
      background: var(--surface-soft);
      transform: translateY(-5px);
    }

    .page-root {
      min-height: 100dvh;
    }

    /* 滚动浮现：JS 给 host 加 .reveal-ready 后才启用 */
    :host(.reveal-ready) [data-reveal] {
      opacity: 0;
      translate: 0 26px;
      transition:
        opacity 700ms cubic-bezier(0.22, 0.61, 0.36, 1),
        translate 700ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    :host(.reveal-ready) [data-reveal].in {
      opacity: 1;
      translate: 0 0;
    }

    /* ---------- 内页 ---------- */
    .inner-page {
      width: min(1180px, calc(100% - 64px));
      min-height: 100dvh;
      margin: 0 auto;
      padding: 128px 0 96px;
      background: transparent;
      animation: page-in 420ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
    }

    @keyframes page-in {
      from {
        opacity: 0;
        translate: 0 16px;
      }
      to {
        opacity: 1;
        translate: 0 0;
      }
    }

    .page-head {
      margin-bottom: 52px;
      padding-bottom: 36px;
      border-bottom: 1px solid var(--line);
    }

    .page-head.center {
      text-align: center;
    }

    .page-head .kicker {
      margin: 0 0 16px;
      color: var(--secondary-d);
    }

    .page-head h1 {
      margin: 0;
      font-family: var(--serif);
      font-size: clamp(40px, 5vw, 58px);
      font-weight: 700;
      line-height: 1.15;
    }

    .page-head .inner-lede {
      max-width: 560px;
      margin: 12px 0 0;
      color: var(--muted);
      font-size: 15px;
      line-height: 1.8;
    }

    .page-head.center .inner-lede {
      margin-inline: auto;
    }

    /* 文章归档 */
    .archive-year {
      margin-bottom: 44px;
    }

    .archive-year > h2 {
      display: flex;
      align-items: baseline;
      gap: 14px;
      margin: 0 0 6px;
      color: var(--faint);
      font-family: var(--serif);
      font-size: 26px;
    }

    .archive-year > h2 span {
      color: var(--faint);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.2em;
    }

    .archive-row {
      display: grid;
      grid-template-columns: 104px minmax(0, 1fr) auto;
      gap: 22px;
      align-items: baseline;
      padding: 19px 4px;
      border-bottom: 1px solid var(--line);
      color: inherit;
      text-decoration: none;
      transition: translate 300ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    .archive-row:hover {
      translate: 8px 0;
    }

    .archive-row time {
      color: var(--faint);
      font-family: var(--mono);
      font-size: 12px;
    }

    .archive-row h3 {
      margin: 0;
      font-family: var(--serif);
      font-size: 19.5px;
      font-weight: 700;
      line-height: 1.5;
    }

    .archive-row h3 span {
      background-image: linear-gradient(currentColor, currentColor);
      background-repeat: no-repeat;
      background-size: 0 1.5px;
      background-position: 0 97%;
      transition: background-size 400ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    .archive-row:hover h3 span {
      background-size: 100% 1.5px;
    }

    .archive-row .meta {
      display: flex;
      gap: 14px;
      color: var(--faint);
      font-size: 12px;
    }

    .archive-row .cat {
      font-weight: 600;
    }

    .cat-b {
      color: var(--primary-d);
    }

    .cat-p {
      color: var(--secondary-d);
    }

    /* 动态时间线 */
    .timeline {
      position: relative;
      max-width: 720px;
      margin: 0 auto;
    }

    .timeline::before {
      position: absolute;
      top: 8px;
      bottom: 0;
      left: 6px;
      width: 1px;
      content: '';
      background: var(--line);
    }

    .moment {
      position: relative;
      padding: 0 0 48px 34px;
    }

    .moment::before {
      position: absolute;
      top: 9px;
      left: 2px;
      width: 9px;
      height: 9px;
      border-radius: 50%;
      content: '';
      background: var(--primary);
      transition:
        background 300ms ease,
        scale 300ms ease;
    }

    .moment:hover::before {
      background: var(--secondary);
      scale: 1.4;
    }

    .moment time {
      color: var(--faint);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.16em;
    }

    .moment p {
      margin: 8px 0 0;
      font-size: 15.5px;
      line-height: 1.95;
    }

    .m-media {
      max-width: 420px;
      margin-top: 14px;
      overflow: hidden;
      border-radius: 12px;
    }

    .m-media i {
      display: block;
      aspect-ratio: 16 / 10;
      background: var(--cover) center / cover no-repeat;
      transition: scale 550ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    .m-media.portrait {
      width: min(300px, 80%);
    }

    .m-media.portrait i {
      aspect-ratio: 3 / 4;
    }

    .moment:hover .m-media i {
      scale: 1.04;
    }

    .mfoot {
      margin-top: 10px;
      color: var(--faint);
      font-size: 12px;
    }

    /* ---------- 动态卡片（朋友圈形态） ---------- */
    .moment-card {
      padding: 20px 22px 14px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: var(--surface);
      transition:
        border-color 300ms ease,
        box-shadow 300ms ease;
    }

    .moment:hover .moment-card {
      border-color: color-mix(in srgb, var(--primary) 40%, var(--line));
      box-shadow: 0 14px 34px -18px rgb(74 147 194 / 30%);
    }

    .moment-head {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .moment-avatar {
      width: 40px;
      height: 40px;
    }

    .moment-who {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .moment-author {
      color: var(--ink);
      font-size: 15px;
      font-weight: 700;
    }

    .moment-who time {
      cursor: help;
    }

    .moment-text {
      font-size: 15px;
      line-height: 1.9;
    }

    .m-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-top: 12px;
      max-width: 420px;
    }

    .m-grid.count-2,
    .m-grid.count-4 {
      grid-template-columns: repeat(2, 1fr);
      max-width: 300px;
    }

    .m-grid i {
      display: block;
      aspect-ratio: 1;
      border-radius: 8px;
      background: var(--cover) center / cover no-repeat;
      transition: scale 420ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    .m-grid i:hover {
      scale: 1.04;
    }

    .m-count {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--faint);
      font-size: 12px;
    }

    .m-count svg {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
    }

    .m-comments {
      margin-top: 14px;
      padding: 12px 14px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--ink) 4%, var(--page));
    }

    .m-comment {
      display: flex;
      gap: 10px;
      padding: 8px 0;
    }

    .m-comment .comment-avatar {
      width: 26px;
      height: 26px;
    }

    .m-comment-body {
      min-width: 0;
      flex: 1;
    }

    .m-comment-line {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 8px;
    }

    .m-comment-line .comment-name {
      font-size: 13px;
    }

    .m-comment p {
      margin: 3px 0 0;
      font-size: 13.5px;
      line-height: 1.75;
    }

    .m-comment-agent {
      display: block;
      margin-top: 3px;
      color: var(--faint);
      font-family: var(--mono);
      font-size: 10.5px;
    }

    .m-children {
      margin-top: 8px;
      padding: 2px 0 2px 12px;
      border-left: 2px solid var(--line);
    }

    .m-reply {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }

    .m-reply > input[name='content'] {
      flex: 1;
    }

    .m-reply-more {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      flex-basis: 100%;
      order: 3;
    }

    .m-reply-more input {
      width: 100%;
    }

    .m-reply-note {
      flex-basis: 100%;
      order: 4;
      margin: 2px 0 0;
      color: var(--faint);
      font-size: 12px;
    }

    .m-reply-sent {
      margin: 10px 0 0;
      color: var(--faint);
      font-size: 12.5px;
    }

    .m-reply input {
      box-sizing: border-box;
      min-width: 0;
      padding: 8px 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--surface);
      color: var(--ink);
      font-family: inherit;
      font-size: 13px;
      transition:
        border-color 250ms ease,
        box-shadow 250ms ease;
    }

    .m-reply input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent);
    }

    .m-reply button {
      flex: none;
      padding: 0 16px;
      border: 0;
      border-radius: 999px;
      background: var(--ink);
      color: var(--page);
      font-size: 12.5px;
      cursor: pointer;
      transition: background 250ms ease;
    }

    .m-reply button:hover {
      background: var(--primary-d);
    }

    /* 友链 */
    .friends-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 26px;
    }

    .friend {
      display: flex;
      align-items: flex-start;
      gap: 20px;
      padding: 26px 28px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: var(--surface);
      color: inherit;
      text-decoration: none;
      transition:
        translate 350ms cubic-bezier(0.22, 0.61, 0.36, 1),
        box-shadow 350ms ease,
        border-color 350ms ease;
    }

    .friend:hover {
      translate: 0 -6px;
      border-color: transparent;
    }

    .friend:nth-child(odd):hover {
      box-shadow: 0 20px 40px -14px rgb(74 147 194 / 35%);
    }

    .friend:nth-child(even):hover {
      box-shadow: 0 20px 40px -14px rgb(213 127 149 / 35%);
    }

    .friend-avatar {
      display: grid;
      width: 54px;
      height: 54px;
      flex: 0 0 54px;
      place-items: center;
      border-radius: 50%;
      background: var(--cover);
      color: #fff;
      font-family: var(--serif);
      font-size: 21px;
    }

    .friend h3 {
      margin: 0;
      font-family: var(--serif);
      font-size: 19px;
    }

    .friend .furl {
      display: block;
      margin: 2px 0 8px;
      color: var(--primary-d);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.08em;
    }

    .friend p {
      margin: 0;
      color: var(--muted);
      font-size: 13.5px;
      line-height: 1.8;
    }

    .friend .fsince {
      display: block;
      margin-top: 10px;
      color: var(--faint);
      font-size: 11px;
      letter-spacing: 0.2em;
    }

    /* 搜索 */
    .search-box {
      display: flex;
      width: min(680px, 90%);
      align-items: center;
      gap: 12px;
      margin: 0 auto;
      padding: 6px 8px 6px 26px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--surface);
      transition:
        border-color 300ms ease,
        box-shadow 300ms ease;
    }

    .search-box:focus-within {
      border-color: var(--primary);
      box-shadow: 0 12px 32px -12px rgb(74 147 194 / 40%);
    }

    .search-box input {
      min-width: 0;
      flex: 1;
      padding: 12px 0;
      border: 0;
      outline: 0;
      background: none;
      color: var(--ink);
      font-family: var(--serif);
      font-size: 17px;
    }

    .search-box input::placeholder {
      color: var(--faint);
    }

    .search-box button {
      padding: 11px 22px;
      border: 0;
      border-radius: 999px;
      background: var(--ink);
      color: #fff;
      font-size: 13px;
      letter-spacing: 0.1em;
      transition: background 250ms ease;
    }

    .search-box button:hover {
      background: var(--primary-d);
    }

    .search-hint {
      margin: 12px 0 0;
      color: var(--faint);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.14em;
      text-align: center;
    }

    .hot-tags {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 30px;
    }

    .hot-tags a,
    .filter-chip {
      padding: 6px 15px;
      border: 1px solid var(--line);
      border-radius: 999px;
      color: var(--muted);
      font-size: 12.5px;
      text-decoration: none;
      transition:
        color 250ms ease,
        border-color 250ms ease;
    }

    .hot-tags a:hover {
      border-color: var(--secondary);
      color: var(--secondary-d);
    }

    .filter-bar {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 10px;
      margin: 26px 0 0;
    }

    .filter-chip:hover {
      border-color: var(--primary);
      color: var(--primary-d);
    }

    .filter-chip.on {
      border-color: var(--ink);
      background: var(--ink);
      color: #fff;
    }

    .results {
      max-width: 760px;
      margin: 52px auto 0;
    }

    .results .cap {
      margin: 0 0 8px;
      color: var(--faint);
      font-size: 12px;
      letter-spacing: 0.18em;
    }

    .result {
      display: block;
      padding: 22px 4px;
      border-bottom: 1px solid var(--line);
      color: inherit;
      text-decoration: none;
      transition: translate 300ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    .result:hover {
      translate: 6px 0;
    }

    .result .meta {
      display: flex;
      gap: 12px;
      margin-bottom: 6px;
      color: var(--faint);
      font-size: 12px;
    }

    .result .meta .cat {
      color: var(--primary-d);
      font-weight: 600;
    }

    .result h3 {
      margin: 0;
      font-family: var(--serif);
      font-size: 20px;
      font-weight: 700;
    }

    .result p {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.85;
    }

    .result mark {
      padding: 0 2px;
      border-radius: 2px;
      background: rgb(232 164 180 / 40%);
      color: inherit;
    }

    /* 文章详情页 */
    .article-page {
      position: relative;
      width: min(720px, 100%);
      margin: 0 auto;
    }

    .post-back {
      display: inline-block;
      margin-bottom: 40px;
      color: var(--muted);
      font-size: 13px;
      transition: color 250ms ease;
    }

    .post-back:hover {
      color: var(--primary-d);
    }

    .post-head {
      margin-bottom: 40px;
    }

    .post-head .component-kicker {
      margin: 0 0 14px;
    }

    .article-page h1 {
      margin: 0 0 16px;
      font-family: var(--serif);
      font-size: clamp(30px, 4.4vw, 42px);
      font-weight: 700;
      line-height: 1.35;
    }

    .post-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 0;
      color: var(--faint);
      font-family: var(--mono);
      font-size: 12px;
      letter-spacing: 0.06em;
    }

    .post-cover {
      width: 100%;
      margin: 0 0 48px;
      border-radius: 14px;
      background: var(--cover) center / cover no-repeat;
      aspect-ratio: 16 / 10;
    }

    .post-cover.is-portrait {
      width: min(400px, 100%);
      margin-inline: auto;
      aspect-ratio: 3 / 4;
    }

    /* 正文排版（SSR 的 Markdown 输出共用这套） */
    .article-page .prose {
      font-size: 16.5px;
      line-height: 2;
    }

    .prose p {
      margin: 0 0 1.5em;
    }

    .prose h2 {
      margin: 2.3em 0 1em;
      padding-bottom: 12px;
      background: linear-gradient(var(--primary), var(--primary)) left bottom / 30px 2px no-repeat;
      font-family: var(--serif);
      font-size: 25px;
      font-weight: 700;
      line-height: 1.5;
    }

    .prose h3 {
      margin: 2em 0 0.8em;
      font-family: var(--serif);
      font-size: 20px;
      font-weight: 700;
      line-height: 1.55;
    }

    .prose a {
      color: var(--primary-d);
      text-decoration: underline;
      text-decoration-color: color-mix(in srgb, var(--primary) 45%, transparent);
      text-underline-offset: 3px;
      transition: text-decoration-color 250ms ease;
    }

    .prose a:hover {
      text-decoration-color: var(--primary-d);
    }

    .prose blockquote {
      margin: 2em 0;
      padding: 2px 0 2px 20px;
      border-left: 2px solid var(--primary);
      color: var(--muted);
      font-family: var(--serif);
      font-size: 17px;
    }

    .prose blockquote p {
      margin: 0 0 0.8em;
    }

    .prose blockquote p:last-child {
      margin-bottom: 0;
    }

    .prose code {
      padding: 2px 7px;
      border-radius: 6px;
      background: color-mix(in srgb, var(--primary) 14%, transparent);
      font-family: var(--mono);
      font-size: 0.86em;
    }

    .prose pre {
      margin: 2em 0;
      padding: 20px 22px;
      overflow-x: auto;
      border-radius: 14px;
      background: var(--ink);
      color: #dde5ec;
      font-size: 13.5px;
      line-height: 1.8;
    }

    .prose pre code {
      padding: 0;
      background: none;
      font-size: inherit;
    }

    .prose ul,
    .prose ol {
      margin: 0 0 1.5em;
      padding-left: 1.5em;
    }

    .prose li {
      margin: 0.45em 0;
    }

    .prose li::marker {
      color: var(--primary-d);
    }

    .prose hr {
      margin: 3em 0;
      border: 0;
      border-top: 1px solid var(--line);
    }

    .prose img {
      border-radius: 14px;
    }

    /* 文末 */
    .post-end {
      display: flex;
      align-items: center;
      gap: 18px;
      margin: 60px 0 0;
      color: var(--faint);
      font-family: var(--serif);
      font-size: 14px;
      letter-spacing: 0.5em;
    }

    .post-end::before,
    .post-end::after {
      content: '';
      flex: 1;
      border-top: 1px solid var(--line);
    }

    .post-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
      margin-top: 36px;
    }

    .post-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .post-tag {
      padding: 5px 14px;
      border: 1px solid var(--line);
      border-radius: 999px;
      color: var(--muted);
      font-size: 12.5px;
      transition:
        color 250ms ease,
        border-color 250ms ease;
    }

    .post-tag:hover {
      border-color: var(--primary);
      color: var(--primary-d);
    }

    .post-like {
      padding: 7px 16px;
      font-size: 13px;
    }

    .post-like svg {
      width: 15px;
      height: 15px;
    }

    .post-nav {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 68px;
      padding-top: 30px;
      border-top: 1px solid var(--line);
    }

    .post-nav-item {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .post-nav-item.older {
      align-items: flex-end;
      text-align: right;
    }

    .post-nav-kicker {
      color: var(--faint);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.14em;
      transition: color 250ms ease;
    }

    .post-nav-title {
      font-family: var(--serif);
      font-size: 16.5px;
      font-weight: 700;
      line-height: 1.55;
      transition: color 250ms ease;
    }

    .post-nav-item:hover .post-nav-kicker,
    .post-nav-item:hover .post-nav-title {
      color: var(--primary-d);
    }

    /* 评论区 */
    .comments {
      margin-top: 76px;
    }

    .comments-head {
      display: flex;
      align-items: baseline;
      gap: 12px;
      padding-bottom: 18px;
      border-bottom: 1px solid var(--line);
    }

    .comments-head h2 {
      margin: 0;
      font-family: var(--serif);
      font-size: 24px;
      font-weight: 700;
    }

    .comments-count {
      color: var(--faint);
      font-family: var(--mono);
      font-size: 12px;
    }

    .comment-list,
    .comment-children {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .comment {
      padding: 22px 0;
      border-bottom: 1px dashed var(--line);
    }

    .comment-list > .comment:last-child {
      border-bottom: 0;
    }

    .comment-children {
      margin-top: 18px;
      padding-left: 20px;
      border-left: 2px solid var(--line);
    }

    .comment-children .comment {
      padding-bottom: 0;
      border-bottom: 0;
    }

    .comment header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .comment-who {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }

    .comment-line {
      display: flex;
      align-items: baseline;
      gap: 10px;
    }

    .comment-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      color: var(--faint);
      font-family: var(--mono);
      font-size: 11px;
    }

    .comment-site {
      color: var(--primary-d);
      transition: text-decoration-color 250ms ease;
    }

    .comment-site:hover {
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    .comment-name {
      color: var(--ink);
      font-size: 14px;
      font-weight: 700;
    }

    a.comment-name {
      transition: color 250ms ease;
    }

    a.comment-name:hover {
      color: var(--primary-d);
    }

    .comment-name.is-owner {
      color: var(--primary-d);
    }

    .comment-badge {
      padding: 1px 8px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--primary) 16%, transparent);
      color: var(--primary-d);
      font-size: 10.5px;
    }

    .comment time {
      color: var(--faint);
      font-family: var(--mono);
      font-size: 11px;
    }

    .comment p {
      margin: 0;
      font-size: 14.5px;
      line-height: 1.9;
    }

    .comment-form {
      margin-top: 30px;
    }

    .comment-form-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin-bottom: 14px;
    }

    .comment-form label {
      display: flex;
      flex-direction: column;
      gap: 7px;
      color: var(--faint);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.12em;
    }

    .comment-form input,
    .comment-form textarea {
      box-sizing: border-box;
      width: 100%;
      padding: 10px 14px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: transparent;
      color: var(--ink);
      font-family: inherit;
      font-size: 14px;
      transition:
        border-color 250ms ease,
        box-shadow 250ms ease;
    }

    .comment-form input:focus,
    .comment-form textarea:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent);
    }

    .comment-content {
      margin-bottom: 16px;
    }

    .comment-form textarea {
      min-height: 110px;
      resize: vertical;
      line-height: 1.8;
    }

    .comment-form-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .comment-note {
      margin: 0;
      color: var(--faint);
      font-size: 12px;
    }

    .comment-form button {
      padding: 10px 26px;
      border: 0;
      border-radius: 999px;
      background: var(--ink);
      color: var(--page);
      font-size: 13.5px;
      letter-spacing: 0.08em;
      cursor: pointer;
      transition:
        background 250ms ease,
        transform 250ms ease;
    }

    .comment-form button:hover {
      background: var(--primary-d);
      transform: translateY(-1px);
    }

    /* 摘要（详情页 meta 之下、封面之上） */
    .post-summary {
      margin: 20px 0 0;
      color: var(--muted);
      font-size: 16.5px;
      line-height: 1.9;
    }

    /* 目录：宽屏左侧 sticky 栏，窄屏正文上方折叠 */
    .post-toc {
      position: absolute;
      top: 0;
      right: calc(100% + 44px);
      width: 188px;
      height: 100%;
    }

    .post-toc-sticky {
      position: sticky;
      top: 116px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-left: 14px;
      border-left: 1px solid var(--line);
    }

    .post-toc-kicker {
      margin: 0 0 10px;
      color: var(--faint);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.18em;
    }

    .post-toc-item {
      position: relative;
      padding: 5px 0;
      color: var(--faint);
      font-size: 12.5px;
      line-height: 1.6;
      transition: color 250ms ease;
    }

    .post-toc-item.level-3 {
      padding-left: 14px;
      font-size: 12px;
    }

    .post-toc-item::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: -15px;
      width: 2px;
      background: var(--primary);
      opacity: 0;
      transition: opacity 250ms ease;
    }

    .post-toc-item:hover {
      color: var(--ink);
    }

    .post-toc-item.is-active {
      color: var(--primary-d);
    }

    .post-toc-item.is-active::before {
      opacity: 1;
    }

    .post-toc-mobile {
      display: none;
      margin: 0 0 36px;
      padding: 14px 18px;
      border: 1px solid var(--line);
      border-radius: 14px;
    }

    .post-toc-mobile summary {
      color: var(--muted);
      font-family: var(--mono);
      font-size: 12px;
      letter-spacing: 0.12em;
      cursor: pointer;
    }

    .post-toc-mobile .post-toc-item {
      display: block;
    }

    .post-toc-mobile .post-toc-item::before {
      content: none;
    }

    .prose h2,
    .prose h3 {
      scroll-margin-top: 96px;
    }

    /* 评论头像 */
    .comment-avatar {
      display: inline-flex;
      flex: none;
      width: 32px;
      height: 32px;
      overflow: hidden;
      border-radius: 50%;
    }

    .comment-avatar svg,
    .comment-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .comment-avatar.has-img svg {
      display: none;
    }

    .comment-avatar.has-img img.is-broken {
      display: none;
    }

    .comment-avatar.has-img img.is-broken + svg {
      display: block;
    }

    /* 评论输入区：收起态是一行引导条 */
    .comment-compose {
      display: flex;
      align-items: center;
      gap: 12px;
      box-sizing: border-box;
      width: 100%;
      margin-top: 24px;
      padding: 10px 18px 10px 10px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: transparent;
      color: var(--faint);
      font-size: 13.5px;
      text-align: left;
      cursor: pointer;
      transition:
        border-color 250ms ease,
        color 250ms ease;
    }

    .comment-compose:hover {
      border-color: var(--primary);
      color: var(--muted);
    }

    .comment-compose .comment-avatar {
      width: 30px;
      height: 30px;
    }

    .comment-compose-hint {
      flex: 1;
    }

    .comment-compose svg:last-child {
      width: 16px;
      height: 16px;
    }

    .comment-form.is-open {
      animation: comment-form-in 320ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
    }

    @keyframes comment-form-in {
      from {
        opacity: 0;
        translate: 0 -8px;
      }
      to {
        opacity: 1;
        translate: 0 0;
      }
    }

    .comment-form-actions {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .comment-form button.comment-cancel {
      padding: 10px 6px;
      border: 0;
      background: transparent;
      color: var(--faint);
      font-size: 13px;
      cursor: pointer;
      transition: color 250ms ease;
    }

    .comment-form button.comment-cancel:hover {
      background: transparent;
      color: var(--ink);
      transform: none;
    }

    @media (max-width: 1240px) {
      .post-toc {
        display: none;
      }

      .post-toc-mobile {
        display: block;
      }
    }

    /* 布局引擎 */
    .layout-stack {
      display: flex;
      flex-direction: column;
      gap: var(--node-gap, 0);
    }

    .gap-none {
      --node-gap: 0;
      gap: 0;
    }

    .gap-sm {
      --node-gap: 10px;
      gap: 10px;
    }

    .gap-md {
      --node-gap: 18px;
      gap: 18px;
    }

    .gap-lg {
      --node-gap: 32px;
      gap: 32px;
    }

    .gap-xl {
      --node-gap: 54px;
      gap: 54px;
    }

    .align-start {
      align-items: start;
    }

    .align-center {
      align-items: center;
    }

    .align-stretch {
      align-items: stretch;
    }

    .is-sticky {
      position: sticky;
      top: 92px;
      align-self: start;
    }

    .layout-grid {
      display: grid;
      width: min(1120px, calc(100% - 48px));
      grid-template-columns: minmax(0, 1fr) 280px;
      gap: 56px;
      margin: 0 auto;
      padding: 130px 0 120px;
    }

    .layout-grid.grid-aside-first {
      grid-template-columns: 280px minmax(0, 1fr);
    }

    /* 个人带：首屏与正文之间的过门 */
    .layout-grid.grid-identity {
      width: min(1180px, calc(100% - 64px));
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 40px;
      align-items: center;
      padding: 44px 0;
      border-bottom: 1px solid var(--line);
      scroll-margin-top: 88px;
    }

    .grid-identity .primitive-avatar {
      width: 76px;
      height: 76px;
      border-radius: 50%;
      object-fit: cover;
      transition: box-shadow 350ms ease;
    }

    .grid-identity .primitive-avatar:hover {
      box-shadow:
        0 0 0 4px var(--page),
        0 0 0 6px var(--primary);
    }

    .grid-identity .layout-stack {
      gap: 4px;
    }

    .grid-identity .text-heading {
      color: var(--ink);
      font-family: var(--serif);
      font-size: 24px;
      font-weight: 700;
    }

    .grid-identity .text-body {
      color: var(--muted);
      font-size: 14px;
    }

    .grid-identity .text-caption {
      color: var(--secondary-d);
      font-size: 11px;
      letter-spacing: 0.14em;
    }

    .grid-identity .profile-log {
      margin: 0;
      padding: 0;
      border: 0;
      background: none;
      color: var(--muted);
      font-family: var(--mono);
      font-size: 11.5px;
      line-height: 1.9;
      text-align: right;
      white-space: pre-line;
    }

    /* 正文区：文章流 + 侧栏 */
    .layout-grid.grid-feed-rail {
      width: min(1180px, calc(100% - 64px));
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: 64px;
      align-items: start;
      padding: 72px 0 96px;
    }

    .site-footer {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 44px;
      border-top: 1px solid var(--line);
      color: var(--faint);
      font-size: 12px;
      letter-spacing: 0.14em;
    }
    .layout-grid.grid-three-rail,
    .theme-hanakoi .layout-grid.grid-three-rail {
      width: 100%;
      max-width: none;
      min-height: 100svh;
      margin: 0;
      grid-template-columns: clamp(240px, 16vw, 280px) minmax(0, 900px) clamp(240px, 16vw, 280px);
      justify-content: center;
      gap: 28px;
      padding: 70px clamp(16px, 2vw, 32px) 96px;
      background: var(--page);
    }

    .theme-hanakoi .layout-card {
      border: 0;
      background: var(--surface);
    }

    .max-full {
      max-width: none;
    }

    .max-1240 {
      max-width: 1240px;
    }

    .layout-split {
      display: grid;
      width: min(1180px, calc(100% - 40px));
      grid-template-columns: 270px minmax(0, 1fr);
      gap: 34px;
      margin: 0 auto;
      padding: 88px 0 120px;
      align-items: start;
    }

    .theme-hanakoi .layout-split {
      padding-top: 104px;
      background:
        radial-gradient(circle at 10% 2%, rgb(227 160 178 / 8%), transparent 24%),
        radial-gradient(circle at 90% 16%, rgb(114 173 210 / 9%), transparent 28%);
    }

    .theme-hanakoi .layout-split > .layout-stack {
      --node-gap: 34px;
    }

    .theme-moonletter .layout-grid {
      align-items: start;
      grid-template-columns: minmax(0, 1fr) 280px;
      padding-top: 118px;
    }

    .layout-bento {
      display: grid;
      width: min(1240px, calc(100% - 40px));
      min-height: 100dvh;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      grid-auto-rows: 84px;
      gap: 18px;
      margin: 0 auto;
      padding: 106px 0 120px;
    }

    .theme-orbit .layout-bento::before {
      position: fixed;
      z-index: -1;
      opacity: 0.13;
      background-image:
        linear-gradient(rgb(121 199 211 / 18%) 1px, transparent 1px),
        linear-gradient(90deg, rgb(121 199 211 / 18%) 1px, transparent 1px);
      background-size: 84px 84px;
      content: '';
      inset: 0;
      mask-image: linear-gradient(to bottom, black, transparent 90%);
    }

    .theme-orbit .layout-bento > .node-hero {
      grid-column: span 8;
      grid-row: span 5;
    }

    .theme-orbit .layout-bento > .node-profile-card {
      grid-column: span 4;
      grid-row: span 5;
    }

    .theme-orbit .layout-bento > .node-article-feed {
      grid-column: span 9;
      grid-row: span 7;
    }

    .theme-orbit .layout-bento > .layout-stack {
      grid-column: span 3;
      grid-row: span 7;
    }

    .node {
      position: relative;
      min-width: 0;
    }

    .layout-card {
      display: flex;
      min-width: 0;
      flex-direction: column;
      gap: 16px;
      border: 1px solid var(--line);
      background: var(--surface);
      color: var(--ink);
    }

    .layout-card.card-glass {
      border-color: color-mix(in srgb, var(--primary) 22%, var(--line));
      background: color-mix(in srgb, var(--surface) 82%, transparent);
      backdrop-filter: blur(18px);
    }

    .layout-card.card-outlined {
      border-width: 2px;
      background: transparent;
    }

    .layout-card.card-paper {
      border-radius: 2px;
      background:
        repeating-linear-gradient(
          transparent 0 31px,
          color-mix(in srgb, var(--primary) 8%, transparent) 32px
        ),
        var(--surface);
    }

    .padding-none {
      padding: 0;
    }

    .padding-sm {
      padding: 12px;
    }

    .padding-md {
      padding: 20px;
    }

    .padding-lg {
      padding: 28px;
    }

    .padding-xl {
      padding: 40px;
    }

    .radius-none {
      border-radius: 0;
    }

    .radius-sm {
      border-radius: 8px;
    }

    .radius-md {
      border-radius: 16px;
    }

    .radius-lg {
      border-radius: 24px;
    }

    .radius-pill {
      border-radius: 999px;
    }

    .shadow-none {
      box-shadow: none;
    }

    .shadow-soft {
      box-shadow: 0 18px 48px rgb(38 57 78 / 10%);
    }

    .shadow-blue {
      box-shadow: -7px 9px 0 rgb(114 173 210 / 14%);
    }

    .shadow-pink {
      box-shadow: 7px 9px 0 rgb(227 160 178 / 15%);
    }

    .is-sticky {
      position: sticky;
      top: 88px;
      align-self: start;
    }

    .primitive-avatar {
      display: grid;
      flex: 0 0 auto;
      place-items: center;
      background: linear-gradient(145deg, var(--secondary), var(--primary));
      color: white;
      font-family: var(--serif);
      box-shadow: 0 10px 28px color-mix(in srgb, var(--secondary) 22%, transparent);
    }

    .avatar-sm {
      width: 44px;
      height: 44px;
      font-size: 16px;
    }

    .avatar-md {
      width: 64px;
      height: 64px;
      font-size: 21px;
    }

    .avatar-lg {
      width: 88px;
      height: 88px;
      font-size: 28px;
    }

    .avatar-xl {
      width: 104px;
      height: 104px;
      font-size: 34px;
    }

    .avatar-circle {
      border-radius: 50%;
    }

    .avatar-rounded {
      border-radius: 20px;
    }

    .avatar-square {
      border-radius: 0;
    }

    .primitive-text {
      width: 100%;
    }

    .text-eyebrow {
      color: var(--secondary);
      font: 700 10px/1.4 system-ui, sans-serif;
      letter-spacing: 0.2em;
      text-transform: uppercase;
    }

    .text-heading {
      color: var(--secondary);
      font-family: var(--serif);
      font-size: 24px;
      font-weight: 700;
      line-height: 1.35;
    }

    .text-body {
      color: var(--muted);
      line-height: 1.8;
    }

    .text-caption {
      color: var(--muted);
      font-size: 12px;
    }

    .text-left {
      text-align: left;
    }

    .text-center {
      text-align: center;
    }

    .text-right {
      text-align: right;
    }

    .primitive-socials {
      display: flex;
      width: 100%;
      flex-wrap: wrap;
      gap: 8px;
    }

    .primitive-socials a {
      color: var(--primary);
      font-size: 12px;
    }

    .socials-labels {
      flex-direction: column;
    }

    .socials-labels a {
      padding: 8px 10px;
      border-radius: 9px;
      background: var(--surface-soft);
    }

    .socials-pills a,
    .socials-icons a {
      padding: 7px 11px;
      border: 1px solid var(--line);
      border-radius: 999px;
    }

    .primitive-status,
    .profile-log {
      width: 100%;
      margin: 8px 0 0;
      padding: 10px 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgb(44 62 80 / 4%);
      color: var(--muted);
      font: 11px/1.5 ui-monospace, monospace;
      white-space: pre-wrap;
    }

    .status-online {
      color: #35835c;
    }

    .status-accent {
      color: var(--secondary);
    }

    .layout-card > .quote-card,
    .layout-card > .stats-card {
      padding: 0;
      border: 0;
      background: transparent;
      box-shadow: none;
    }

    /* ---------- 首屏 ---------- */
    .hero {
      position: relative;
      display: grid;
      min-height: 100vh;
      place-items: center;
      overflow: hidden;
      isolation: isolate;
      background:
        radial-gradient(circle at 70% 18%, rgb(74 147 194 / 24%), transparent 46%),
        linear-gradient(180deg, #122539, #0e1d30);
      color: #eef3f8;
    }

    .hero::before {
      position: absolute;
      z-index: -1;
      inset: 0;
      content: '';
      background: linear-gradient(
        180deg,
        rgb(6 14 26 / 55%),
        rgb(6 14 26 / 18%) 45%,
        rgb(9 17 30 / 66%) 100%
      );
    }

    .hero::after {
      position: absolute;
      z-index: -1;
      right: 0;
      bottom: 0;
      left: 0;
      height: 8vh;
      content: '';
      background: linear-gradient(180deg, transparent, rgb(247 248 247 / 68%));
    }

    .hero-background {
      position: absolute;
      z-index: -2;
      top: -32%;
      left: 0;
      width: 100%;
      height: 132%;
      background: center / cover no-repeat;
      will-change: transform;
    }

    .hero:not(.has-media) .hero-background {
      display: none;
    }

    .hero-inner {
      display: flex;
      width: min(680px, 88vw);
      align-items: center;
      flex-direction: column;
      gap: 5.5vh;
      text-align: center;
      will-change: transform, opacity;
    }

    .hero-info {
      display: flex;
      width: auto;
      max-width: 100%;
      align-items: center;
      flex-direction: column;
    }

    .component-kicker {
      margin: 0;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.26em;
      text-transform: uppercase;
    }

    .hero-inner > .component-kicker {
      color: rgb(238 243 248 / 72%);
    }

    .hero h1 {
      margin: 0;
      font-family: var(--serif);
      font-size: clamp(30px, 5.2vw, 64px);
      font-weight: 700;
      letter-spacing: 0.02em;
      line-height: 1.15;
      text-shadow: 0 6px 40px rgb(0 0 0 / 50%);
      white-space: nowrap;
    }

    .hero-character {
      display: inline-block;
      animation: hero-char-in 700ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
      animation-delay: calc(var(--char-index) * 55ms);
    }

    .hero-character.accent {
      color: var(--secondary);
    }

    @keyframes hero-char-in {
      from {
        opacity: 0;
        translate: 0 22px;
      }
      to {
        opacity: 1;
        translate: 0 0;
      }
    }

    /* 首屏信息卡：深色半透明卡，引语与社交图标同卡（参考旧版 YukiLog） */
    .welcome-quote {
      display: flex;
      width: auto;
      max-width: 100%;
      align-items: center;
      flex-direction: column;
      gap: 18px;
      padding: 24px 36px 20px;
      border: 1px solid rgb(255 255 255 / 8%);
      border-radius: 24px;
      background: rgb(6 12 22 / 55%);
    }

    .quote-mark {
      display: none;
    }

    .quote-text {
      font-family: var(--serif);
      font-size: 17px;
      line-height: 1.9;
      color: rgb(255 255 255 / 88%);
      text-align: center;
    }

    .social-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 18px;
    }

    .social-icon {
      display: grid;
      width: 34px;
      height: 34px;
      place-items: center;
      border-radius: 50%;
      transition:
        filter 300ms cubic-bezier(0.22, 0.61, 0.36, 1),
        transform 300ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    .social-icon svg {
      transition: transform 300ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    .social-icon:hover {
      filter: brightness(1.35);
      transform: translateY(-2px);
    }

    .social-icon:hover svg {
      transform: scale(1.12);
    }

    .enter-button {
      position: absolute;
      bottom: 32px;
      left: 50%;
      display: flex;
      align-items: center;
      flex-direction: column;
      gap: 8px;
      padding: 0;
      border: 0;
      background: none;
      color: rgb(238 243 248 / 66%);
      translate: -50%;
      filter: drop-shadow(0 2px 10px rgb(9 17 30 / 55%));
    }

    .enter-button span {
      font-size: 10px;
      letter-spacing: 0.3em;
    }

    .enter-button svg {
      width: 30px;
      height: 30px;
      animation: enter-bob 2.4s ease-in-out infinite;
    }

    @keyframes enter-bob {
      0%,
      100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(7px);
      }
    }

    .hero-compact .hero-inner,
    .hero-split .hero-inner {
      gap: 18px;
    }

    /* ---------- 刊头 ---------- */
    .masthead-minimal {
      display: flex;
      align-items: baseline;
      gap: 20px;
      margin-bottom: 44px;
    }

    /* 刊头背景（如旧版的 gif 标题背景）：盖一层页面色保证文字可读 */
    .masthead.has-bg {
      position: relative;
      overflow: hidden;
      padding: 30px 32px;
      border-radius: 18px;
      background-size: cover;
      background-position: center;
    }

    .masthead.has-bg::before {
      content: '';
      position: absolute;
      inset: 0;
      background: color-mix(in srgb, var(--page) 82%, transparent);
    }

    .masthead.has-bg > * {
      position: relative;
    }

    .masthead-minimal.has-bg {
      align-items: center;
    }

    .masthead-minimal .kicker {
      margin: 0;
      color: var(--secondary-d);
      font-family: var(--mono);
      font-size: 12px;
      letter-spacing: 0.08em;
    }

    .masthead-minimal h1 {
      margin: 0;
      font-family: var(--serif);
      font-size: 32px;
      font-weight: 700;
    }

    .sort-title-anim {
      display: inline-block;
      animation: sort-title-in 320ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
    }

    /* 刊头紧跟文章流（带排序 tab）时收紧间距 */
    .node-masthead.masthead-minimal:has(+ .node-article-feed) {
      flex-wrap: wrap;
      row-gap: 12px;
      margin-bottom: 0;
    }

    @keyframes sort-title-in {
      from {
        opacity: 0;
        translate: 0 8px;
      }
      to {
        opacity: 1;
        translate: 0 0;
      }
    }

    .masthead-minimal .lead {
      margin: 0 0 0 auto;
      color: var(--faint);
      font-size: 12px;
    }

    .masthead-editorial {
      margin-bottom: 44px;
    }

    .masthead-editorial .kicker {
      margin: 0 0 12px;
      color: var(--secondary-d);
    }

    .masthead-editorial h1 {
      margin: 0;
      font-family: var(--serif);
      font-size: clamp(34px, 4.6vw, 48px);
    }

    .masthead-editorial .lead {
      margin: 10px 0 0;
      color: var(--muted);
    }

    /* ---------- 个人卡（工作室可选组件的简约样式） ---------- */
    .profile-card {
      width: min(100%, 420px);
    }

    .profile-button {
      display: block;
      width: 100%;
      padding: 26px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: var(--surface);
      color: var(--ink);
      text-align: center;
    }

    .profile-face {
      display: block;
    }

    .profile-back {
      display: none;
    }

    .profile-button[aria-pressed='true'] .profile-face:not(.profile-back) {
      display: none;
    }

    .profile-button[aria-pressed='true'] .profile-back {
      display: block;
    }

    .profile-face .avatar {
      display: grid;
      width: 64px;
      height: 64px;
      margin: 0 auto 12px;
      place-items: center;
      border-radius: 50%;
      background: linear-gradient(150deg, #3d5a80, #7eb6d9 55%, #c9a0b4);
      color: #fff;
      font-family: var(--serif);
      font-size: 24px;
    }

    .profile-face h2 {
      margin: 0 0 6px;
      font-family: var(--serif);
      font-size: 20px;
    }

    .profile-face p {
      margin: 0;
      color: var(--muted);
      font-size: 13.5px;
      line-height: 1.8;
    }

    .profile-socials,
    .profile-status,
    .profile-hint {
      display: block;
      margin-top: 10px;
      color: var(--faint);
      font-size: 12px;
    }

    /* ---------- 文章流 ---------- */
    .article-feed {
      min-width: 0;
    }

    .feed-alternating {
      display: flex;
      flex-direction: column;
      gap: 56px;
    }

    .feed-alternating .article {
      display: grid;
      grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
      gap: 32px;
      align-items: center;
    }

    .feed-alternating .article:nth-child(even) {
      grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
    }

    .feed-alternating .article:nth-child(even) .article-cover {
      order: 2;
    }

    .feed-alternating .article:has(.is-portrait) {
      grid-template-columns: minmax(0, 4fr) minmax(0, 8fr);
    }

    .feed-alternating .article:nth-child(even):has(.is-portrait) {
      grid-template-columns: minmax(0, 8fr) minmax(0, 4fr);
    }

    .article-cover {
      display: block;
      overflow: hidden;
      border-radius: 14px;
      background: var(--cover) center / cover no-repeat;
      aspect-ratio: 16 / 10;
      transition:
        translate 450ms cubic-bezier(0.22, 0.61, 0.36, 1),
        box-shadow 450ms ease;
    }

    .article-cover.is-portrait {
      aspect-ratio: 3 / 4;
    }

    .article:hover .article-cover {
      translate: 0 -6px;
      box-shadow: 0 22px 44px -14px rgb(74 147 194 / 38%);
    }

    .article:nth-child(even):hover .article-cover {
      box-shadow: 0 22px 44px -14px rgb(213 127 149 / 38%);
    }

    .cover-one {
      --cover: linear-gradient(150deg, #3d5a80, #7eb6d9 55%, #c9a0b4);
    }

    .cover-two {
      --cover: linear-gradient(150deg, #1d2b4a, #45618f 60%, #7eb6d9);
    }

    .cover-three {
      --cover: linear-gradient(150deg, #5c4a72, #a17fa8 55%, #e8a4b4);
    }

    .cover-four {
      --cover: linear-gradient(150deg, #274c57, #3f7d8c 55%, #8fc7c9);
    }

    .cover-five {
      --cover: linear-gradient(150deg, #6b4a68, #b07fa0 55%, #e8c9b4);
    }

    .cover-six {
      --cover: linear-gradient(150deg, #2c3e50, #5f7d9c 55%, #a9c6de);
    }

    .article-copy {
      min-width: 0;
    }

    .article-copy .meta {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      color: var(--faint);
      font-size: 12px;
    }

    .article-copy .meta .cat {
      color: var(--primary-d);
      font-weight: 600;
      letter-spacing: 0.1em;
    }

    .article:nth-child(even) .article-copy .meta .cat {
      color: var(--secondary-d);
    }

    .article-copy h3 {
      margin: 0;
      font-family: var(--serif);
      font-size: 25px;
      font-weight: 700;
      line-height: 1.45;
    }

    .article-copy h3 a {
      background-image: linear-gradient(currentColor, currentColor);
      background-repeat: no-repeat;
      background-size: 0 1.5px;
      background-position: 0 97%;
      transition: background-size 400ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    .article-copy h3 a:hover {
      background-size: 100% 1.5px;
    }

    .article-copy .summary {
      margin: 10px 0 0;
      color: var(--muted);
      font-size: 14.5px;
      line-height: 1.95;
    }

    .article-copy .foot {
      display: flex;
      gap: 16px;
      margin-top: 14px;
      color: var(--faint);
      font-size: 12px;
    }

    .article-copy .foot .tags {
      display: flex;
      gap: 10px;
      margin-right: auto;
    }

    .article-copy .foot .tags a:hover {
      color: var(--primary-d);
    }

    /* 其它文章列表变体的兜底排版 */
    .feed-editorial,
    .feed-cover-overlay,
    .feed-compact {
      display: grid;
      gap: 24px;
    }

    /* ---------- 侧栏区块 ---------- */
    .stats-card,
    .quote-card,
    .dynamic-strip {
      display: block;
      margin: 0;
      padding: 18px 0 0;
      border-top: 2px solid var(--ink);
      background: none;
    }

    .stats-card > .component-kicker,
    .dynamic-strip > .component-kicker {
      display: block;
      margin-bottom: 18px;
      color: var(--ink);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.22em;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px 12px;
    }

    .stat strong {
      display: block;
      font-family: var(--serif);
      font-size: 26px;
      font-weight: 700;
    }

    .stat:nth-child(1) strong {
      color: var(--primary-d);
    }

    .stat:nth-child(2) strong {
      color: var(--secondary-d);
    }

    .stat span {
      color: var(--faint);
      font-size: 11.5px;
    }

    .quote-card {
      font-family: var(--serif);
      font-size: 15.5px;
      line-height: 2;
    }

    .quote-card cite {
      display: block;
      margin-top: 10px;
      color: var(--faint);
      font-family: var(--serif);
      font-size: 12px;
      font-style: normal;
      text-align: right;
    }

    .dynamic-item {
      display: block;
      padding: 13px 0;
      border-bottom: 1px dashed var(--line);
      color: var(--muted);
      font-size: 13.5px;
      line-height: 1.75;
      transition:
        color 250ms ease,
        translate 250ms ease;
    }

    .dynamic-item:last-child {
      border-bottom: 0;
    }

    .dynamic-item:hover {
      color: var(--ink);
      translate: 4px 0;
    }

    .dynamic-item time {
      display: block;
      margin-bottom: 2px;
      color: var(--faint);
      font-family: var(--mono);
      font-size: 10.5px;
    }
    /* Layout studio */
    .studio-shell {
      display: grid;
      height: var(--studio-height, 100dvh);
      min-height: var(--studio-min-height, 720px);
      grid-template-columns: 250px minmax(0, 1fr) 320px;
      background: #0e131b;
      color: #e8edf5;
    }

    .studio-panel {
      position: sticky;
      top: 0;
      height: 100%;
      overflow: auto;
      padding: 20px 16px;
      border-right: 1px solid #27303d;
      background: #151b24;
    }

    .studio-panel.right {
      border-right: 0;
      border-left: 1px solid #27303d;
    }

    .studio-panel h2 {
      margin: 0 0 16px;
      font-size: 14px;
    }

    .palette-group {
      margin-bottom: 20px;
    }

    .palette-group h3 {
      margin: 0 0 8px;
      color: #828da0;
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .palette-item,
    .tree-item,
    .inspector-button {
      width: 100%;
      margin: 3px 0;
      padding: 9px 10px;
      border: 1px solid #2b3543;
      border-radius: 9px;
      background: #1b2330;
      color: #dbe2ed;
      font-size: 12px;
      text-align: left;
    }

    .palette-item {
      cursor: grab;
    }

    .palette-item.dragging {
      opacity: 0.38;
      cursor: grabbing;
    }

    .tree-item.selected {
      border-color: #79c7d3;
      background: #21323e;
    }

    .tree-help {
      margin: 0 0 10px;
      color: #788497;
      font-size: 10px;
      line-height: 1.6;
    }

    .tree-row {
      position: relative;
      display: flex;
      align-items: center;
      gap: 4px;
      border-radius: 9px;
    }

    .tree-node > .tree-node {
      margin-left: 14px;
    }

    .tree-row.drop-inside {
      outline: 2px solid #79c7d3;
      outline-offset: 1px;
      background: rgb(121 199 211 / 10%);
    }

    .tree-row.dragging {
      opacity: 0.38;
    }

    .drag-handle {
      display: grid;
      width: 24px;
      height: 28px;
      flex: 0 0 24px;
      place-items: center;
      border-radius: 7px;
      color: #8491a4;
      cursor: grab;
      user-select: none;
    }

    .drag-handle:active {
      cursor: grabbing;
    }

    .drag-handle:focus-visible {
      outline: 2px solid #79c7d3;
    }

    .tree-row .tree-item {
      min-width: 0;
      flex: 1;
    }

    .tree-drop-line {
      position: relative;
      height: 10px;
      margin-left: 28px;
    }

    .tree-drop-line::before {
      position: absolute;
      top: 4px;
      right: 2px;
      left: 2px;
      height: 2px;
      content: '';
      border-radius: 999px;
      background: transparent;
    }

    .tree-drop-line span,
    .inside-label {
      position: absolute;
      z-index: 2;
      right: 8px;
      padding: 2px 6px;
      border-radius: 5px;
      background: #79c7d3;
      color: #102027;
      font-size: 9px;
      font-weight: 700;
      pointer-events: none;
      opacity: 0;
    }

    .tree-drop-line span {
      top: -4px;
    }

    .inside-label {
      top: 50%;
      transform: translateY(-50%);
    }

    .tree-drop-line.active::before {
      background: #79c7d3;
    }

    .tree-drop-line.active span,
    .tree-row.drop-inside .inside-label {
      opacity: 1;
    }

    .tree-actions {
      display: flex;
      gap: 2px;
      opacity: 0;
      transition: opacity 120ms ease;
    }

    .tree-row:hover .tree-actions,
    .tree-row:focus-within .tree-actions {
      opacity: 1;
    }

    .tree-actions button {
      width: 24px;
      height: 28px;
      padding: 0;
      border: 1px solid #303b49;
      border-radius: 7px;
      background: #1b2330;
      color: #aeb8c7;
    }

    .studio-canvas {
      display: grid;
      height: 100%;
      min-width: 0;
      grid-template-rows: auto minmax(0, 1fr);
      overflow: hidden;
      background: #0b1017;
    }

    .studio-canvas-toolbar {
      position: relative;
      z-index: 2;
      display: flex;
      min-height: 54px;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 18px;
      border-bottom: 1px solid #27303d;
      background: #151b24;
      color: #dbe2ed;
      font-size: 12px;
    }

    .viewport-switcher {
      display: flex;
      gap: 3px;
      padding: 3px;
      border: 1px solid #303b49;
      border-radius: 9px;
      background: #101721;
    }

    .viewport-switcher button {
      padding: 5px 9px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: #8f9aac;
      font-size: 11px;
    }

    .viewport-switcher button[aria-pressed='true'] {
      background: #2a3544;
      color: #fff;
    }

    .studio-canvas-stage {
      min-width: 0;
      overflow: auto;
      padding: 24px;
    }

    .studio-preview {
      position: relative;
      width: 1500px;
      min-height: max(480px, calc(var(--studio-height, 100dvh) - 102px));
      margin: 0 auto;
      overflow: hidden;
      border: 1px solid #303a48;
      border-radius: 10px;
      background: white;
      box-shadow: 0 24px 80px rgb(0 0 0 / 34%);
      transition: width 180ms ease;
    }

    .studio-preview.viewport-tablet {
      width: 768px;
    }

    .studio-preview.viewport-mobile {
      width: 390px;
    }

    .studio-preview .site-nav {
      position: absolute;
    }

    .studio-preview .nav-sidebar {
      height: 100%;
    }

    .studio-preview .hero {
      min-height: 680px;
    }

    .studio-preview .layout-bento {
      min-height: 760px;
    }

    .is-studio-preview .node.selected::after {
      position: absolute;
      z-index: 120;
      content: attr(data-label);
      inset: 0;
      padding: 4px 6px;
      border: 2px solid #79c7d3;
      background: rgb(121 199 211 / 5%);
      color: #fff;
      font: 11px system-ui;
      pointer-events: none;
    }

    .inspector-section {
      margin-bottom: 22px;
    }

    .inspector-section label {
      display: block;
      margin-bottom: 7px;
      color: #8d98aa;
      font-size: 11px;
    }

    .segmented {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    .segmented button {
      padding: 7px 8px;
      border: 1px solid #303b49;
      border-radius: 8px;
      background: #1b2330;
      color: #c8d0dd;
      font-size: 11px;
    }

    .segmented button[aria-pressed='true'] {
      border-color: #79c7d3;
      color: #9de5ec;
    }

    .studio-history,
    .move-actions {
      display: flex;
      gap: 6px;
      margin-bottom: 18px;
    }

    .studio-history button,
    .move-actions button {
      flex: 1;
      padding: 7px 9px;
      border: 1px solid #303b49;
      border-radius: 8px;
      background: #1b2330;
      color: #c8d0dd;
    }

    .studio-history button:disabled,
    .inspector-button:disabled {
      cursor: not-allowed;
      opacity: 0.38;
    }

    .property-list {
      display: grid;
      gap: 13px;
    }

    .property-field {
      display: grid !important;
      gap: 6px;
      margin: 0 !important;
    }

    .property-field input,
    .property-field select,
    .property-field textarea {
      width: 100%;
      min-height: 34px;
      padding: 7px 9px;
      border: 1px solid #303b49;
      border-radius: 8px;
      outline: 0;
      background: #101721;
      color: #e3e9f2;
      font: inherit;
      font-size: 12px;
      line-height: 1.45;
    }

    .property-field textarea {
      min-height: 82px;
      resize: vertical;
    }

    .property-field input:focus,
    .property-field select:focus,
    .property-field textarea:focus {
      border-color: #79c7d3;
    }

    .property-help {
      color: #69778b;
      font-size: 10px;
      line-height: 1.5;
    }

    .media-picker-preview {
      display: grid;
      place-items: center;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      border: 1px solid #303b49;
      border-radius: 8px;
      background: #101721;
    }

    .media-picker-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .media-picker-empty {
      color: #69778b;
      font-size: 11px;
    }

    .media-picker-actions {
      display: flex;
      gap: 6px;
    }

    .media-picker-actions button {
      flex: 1;
      padding: 7px 9px;
      border: 1px solid #303b49;
      border-radius: 8px;
      background: #1b2330;
      color: #c8d0dd;
      font-size: 11px;
    }

    .property-toggle {
      display: flex !important;
      align-items: center;
      gap: 8px;
      margin: 0 !important;
    }

    .property-toggle input {
      width: 16px;
      height: 16px;
      margin: 0;
    }

    .property-options {
      min-width: 0;
      margin: 0;
      padding: 0;
      border: 0;
    }

    .property-options legend {
      margin-bottom: 7px;
      color: #8d98aa;
      font-size: 11px;
    }

    .inspector-button.danger {
      border-color: #62313c;
      background: #2c1a20;
      color: #f0a5b5;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .layout-json {
      max-height: 180px;
      overflow: auto;
      padding: 10px;
      border-radius: 8px;
      background: #0d1118;
      color: #9eacbd;
      font: 10px/1.5 ui-monospace, monospace;
      white-space: pre-wrap;
    }

    .validation-ok {
      color: #83d6a1;
      font-size: 12px;
    }

    @keyframes hero-reveal {
      from {
        filter: blur(9px) brightness(0.55);
        transform: scale(1.1);
      }
      to {
        filter: blur(0) brightness(1);
        transform: scale(1.04);
      }
    }

    @keyframes nav-item-in {
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes mobile-menu-up {
      from {
        transform: translateY(100%);
      }
      to {
        transform: translateY(0);
      }
    }

    @keyframes hero-media-reveal {
      from {
        filter: brightness(0.3) blur(8px);
        transform: scale(1.08);
      }
      to {
        filter: brightness(var(--hero-brightness, 0.7)) blur(0);
        transform: scale(1.02);
      }
    }

    @keyframes hero-copy-in {
      from {
        opacity: 0;
        transform: translateY(26px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes character-in {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes enter-float {
      0%,
      100% {
        transform: translate(-50%, 0);
      }
      50% {
        transform: translate(-50%, 7px);
      }
    }

    /* ---------- 回到顶部（滚动进度环） ---------- */
    .to-top {
      position: fixed;
      z-index: 60;
      right: 22px;
      bottom: 22px;
      display: grid;
      width: 46px;
      height: 46px;
      padding: 0;
      place-items: center;
      border: 0;
      border-radius: 50%;
      background: var(--surface);
      box-shadow: 0 8px 24px rgb(28 39 51 / 16%);
      color: var(--ink);
      cursor: pointer;
      opacity: 0;
      visibility: hidden;
      translate: 0 10px;
      transition:
        opacity 320ms ease,
        translate 320ms cubic-bezier(0.22, 0.61, 0.36, 1),
        visibility 320ms;
    }

    .to-top.show {
      opacity: 1;
      visibility: visible;
      translate: 0 0;
    }

    .to-top svg.ring {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
      fill: none;
    }

    .to-top .ring-bg {
      stroke: var(--line);
      stroke-width: 2.5;
    }

    .to-top .ring-fg {
      stroke: var(--primary-d);
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-dasharray: 125.66;
      stroke-dashoffset: 125.66;
    }

    .to-top svg.arrow {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .to-top:hover {
      color: var(--primary-d);
    }

    /* ---------- 首页文章排序切换（嵌在刊头行内右侧） ---------- */
    .sort-tabs {
      display: flex;
      gap: 6px;
      margin: 0 0 0 auto;
      padding: 4px;
      border: 1px solid var(--line);
      border-radius: 999px;
      width: fit-content;
    }

    .sort-tabs button {
      padding: 6px 16px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--muted);
      font-size: 12.5px;
      cursor: pointer;
      transition:
        color 250ms ease,
        background 250ms ease;
    }

    .sort-tabs button:hover {
      color: var(--ink);
    }

    .sort-tabs button[aria-pressed='true'] {
      background: var(--ink);
      color: #fff;
    }

    /* ---------- 侧栏「最近动态」更多链接 ---------- */
    .dynamic-strip > .component-kicker {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    a.strip-kicker {
      color: var(--ink);
      text-decoration: none;
      cursor: pointer;
    }

    .strip-more {
      color: var(--muted);
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.14em;
      transition:
        color 250ms ease,
        translate 250ms ease;
    }

    a.strip-kicker:hover .strip-more {
      color: var(--primary-d);
      translate: 3px 0;
    }

    /* ---------- 文章流「全部文章」 ---------- */
    .feed-more {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      margin-top: 28px;
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0.18em;
      text-decoration: none;
      transition: color 250ms ease;
    }

    .feed-more span {
      transition: translate 250ms ease;
    }

    .feed-more:hover {
      color: var(--primary-d);
    }

    .feed-more:hover span {
      translate: 4px 0;
    }

    /* ---------- 友链 favicon 头像 ---------- */
    .friend-avatar {
      position: relative;
      overflow: hidden;
    }

    .friend-avatar img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border-radius: inherit;
      object-fit: cover;
      background: var(--surface);
    }

    /* ---------- 友链申请表单 ---------- */
    .friend-apply {
      margin-top: 56px;
      padding-top: 30px;
      border-top: 2px solid var(--ink);
    }

    .friend-apply h2 {
      margin: 10px 0 12px;
      font-family: var(--serif);
      font-size: 24px;
      font-weight: 600;
    }

    .apply-lede {
      margin: 0 0 22px;
      max-width: 52ch;
      color: var(--muted);
      font-size: 13.5px;
      line-height: 1.9;
    }

    .apply-form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px 18px;
      max-width: 640px;
    }

    .apply-form label {
      display: grid;
      gap: 8px;
      color: var(--ink);
      font-size: 12.5px;
      letter-spacing: 0.06em;
    }

    .apply-form label.wide {
      grid-column: 1 / -1;
    }

    .apply-form input,
    .apply-form textarea {
      padding: 11px 14px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface);
      color: var(--ink);
      font: inherit;
      font-size: 13.5px;
      transition:
        border-color 200ms ease,
        box-shadow 200ms ease;
    }

    .apply-form input:focus,
    .apply-form textarea:focus,
    .sub-form input[type='email']:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent);
      outline: none;
    }

    .apply-form textarea {
      resize: vertical;
    }

    .apply-form button,
    .sub-form button {
      justify-self: start;
      padding: 11px 30px;
      border: none;
      border-radius: 999px;
      background: var(--ink);
      color: #fff;
      font: inherit;
      font-size: 13px;
      letter-spacing: 0.12em;
      cursor: pointer;
      transition:
        background 200ms ease,
        translate 200ms ease;
    }

    .apply-form button:hover:not(:disabled),
    .sub-form button:hover:not(:disabled) {
      background: var(--primary-d);
      translate: 0 -1px;
    }

    .apply-form button:disabled,
    .sub-form button:disabled {
      opacity: 0.55;
      cursor: default;
    }

    .apply-err,
    .sub-err {
      margin: 0;
      color: var(--secondary-d, #c26d82);
      font-size: 12.5px;
    }

    .apply-ok,
    .sub-ok {
      margin: 0;
      padding: 16px 18px;
      border: 1px solid color-mix(in srgb, var(--primary) 45%, var(--line));
      border-radius: 12px;
      background: color-mix(in srgb, var(--primary) 8%, var(--surface));
      color: var(--ink);
      font-size: 13.5px;
      line-height: 1.8;
    }

    /* ---------- 邮件订阅横条 ---------- */
    .subscribe-strip {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 14px 32px;
      margin: 0 0 56px;
      padding: 20px 24px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: var(--surface);
    }

    .subscribe-strip .component-kicker {
      margin: 0 0 5px;
    }

    .sub-copy {
      flex: 1 1 280px;
    }

    .sub-text {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.75;
    }

    .sub-text a {
      color: var(--primary-d);
      text-decoration: none;
    }

    .sub-text a:hover {
      text-decoration: underline;
    }

    .sub-form {
      display: flex;
      flex: 1 1 360px;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }

    .sub-form input[type='email'] {
      flex: 1 1 180px;
      min-width: 0;
      padding: 10px 14px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface);
      color: var(--ink);
      font: inherit;
      font-size: 13.5px;
      transition:
        border-color 200ms ease,
        box-shadow 200ms ease;
    }

    .sub-other {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--muted);
      font-size: 12.5px;
      white-space: nowrap;
      cursor: pointer;
    }

    .sub-other input {
      accent-color: var(--primary-d);
    }

    .subscribe-strip .sub-ok,
    .subscribe-strip .sub-err {
      flex: 1 1 100%;
    }

    /* ---------- 归档行悬停展开 ---------- */
    .archive-row {
      grid-template-columns: 104px minmax(0, 1fr) auto;
    }

    .archive-more {
      display: grid;
      grid-column: 1 / -1;
      grid-template-rows: 0fr;
      transition: grid-template-rows 480ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    .archive-row:hover .archive-more,
    .archive-row:focus-visible .archive-more {
      grid-template-rows: 1fr;
    }

    .archive-more-in {
      display: flex;
      min-height: 0;
      align-items: center;
      gap: 18px;
      overflow: hidden;
    }

    .archive-cover {
      display: block;
      width: 148px;
      flex: 0 0 148px;
      border-radius: 10px;
      background: var(--cover) center / cover no-repeat;
      aspect-ratio: 16 / 10;
    }

    .archive-summary {
      margin: 0;
      padding: 14px 0 4px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.85;
    }

    /* ---------- 动态爱心 ---------- */
    .mfoot {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .heart-button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 10px 3px 8px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: transparent;
      color: var(--faint);
      font-size: 12px;
      cursor: pointer;
      transition:
        color 250ms ease,
        border-color 250ms ease,
        background 250ms ease;
    }

    .heart-button svg {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      transition:
        fill 250ms ease,
        stroke 250ms ease,
        scale 250ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    .heart-button:hover {
      border-color: var(--secondary);
      color: var(--secondary-d);
    }

    .heart-button.liked {
      border-color: var(--secondary);
      background: rgb(232 164 180 / 12%);
      color: var(--secondary-d);
    }

    .heart-button.liked svg {
      fill: var(--secondary-d);
      stroke: var(--secondary-d);
      scale: 1.15;
    }

    /* ---------- 响应式 ---------- */
    @media (max-width: 1080px) {
      .layout-grid.grid-feed-rail {
        grid-template-columns: 1fr;
      }

      .grid-feed-rail .is-sticky {
        position: static;
        max-height: none;
      }

      .layout-grid.grid-identity {
        grid-template-columns: auto minmax(0, 1fr);
      }

      .grid-identity .profile-log {
        display: none;
      }
    }

    @media (max-width: 968px) {
      .nav-corners {
        padding: 0 24px;
      }

      .nav-corners .nav-links {
        display: none;
      }

      .nav-corners .nav-actions {
        display: flex;
      }
    }

    @media (max-width: 900px) {
      .lab-title,
      .lab-spacer {
        display: none;
      }

      .lab-bar button {
        flex: 1;
        padding-inline: 5px;
        font-size: 11px;
      }

      .nav-sidebar {
        position: sticky;
        top: 0;
        width: 100%;
        height: auto;
        padding: 80px 18px 14px;
        border-right: 0;
        border-bottom: 1px solid var(--line);
      }

      .nav-sidebar .nav-links {
        flex-direction: row;
        margin-top: 14px;
        overflow: auto;
      }

      .nav-sidebar .nav-foot {
        display: none;
      }

      .shell-sidebar .page-root {
        margin-left: 0;
      }

      .layout-bento {
        width: min(100% - 24px, 680px);
        grid-template-columns: 1fr;
        grid-auto-rows: auto;
      }

      .is-sticky {
        position: relative;
        top: auto;
      }

      .studio-shell {
        display: block;
      }

      .studio-panel {
        position: static;
        height: auto;
      }

      .studio-panel.left {
        display: none;
      }

      .studio-canvas {
        padding: 12px;
      }
    }

    @media (max-width: 760px) {
      .inner-page {
        width: min(100% - 40px, 1180px);
        padding-top: 108px;
      }

      .archive-row {
        grid-template-columns: 64px minmax(0, 1fr);
      }

      .archive-row .meta {
        display: none;
      }

      .friends-grid {
        grid-template-columns: 1fr;
      }

      .feed-alternating .article,
      .feed-alternating .article:nth-child(even),
      .feed-alternating .article:has(.is-portrait),
      .feed-alternating .article:nth-child(even):has(.is-portrait) {
        grid-template-columns: 1fr;
      }

      .feed-alternating .article:nth-child(even) .article-cover {
        order: 0;
      }

      .feed-alternating .article-cover.is-portrait {
        width: min(320px, 88%);
      }

      .layout-grid,
      .layout-grid.grid-three-rail {
        grid-template-columns: minmax(0, 1fr);
        gap: 20px;
        padding: 76px 16px 56px;
      }
    }

    @media (max-width: 640px) {
      .post-nav {
        grid-template-columns: 1fr;
      }

      .post-nav-item.older {
        align-items: flex-start;
        text-align: left;
      }

      .comment-form-grid {
        grid-template-columns: 1fr;
      }

      .post-cover.is-portrait {
        width: min(320px, 88%);
      }

      .lab-bar {
        top: auto;
        right: 8px;
        bottom: 8px;
        left: 8px;
        overflow-x: auto;
        justify-content: flex-start;
      }

      .lab-bar button {
        min-width: max-content;
      }

      .hero h1 {
        font-size: clamp(25px, 7.4vw, 48px);
      }

      .hero-inner {
        gap: 4vh;
      }

      .welcome-quote {
        padding: 22px 20px;
      }

      .quote-text {
        font-size: 15px;
      }

      .nav-topbar .nav-links {
        display: none;
      }

      .nav-hamburger {
        display: grid;
      }

      .mobile-menu {
        padding-inline: 24px;
      }

      .layout-grid.grid-identity {
        width: min(100% - 40px, 1180px);
        gap: 20px;
      }

      .layout-grid.grid-feed-rail {
        width: min(100% - 40px, 1180px);
        gap: 48px;
        padding: 56px 0 72px;
      }

      .site-footer {
        flex-direction: column;
        align-items: center;
        gap: 6px;
        text-align: center;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        scroll-behavior: auto !important;
        transition-duration: 0.01ms !important;
        animation-duration: 0.01ms !important;
      }
    }
  `;

  private selectNode(id: string, event?: Event) {
    // 仅在工作室/预览模式拦截点击；公开浏览时必须放行，让站内路由接管锚点。
    if (this.previewOnly) {
      event?.stopPropagation();
      window.parent.postMessage(
        { source: 'yukilog-studio', type: 'select-node', nodeId: id },
        window.location.origin,
      );
      return;
    }
    if (!this.studio) return;
    event?.stopPropagation();
    if (this.studioStore.select(id)) this.requestUpdate();
  }

  private applyStudioMutation(mutation: StudioMutation) {
    if (!mutation.changed) return;
    this.studioAnnouncement = mutation.announcement;
    this.requestUpdate();
  }

  private runStudioCommand(action: () => StudioMutation) {
    try {
      this.applyStudioMutation(action());
    } catch (error) {
      this.studioAnnouncement =
        error instanceof LayoutCommandError ? error.message : '布局修改失败';
      this.requestUpdate();
    }
  }

  private beginNodeDrag(nodeId: string, event: DragEvent) {
    this.draggingNodeId = nodeId;
    this.draggingComponentType = null;
    this.dropTarget = null;
    event.dataTransfer?.setData('text/yukilog-node', nodeId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    this.requestUpdate();
  }

  private beginComponentDrag(type: ComponentType, event: DragEvent) {
    this.draggingNodeId = null;
    this.draggingComponentType = type;
    this.dropTarget = null;
    event.dataTransfer?.setData('text/yukilog-component', type);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
    this.requestUpdate();
  }

  private allowedDropPositions(targetId: string): DropPosition[] {
    if (this.draggingNodeId) {
      return validDropPositions(this.layout.root, this.draggingNodeId, targetId);
    }
    if (!this.draggingComponentType) return [];
    const target = indexLayout(this.layout.root).get(targetId);
    if (!target) return [];
    const positions: DropPosition[] = [];
    if (target.parentId !== null) positions.push('before', 'after');
    if (componentRegistry[target.node.type].acceptsChildren) positions.splice(1, 0, 'inside');
    return positions;
  }

  private activateDropTarget(
    targetId: string,
    position: DropPosition,
    event: DragEvent,
  ) {
    if (!this.allowedDropPositions(targetId).includes(position)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = this.draggingComponentType ? 'copy' : 'move';
    }
    if (this.dropTarget?.nodeId === targetId && this.dropTarget.position === position) return;
    this.dropTarget = { nodeId: targetId, position };
    this.requestUpdate();
  }

  private dropNode(targetId: string, position: DropPosition, event: DragEvent) {
    this.activateDropTarget(targetId, position, event);
    const draggedId = event.dataTransfer?.getData('text/yukilog-node') || this.draggingNodeId;
    const componentType =
      (event.dataTransfer?.getData('text/yukilog-component') as ComponentType) ||
      this.draggingComponentType;
    if (draggedId) {
      this.runStudioCommand(() => this.studioStore.moveTo(draggedId, targetId, position));
    } else if (componentType && componentRegistry[componentType]) {
      this.insertComponentAt(componentType, targetId, position);
    }
    this.endNodeDrag();
  }

  private endNodeDrag() {
    this.draggingNodeId = null;
    this.draggingComponentType = null;
    this.dropTarget = null;
    this.requestUpdate();
  }

  private moveSibling(id: string, direction: -1 | 1) {
    this.runStudioCommand(() => this.studioStore.moveSibling(id, direction));
  }

  private setSelectedProperty(name: string, value: unknown) {
    this.runStudioCommand(() =>
      this.studioStore.execute({
        type: 'set-prop',
        nodeId: this.selectedNodeId,
        name,
        value,
      }),
    );
  }

  private toggleArrayProperty(name: string, value: string) {
    const selected = indexLayout(this.layout.root).get(this.selectedNodeId)?.node;
    if (!selected) return;
    const values = new Set(Array.isArray(selected.props[name]) ? (selected.props[name] as string[]) : []);
    if (values.has(value)) values.delete(value);
    else values.add(value);
    this.setSelectedProperty(name, [...values]);
  }

  private addComponent(type: ComponentType) {
    const selected = indexLayout(this.layout.root).get(this.selectedNodeId)?.node;
    const targetId =
      selected && componentRegistry[selected.type].acceptsChildren
        ? selected.id
        : this.layout.root.id;
    const node = this.createComponentNode(type);
    this.runStudioCommand(() =>
      this.studioStore.execute({ type: 'insert-node', parentId: targetId, node }),
    );
  }

  private createComponentNode(type: ComponentType): LayoutNode {
    const definition = componentRegistry[type];
    return {
      id: `${type}-${Date.now().toString(36)}-${(this.nodeSequence += 1).toString(36)}`,
      type,
      props: structuredClone(definition.defaultProps),
    };
  }

  private insertComponentAt(type: ComponentType, targetId: string, position: DropPosition) {
    const target = indexLayout(this.layout.root).get(targetId);
    if (!target) return;
    const node = this.createComponentNode(type);
    const parentId = position === 'inside' ? targetId : target.parentId;
    if (!parentId) return;
    const index =
      position === 'inside' ? target.node.children?.length : target.index + (position === 'after' ? 1 : 0);
    this.runStudioCommand(() =>
      this.studioStore.execute({ type: 'insert-node', parentId, index, node }),
    );
  }

  private removeSelected() {
    this.runStudioCommand(() =>
      this.studioStore.execute({ type: 'remove-node', nodeId: this.selectedNodeId }),
    );
  }

  private undoStudio() {
    this.applyStudioMutation(this.studioStore.undo());
  }

  private redoStudio() {
    this.applyStudioMutation(this.studioStore.redo());
  }

  private setMobileMenu(open: boolean) {
    this.mobileMenuOpen = open;
    document.body.style.overflow = open ? 'hidden' : '';
    this.requestUpdate();
  }

  private isCurrentPage(href: string) {
    const path = window.location.pathname;
    return href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
  }

  private renderNavigation() {
    const items = publicNavigation;
    const links = html`
      <div class="nav-links">
        ${items.map(
          (item) => html`
            <a
              class="nav-item${this.isCurrentPage(item.href) ? ' active' : ''}"
              href=${item.href}
              aria-label=${item.label}
            >
              <span class="nav-icon">${icon(item.icon)}</span>
              <span class="nav-label">${item.label}</span>
            </a>
          `,
        )}
      </div>
    `;
    const actions = html`
      <div class="nav-actions">
        ${this.layout.shell.showSearch
          ? html`<a
              class="nav-action nav-search${this.isCurrentPage('/search') ? ' active' : ''}"
              href="/search"
              aria-label="搜索"
              ><span class="search-icon">${icon('search')}</span
              ><span class="search-text">搜索</span></a
            >`
          : nothing}
        <button
          class="nav-action nav-hamburger"
          type="button"
          aria-label=${this.mobileMenuOpen ? '关闭菜单' : '打开菜单'}
          aria-expanded=${this.mobileMenuOpen}
          @click=${() => this.setMobileMenu(!this.mobileMenuOpen)}
        >
          ${icon(this.mobileMenuOpen ? 'close' : 'menu')}
        </button>
      </div>
    `;
    if (this.layout.shell.navigation === 'sidebar') {
      return html`
        <nav class="site-nav nav-sidebar">
          <a class="brand" href="/">${this.siteData.siteTitle}</a>
          ${links}
          <div class="nav-foot">写给时间的长信<br />RSS · Mail</div>
        </nav>
      `;
    }
    if (this.layout.shell.navigation === 'floating-dock') {
      return html`<nav class="site-nav nav-dock"><a class="brand" href="/">Y</a>${links}</nav>`;
    }
    return html`
      <div class="nav-corners${this.navPastHero ? ' hidden' : ''}">
        <a class="brand" href="/">${this.siteData.siteTitle}</a>
        ${links}
        ${actions}
      </div>
      <nav class="site-nav nav-topbar${this.navPastHero ? ' nav-sticky' : ''}">
        <a class="brand" href="/">${this.siteData.siteTitle}</a>
        ${links}
        <div class="nav-inner-actions">${actions}</div>
      </nav>
      ${this.mobileMenuOpen
        ? html`
            <div
              class="mobile-menu-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="导航菜单"
              @click=${() => this.setMobileMenu(false)}
            >
              <section class="mobile-menu" @click=${(event: Event) => event.stopPropagation()}>
                <header class="mobile-menu-header">
                  <strong>${this.siteData.siteTitle}</strong>
                  <button
                    class="nav-action"
                    type="button"
                    aria-label="关闭菜单"
                    @click=${() => this.setMobileMenu(false)}
                  >
                    ${icon('close')}
                  </button>
                </header>
                <nav class="mobile-menu-nav">
                  ${items.map(
                    (item) => html`
                      <a
                        class="mobile-nav-item${this.isCurrentPage(item.href) ? ' active' : ''}"
                        href=${item.href}
                        @click=${() => this.setMobileMenu(false)}
                      >
                        <span class="nav-icon">${icon(item.icon)}</span>
                        <span>${item.label}</span>
                      </a>
                    `,
                  )}
                </nav>
              </section>
            </div>
          `
        : nothing}
    `;
  }

  private renderNode(node: LayoutNode): unknown {
    const definition = componentRegistry[node.type];
    const selected =
      (this.studio && node.id === this.selectedNodeId) ||
      (this.previewOnly && node.id === this.previewSelectedNodeId);
    const base = `node node-${node.type}${selected ? ' selected' : ''}`;
    const click = (event: Event) => this.selectNode(node.id, event);

    if (definition.acceptsChildren) {
      const gap = typeof node.props.gap === 'string' ? ` gap-${node.props.gap}` : '';
      const align = typeof node.props.align === 'string' ? ` align-${node.props.align}` : '';
      const sticky = node.props.sticky ? ' is-sticky' : '';
      const columns =
        node.type === 'grid' && node.props.columns === '240px minmax(0, 1fr) 240px'
          ? ' grid-three-rail'
          : node.type === 'grid' && node.props.columns === '280px minmax(0, 1fr)'
            ? ' grid-aside-first'
            : node.type === 'grid' && node.props.columns === 'auto minmax(0, 1fr) auto'
              ? ' grid-identity'
              : node.type === 'grid' && node.props.columns === 'minmax(0, 1fr) 300px'
                ? ' grid-feed-rail'
                : '';
      const maxWidth =
        node.props.maxWidth === 'full'
          ? ' max-full'
          : node.props.maxWidth === '1240px'
            ? ' max-1240'
            : '';
      const card =
        node.type === 'card'
          ? [
              ` card-${String(node.props.variant ?? 'plain')}`,
              ` padding-${String(node.props.padding ?? 'md')}`,
              ` radius-${String(node.props.radius ?? 'md')}`,
              ` shadow-${String(node.props.shadow ?? 'none')}`,
              ` align-${String(node.props.align ?? 'stretch')}`,
            ].join('')
          : '';
      return html`
        <section
          class="${base} layout-${node.type}${gap}${align}${sticky}${columns}${maxWidth}${card}"
          data-label="${definition.label}"
          data-node-id="${node.id}"
          .draggable=${this.studio && node.id !== this.layout.root.id}
          @dragstart=${(event: DragEvent) => this.beginNodeDrag(node.id, event)}
          @dragend=${this.endNodeDrag}
          @dragover=${(event: DragEvent) => this.activateDropTarget(node.id, 'inside', event)}
          @drop=${(event: DragEvent) => this.dropNode(node.id, 'inside', event)}
          @click=${click}
        >
          ${node.children?.map((child) => this.renderNode(child))}
        </section>
      `;
    }

    switch (node.type) {
      case 'hero':
        return this.renderHero(node, base, click);
      case 'masthead':
        return this.renderMasthead(node, base, click);
      case 'avatar':
        {
          const avatarClass = `${base} primitive-avatar avatar-${String(
            node.props.size ?? 'md',
          )} avatar-${String(node.props.shape ?? 'circle')}`;
          const label = String(node.props.label ?? this.siteData.ownerName);
          return this.siteData.avatarUrl && node.props.source === 'site-owner'
            ? html`
                <img
                  class=${avatarClass}
                  src=${this.siteData.avatarUrl}
                  alt=${label}
                  data-label="头像"
                  @click=${click}
                />
              `
            : html`
                <div class=${avatarClass} data-label="头像" @click=${click}>
                  ${this.siteData.ownerName.slice(0, 1) || '雪'}
                </div>
              `;
        }
      case 'text-block':
        return this.renderTextBlock(node, base, click);
      case 'social-links':
        return html`
          <nav
            class="${base} primitive-socials socials-${String(
              node.props.variant ?? 'labels',
            )} text-${String(node.props.alignment ?? 'left')}"
            data-label="社交链接"
            @click=${click}
          >
            ${[...this.siteData.socialLinks, { label: 'RSS', url: '/feed.xml' }].map(
              (link) => html`<a href=${link.url}>${link.label}</a>`,
            )}
          </nav>
        `;
      case 'status-line':
        {
          const statusText = String(node.props.text ?? '');
          return html`
            <pre
              class="${base} ${statusText.includes('system.log') ? 'profile-log' : 'primitive-status'} status-${String(
                node.props.tone ?? 'neutral',
              )}"
              data-label="状态行"
              @click=${click}
            >${statusText}</pre>
          `;
        }
      case 'profile-card':
        return this.renderProfile(node, base, click);
      case 'article-feed':
        return this.renderArticleFeed(node, base, click);
      case 'quote':
        return html`
          <aside class="${base} quote-card" data-label="引语" data-reveal @click=${click}>
            ${String(node.props.text ?? '')}
            <cite>${String(node.props.attribution ?? '')}</cite>
          </aside>
        `;
      case 'stats':
        {
          const fields = new Set((node.props.fields as string[]) ?? []);
          const available = [
            ['articles', '6', '文章'],
            ['dynamics', '5', '动态'],
            ['friends', '4', '友链'],
            ['views', '604', '总阅读'],
          ] as const;
        return html`
          <section class="${base} stats-card" data-label="站点数据" data-reveal @click=${click}>
            <p class="component-kicker">站点信息</p>
            <div class="stats-grid">
                ${available
                  .filter(([field]) => fields.size === 0 || fields.has(field))
                  .map(
                    ([, value, label]) =>
                      html`<div class="stat"><strong>${value}</strong><span>${label}</span></div>`,
                  )}
            </div>
          </section>
        `;
        }
      case 'dynamic-strip':
        {
          const limit = Number(node.props.limit ?? 3);
          const variant = String(node.props.variant ?? 'compact');
        return html`
            <section
              class="${base} dynamic-strip dynamics-${variant}"
              data-label="最近动态"
              data-reveal
              @click=${click}
            >
            <a
              class="component-kicker strip-kicker"
              href="/dynamics"
              aria-label="查看全部动态"
              @click=${(event: Event) => event.stopPropagation()}
            >
                最近动态
                <span class="strip-more" aria-hidden="true">更多 ›</span>
              </a>
              ${dynamics
                .slice(0, Math.max(1, limit))
                .map(
                  (item) =>
                    html`<div class="dynamic-item">
                      <time>${item.time.slice(5, 10)}</time><span>${item.text}</span>
                    </div>`,
                )}
          </section>
        `;
        }
      default:
        return nothing;
    }
  }

  private renderHero(node: LayoutNode, base: string, click: (event: Event) => void) {
    const variant = String(node.props.variant ?? 'cinematic');
    const title = String(node.props.title ?? '');
    const accentChars = new Set(String(node.props.accent ?? ''));
    const background = this.mediaLibrary.find(
      (media) => media.id === String(node.props.backgroundMediaId ?? ''),
    );
    const backgroundPosition = String(node.props.backgroundPosition ?? 'center');
    const overlay = String(node.props.overlay ?? 'medium');
    const socialLinks = [
      ...this.siteData.socialLinks,
      { label: 'RSS', url: '/feed.xml' },
    ];
    const socialColors = ['#6e7f8d', '#e3a0ae', '#7eb6d9', '#8fafc4', '#e8a4b4', '#d6a1ae', '#f0a65a'];
    const details = html`
      <div class="welcome-quote">
        <span class="quote-text">${String(node.props.lead ?? '')}</span>
        ${node.props.showSocials
          ? html`
              <nav class="social-row" aria-label="社交链接">
                ${socialLinks.map(
                  (link, index) => html`
                    <a
                      class="social-icon"
                      href=${link.url}
                      aria-label=${link.label}
                      title=${link.label}
                      target=${/^https?:/.test(link.url) ? '_blank' : nothing}
                      rel=${/^https?:/.test(link.url) ? 'noopener noreferrer' : nothing}
                      style=${styleMap({ color: socialColors[index % socialColors.length] })}
                    >
                      ${socialGlyph(link.label, index)}
                    </a>
                  `,
                )}
              </nav>
            `
          : nothing}
      </div>
    `;
    return html`
      <section
        class="${base} hero hero-${variant} overlay-${overlay}${background ? ' has-media' : ''}"
        data-label="沉浸式首屏"
        data-node-id="${node.id}"
        @click=${click}
      >
        ${background
          ? html`
              <div
                class="hero-background"
                role="img"
                aria-label=${background.name}
                style=${styleMap({
                  backgroundImage: `url(${JSON.stringify(background.url)})`,
                  backgroundPosition,
                })}
              ></div>
            `
          : nothing}
        <div class="hero-inner">
          <h1>
            ${variant === 'cinematic'
              ? [...title].map(
                  (character, index) =>
                    html`<span
                      class="hero-character${accentChars.has(character) ? ' accent' : ''}"
                      style="--char-index:${index}"
                      >${character}</span
                    >`,
                )
              : title}
          </h1>
          ${variant === 'cinematic' ? html`<div class="hero-info">${details}</div>` : details}
        </div>
        ${node.props.showEnter
          ? html`<button
              class="enter-button"
              aria-label="进入文章区域"
              @click=${(event: Event) => {
                event.stopPropagation();
                window.scrollTo({
                  top: window.innerHeight,
                  behavior: this.reducedMotion ? 'auto' : 'smooth',
                });
              }}
            >
              <span>ENTER</span>${icon('arrow-down')}
            </button>`
          : nothing}
      </section>
    `;
  }

  private renderMasthead(node: LayoutNode, base: string, click: (event: Event) => void) {
    const variant = String(node.props.variant ?? 'editorial');
    const rawTitle = String(node.props.title ?? '');
    // 首页文章流刊头：标题随排序 tab 联动（用户在工作室改过标题则尊重自定义）
    const sortTitles: Record<string, string> = {
      featured: '精选文章',
      popular: '最热文章',
      recent: '最近文章',
    };
    const sortLinked =
      variant === 'minimal' && (rawTitle === '' || Object.values(sortTitles).includes(rawTitle));
    const title = sortLinked ? sortTitles[this.feedSort] : rawTitle;
    const background = this.mediaLibrary.find(
      (media) => media.id === String(node.props.backgroundMediaId ?? ''),
    );
    return html`
      <header
        class="${base} masthead masthead-${variant}${background ? ' has-bg' : ''}"
        style=${background
          ? styleMap({ backgroundImage: `url("${background.url}")` })
          : nothing}
        data-label="文字刊头"
        data-node-id="${node.id}"
        @click=${click}
      >
        <p class="kicker">${String(node.props.kicker ?? 'YukiLog · Vol. 01')}</p>
        <h1>${keyed(title, html`<span class="sort-title-anim">${title}</span>`)}</h1>
        ${sortLinked
          ? html`<div class="sort-tabs" role="group" aria-label="文章排序">
              ${(
                [
                  ['featured', '精选'],
                  ['popular', '最热'],
                  ['recent', '最近'],
                ] as const
              ).map(
                ([value, label]) => html`
                  <button
                    type="button"
                    aria-pressed=${this.feedSort === value}
                    @click=${(event: Event) => {
                      event.stopPropagation();
                      this.feedSort = value;
                      this.requestUpdate();
                    }}
                  >
                    ${label}
                  </button>
                `,
              )}
            </div>`
          : html`<p class="lead">${String(node.props.lead ?? '')}</p>`}
      </header>
    `;
  }

  private renderTextBlock(node: LayoutNode, base: string, click: (event: Event) => void) {
    const source = String(node.props.source ?? 'literal');
    const text =
      {
        'owner-name': this.siteData.ownerName,
        'owner-bio': this.siteData.ownerBio,
        'site-title': this.siteData.siteTitle,
        'site-description': this.siteData.siteDescription,
      }[source] ?? String(node.props.text ?? '');
    const variant = String(node.props.variant ?? 'body');
    return html`
      <div
        class="${base} primitive-text text-${variant} text-${String(
          node.props.alignment ?? 'left',
        )}"
        data-label="文字块"
        @click=${click}
      >
        ${text}
      </div>
    `;
  }

  private renderProfile(node: LayoutNode, base: string, click: (event: Event) => void) {
    const flipped = this.flippedProfiles.has(node.id);
    const variant = String(node.props.variant ?? 'portrait');
    const canFlip = node.props.flip !== false;
    return html`
      <section
        class="${base} profile-card profile-${variant}"
        data-label="双面个人卡"
        data-node-id="${node.id}"
        @click=${click}
      >
        <button
          class="profile-button"
          aria-label="翻转个人卡片"
          aria-pressed=${flipped}
          ?disabled=${!canFlip}
          @click=${(event: Event) => {
            event.stopPropagation();
            if (!canFlip) return;
            if (flipped) this.flippedProfiles.delete(node.id);
            else this.flippedProfiles.add(node.id);
            this.requestUpdate();
          }}
        >
          <span class="profile-face">
            <span class="avatar" aria-hidden="true">雪</span>
            <h2>Sakurine</h2>
            <p>写代码，也收集深夜、长风和那些不肯消失的心动。</p>
            ${node.props.showSocials
              ? html`<span class="profile-socials">GitHub · RSS · Mail</span>`
              : nothing}
            ${node.props.showStatus
              ? html`<span class="profile-status">● system.log · rebuilding</span>`
              : nothing}
            ${canFlip ? html`<span class="profile-hint">轻触卡片，读另一面</span>` : nothing}
          </span>
          <span class="profile-face profile-back">
            <p class="component-kicker">About this person</p>
            <h2>比起数字肖像</h2>
            <p>我更愿意把这里当成一封持续写下去的长信。技术只是语言之一。</p>
            <span class="profile-hint">再轻触一次，回到正面</span>
          </span>
        </button>
      </section>
    `;
  }

  private renderArticleFeed(node: LayoutNode, base: string, click: (event: Event) => void) {
    const variant = String(node.props.variant ?? 'compact');
    const fields = new Set((node.props.fields as ArticleField[]) ?? []);
    const limit = Number(node.props.limit ?? articles.length);
    const sort = this.feedSort;
    const sortedArticles =
      sort === 'popular'
        ? [...articles].sort((left, right) => right.likes - left.likes)
        : sort === 'featured'
          ? [...articles].sort(
              (left, right) => Number(right.featured) - Number(left.featured),
            )
          : articles;
    return html`
      <section
        class="${base} article-feed feed-${variant}"
        data-label="文章列表 · ${variant}"
        data-node-id="${node.id}"
        @click=${click}
      >
        ${sortedArticles.slice(0, Math.max(1, limit)).map(
          (article) => html`
            <article class="article" data-reveal>
              ${fields.has('cover')
                ? html`<a class="article-cover ${article.cover}${
                    article.orientation === 'portrait' ? ' is-portrait' : ''
                  }" href=${`/articles/${article.slug}`} aria-label=${article.title}></a>`
                : nothing}
              <div class="article-copy">
                <div class="meta">
                  ${fields.has('category')
                    ? html`<span class="cat">${article.category}</span>`
                    : nothing}
                  ${fields.has('date') ? html`<time>${article.date}</time>` : nothing}
                </div>
                <h3><a href=${`/articles/${article.slug}`}>${article.title}</a></h3>
                ${fields.has('summary') ? html`<p class="summary">${article.summary}</p>` : nothing}
                <div class="foot">
                  ${fields.has('tags')
                    ? html`<div class="tags">
                        ${article.tags.map(
                          (tag) => html`<a href=${`/search?tag=${tag}`}>#${tag}</a>`,
                        )}
                      </div>`
                    : nothing}
                  ${fields.has('views') ? html`<span>${article.views} 阅读</span>` : nothing}
                  ${fields.has('likes') ? html`<span>${article.likes} 喜欢</span>` : nothing}
                </div>
              </div>
            </article>
          `,
        )}
        ${sortedArticles.length > Math.max(1, limit)
          ? html`<a
              class="feed-more"
              href="/articles"
              @click=${(event: Event) => event.stopPropagation()}
              >全部文章 <span aria-hidden="true">›</span></a
            >`
          : nothing}
      </section>
    `;
  }

  private renderSubscribeCard(kind: 'articles' | 'dynamics') {
    const done = this.subscribeDone.has(kind);
    const failed = this.subscribeFailed.has(kind);
    const copy =
      kind === 'articles'
        ? {
            text: '新文章发布时，给你发一封短短的邮件。',
            other: '同时订阅动态',
            feed: '/feeds/articles.xml',
          }
        : {
            text: '新动态发布时，给你发一封通知。',
            other: '同时订阅文章',
            feed: '/feeds/dynamics.xml',
          };
    return html`
      <section class="subscribe-strip" data-reveal>
        ${done
          ? html`<p class="sub-ok">确认邮件已经发出，点一下邮件里的链接，订阅就生效了。</p>`
          : html`
              <div class="sub-copy">
                <p class="component-kicker">邮件订阅</p>
                <p class="sub-text">
                  ${copy.text}每封邮件末尾都有一键退订；也欢迎用 <a href=${copy.feed}>RSS</a>。
                </p>
              </div>
              <form class="sub-form" @submit=${(event: SubmitEvent) => this.submitSubscribe(event, kind)}>
                <input
                  name="email"
                  type="email"
                  required
                  maxlength="254"
                  placeholder="you@example.com"
                  aria-label="邮箱地址"
                />
                <label class="sub-other"><input type="checkbox" name="with_other" />${copy.other}</label>
                <button type="submit" ?disabled=${this.subscribeBusy}>
                  ${this.subscribeBusy ? '发送中…' : '订阅'}
                </button>
              </form>
              ${failed
                ? html`<p class="sub-err">提交失败，请稍后再试；也可以先用 RSS。</p>`
                : nothing}
            `}
      </section>
    `;
  }

  private renderArticleCollection(items: typeof articles) {
    const years = [...new Set(items.map((item) => item.date.slice(0, 4)))];
    return years.map((year) => {
      const group = items.filter((item) => item.date.startsWith(year));
      return html`
        <section class="archive-year">
          <h2 data-reveal>${year} <span>${group.length} 篇</span></h2>
          ${group.map(
            (article, index) => html`
              <a class="archive-row" data-reveal href=${`/articles/${article.slug}`}>
                <time>${article.date.slice(7).replace(' · ', '.')}</time>
                <h3><span>${article.title}</span></h3>
                <div class="meta">
                  <span class="cat ${index % 2 === 0 ? 'cat-b' : 'cat-p'}">${article.category}</span>
                  <span>${article.views} 阅读</span>
                </div>
                <div class="archive-more">
                  <div class="archive-more-in">
                    <i
                      class="archive-cover ${article.cover}${article.orientation === 'portrait' ? ' is-portrait' : ''}"
                      role="img"
                      aria-label=${`${article.title}的封面`}
                    ></i>
                    <p class="archive-summary">${article.summary}</p>
                  </div>
                </div>
              </a>
            `,
          )}
        </section>
      `;
    });
  }

  private highlight(text: string, query: string): unknown {
    if (!query || !text.includes(query)) return text;
    const parts = text.split(query);
    return parts.flatMap((part, index) =>
      index === 0 ? [part] : [html`<mark>${query}</mark>`, part],
    );
  }

  private renderIndexRows(items: typeof articles, query: string) {
    return html`
      <div class="results">
        <p class="cap" data-reveal>
          ${query ? `「${query}」· ` : ''}${items.length} 条结果
        </p>
        ${items.map(
          (article) => html`
            <a class="result" data-reveal href=${`/articles/${article.slug}`}>
              <div class="meta">
                <span class="cat">${article.category}</span><time>${article.date}</time>
              </div>
              <h3>${this.highlight(article.title, query)}</h3>
              <p>${this.highlight(article.summary, query)}</p>
            </a>
          `,
        )}
      </div>
    `;
  }

  private renderInnerPage() {
    const path = window.location.pathname;
    const article = articles.find((item) => path === `/articles/${item.slug}`);
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q')?.trim() ?? '';
    const category = params.get('category') ?? '';
    const tag = params.get('tag') ?? '';
    const year = params.get('year') ?? '';
    const categories = [...new Set(articles.map((item) => item.category))];
    const tags = [...new Set(articles.flatMap((item) => item.tags))];
    const years = [...new Set(articles.map((item) => item.date.slice(0, 4)))];
    const filterHref = (key: string, value: string) => {
      const next = new URLSearchParams(params);
      if (next.get(key) === value) next.delete(key);
      else next.set(key, value);
      const search = next.toString();
      return `/search${search ? `?${search}` : ''}`;
    };
    const friends = [
      ['星港', 'https://yeastar.xin', 'yeastar.xin', '另一处慢慢更新的主站。', 'SINCE 2024.10', 'cover-one'],
      ['夜航', 'https://github.com/Yueosa', 'github.com/Yueosa', '代码和还没写完的实验。', 'SINCE 2023.04', 'cover-two'],
      ['电台', 'https://music.163.com/#/user/home?id=630887153', 'music.163.com', '适合后半夜再读。', 'SINCE 2024.11', 'cover-three'],
      ['窗边', 'https://x.com/Yosa04942475621', 'x.com/Yosa04942475621', '偶尔留下一句近况。', 'SINCE 2025.06', 'cover-four'],
    ] as const;

    if (article) {
      const articleIndex = articles.indexOf(article);
      const newer = articles[articleIndex - 1];
      const older = articles[articleIndex + 1];
      const liked = this.likedArticles.has(article.slug);
      const tocLink = (item: { id: string; text: string; level: number }) => html`<a
        class="post-toc-item level-${item.level}${this.tocActive === item.id ? ' is-active' : ''}"
        href="#${item.id}"
        @click=${(event: Event) => {
          event.preventDefault();
          this.tocActive = item.id;
          this.renderRoot
            .querySelector(`#${CSS.escape(item.id)}`)
            ?.scrollIntoView({ behavior: this.reducedMotion ? 'auto' : 'smooth', block: 'start' });
        }}
        >${item.text}</a
      >`;
      return html`
        <main class="inner-page">
          <article class="article-page">
            <a
              class="post-back"
              href="/articles"
              @click=${(event: Event) => {
                event.preventDefault();
                if (this.spaNavigated && window.history.length > 1) {
                  window.history.back();
                } else {
                  window.history.pushState(null, '', '/articles');
                  this.handleRouteChange();
                }
              }}
              >← 返回</a
            >
            <header class="post-head" data-reveal>
              <p class="component-kicker">${article.category}</p>
              <h1>${article.title}</h1>
              <p class="post-meta">
                <time>${article.date}</time>
                <span aria-hidden="true">·</span>
                <span>${article.views} 阅读</span>
                <span aria-hidden="true">·</span>
                <span>${article.likes + (liked ? 1 : 0)} 喜欢</span>
                <span aria-hidden="true">·</span>
                <span>约 6 分钟</span>
              </p>
              <p class="post-summary">${article.summary}</p>
            </header>
            ${this.tocItems.length > 1
              ? html`<nav class="post-toc" aria-label="目录">
                  <div class="post-toc-sticky">
                    <p class="post-toc-kicker">目录</p>
                    ${this.tocItems.map(tocLink)}
                  </div>
                </nav>`
              : nothing}
            <div
              class="post-cover ${article.cover}${article.orientation === 'portrait' ? ' is-portrait' : ''}"
              role="img"
              aria-label=${`${article.title}的封面`}
              data-reveal
            ></div>
            ${this.tocItems.length > 1
              ? html`<details class="post-toc-mobile" data-reveal>
                  <summary>目录 · ${this.tocItems.length} 节</summary>
                  ${this.tocItems.map(tocLink)}
                </details>`
              : nothing}
            <div class="prose" data-reveal>${articleProseMock}</div>
            <p class="post-end" data-reveal>完</p>
            <footer class="post-foot" data-reveal>
              <div class="post-tags">
                ${article.tags.map(
                  (tag) => html`<a class="post-tag" href=${`/search?tag=${encodeURIComponent(tag)}`}>#${tag}</a>`,
                )}
              </div>
              <button
                class="heart-button post-like${liked ? ' liked' : ''}"
                type="button"
                aria-pressed=${liked}
                aria-label=${liked ? '取消喜欢' : '喜欢这篇文章'}
                @click=${() => {
                  if (liked) this.likedArticles.delete(article.slug);
                  else this.likedArticles.add(article.slug);
                  this.requestUpdate();
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 20.3C7.2 16.9 3.5 13.6 3.5 9.9 3.5 7.2 5.6 5 8.3 5c1.5 0 2.9.7 3.7 1.9C12.8 5.7 14.2 5 15.7 5c2.7 0 4.8 2.2 4.8 4.9 0 3.7-3.7 7-8.5 10.4Z"
                  />
                </svg>
                <span class="heart-count">${article.likes + (liked ? 1 : 0)}</span>
                <span>${liked ? '已喜欢' : '喜欢这篇'}</span>
              </button>
            </footer>
            <nav class="post-nav" data-reveal aria-label="相邻文章">
              ${newer
                ? html`<a class="post-nav-item" href=${`/articles/${newer.slug}`}>
                    <span class="post-nav-kicker">← 上一篇</span>
                    <span class="post-nav-title">${newer.title}</span>
                  </a>`
                : html`<span aria-hidden="true"></span>`}
              ${older
                ? html`<a class="post-nav-item older" href=${`/articles/${older.slug}`}>
                    <span class="post-nav-kicker">下一篇 →</span>
                    <span class="post-nav-title">${older.title}</span>
                  </a>`
                : html`<span aria-hidden="true"></span>`}
            </nav>
            <section class="comments" data-reveal>
              <header class="comments-head">
                <h2>评论</h2>
                <span class="comments-count">3 条</span>
              </header>
              ${this.commentFormOpen
                ? html`<form class="comment-form is-open" @submit=${(event: Event) => event.preventDefault()}>
                    <div class="comment-form-grid">
                      <label>昵称<input name="display_name" required maxlength="24" placeholder="怎么称呼你" /></label>
                      <label>邮箱（选填，会公开展示）<input name="email" type="email" placeholder="用于头像和公开展示" /></label>
                      <label>网站（选填）<input name="website" type="url" placeholder="https://" /></label>
                    </div>
                    <label class="comment-content">
                      内容
                      <textarea name="content" required rows="4" maxlength="2000" placeholder="想说什么都可以，慢一点也没关系。"></textarea>
                    </label>
                    <div class="comment-form-foot">
                      <p class="comment-note">评论会在审核后显示；昵称和邮箱会公开展示。</p>
                      <div class="comment-form-actions">
                        <button
                          class="comment-cancel"
                          type="button"
                          @click=${() => {
                            this.commentFormOpen = false;
                            this.requestUpdate();
                          }}
                        >
                          先不写了
                        </button>
                        <button type="submit">寄出评论</button>
                      </div>
                    </div>
                  </form>`
                : html`<button
                    class="comment-compose"
                    type="button"
                    @click=${() => {
                      this.commentFormOpen = true;
                      this.requestUpdate();
                    }}
                  >
                    <span class="comment-avatar">${this.avatarFallback('来访者')}</span>
                    <span class="comment-compose-hint">写下你的想法，点这里开始评论…</span>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  </button>`}
              <ol class="comment-list">
                <li class="comment">
                  <header>
                    ${this.commentAvatar('远岸', 'https://yeastar.xin')}
                    <div class="comment-who">
                      <div class="comment-line">
                        <a class="comment-name" href="https://yeastar.xin" rel="nofollow">远岸</a>
                        <time>2026 · 10 · 04 / 23:14</time>
                      </div>
                      <div class="comment-meta">
                        <a class="comment-site" href="https://yeastar.xin" rel="nofollow">yeastar.xin</a>
                        <span>Desktop Firefox 143 · Arch Linux</span>
                      </div>
                    </div>
                  </header>
                  <p>「旧服务器消失」这句话看得心里一沉，但读到最后又觉得很轻。欢迎回来。</p>
                </li>
                <li class="comment">
                  <header>
                    ${this.commentAvatar('栖迟')}
                    <div class="comment-who">
                      <div class="comment-line">
                        <span class="comment-name">栖迟</span>
                        <time>2026 · 10 · 05 / 01:02</time>
                      </div>
                      <div class="comment-meta">
                        <span>qichi@example.com</span>
                        <span>Mobile Safari 17 · iOS 17</span>
                      </div>
                    </div>
                  </header>
                  <p>备份那一段太真实了……我也是丢了数据之后，才学会给自己写备份脚本的。</p>
                  <ol class="comment-children">
                    <li class="comment">
                      <header>
                        ${this.commentAvatar('恋')}
                        <div class="comment-who">
                          <div class="comment-line">
                            <span class="comment-name is-owner">恋</span>
                            <span class="comment-badge">作者</span>
                            <time>2026 · 10 · 05 / 09:40</time>
                          </div>
                          <div class="comment-meta">
                            <span>Desktop Firefox 143 · Arch Linux</span>
                          </div>
                        </div>
                      </header>
                      <p>是的，现在备份每天自己跑，再也不用记住这件事了。</p>
                    </li>
                  </ol>
                </li>
              </ol>
            </section>
          </article>
        </main>
      `;
    }

    if (path === '/articles') {
      return html`
        <main class="inner-page">
          <header class="page-head" data-reveal>
            <p class="kicker caps">YukiLog — Archive</p>
            <h1>文章</h1>
            <p class="inner-lede">长文、随笔与手记，按时间倒序。写得慢，但每一篇都算数。</p>
          </header>
          ${this.renderSubscribeCard('articles')}
          ${this.renderArticleCollection(articles)}
        </main>
      `;
    }

    if (path === '/dynamics') {
      return html`
        <main class="inner-page">
          <header class="page-head" data-reveal>
            <p class="kicker caps">YukiLog — Moments</p>
            <h1>动态</h1>
            <p class="inner-lede">短句与片刻，散落在时间里的星。不必完整，真实就好。</p>
          </header>
          ${this.renderSubscribeCard('dynamics')}
          <div class="timeline">${dynamics.map((item, index) => this.renderMoment(item, index))}</div>
        </main>
      `;
    }

    if (path === '/friends') {
      return html`
        <main class="inner-page">
          <header class="page-head" data-reveal>
            <p class="kicker caps">YukiLog — Friends</p>
            <h1>友链</h1>
            <p class="inner-lede">互联网很大，但总有一些站点值得互相留一盏灯。</p>
          </header>
          <div class="friends-grid">
            ${friends.map(
              ([name, url, host, description, since, cover]) => html`
                <a class="friend" data-reveal href=${url} target="_blank" rel="noopener noreferrer">
                  <span class="friend-avatar ${cover}">
                    <span aria-hidden="true">${name.slice(0, 1)}</span>
                    <img
                      src=${`https://${new URL(url).host}/favicon.ico`}
                      alt=""
                      loading="lazy"
                      @error=${(event: Event) => (event.currentTarget as HTMLImageElement).remove()}
                    />
                  </span>
                  <div>
                    <h3>${name}</h3>
                    <span class="furl">${host}</span>
                    <p>${description}</p>
                    <span class="fsince">${since}</span>
                  </div>
                </a>
              `,
            )}
          </div>
          <section class="friend-apply" data-reveal>
            <p class="component-kicker">交换友链</p>
            <h2>也为你的站点留一盏灯？</h2>
            ${this.friendApplyDone
              ? html`<p class="apply-ok">申请已经收到，审核通过后就会出现在上面。谢谢你的灯。</p>`
              : html`
                  <p class="apply-lede">
                    留下站点信息，我看过之后就会挂到这里。favicon 可以留空，会自动取你站点的 /favicon.ico。
                  </p>
                  <form class="apply-form" @submit=${this.submitFriendApplication}>
                    <label>站点名称<input name="name" required maxlength="40" placeholder="你的站点名字" /></label>
                    <label>站点地址<input name="url" type="url" required placeholder="https://…" /></label>
                    <label>联系邮箱<input name="email" type="email" required maxlength="254" placeholder="方便我回复你" /></label>
                    <label>favicon 链接（选填）<input name="avatar_url" type="url" maxlength="2048" placeholder="留空则自动获取" /></label>
                    <label class="wide">一句话介绍<textarea name="description" rows="2" maxlength="120" placeholder="这个站点在记录什么？"></textarea></label>
                    ${this.friendApplyError ? html`<p class="apply-err">${this.friendApplyError}</p>` : nothing}
                    <button type="submit" ?disabled=${this.friendApplyBusy}>
                      ${this.friendApplyBusy ? '提交中…' : '提交申请'}
                    </button>
                  </form>
                `}
          </section>
        </main>
      `;
    }

    if (path === '/search') {
      const found = articles.filter((item) => {
        const text = `${item.title} ${item.summary} ${item.category} ${item.tags.join(' ')}`;
        return (
          (!query || text.includes(query)) &&
          (!category || item.category === category) &&
          (!tag || item.tags.includes(tag)) &&
          (!year || item.date.startsWith(year))
        );
      });
      return html`
        <main class="inner-page">
          <header class="page-head" data-reveal>
            <p class="kicker caps">YukiLog — Search</p>
            <h1>搜索</h1>
            <p class="inner-lede">在文章、动态与随记里，找一段你还记得的话。</p>
          </header>
          <form class="search-box" method="get" action="/search" @submit=${this.handleSiteSubmit}>
            ${category ? html`<input type="hidden" name="category" value=${category} />` : nothing}
            ${tag ? html`<input type="hidden" name="tag" value=${tag} />` : nothing}
            ${year ? html`<input type="hidden" name="year" value=${year} />` : nothing}
            <input name="q" value=${query} maxlength="100" aria-label="搜索关键词" placeholder=${`试着搜搜：${tags.slice(0, 3).join('、')}……`} />
            <button type="submit">搜索</button>
          </form>
          <p class="search-hint">ENTER 搜索 · 支持标题 / 正文 / 标签</p>
          <div class="filter-bar">
            ${categories.map(
              (item) => html`<a class="filter-chip${category === item ? ' on' : ''}" href=${filterHref('category', item)}>${item}</a>`,
            )}
            ${tags.map(
              (item) => html`<a class="filter-chip${tag === item ? ' on' : ''}" href=${filterHref('tag', item)}>#${item}</a>`,
            )}
            ${years.map(
              (item) => html`<a class="filter-chip${year === item ? ' on' : ''}" href=${filterHref('year', item)}>${item}</a>`,
            )}
          </div>
          ${found.length
            ? this.renderIndexRows(found, query)
            : html`<p class="search-hint">没有符合这些条件的文章。</p>`}
        </main>
      `;
    }

    return html`
      <main class="inner-page">
        <header class="page-head" data-reveal>
          <p class="kicker caps">YukiLog — 404</p>
          <h1>页面不存在</h1>
          <p class="inner-lede"><a href="/">回到首页</a></p>
        </header>
      </main>
    `;
  }

  private renderSite() {
    const home = window.location.pathname === '/' || this.previewOnly;
    return html`
      <div
        class="site theme-${this.layout.theme} shell-${this.layout.shell.navigation}${
          this.previewOnly ? ' is-studio-preview' : ''
        }"
      >
        ${this.studio || this.previewOnly ? nothing : this.renderNavigation()}
        ${home
          ? html`<div class="page-root">${this.renderNode(this.layout.root)}</div>`
          : keyed(window.location.pathname, this.renderInnerPage())}
        <footer class="site-footer">
          <span>YUKILOG</span>
          <span>© ${new Date().getFullYear()} LIAN / SAKURINE</span>
        </footer>
        <button
          class="to-top${this.navPastHero ? ' show' : ''}"
          type="button"
          aria-label="回到顶部"
          title="回到顶部"
          @click=${() =>
            window.scrollTo({ top: 0, behavior: this.reducedMotion ? 'auto' : 'smooth' })}
        >
          <svg class="ring" viewBox="0 0 46 46" aria-hidden="true">
            <circle class="ring-bg" cx="23" cy="23" r="20"></circle>
            <circle class="ring-fg" cx="23" cy="23" r="20"></circle>
          </svg>
          <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 19V5m-7 7 7-7 7 7" />
          </svg>
        </button>
      </div>
    `;
  }

  private renderPalette() {
    const groups = ['layout', 'content', 'decoration'] as const;
    return html`
      <aside class="studio-panel left">
        <h2>组件库</h2>
        ${groups.map(
          (group) => html`
            <section class="palette-group">
              <h3>${group}</h3>
              ${Object.values(componentRegistry)
                .filter((definition) => definition.group === group)
                .map(
                  (definition) => html`
                    <button
                      class="palette-item${this.draggingComponentType === definition.type
                        ? ' dragging'
                        : ''}"
                      draggable="true"
                      @dragstart=${(event: DragEvent) =>
                        this.beginComponentDrag(definition.type, event)}
                      @dragend=${this.endNodeDrag}
                      @click=${() => this.addComponent(definition.type)}
                      title="拖入组件树，或点击加入当前容器"
                    >
                      <span aria-hidden="true">⠿</span> ${definition.label}
                    </button>
                  `,
                )}
            </section>
          `,
        )}
      </aside>
    `;
  }

  private renderTreeNode(node: LayoutNode, depth = 0): unknown {
    const selected = node.id === this.selectedNodeId;
    const movable = node.id !== this.layout.root.id;
    const positions =
      this.draggingNodeId || this.draggingComponentType
        ? this.allowedDropPositions(node.id)
        : [];
    const isDropTarget = (position: DropPosition) =>
      this.dropTarget?.nodeId === node.id && this.dropTarget.position === position;
    const dropLine = (position: 'before' | 'after') =>
      positions.includes(position)
        ? html`
            <div
              class="tree-drop-line${isDropTarget(position) ? ' active' : ''}"
              data-position=${position}
              @dragover=${(event: DragEvent) =>
                this.activateDropTarget(node.id, position, event)}
              @drop=${(event: DragEvent) => this.dropNode(node.id, position, event)}
            >
              <span>${position === 'before' ? '插入之前' : '插入之后'}</span>
            </div>
          `
        : nothing;
    return html`
      <div class="tree-node" role="treeitem" aria-level=${depth + 1} aria-selected=${selected}>
        ${dropLine('before')}
        <div
          class="tree-row${this.draggingNodeId === node.id ? ' dragging' : ''}${
            isDropTarget('inside') ? ' drop-inside' : ''
          }"
          @dragover=${(event: DragEvent) => {
            if (positions.includes('inside')) this.activateDropTarget(node.id, 'inside', event);
          }}
          @drop=${(event: DragEvent) => {
            if (positions.includes('inside')) this.dropNode(node.id, 'inside', event);
          }}
        >
          ${movable
            ? html`
                <span
                  class="drag-handle"
                  draggable="true"
                  role="button"
                  tabindex="0"
                  aria-label="拖动 ${componentRegistry[node.type].label}"
                  @dragstart=${(event: DragEvent) => this.beginNodeDrag(node.id, event)}
                  @dragend=${this.endNodeDrag}
                >
                  ⠿
                </span>
              `
            : nothing}
          <button
            class="tree-item${selected ? ' selected' : ''}"
            @click=${() => this.selectNode(node.id)}
          >
            ${componentRegistry[node.type].label}
          </button>
          ${movable
            ? html`<span class="tree-actions">
                <button aria-label="上移组件" @click=${() => this.moveSibling(node.id, -1)}>↑</button>
                <button aria-label="下移组件" @click=${() => this.moveSibling(node.id, 1)}>↓</button>
              </span>`
            : nothing}
          ${isDropTarget('inside') ? html`<span class="inside-label">放入容器</span>` : nothing}
        </div>
        ${node.children?.map((child) => this.renderTreeNode(child, depth + 1))}
        ${dropLine('after')}
      </div>
    `;
  }

  private renderPropertyEditor(node: LayoutNode, name: string, schema: PropertySchema) {
    const value = node.props[name];
    const label =
      name === 'backgroundMediaId' && node.type === 'masthead'
        ? '刊头背景'
        : (propertyLabels[name] ?? name);

    if (schema.kind === 'media-image') {
      const current = this.mediaLibrary.find((media) => media.id === String(value ?? ''));
      return html`
        <div class="property-field media-picker">
          <span>${label}</span>
          <div class="media-picker-preview">
            ${current
              ? html`<img src=${current.url} alt=${current.name} />`
              : html`<span class="media-picker-empty">未选择背景图</span>`}
          </div>
          <select
            .value=${String(value ?? '')}
            @change=${(event: Event) => {
              const mediaId = (event.currentTarget as HTMLSelectElement).value;
              this.setSelectedProperty(name, mediaId || undefined);
            }}
          >
            <option value="">使用主题默认背景</option>
            ${this.mediaLibrary.map(
              (media) => html`<option value=${media.id}>${media.name}</option>`,
            )}
          </select>
          <div class="media-picker-actions">
            <button
              type="button"
              @click=${(event: Event) =>
                (event.currentTarget as HTMLElement)
                  .closest('.media-picker')
                  ?.querySelector<HTMLInputElement>('.media-picker-file')
                  ?.click()}
            >
              上传新图
            </button>
            ${value
              ? html`<button type="button" @click=${() => this.setSelectedProperty(name, undefined)}>
                  清除背景
                </button>`
              : nothing}
          </div>
          <input
            class="media-picker-file"
            type="file"
            accept="image/*"
            style="display: none"
            @change=${this.requestMediaUpload}
          />
          ${this.mediaLibrary.length === 0
            ? html`<small class="property-help">媒体库还没有图片，可以直接「上传新图」。</small>`
            : nothing}
        </div>
      `;
    }

    if (schema.kind === 'boolean') {
      return html`
        <label class="property-toggle">
          <input
            type="checkbox"
            .checked=${value === true}
            @change=${(event: Event) =>
              this.setSelectedProperty(name, (event.currentTarget as HTMLInputElement).checked)}
          />
          <span>${label}</span>
        </label>
      `;
    }

    if (schema.kind === 'integer') {
      return html`
        <label class="property-field">
          <span>${label}</span>
          <input
            type="number"
            min=${schema.minimum}
            max=${schema.maximum}
            .value=${String(value ?? schema.minimum)}
            @change=${(event: Event) =>
              this.setSelectedProperty(
                name,
                Number((event.currentTarget as HTMLInputElement).value),
              )}
          />
        </label>
      `;
    }

    if (schema.kind === 'string-array') {
      const selected = new Set(Array.isArray(value) ? (value as string[]) : []);
      return html`
        <fieldset class="property-options">
          <legend>${label}</legend>
          <div class="segmented">
            ${schema.values.map(
              (option) => html`
                <button
                  type="button"
                  aria-pressed=${selected.has(option)}
                  @click=${() => this.toggleArrayProperty(name, option)}
                >
                  ${option}
                </button>
              `,
            )}
          </div>
        </fieldset>
      `;
    }

    if (schema.values) {
      return html`
        <label class="property-field">
          <span>${label}</span>
          <select
            .value=${String(value ?? schema.values[0] ?? '')}
            @change=${(event: Event) =>
              this.setSelectedProperty(name, (event.currentTarget as HTMLSelectElement).value)}
          >
            ${schema.values.map((option) => html`<option value=${option}>${option}</option>`)}
          </select>
        </label>
      `;
    }

    const control =
      (schema.maxLength ?? 0) > 160
        ? html`
            <textarea
              maxlength=${schema.maxLength ?? 500}
              .value=${String(value ?? '')}
              @change=${(event: Event) =>
                this.setSelectedProperty(name, (event.currentTarget as HTMLTextAreaElement).value)}
            ></textarea>
          `
        : html`
            <input
              type="text"
              maxlength=${schema.maxLength ?? 500}
              .value=${String(value ?? '')}
              @change=${(event: Event) =>
                this.setSelectedProperty(name, (event.currentTarget as HTMLInputElement).value)}
            />
          `;
    return html`<label class="property-field"><span>${label}</span>${control}</label>`;
  }

  private renderMoveControls(selected: LayoutNode) {
    if (selected.id === this.layout.root.id) return nothing;
    const targets = flattenLayout(this.layout.root).filter(
      (node) => validDropPositions(this.layout.root, selected.id, node.id).length > 0,
    );
    if (targets.length === 0) return nothing;
    const targetId = targets.some((node) => node.id === this.moveTargetId)
      ? this.moveTargetId!
      : targets[0].id;
    const positions = validDropPositions(this.layout.root, selected.id, targetId);

    return html`
      <section class="inspector-section">
        <label class="property-field">
          <span>移动到</span>
          <select
            .value=${targetId}
            @change=${(event: Event) => {
              this.moveTargetId = (event.currentTarget as HTMLSelectElement).value;
              this.requestUpdate();
            }}
          >
            ${targets.map(
              (target) =>
                html`<option value=${target.id}>${componentRegistry[target.type].label} · ${target.id}</option>`,
            )}
          </select>
        </label>
        <div class="move-actions">
          ${positions.map(
            (position) => html`
              <button
                type="button"
                @click=${() =>
                  this.runStudioCommand(() =>
                    this.studioStore.moveTo(selected.id, targetId, position),
                  )}
              >
                ${position === 'before' ? '放在之前' : position === 'after' ? '放在之后' : '放入内部'}
              </button>
            `,
          )}
        </div>
      </section>
    `;
  }

  private renderInspector() {
    const selected =
      indexLayout(this.layout.root).get(this.selectedNodeId)?.node ?? this.layout.root;
    const definition = componentRegistry[selected.type];
    const errors = validateLayout(this.layout);
    const fields = definition.configurableFields ?? [];

    return html`
      <aside class="studio-panel right">
        <div class="studio-history">
          <button
            type="button"
            ?disabled=${!this.studioStore.canUndo}
            @click=${this.undoStudio}
            title="撤销（Ctrl/⌘ Z）"
          >
            撤销
          </button>
          <button
            type="button"
            ?disabled=${!this.studioStore.canRedo}
            @click=${this.redoStudio}
            title="重做（Ctrl/⌘ Shift Z）"
          >
            重做
          </button>
        </div>
        <p class="sr-only" aria-live="polite">${this.studioAnnouncement}</p>

        <h2>属性 · ${definition.label}</h2>
        <section class="inspector-section property-list">
          ${fields.length > 0
            ? fields.map((name) =>
                this.renderPropertyEditor(selected, name, definition.properties[name]),
              )
            : html`<p class="tree-help">该组件没有可编辑属性。</p>`}
        </section>

        ${this.renderMoveControls(selected)}
        <section class="inspector-section">
          <button
            class="inspector-button danger"
            ?disabled=${selected.id === this.layout.root.id}
            @click=${this.removeSelected}
          >
            删除所选组件
          </button>
        </section>

        <h2>页面结构</h2>
        <div class="inspector-section">
          <p class="tree-help">
            从 ⠿ 拖动组件；蓝色横线是插入位置，蓝色边框表示放入容器。也可在上方使用移动按钮。
          </p>
          <div role="tree" aria-label="页面组件树">${this.renderTreeNode(this.layout.root)}</div>
        </div>

        <section class="inspector-section">
          <div class="validation-ok">
            ${errors.length === 0 ? '布局 schema 校验通过' : errors.join('；')}
          </div>
        </section>
        <details>
          <summary>查看布局 JSON</summary>
          <pre class="layout-json">${JSON.stringify(this.layout, null, 2)}</pre>
        </details>
      </aside>
    `;
  }

  private renderStudio() {
    return html`
      <div class="studio-shell">
        ${this.renderPalette()}
        <main class="studio-canvas">
          <header class="studio-canvas-toolbar">
            <strong>实时画布</strong>
            <div class="viewport-switcher" aria-label="预览宽度">
              ${(['desktop', 'tablet', 'mobile'] as const).map(
                (viewport) => html`
                  <button
                    type="button"
                    aria-pressed=${this.studioViewport === viewport}
                    @click=${() => {
                      this.studioViewport = viewport;
                      this.requestUpdate();
                    }}
                  >
                    ${viewport === 'desktop' ? '桌面' : viewport === 'tablet' ? '平板' : '手机'}
                  </button>
                `,
              )}
            </div>
          </header>
          <div class="studio-canvas-stage">
            <iframe
              class="studio-preview viewport-${this.studioViewport}"
              title="公开页面实时预览"
              src="/?preview=1"
              @load=${this.syncStudioPreview}
            ></iframe>
          </div>
        </main>
        ${this.renderInspector()}
      </div>
    `;
  }

  protected render() {
    if (this.previewOnly) return this.renderSite();
    return html`
      <nav class="lab-bar" aria-label="布局实验室">
        <span class="lab-title">夜航主题预览</span>
        <span class="lab-spacer"></span>
        <button
          class="mode-button"
          aria-pressed=${this.studio}
          @click=${() => {
            this.studio = !this.studio;
            this.requestUpdate();
          }}
        >
          ${this.studio ? '返回页面' : '布局工作室'}
        </button>
      </nav>
      ${this.studio ? this.renderStudio() : this.renderSite()}
    `;
  }
}

customElements.define('yuki-app', YukiApp);

declare global {
  interface HTMLElementTagNameMap {
    'yuki-app': YukiApp;
  }
}
