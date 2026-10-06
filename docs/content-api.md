# 内容与互动 API

所有 `/api/admin/*` 写接口都要求管理员 Session、匹配
`YUKILOG_PUBLIC_ORIGIN` 的 `Origin`，以及与 CSRF Cookie 相同的
`X-CSRF-Token`。

## 管理端

- `/api/admin/categories`：分类列表与创建；
- `/api/admin/categories/{id}`：分类修改与删除；
- `/api/admin/tags`、`/api/admin/tags/{id}`：标签 CRUD；
- `/api/admin/articles`、`/api/admin/articles/{id}`：文章 CRUD；写请求体严格校验
  字段名（未知字段直接 422，不再静默丢弃），封面字段接受 `cover_media_id`，
  并兼容 camelCase 别名 `coverMediaId`；
- `/api/admin/articles/{id}/publish|withdraw`：发布与撤回；
- `PUT /api/admin/articles/{id}/featured`：设置或取消精选，请求体
  `{ "featured": true|false }`，响应中的文章带 `featured_at`；撤回文章会同时清空精选；
- `/api/admin/dynamics`、`/api/admin/dynamics/{id}`：动态 CRUD；
- `/api/admin/dynamics/{id}/publish|withdraw`：发布与撤回；
- `/api/admin/comments`、`/api/admin/comments/{id}`：审核与删除；状态只接受
  `pending` / `visible` / `hidden`，非法值返回 `400`；列表响应含
  `parent_id`（楼中楼父评论）、`email`、`website`、`user_agent`（评论表不存
  IP，无从返回）；
- `/api/admin/friend-links`、`/api/admin/friend-links/{id}`：友链 CRUD；
- `GET /api/admin/media`：媒体选择列表；
- `DELETE /api/admin/media/{id}`：删除媒体记录并尝试删除磁盘文件。仍被引用时
  返回 `409` 与 `references` 引用清单（文章封面 `article_cover`、动态配图
  `dynamic_media`、站点头像 `site_avatar`、刊头背景 `site_masthead`、友链头像
  `friend_link_avatar`）；
- `GET|PUT /api/admin/settings`：站点资料、主题 Token 与页面外壳；站点资料另含
  `avatarExternalUrl`（可选外部头像 URL，仅 `http(s)` 且不超过 512 字符，本地头像
  为空时作为公开头像与 favicon 回退）、`mastheadMediaId`（可选刊头背景图片，
  校验媒体存在且为 `image/*`）、`heroBackgroundMediaIds`（首屏背景轮换图
  UUID 数组，最多 12 张，每个 id 必须是存在的 `image/*` 媒体）与
  `heroQuote`（可选首屏语录，不超过 120 字）；
- `GET /api/admin/layouts`、`GET|PUT /api/admin/layouts/{page_key}`：页面布局；
- `GET /api/admin/subscribers`：订阅者列表；
- `DELETE /api/admin/subscribers/{id}`：硬删除订阅者，其投递记录随外键级联删除；
- `GET /api/admin/overview`：仪表盘聚合——`counts`（文章总数/已发布、动态、待审
  评论、媒体、活跃订阅、失败投递、当前管理员未读通知）、`totals`（总浏览、文章
  与动态合计点赞）、`top_viewed` / `top_liked_articles`（各 TOP5，含
  id/title/slug/value）、`top_liked_dynamics`（TOP5，含 id/正文前 40 字
  excerpt/like_count）、`recent_comments`（最近 5 条，正文前 80 字 excerpt，
  `target_title` 为文章标题或动态前 40 字）、`recent_notifications`（最近 5 条）；
- `GET /api/admin/deliveries`：邮件投递列表；
- `POST /api/admin/deliveries/{id}/retry|cancel`：重试或取消投递。
- `GET /api/admin/notifications`：当前管理员最近 100 条站内消息；
- `POST /api/admin/notifications/{id}/read`、`/api/admin/notifications/read-all`：标记已读；
- `GET|PUT /api/admin/notification-settings`：通知邮箱、类别与频率；
- `POST /api/admin/notifications/{id}/email-retry|email-cancel`：人工处理通知邮件。

文章保存会在事务中锁定文章行并整体替换标签。首次发布内容时，同一事务为符合
偏好的活跃订阅者建立 `email_deliveries`；编辑已发布内容不会再次通知。撤回会
取消尚未发送的任务。

