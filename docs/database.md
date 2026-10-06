# PostgreSQL 初始模型

这是全新 YukiLog 的初始数据库，不兼容历史 schema。模型只覆盖当前确认的功能：

- 管理员登录；
- 文章、分类、标签、动态和评论；
- 文件媒体、友链和站点外观配置；
- 文章浏览量、文章/动态匿名点赞和热门排序；
- 文章/动态邮件订阅；
- RSS 直接查询已发布内容，不需要专用表。

不包含修订历史、Slug 重定向、审计日志、支付、赞赏、每日统计、通用
outbox 或邮件供应商 webhook。

## 字段

“写入”描述正常业务路径；数据库约束仍是最终边界。

### `admin_accounts`

| 字段 | 含义与读写 |
| --- | --- |
| `id` | 管理员 UUID；建号时由数据库生成，鉴权和会话读取。 |
| `username` | 不区分大小写的登录名；建号或改名时写，登录时查。 |
| `password_hash` | Argon2id 哈希；设密/改密时写，登录校验时读。 |
| `display_name` | 后台显示名称；资料编辑时写。 |
| `is_active` | 是否允许登录；停用账号时写，每次鉴权时读。 |
| `last_login_at` | 最近成功登录时间；登录成功后写。 |
| `created_at` | 建号时间；数据库生成，只读。 |
| `updated_at` | 最近资料变化；数据库触发器维护。 |

数据库保证用户名唯一、字段长度和 Argon2id 格式。改密或强制退出时直接删除该
账号的会话行。

### `admin_sessions`

| 字段 | 含义与读写 |
| --- | --- |
| `id` | 会话 UUID；创建登录态时生成。 |
| `account_id` | 所属管理员；鉴权时关联账号。 |
| `token_hash` | Cookie 随机令牌的 SHA-256；创建时写、鉴权时查，不保存明文。 |
| `csrf_token_hash` | CSRF 随机令牌的 SHA-256；写操作鉴权时读取。 |
| `expires_at` | 到期时间；创建时写，鉴权和清理时读。 |
| `last_seen_at` | 最近活动时间；限频刷新。 |
| `created_at` | 会话创建时间；数据库生成。 |

删除或停用账号时删除其会话；定时任务直接删除过期行。

### `categories`

| 字段 | 含义与读写 |
| --- | --- |
| `id` | 分类 UUID。 |
| `name` | 分类显示名；后台维护，筛选和文章页读取。 |
| `slug` | URL 中的分类标识；后台维护，分类筛选查询。 |
| `description` | 可选简介；分类展示时读取。 |
| `sort_order` | 后台及筛选器顺序；后台调整。 |
| `created_at` | 创建时间。 |
| `updated_at` | 修改时间；触发器维护。 |

名称和 Slug 均不区分大小写且唯一。仍被文章引用的分类不能删除。

### `tags`

| 字段 | 含义与读写 |
| --- | --- |
| `id` | 标签 UUID。 |
| `name` | 标签显示名；后台维护，文章卡片读取。 |
| `slug` | URL 筛选标识；后台维护，`/articles?tag=` 查询。 |
| `created_at` | 创建时间。 |

名称和 Slug 均不区分大小写且唯一。标签没有独立公开页面。

### `media_assets`

| 字段 | 含义与读写 |
| --- | --- |
| `id` | 媒体 UUID；其他表只引用该值。 |
| `storage_key` | 媒体目录内的相对路径；上传完成后写，响应文件时读。 |
| `original_name` | 用户上传时的文件名；后台显示。 |
| `media_type` | 经文件魔数确认的 MIME；上传时写，响应时读。 |
| `byte_size` | 文件字节数；上传限制和后台信息使用。 |
| `sha256` | 文件内容摘要；上传时计算，用于去重和完整性检查。 |
| `width` | 图片/视频宽度；可选，上传探测后写。 |
| `height` | 图片/视频高度；可选，上传探测后写。 |
| `created_at` | 上传完成时间。 |

文件本体保存在发布目录之外的媒体目录，数据库不保存 Base64。删除媒体前必须没有外键引用。

### `articles`

