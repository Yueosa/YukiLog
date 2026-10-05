# 前端交接

日期：2026-10-05。分支 `main`，比 `origin/main` 超前 34 个提交，尚未推送。

## 为什么重做后端

后端语言没有被否定。2026-10-04 的原话是：后端满意，Rust 是理想实现；不满意的是前端架构、写死的页面，以及旧的数据库更新方式。

重做的直接原因是云服务器忘记续费，机器被收回，线上数据丢失，只剩下一部分备份。同时旧站有这些问题：

- Web UI 不可动态配置，样式和组件写死，管理页单调。
- 响应式和交互不流畅，Bug 多，播放卡顿。
- 文章封面不能作为正式媒体上传管理。当时提过 Base64，随后改成了独立媒体文件和数据库元数据，没有采用 Base64。
- 旧 SQL 更新机制不被接受。旧实现被归档，`main` 按全新系统重写，明确不叫 v2。
- 备份里的 “YukiLog 系列”长文被认定为 AI 流水账，不整包导入。封面也准备重找。只有确认过的文章和随记才入库。

因此新后端要解决的是：干净的 PostgreSQL schema、SeaORM migration、会话鉴权、媒体文件、订阅和可回滚发布。它不是因为 Rust 或 Axum 失败而换语言。Redis、Slug 重定向、修订审计和赞赏被明确去掉；分类、浏览量、点赞、订阅保留。

用户当时列的六步是：

1. 理解旧后端，修复功能和安全问题。
2. 重建数据库及相关系统。
3. 重做前端架构、样式和页面。
4. 把新的 `blog.yeastar.xin` 部署到服务器。
5. 审核旧数据并导入。
6. 博客恢复上线。

目前只完成了第 2 步的主体，以及第 3 步的一个未验收原型。第 4 到第 6 步还没做。

## 这段时间做了什么

1. 2026-08-17：在旧 SvelteKit 博客上修安全、评论、首页排序、归档、标签筛选、随记双列和竖封面比例。
2. 2026-10-04 下午：先完成并部署个人站 Yukikoi（`yeastar.xin`）。
3. 2026-10-04 晚上：因服务器被收回，开始把 YukiLog 当新系统重建。旧代码留在 `archive/legacy-sveltekit`。
4. 新系统先后做了数据库、管理员会话、内容 API、媒体上传、RSS、邮件订阅、Askama 公开页骨架，以及隔离部署演练。
5. 随后开始花恋视觉和布局工作室。开发预览能看首页、假文章、假动态、假友链和假索引，但还没有接上数据库，也没有通过视觉验收。


最近已提交的前端节点是 `9cafd18 feat: rebuild hanakoi layout studio`。其后的视觉修正还在工作区，没有提交：

- `web/src/ui/yuki-app.ts`
- `web/src/layout/presets.ts`
- `web/src/ui/yuki-admin.ts`
- `web/vite.config.ts`
- `server/src/site/（原 web.rs 拆分）`

不要把 `.build-tmp/`、壁纸、`node_modules/` 或发布产物提交进 Git。三张旧壁纸只应留在本地忽略目录，或从标签 `legacy-sveltekit-archive` 读取。

## 现在实际在看什么

`pnpm --filter @yukilog/web dev` 打开的是 Vite，地址 `http://localhost:5173/`。

`web/src/main.ts` 的规则是：

- `/admin` 挂载 `yuki-admin`（元素名未变，实现已重写为 `web/src/admin/admin-app.ts`）
- 其他路径挂载 `yuki-app`

`web/vite.config.ts` 只把 `/api`、`/media`、`/subscriptions`、`/feed.xml`、`/feeds` 代理到 `127.0.0.1:3000`。`/articles`、`/dynamics`、`/friends`、`/search` 不再代理，所以开发时这些地址全部由 `yuki-app.ts` 里的假数据渲染。Rust 服务没启动时，这些页面仍然能打开，但内容不是数据库里的内容。

