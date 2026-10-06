# 公开 Web

公开站点是「Lit SPA 给人类访客，SSR 给爬虫与无 JS 环境」的双形态架构：同一组
路由按请求分流，人类拿到 SPA 壳（加载 `yuki-app`，数据走 `/api/public/*`），
爬虫与 `?ssr=1` 调试请求拿到 Askama 服务端渲染的完整 HTML。浏览器不执行
JavaScript 也能通过 SSR 版本阅读首页、文章、动态、评论、友链和搜索结果。

## UA 分流

`/`、`/articles`、`/articles/{slug}`、`/dynamics`、`/friends`、`/search` 由
`server/src/site/gateway.rs` 分流，判定顺序：

1. query 含 `ssr=1` → SSR（调试与降级通道）；
2. User-Agent 大小写不敏感匹配爬虫标记（`bot|spider|crawler|slurp|
   facebookexternalhit|twitterbot|telegrambot|whatsapp|discordbot|
   google-inspectiontool|baiduspider|sogou|yisouspider|bytespider`）→ SSR；
3. 其余 → SPA 壳。

壳 HTML 带正确的 `<title>`、`<meta name="description">`、favicon、
`<meta name="robots" content="index,follow">` 与 `<yuki-app>` 挂载点；模块脚本
与 CSS 由服务端解析 `$YUKILOG_WEB_DIR/.vite/manifest.json`（默认 `admin/`，即
发布目录下的 web 构建产物）里 `name: "yuki-app"` 的 chunk 得到，URL 形如
`/admin/assets/yuki-app-<hash>.js`。`<noscript>` 提示并链接当前 URL 加
`?ssr=1` 的无脚本版本；manifest 缺失时所有访客回退 SSR。`/feed.xml`、`/api/*`、
`/media/*`、`/admin` 不参与分流。

## 路由

以下路由的 SSR 版本（爬虫与 `?ssr=1` 所见）行为如下；人类访客看到的 Lit SPA
通过 `/api/public/*` 获取同一口径的数据（见 docs/content-api.md）。

- `/`：读取 `page_layouts.home` 并递归渲染注册组件；支持 `?sort=featured|popular|recent`
  切换首页文章排序，默认 `featured`，非法值返回 `422`。首屏 hero：背景取站点设置
  的 `hero_background_media_ids` 轮换列表第一张，多于一张时内联脚本每 8 秒淡切
  （`prefers-reduced-motion` 时不启动轮换）；布局节点里的 `backgroundMediaId`
  已弃用，仅在轮换列表为空时作回退。语录卡文本取 `hero_quote`，为空回退站点说明。
  访客每次冷进入随机抽一张、顺序轮换与定时间隔属 SPA 前端行为，后端只存列表；
- `/articles`：已发布文章列表；支持 `tag`、`category`、`year` 与 `page` 查询参数；
- `/articles/{slug}`：文章正文和公开评论；
- `/dynamics`：已发布动态；朋友圈形态卡片（头像 + 昵称 + 相对时间与可选心情、
  Markdown 正文、配图——单图限宽展示、多图九宫格（2/4 张两列）、点赞与评论计数、
  灰底内联评论区含楼中楼缩进、作者徽章与常驻一行输入框，输入框聚焦/提交时展开
  昵称等字段，评论身份存 `localStorage`）；
- `/friends`：公开友链；
- `/search?q=`：在已发布文章标题、摘要和正文中搜索。
- `/feed.xml`：文章与动态聚合 RSS；
- `/feeds/articles.xml`：文章 RSS；
- `/feeds/dynamics.xml`：动态 RSS。
- `/sitemap.xml`：首页、文章、动态、友链四个列表页加每篇已发布文章详情页
  （不含 `/search`），`lastmod` 取 `published_at` 与 `updated_at` 的较晚者；
- `/robots.txt`：放行公开页，`Disallow: /admin` 与 `/api`，并以
  `YUKILOG_PUBLIC_ORIGIN` 的绝对 URL 指向 sitemap。

## SEO 元信息

SSR 页面（`server/src/site/mod.rs` 的 base 模板）统一输出：canonical（origin +
当前路径，不含 query）、Open Graph（`og:title/description/type/url/site_name`，
有图时 `og:image`）、Twitter card（有图 `summary_large_image`，否则
`summary`）。默认 og 图是站点头像的绝对 URL；文章详情页改为
`og:type=article`、描述取摘要、og 图取封面，并输出 `@type: Article` 的
JSON-LD（`headline/datePublished/dateModified/author/mainEntityOfPage`，
序列化后转义 `</` 防止穿出 `<script>`）。

公开查询只选择 `status = published` 且发布时间不晚于当前时间的内容。站点设置或
首页布局不存在时返回 `503 site_not_configured`，不会使用隐藏默认值或测试数据。

文章列表每页 12 篇，最多接受第 10000 页。分类、标签和日期直接从文章卡片链接到
筛选结果，不额外建立分类、标签或归档导航页；不存在的合法 slug 返回空列表，格式
非法的筛选值返回 `422`。