| 字段 | 含义与读写 |
| --- | --- |
| `id` | 文章 UUID。 |
| `category_id` | 唯一主分类；编辑文章时写，列表筛选时读。 |
| `cover_media_id` | 可选封面媒体；上传或选择封面时写。 |
| `title` | 标题；编辑时写，所有公开页面读取。 |
| `slug` | 当前文章 URL；创建/编辑时写，全站唯一；修改后旧地址直接失效。 |
| `summary` | 卡片和元信息摘要；可选。 |
| `body_markdown` | Markdown 原文；编辑时写，渲染时读。 |
| `status` | `draft` 或 `published`；保存/发布时写。 |
| `allow_comments` | 是否接受新评论；编辑时写，评论接口读取。 |
| `published_at` | 首次/当前发布时间；发布时写，撤回草稿时清空。 |
| `featured_at` | 精选标记时间；后台设置或取消精选时写，首页精选排序读取，撤回时清空。 |
| `created_at` | 创建时间。 |
| `updated_at` | 内容最近变化；触发器维护。 |

数据库保证已发布文章一定有 `published_at`，草稿一定没有。不存在修订表和
Slug 历史表。部分索引 `articles_featured_idx` 只覆盖已发布且带精选时间的行，
供首页精选排序使用。

### `article_tags`

| 字段 | 含义与读写 |
| --- | --- |
| `article_id` | 文章 UUID。 |
| `tag_id` | 标签 UUID。 |

联合主键防止重复标签。保存文章时在同一事务中替换关联。

### `dynamics`

| 字段 | 含义与读写 |
| --- | --- |
| `id` | 动态 UUID。 |
| `content_markdown` | 动态 Markdown 内容；编辑时写，时间线读取。 |
| `mood` | 可选心情短句（1–40 字符，去空白后为空则存 NULL）；编辑时写，动态卡片读取。 |
| `status` | `draft` 或 `published`。 |
| `allow_comments` | 是否接受新评论。 |
| `published_at` | 发布时间；发布时写，撤回时清空。 |
| `created_at` | 创建时间。 |
| `updated_at` | 最近修改时间；触发器维护。 |

动态正文通过 Markdown 引用 `media_assets` 文件；除正文内嵌外，动态还可以关联
最多 9 张配图（见下表）。删除动态或媒体时关联行级联删除。

### `dynamic_media`

| 字段 | 含义与读写 |
| --- | --- |
| `dynamic_id` | 动态 UUID。 |
| `media_id` | 配图媒体 UUID，指向 `media_assets`。 |
| `position` | 展示顺序，0–8；创建/编辑动态配图时按请求数组顺序写入。 |

联合主键 `(dynamic_id, media_id)` 防止同一媒体重复挂载；保存动态配图时在同一
事务中整体替换关联。索引 `dynamic_media_dynamic_idx` 按 `(dynamic_id, position)`
有序读取一条动态的全部配图。`CHECK (position BETWEEN 0 AND 8)` 与后端「最多
9 张」校验对应。

### `comments`

| 字段 | 含义与读写 |
| --- | --- |
| `id` | 评论 UUID。 |
| `article_id` | 被评论文章；与 `dynamic_id` 必须且只能有一个。 |
| `dynamic_id` | 被评论动态；与 `article_id` 必须且只能有一个。 |
| `parent_id` | 可选父评论；回复时写。 |
| `display_name` | 访客公开昵称；提交时写，评论区读取。 |
| `email` | 可选邮箱；提交时写，填了随评论公开展示，另用于派生 Gravatar。可空；非空时受 `comments_email_shape` 约束（3–254 字符且含非首尾 `@`）。 |
| `website` | 可选公开网站；提交时写。 |
| `content` | 评论正文；提交时写，审核和评论区读取。 |
| `user_agent` | 提交时的 User-Agent 请求头原文（截断 512 字符）；公开时解析为 `agent_label` 短标签展示。 |
| `status` | `pending`、`visible` 或 `hidden`；提交和审核时写。 |
| `created_at` | 提交时间。 |

数据库触发器保证回复与父评论属于同一篇文章或同一条动态。后端仍负责 URL
协议白名单、内容转义、限流和反垃圾。

### `article_metrics`

| 字段 | 含义与读写 |
| --- | --- |
| `article_id` | 文章 UUID，同时是主键。 |
| `view_count` | 有效页面打开次数；浏览接口原子递增。 |
| `like_count` | 当前点赞数；由点赞表触发器维护。 |
| `updated_at` | 最近一次浏览或点赞变化时间。 |

文章创建后触发器自动建立指标行。首页热门排序在 SQL 层按
`like_count * 20 + view_count` 加权降序，并列时按发布时间倒序；暂不记录每日趋势。