生产公开页是另一套实现：`server/src/site/（原 web.rs 拆分）` 用 Askama 输出 SSR。两套渲染目前不同步。开发时看到的花恋页面，不等于 Rust 正式页面。

## 已有能力

后端和数据层已经能支撑内容系统，不需要从零做接口：

- 文章、分类、标签、评论、友链、站点设置、首页布局都有管理 API；另有 `GET /api/admin/overview` 聚合概览。
- 文章有 `cover_media_id`、`featured_at`（精选）和 `PUT /api/admin/articles/{id}/featured`。媒体上传已实现 SHA-256 内容寻址去重（重复上传直接复用已有记录，不占双份磁盘）。
- 动态有 `mood`（心情，可空）和 `dynamic_media` 配图关联表（最多 9 张，position 0–8），管理端九宫格上传已实现；SSR 公开页是朋友圈形态（头像、相对时间、九宫格、灰底内联评论区、楼中楼回复）。
- 评论分文章/动态两个目标，管理端可按来源筛选并跳转到目标编辑页。
- 订阅是 double opt-in（确认邮件点链接生效），每封邮件末尾带 HMAC 签名的一键退订链接（GET 先出确认页防扫描器误触，POST 才真正退订）；RSS 是拉取式，无需退订机制。
- 友链有 `avatar_url`（申请者可自填 favicon），公开页头像优先级：avatar_url > 本地媒体 > 对方站点 /favicon.ico > 字母兜底。
- 管理后台已在 2026-10-05 重写为 `web/src/admin/`（store/theme/labels/slugify + 组件库 + hash 路由 + 夜航深色侧栏），13 个视图：概览、文章（列表+独立编辑路由）、动态、分类与标签、评论、媒体（按引用关系分组+图床筛选）、友链（待审核申请段）、站点设置、布局工作室、消息、订阅与投递。后端不可达时自动进入预览模式（假数据+顶部黄条，写操作被拦截），登录页也有「不登录，先看看界面」入口。
- 旧的 `web/src/ui/yuki-admin.ts` 已删除。

## 公开页真实完成度

| 页面 | 开发地址看到的 | 实际数据 |
| --- | --- | --- |
| 首页 | `yuki-app.ts` 花恋预设 | 假文章、假统计；个人资料写死在 `defaultSiteData` |
| 文章列表和正文 | 同一文件里的 6 篇假文章 | 未请求 `/api`，也未使用 Rust SSR |
| 动态 | 5 条写死短句（SSR 已是朋友圈形态真数据） | Lit 侧仍不读取 `dynamics` |
| 友链 | 4 张写死便签 + favicon 头像 + 申请友链表（真 POST） | 列表未读库；表单已接 `/api/friend-link-applications` |
| 搜索 | 对假文章做查询参数筛选 | 未接全文搜索 API |
| 订阅入口 | 文章/动态页页头下方的横条（含交叉订阅勾选） | 已接 `/api/subscriptions`，真提交 |
| 管理后台 | `/admin` 新管理台 | 需要 Rust 在 3000 端口并登录；否则预览模式 |

主站新增的小件：文章流底部「全部文章 ›」（超出 limit 时出现）、最近动态 kicker 整行可点「更多 ›」、悬浮顶栏搜索用文字（首屏角落仍用图标）、页脚品牌改为 YUKILOG。

## 视觉事实来源

旧站源码不在当前工作区，使用：

`git show legacy-sveltekit-archive:<path>`

关键文件：