`publish` 接受可选 JSON `{ "published_at": "<RFC 3339>" }`。未来时间表示定时
发布：公开 SSR 与 RSS 在到点前不可见，订阅投递的 `next_attempt_at` 与发布时间
一致，不依赖额外常驻调度器。未提供请求体或时间时立即发布；已公开内容不能直接改回
未来时间，必须先撤回再重新安排。

动态创建/更新请求体另接受可选 `mood`（心情短句，去空白后为空存 `null`，最长
40 字，超长返回 `422`）与可选 `media_ids`（UUID 数组）：缺省或 `null` 表示不改动
现有配图；提供数组则在事务中校验后整体替换配图——最多 9 张、不允许重复、每个
UUID 必须存在于媒体库，数组顺序即 `position` 展示顺序，传 `[]` 即清空配图。动态
响应带 `media` 数组，每项含 `id`、`url`、`original_name`、`media_type`、
`width`、`height`，按 `position` 升序。RSS 动态条目在正文 HTML 后追加第一张
`image/*` 配图的 `<img>`（绝对 URL）。

## 公开内容 API

访客端 Lit SPA 的只读数据源。全部 GET、无需鉴权、JSON 一律 camelCase。列表与
搜索按 IP 做基础限流（列表 1 次/秒、搜索 1 次/0.8 秒，超限返回 429；Lit 端搜索
撞 429 会自动等待重试一次）。错误响应
沿用 `{ code, message }` 形态，时间字段一律 RFC 3339 字符串。

- `GET /api/public/site` → `{ siteTitle, siteDescription, ownerName, ownerBio,
  avatarUrl, mastheadUrl, socialLinks: [{ label, url }], mailEnabled,
  articleCount, dynamicCount, friendCount, totalViews,
  heroBackgrounds: [url], heroQuote | null, theme,
  shellLayout }`。`avatarUrl` 本地头像媒体优先、为空回退外部头像 URL；
  `theme`/`shellLayout` 与 `GET /api/admin/settings` 同形；
  `articleCount`/`dynamicCount` 只计已发布且到点内容、`friendCount` 只计
  可见友链、`totalViews` 是 `article_metrics.view_count` 合计，四格口径与
  SSR 首页统计卡一致；`heroBackgrounds` 是首屏轮换图的媒体 URL 数组（按配置
  顺序、只含存在的 `image/*`，媒体 URL 保持 `/media/...` 相对路径），
  `heroQuote` 为首屏语录，为空时前端回退站点说明；
- `GET /api/public/articles?sort=featured|popular|recent&category=<slug>&tag=<slug>&page=N&pageSize=M`：
  默认 `sort=featured`、`page=1`、`pageSize=10`；`pageSize` 上限 20、`page` 上限
  10000；非法 `sort` 返回 422；只返回已发布文章。排序口径与 SSR 一致：featured
  按 `featured_at` 降序（未精选排后）、popular 按 `like_count * 20 + view_count`
  加权、recent 按发布时间倒序 → `{ items: [ArticleItem], page, totalPages, total }`，
  `ArticleItem = { id, slug, title, summary, coverUrl（无则 ""）, category:
  { name, slug } | null, tags: [{ name, slug }], publishedAt, views, likes,
  featured }`；`id` 是文章 UUID，写端点（view/metrics/like/comments）按它寻址；
- `GET /api/public/articles/{slug}` → `ArticleItem` 展平后另加 `{ html, headings:
  [{ level, text, id }], updatedAt, allowComments, prev: { slug, title } | null,
  next: { slug, title } | null }`；`prev` 是发布时间更晚（较新）的一篇、`next` 是
  更早的一篇；不存在或未发布返回 404；
- `GET /api/public/articles/{slug}/comments` → `{ items: [CommentItem], total }`，
  只含 visible、按时间升序；`CommentItem = { id, parentId | null, displayName,
  avatarUrl, website | null, contentHtml, createdAt }`，`contentHtml` 是转义后
  的纯文本；列表保持平铺，前端按 `parentId` 自行组树（最多两层）；
- `GET /api/public/dynamics?page=N&pageSize=M`（分页规则同上）→ `{ items: [{ id,
  contentHtml, mood | null, mediaUrls: [], likes, commentCount, createdAt }], page,
  totalPages, total }`；`createdAt` 取发布时间；`commentCount` 只计 visible 评论；