### `article_likes`

| 字段 | 含义与读写 |
| --- | --- |
| `article_id` | 被点赞文章。 |
| `visitor_token_hash` | 浏览器匿名令牌的 SHA-256，不保存 IP 或浏览器指纹。 |
| `created_at` | 点赞时间。 |

联合主键保证同一匿名令牌对同一文章最多一个点赞。删除该行就是取消点赞。

### `dynamic_metrics`

| 字段 | 含义与读写 |
| --- | --- |
| `dynamic_id` | 动态 UUID，同时是主键。 |
| `like_count` | 当前点赞数；由点赞表触发器维护。 |
| `updated_at` | 最近一次点赞变化时间。 |

动态创建后触发器自动建立指标行。动态不统计浏览量。

### `dynamic_likes`

| 字段 | 含义与读写 |
| --- | --- |
| `dynamic_id` | 被点赞动态。 |
| `visitor_token_hash` | 浏览器匿名令牌的 SHA-256，与文章点赞共用同一访客 Cookie。 |
| `created_at` | 点赞时间。 |

联合主键保证同一匿名令牌对同一动态最多一个点赞。删除该行就是取消点赞。

### `friend_links`

| 字段 | 含义与读写 |
| --- | --- |
| `id` | 友链 UUID。 |
| `avatar_media_id` | 可选站点头像（本地媒体）。 |
| `avatar_url` | 可选外部头像链接（申请者自填的 favicon）；优先级高于 `avatar_media_id`，都为空时公开页回退到对方站点 `/favicon.ico`。 |
| `name` | 站点名称。 |
| `url` | 站点地址，全局唯一。 |
| `description` | 可选简介。 |
| `application_email` | 友链申请者留下的联系邮箱；管理端添加时为 NULL。 |
| `is_visible` | 是否在公开友链页显示。 |
| `sort_order` | 展示顺序。 |
| `created_at` | 创建时间。 |
| `updated_at` | 修改时间；触发器维护。 |

后端负责只允许 `http`/`https`，并在服务端抓取功能中防止 SSRF。

### `site_settings`

全库只能有一行，以 `singleton = true` 为主键。

| 字段 | 含义与读写 |
| --- | --- |
| `singleton` | 单例键；固定为 `true`。 |
| `site_title` | 站点标题。 |
| `site_description` | 可选站点描述和 SEO 摘要。 |
| `owner_name` | 个人卡正面名称。 |
| `owner_bio` | 个人卡背面/About 内容。 |
| `avatar_media_id` | 个人头像媒体。 |
| `avatar_external_url` | 可选外部头像链接；仅允许 `http(s)`、最长 512 字符。本地上传头像存在时优先，否则公开页与 favicon 使用此外部链接。 |
| `masthead_media_id` | 可选刊头背景图片媒体；设置后各列表页刊头以暗色遮罩背景图渲染。 |
| `hero_background_media_ids` | 首屏背景轮换图列表（jsonb 数组，最多 12 张，CHECK 约束限定数组类型与长度）。元素为媒体 UUID 字符串（按全局适应方式渲染，缺省 contain），或焦点对象 `{mediaId, position, size?}`：`position` 为 `"x% y%"` 框选焦点（该图按 cover 渲染并脱离视差超幅，精确还原框选窗口），可选 `size` 为 `"w% h%"` background-size 百分比（框选器滚轮局部放大）。访客每次冷进入随机抽一张；顺序轮换与定时间隔属前端行为，不存后端。 |
| `hero_quote` | 可选首屏语录卡文本，最长 120 字；为空时前端回退到站点说明。 |
| `social_links` | 社交链接 JSON 数组。 |
| `theme` | 当前颜色、字体和视觉 token JSON 对象。 |
| `shell_layout` | 全局导航、页宽和外壳组件 JSON 对象。 |
| `updated_at` | 最近配置时间；触发器维护。 |

JSONB 只承载变化快且整体读取的界面配置。数据库检查顶层类型，后端按字段
白名单与格式约束校验内部结构，不允许保存脚本。

### `page_layouts`（已停用，保留）

| 字段 | 含义与读写 |
| --- | --- |
| `page_key` | 页面类型键，例如 `home`。 |
| `layout` | 旧布局工作室的 JSON 布局树。 |
| `updated_at` | 最近调整布局的时间；触发器维护。 |