- `yukilog-hanakoi/src/routes/+page.svelte`：100vh 首屏，第二屏为 `240–280px | 最大 900px | 240–280px`，整体居中。
- `yukilog-hanakoi/src/components/navigation/NavBar.svelte`：首屏隐藏；指针进入顶部 80px 时全宽展开；滚过一屏后 `width: auto`、`top: 10px`、圆角 28px。不是胶囊，也不是 1180px 固定白条。
- `yukilog-hanakoi/src/components/navigation/NavItem.svelte`：悬停只把文字变蓝，并从文字下方长出下划线。768px 以下只留图标，更窄时使用抽屉。
- `yukilog-hanakoi/src/components/home/WelcomeCard.svelte`：标题逐字出现，下面是黑底引语卡和彩色社交图标。向下箭头属于首屏底部，不属于引语卡内部。
- `yukilog-hanakoi/src/components/home/ArticleCard.svelte`：横图 `4fr 6fr` 交替。图片高度随原图，竖图不能裁成 16:10。
- `yukilog-hanakoi/src/components/home/ProfileCard.svelte`：终端样式 `system.log`。
- `yukilog-hanakoi/src/routes/notes/+page.svelte`：最多 1080px 的两列随记，不是通栏列表。
- `yukilog-hanakoi/src/routes/links/+page.svelte` 和 `FriendCard.svelte`：最多 800px，轻微旋转的小卡片。
- `yukilog-hanakoi/src/routes/posts/[slug]/+page.svelte`：正文约 760–1160px，不占满窗口。
- `yukilog-hanakoi/src/routes/archive/+page.svelte`：年份、月份和紧凑标题行，适合作为搜索索引的参考。

身份资料来自旧配置和 `/home/Sakurine/YeaSrine/Yukikoi`：

- 名称：`Lian（恋）`
- 头像：`https://q1.qlogo.cn/g?b=qq&nk=1303028790&s=640`
- 简介：`我能走到这里，是因为你没有放弃`
- 生日：`2005-05-16`
- 性别认同：非二元
- 个性标签：代码、记忆、夜航
- `system.log`：`[2024-06-09 08:48:29]`，内容是“这不是你亲手开启的故事吗？”

`docs/product-shape.md` 里“个人卡正面显示社交链接、背面放站点信息”已被用户否定。当前要求是个人卡不放社交链接；社交和 RSS 留在首屏。

## 不要继续做的事

- 不要把文章、动态、友链再拉成 100% 视口宽度。
- 不要再增加第二套主题。Yukikoi 加月下书简只作为未来的第二主题，现在不做。
- 不要把三张带水印的壁纸提交进 Git。首屏背景应通过已有媒体库选择。
- 不要另写一套 React 页面。项目约束是 Lit，公开正式 HTML 仍应由 Askama 输出，Lit 只做增强和后台。

## 建议的后续顺序

1. ~~先修间距、顶栏 `width: auto`、友链标题顺序和页面内路由，消除闪烁。~~（已完成：SPA 路由、导航、间距、刊头合并）
2. ~~为动态设计媒体关联和上传体验~~（已完成：`dynamic_media` + 九宫格上传 + 朋友圈渲染；另有 `mood` 字段）
3. **用同一套花恋样式接上真实文章、动态、友链和搜索**：Lit 公开页目前仍是假数据，这是最大的一块剩余工作。注意公开正式 HTML 由 Askama SSR 输出，Lit 只做增强——两边样式要保持同步。
4. 文章正文渲染规则参考旧版 yukilog（`legacy-sveltekit-archive`），预留自研标记语言（md 升级版）的渲染接口。
5. 刊头 gif 背景：`mc.gif` 已从旧分支提取，需做站点设置里的刊头背景配置项。
6. 文章编辑器增强：从媒体库直接插入图片到正文（媒体库已是事实上的图床，复制 URL 可用）。
7. 旧数据迁移工具（备份在 `/home/Sakurine/Documents/QQ/content`，逐篇审核后导入）+ nspawn 隔离环境建库验证。
8. 部署到 `blog.yeastar.xin`（`ops/` 里的演练脚本已有基础）。
6. 最后把通过验收的 Lit 结构同步回 `server/src/site/（原 web.rs 拆分）`，让无 JavaScript 的 SSR 与开发预览一致。
