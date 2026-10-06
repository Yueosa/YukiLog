# 固定布局与部件清单

2026-10 大重构删除了布局工作室（节点树布局）。首页布局**硬编码固定**，
不再可编辑；原「夜航」节点树成为代码常量：

- Lit 访客端：`web/src/ui/home-layout.ts`（`homeLayout` 常量树 + 渲染 walker）；
- SSR：`server/src/site/components.rs`（同构的固定结构直写）。

主题与外壳仍是两套独立数据：

- `site_settings.theme`：颜色、字体、间距、圆角、阴影和动画 Token；
- `site_settings.shell_layout`：全局导航和页面外壳；

主题 schema v1 使用固定语义 Token：背景、表面、正文、弱化文字、主色、辅色和
边框色；颜色只接受 6/8 位十六进制。字体选择映射到代码内置字体栈，字号比例限制在
`0.8–1.4`，圆角限制在 `0–32px`。外壳 schema v1 负责导航类型、品牌位置、搜索、
透明效果和页面宽度。数据库值永远不会直接拼接成任意 CSS。

## 首页固定结构

```
hero（沉浸式首屏：轮换背景 / 欢迎大文字 / 语录卡 / ENTER 整区）
└─ identity-band（个人信息带：头像 + 名字/bio/标签行 + status-line）
└─ 两列网格（主列 + 300px 吸附侧栏）
   ├─ masthead（文章刊头 minimal，标题随排序 tab 联动）
   ├─ article-feed（alternating 文章卡片，5 篇）
   ├─ stats-panel（站点信息四格）
   ├─ free-panel（一言）
   └─ dynamic-strip（最近动态 compact，4 条）
```

## 部件清单（data-part 挂载点）

根区域带 `data-part` 属性，是后续「部件 token」（按部件开放样式配置）的挂载点。

### 外壳与首屏

| 部件 id | 内容 |
| --- | --- |
| `brand` | 左上角站点名 |
| `topnav` | 导航（首页角导航 / 内页胶囊顶栏两种形态） |
| `search-entry` | 搜索入口 |
| `hero` | 首屏整体（含背景轮换 `hero-bg`，焦点/cover/contain 已定型） |
| `hero-title` | 欢迎大文字（含 accent 着色） |
| `hero-quote-card` | 语录卡（站点说明/heroQuote + 社交链接） |
| `hero-enter` | ENTER 块：整个底部区域可点，文字+箭头仅引导 |

### 首页内容区

| 部件 id | 内容 |
| --- | --- |
| `identity-band` | 个人信息带 |
| `masthead` | 文章刊头 |
| `article-feed` | 文章区域（子部件 article-card） |
| `stats-panel` | 站点信息区 |
| `free-panel` | 其他信息区（v1 = 一言） |
| `dynamic-strip` | 最近动态区 |

### 列表页与详情页（随部件 token 阶段逐步标记）

- /articles：masthead(has-bg)、subscribe-panel、article-row；
- /dynamics：masthead、moment-card（含 comment-block）；
- /friends：masthead、friend-card、friend-apply；
- /search：masthead、search-box、filter-group、result-row；
- /articles/{slug}：post-head、post-cover、toc、prose、post-tags、like-bar、comment-section。

候选 v2：hot-panel（热点信息区：最近评论人/最新友链）。