2026-10 大重构后布局工作室已删除，首页布局硬编码在代码里
（`web/src/ui/home-layout.ts` 与 `server/src/site/components.rs`），
本表不再被读写，仅为可回滚性保留，后续迁移可 DROP。
Askama 和 Lit 只渲染代码中注册过的组件，不执行数据库中的 HTML 或脚本。

### `subscribers`

| 字段 | 含义与读写 |
| --- | --- |
| `id` | 订阅者 UUID。 |
| `email` | 不区分大小写的唯一邮箱；仅订阅系统和管理员可见。 |
| `subscribe_articles` | 是否接收新文章。 |
| `subscribe_dynamics` | 是否接收新动态。 |
| `status` | `pending`、`active` 或 `unsubscribed`。 |
| `token_nonce` | 16 字节随机 nonce；重新订阅时轮换，使旧签名链接失效。 |
| `confirmation_sent_at` | 最近确认邮件发送时间。 |
| `confirmed_at` | 完成 double opt-in 的时间。 |
| `unsubscribed_at` | 退订时间。 |
| `created_at` | 首次提交时间。 |
| `updated_at` | 偏好或状态变化时间；触发器维护。 |

至少订阅文章或动态中的一种。确认与退订令牌由订阅者 UUID、用途和 nonce 经
HMAC-SHA-256 签名生成；数据库不保存令牌明文或可直接使用的链接。

### `email_deliveries`

| 字段 | 含义与读写 |
| --- | --- |
| `id` | 投递 UUID。 |
| `subscriber_id` | 接收订阅者。 |
| `kind` | 确认订阅、新文章或新动态。 |
| `article_id` | 新文章目标；仅文章通知填写。 |
| `dynamic_id` | 新动态目标；仅动态通知填写。 |
| `status` | `pending`、`sending`、`sent`、`failed` 或 `cancelled`。 |
| `attempt_count` | 已尝试次数。 |
| `next_attempt_at` | 首次发送或下次重试时间。 |
| `locked_at` | worker 领取时间；用于回收崩溃后遗留的 `sending` 任务。 |
| `last_error` | 最近错误摘要，不保存供应商完整响应。 |
| `created_at` | 任务创建时间。 |
| `sent_at` | 成功发送时间。 |

提交订阅时生成确认邮件任务；发布内容的事务直接为活跃订阅者生成通知任务。
数据库保证任务类型与内容目标匹配，同一订阅者对同一内容最多一条任务。初始系统
不建立通用 outbox。

## 基线种子

基线迁移在建表之后写入首装即可用的最小数据：单行 `site_settings`（夜航主题
Token 与顶栏外壳）、默认分类「夜航手记」，
以及一篇已发布且带 `featured_at` 的欢迎文章，保证首次启动时精选排序和首页文章流
不为空。种子内容均可在后台直接修改或删除。（历史种子还含 `page_layouts.home`
夜航布局树，该表已停用，见上节。）

## 并发与锁

- 普通公开查询使用 PostgreSQL 默认的 `READ COMMITTED` 和 MVCC，不显式加锁。
- 保存文章时先锁定文章行 `FOR UPDATE`，然后替换按 `tag_id` 排序的标签关联。
- 发布内容时锁定内容行；状态、发布时间和 `email_deliveries` 在同一事务提交。
- 浏览量使用单条 `UPDATE article_metrics SET view_count = view_count + 1`，只锁指标行。
- 点赞依赖 `(article_id, visitor_token_hash)` 主键处理竞争；触发器在同一事务更新计数。
- 评论回复触发器以 `FOR KEY SHARE` 读取父评论，避免验证期间父评论被删除。
- 邮件 worker 使用 `FOR UPDATE SKIP LOCKED` 小批量领取任务，提交领取状态后再发送。
- 清理过期会话按主键分批删除，不锁账号或内容表。
- 迁移进程获取 PostgreSQL advisory lock，并设置有限的 `lock_timeout`；运行时不使用
  `LOCK TABLE`。

## 校验边界

PostgreSQL 负责非空、唯一、外键、字段长度、计数范围、状态/时间组合和跨表引用。

后端仍负责权限、请求体大小、Argon2id 计算、上传文件魔数、Markdown 安全渲染、
URL 协议与 SSRF、JSON 组件 schema、限流及把约束错误转换为可读 API 响应。