## 渲染边界

布局 JSON 只能选择注册组件、枚举属性和预先定义的 CSS class。颜色是已经校验过的
十六进制 Token；Hero 背景只能引用已验证的图片媒体 ID，由服务端解析为同源
`/media/` 地址。数据库内容不会成为任意脚本或自由 CSS。

Markdown 先由 `pulldown-cmark` 转换，再由 `ammonia` 清理。Askama 默认转义标题、
摘要、评论、站点资料和搜索词；只有清理后的 Markdown 及由服务端组件模板生成的
HTML 会进入安全输出位置。

RSS 使用配置中的公开 Origin 生成绝对链接和稳定 GUID，最多返回最近 50 项，响应为
`application/rss+xml` 并缓存 5 分钟。文章摘要缺失时只截取正文前 500 个字符；
动态条目链接到公开动态页面中的稳定锚点。

首页以旧版花恋的沉浸首屏、三栏内容区和双态导航作为首发视觉基准。无脚本时页面仍
完整可读；少量脚本只增强顶部感应导航和滚动状态。后续视觉调整不改变内容查询、
布局 schema 或安全边界。

## 首页排序与渐进增强

首页文章排序由 `?sort=` 决定：`featured` 按 `featured_at` 降序（未精选文章排在
最后，并列按发布时间）、`popular` 在 SQL 层按 `like_count * 20 + view_count` 加权
降序、`recent` 按发布时间倒序。minimal 刊头的排序 tab 与标题同处一行，是普通
链接，无脚本也可切换；刊头标题随当前排序在「精选文章 / 最热文章 / 最近文章」间
联动。

脚本增强还包括：动态时间线每条下的爱心按钮（点击调用动态点赞接口，成功才更新
计数与按下态，失败保持原样，无脚本时按钮不产生行为）；右下角回到顶部按钮，圆环
显示阅读进度；归档列表行悬停时展开封面与摘要；滚动浮现使用
`IntersectionObserver`（`threshold: 0.1`、`rootMargin: '0px 0px 10% 0px'`），
让下方内容提前进入过渡。

全站外观细节：favicon 取站点设置中的外部头像 URL，缺省回退到本地头像媒体；页面
`<title>` 带 `data-away` 文案，标签页隐藏时切换为卖萌文本、回来恢复；跨页导航
启用 `@view-transition { navigation: auto }`（240ms 淡入加轻微位移，尊重
`prefers-reduced-motion`）。站点设置配置刊头背景媒体后，文章/动态/友链/搜索等
列表页刊头（`.page-head` / `.masthead` 的 `has-bg` 变体）以背景图渲染，可叠加
强度可调的深色蒙版（默认 0，即不压暗）与底部深色渐变；刊头文字固定为白色并带
硬阴影，保证任意背景图下可读。

`/friends` 页底部有友链申请表单（名称、站点 URL、邮箱、可选图标 URL 与简介），
内联脚本 POST `/api/friend-link-applications`，成功提示审核后展示，失败显示
后端返回的 message。

## 文章页

`/articles/{slug}` 依次输出刊头（分类、标题、发布时间与摘要）、目录、封面、
`prose` 正文和评论区。Markdown 渲染时收集 h1–h3 并注入 `h-{序号}` 锚点 id
（支持 `{#custom-id}`，仅保留 `[a-zA-Z0-9._:-]`）。目录多于一项时：宽屏
（≥1280px）显示正文左侧 sticky 的 `nav.post-toc`（细滚动条悬停显现），窄屏
显示正文前可折叠的 `details.post-toc-mobile`；宽屏下滚动监听
（IntersectionObserver，`rootMargin: '-90px 0px -70% 0px'`）为当前小节链接加
`is-active`。正文排版对齐 Lit 设计：h2 蓝色刻度线、serif 蓝边引用块、蓝色列表
marker、任务清单复选框与脚注样式，标题带 `scroll-margin-top` 避免被导航遮挡。
围栏代码块由 syntect 以 InspiredGitHub 浅色主题在服务端高亮（内联样式的
`pre/span` 经 ammonia 放行）；`mermaid` 与未知语言保持原样输出为普通代码块。

评论区对齐 Lit 端设计：输入区在列表之前，收起态是一行 `.comment-compose` 引导条
（头像 SVG + 提示 + chevron），增强脚本点击展开完整表单（含「先不写了」收回按钮；
提交走 fetch POST `/api/articles/{id}/comments`，成功后显示审核提示并复原引导条，
无脚本时表单保持收起）。每条评论头为两行结构：`.comment-line`（昵称——留网站时
昵称本身即链接——加时间）与 `.comment-meta`（mono 11px 浅灰的 website 域名链接 ·
邮箱 · `agent_label` 访客环境标签）。头像用响应的 `avatar_url`，加载失败经 onerror
回退到内联 SVG 插画（蓝粉渐变星/墨底月夜/粉底海浪三款，按昵称哈希 `% 3` 选款，
与 Lit 端 `avatarFallback()` 同一算法）；`avatar_url` 为空时直接渲染 SVG。