- `GET /api/public/dynamics/{id}/comments` → 同文章评论结构，按时间升序平铺
  （不做楼中楼嵌套）；
- `GET /api/public/friends` → `{ items: [{ name, url, description, avatarUrl,
  host }] }`，只含 `is_visible` 友链；头像口径与 SSR 相同（外链头像 > 本地媒体 >
  对方站点 `/favicon.ico`）；
- `GET /api/public/search?q=&page=N` → `{ articles: { items, total }, dynamics:
  { items, total } }`；关键词 trim 后最多 100 字符，文章匹配标题/摘要/正文、动态
  匹配正文，两组各自按发布时间倒序、每页 10 条；
- `GET /api/hitokoto` → `{ text, from }`。服务器代理 `https://v1.hitokoto.cn`
  （3 秒超时、内存缓存 10 分钟）；超时、非 2xx、非法响应一律回退内置句库并返回
  200，绝不向前端返回 5xx。

页面壳契约：`/`、`/articles`、`/articles/{slug}`、`/dynamics`、`/friends`、
`/search` 对人类 UA 返回 SPA 壳 HTML（`<yuki-app>` 挂载点 +
`/admin/assets/yuki-app-<hash>.js` 模块脚本；hash 由服务端读取
`$YUKILOG_WEB_DIR/.vite/manifest.json` 中 `name: "yuki-app"` 的 chunk 解析，壳里
同时输出 manifest 声明的 CSS）。爬虫 UA 与带 `?ssr=1` 的请求继续返回完整 SSR
HTML；找不到 manifest 时所有访客回退 SSR。

## 公开互动

- `POST /api/friend-link-applications`
- `GET|POST /api/articles/{id}/comments`
- `GET|POST /api/dynamics/{id}/comments`

评论 POST 接受可选 `parent_id` 实现楼中楼回复：父评论必须存在、已
`visible`、同属当前文章/动态，且父评论本身不能再有父评论（只支持两层，
违反返回 422）。
- `GET /api/articles/{id}/metrics`
- `POST /api/articles/{id}/view`
- `PUT|DELETE /api/articles/{id}/like`
- `GET /api/dynamics/{id}/metrics`
- `POST|DELETE /api/dynamics/{id}/like`

评论默认进入 `pending`，仅 `visible` 评论公开。评论表单中的昵称、邮箱、网站与
正文按页面声明公开——邮箱选填，但填了就会随评论公开展示，表单底部有文字提醒；
订阅邮箱仍然私密。公开响应另带两个服务端派生字段：`avatar_url`（评论者网站存在
时取其 `https://{host}/favicon.ico`，否则用邮箱 trim+小写后的 SHA-256 拼
Gravatar `?d=404`，两者皆无则为空串）和 `agent_label`——提交时服务端从
User-Agent 请求头捕获原文（截断到 512 字符，不从请求体收），公开时解析成
「Desktop Edge 146 · Windows 10」式短标签（设备 Desktop/Mobile/Tablet + 浏览器
主版本 · 系统主版本），解析不出则为空串。

友链申请只接收名称、HTTP(S) URL、简介、联系邮箱与可选图标 URL，不抓取访客 URL
或远程头像。申请以不可见友链保存，管理员通过后才公开，并同时建立站内通知。
`/friends` 页底部的申请表单直接提交到该接口。

浏览量按 IP、文章和 30 秒窗口进行进程内限频。仅当请求来自本机反向代理时才信任
`X-Real-IP`。评论按目标和 IP 限制为每分钟一次。nginx 前置另有第二层限流
（`ops/nginx/yukilog.conf`）：`/api/` 整体每 IP 10 r/s，评论、订阅、友链申请与
管理员登录等写操作仅按 POST/PUT/DELETE 计每 IP 12 次/分（burst 12），超限返回 429。

点赞使用一年有效的 HttpOnly 匿名访客 Cookie。Cookie 保存随机令牌，数据库只
保存 SHA-256；联合主键和触发器负责去重及维护点赞数。文章与动态点赞共用同一
访客 Cookie 和限频窗口；动态不统计浏览量，动态点赞也不产生站内通知。

Markdown 原文由公开 Askama 页面统一安全渲染。管理后台不接收或保存生成后的
HTML。
