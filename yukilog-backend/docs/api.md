<div align="center">

## YukiLog API 层文档

这个文档讲的是 YukiLog 后端的标准 API 接口（面向前端对接）

</div>

---

## 目录

| 模块 | 说明 |
| --- | --- |
| 通用 | [统一返回格式](#common) |
| Auth | [管理员登录](#auth) |
| Public | [前台接口](#public)<br>[Themes 主题](#public-themes) / [Tags 标签](#public-tags) / [Posts 文章](#public-posts) / [Stats 统计](#public-stats) / [Comments 评论](#public-comments) / [Links 友链](#public-links) / [Notes 随记](#public-notes) |
| Admin | [管理接口（JWT 保护）](#admin)<br>[Themes 主题](#admin-themes) / [Tags 标签](#admin-tags) / [Posts 文章](#admin-posts) / [Comments 评论](#admin-comments) / [Links 友链](#admin-links) / [Notes 随记](#admin-notes) |

<a id="common"></a>

## 统一返回格式

**所有接口都返回同一个外层结构：**

**响应**

```json
{
    "success": true,
    "data": null,
    "message": null
}
```

**字段说明：**
* success：请求是否成功
* data：成功时的数据；失败时通常为 null
* message：失败原因/提示信息；成功时通常为 null

**分页接口的 data 是一个分页对象：**

**data（分页对象）**

```json
{
    "items": [],
    "total": 123,
    "page": 1,
    "page_size": 10,
    "total_pages": 13
}
```

**字段说明：**
* items：当前页数据数组
* total：总条数
* page：当前页（从 1 开始）
* page_size：每页数量
* total_pages：总页数

---

<a id="auth"></a>
## Auth（管理员登录）

**说明：** 管理员登录，获取后续请求所需的 JWT。

```bash
POST /api/admin/login
```

**请求（JSON Body）**

```json
{
    "username": "admin",
    "password": "your_password"
}
```

**响应**

```json
{
    "success": true,
    "data": {
        "token": "eyJ...",
        "expires_in": 86400
    },
    "message": null
}
```

**字段说明：**
* token：JWT 字符串，后续请求放在 header：`Authorization: Bearer <token>`
* expires_in：有效期（秒）

---

<a id="public"></a>
## Public（前台接口）

<a id="public-themes"></a>
#### Themes 主题

**说明：** 获取主题列表（用于前台展示/筛选）。

```bash
GET /api/public/themes
```

**请求（Query）**

**字段说明：**
* sort：排序字段，可选值：`post_count` / `view_count` / `created_at`

```json
{
    "sort": "view_count"
}
```

**响应**

```json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "name": "技术",
            "slug": "tech",
            "description": "...",
            "post_count": 10,
            "view_count": 1000,
            "created_at": "2026-01-01T00:00:00+08:00"
        }
    ],
    "message": null
}
```

**说明：** 获取某个主题的详情（按 slug）。

```bash
GET /api/public/themes/:slug
```

**请求**

```json
{
    "slug": "tech"
}
```

**响应**

```json
{
    "success": true,
    "data": {
        "id": 1,
        "name": "技术",
        "slug": "tech",
        "description": "...",
        "post_count": 10,
        "view_count": 1000,
        "created_at": "2026-01-01T00:00:00+08:00"
    },
    "message": null
}
```

> 与 `GET /api/public/themes` 的 data 数组元素结构一致

**说明：** 主题浏览计数 +1（用于前台统计）。

```bash
POST /api/public/themes/:slug/view
```

**请求**

```json
{
    "slug": "tech"
}
```

**响应**

```json
{
    "success": true,
    "data": null,
    "message": null
}
```

> 以下接口响应体一致（均为 `data = null`）：
> - POST /api/public/themes/:slug/view
> - POST /api/public/tags/:slug/view
> - POST /api/public/posts/:slug/view

**字段说明（Theme）：**
* id：主题 ID
* name：主题名称
* slug：主题唯一标识（用于 URL）
* description：主题描述（可为空）
* post_count：主题下文章数
* view_count：主题浏览计数
* created_at：创建时间（带时区的时间字符串）

---

<a id="public-tags"></a>
#### Tags 标签

**说明：** 获取标签列表（用于前台展示/筛选）。

```bash
GET /api/public/tags
```

**请求（Query）**

**字段说明：**
* sort：排序字段，可选值：`post_count` / `view_count` / `created_at` / `name`

```json
{
    "sort": "view_count"
}
```

**响应**

```json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "name": "Rust",
            "slug": "rust",
            "post_count": 5,
            "view_count": 500,
            "created_at": "2026-01-01T00:00:00+08:00"
        }
    ],
    "message": null
}
```

**说明：** 获取某个标签的详情（按 slug）。

```bash
GET /api/public/tags/:slug
```

**请求**

```json
{
    "slug": "rust"
}
```

**响应**

```json
{
    "success": true,
    "data": {
        "id": 1,
        "name": "Rust",
        "slug": "rust",
        "post_count": 5,
        "view_count": 500,
        "created_at": "2026-01-01T00:00:00+08:00"
    },
    "message": null
}
```

> 与 `GET /api/public/tags` 的 data 数组元素结构一致

**说明：** 标签浏览计数 +1（用于前台统计）。

```bash
POST /api/public/tags/:slug/view
```

**请求**

```json
{
    "slug": "rust"
}
```

**响应**

```json
{
    "success": true,
    "data": null,
    "message": null
}
```

**字段说明（Tag）：**
* id：标签 ID
* name：标签名称
* slug：标签唯一标识
* post_count：标签下文章数
* view_count：标签浏览计数
* created_at：创建时间

---

<a id="public-posts"></a>
#### Posts 文章

**说明：** 获取文章列表（支持分页、排序、主题/标签筛选）。

```bash
GET /api/public/posts
```

**请求（Query）**

**字段说明：**
* sort：排序字段，可选值：`created_at` / `updated_at` / `view_count`
* theme_slugs：多个主题用英文逗号分隔
* tag_slugs：多个标签用英文逗号分隔（AND 关系：同时拥有这些标签）

```json
{
    "page": 1,
    "page_size": 10,
    "sort": "created_at",
    "theme_slugs": "tech,life",
    "tag_slugs": "rust,backend"
}
```

**响应（分页）**

```json
{
    "success": true,
    "data": {
        "items": [
            {
                "id": 1,
                "title": "文章标题",
                "slug": "article-slug",
                "summary": "摘要",
                "content": "内容",
                "cover_image": "https://...",
                "status": "published",
                "theme_id": 1,
                "view_count": 100,
                "created_at": "2026-01-01T00:00:00+08:00",
                "updated_at": "2026-01-02T00:00:00+08:00"
            }
        ],
        "total": 100,
        "page": 1,
        "page_size": 10,
        "total_pages": 10
    },
    "message": null
}
```

**说明：** 获取文章详情（按 slug）。

```bash
GET /api/public/posts/:slug
```

**请求**

```json
{
    "slug": "article-slug"
}
```

**响应**

```json
{
    "success": true,
    "data": {
        "id": 1,
        "title": "文章标题",
        "slug": "article-slug",
        "summary": "摘要",
        "content": "内容",
        "cover_image": "https://...",
        "status": "published",
        "theme_id": 1,
        "view_count": 100,
        "created_at": "2026-01-01T00:00:00+08:00",
        "updated_at": "2026-01-02T00:00:00+08:00"
    },
    "message": null
}
```

> 与 `GET /api/public/posts` 的 data.items 数组元素结构一致

**说明：** 文章浏览计数 +1（用于前台统计）。

```bash
POST /api/public/posts/:slug/view
```

**请求**

```json
{
    "slug": "article-slug"
}
```

**响应**

```json
{
    "success": true,
    "data": null,
    "message": null
}
```

**字段说明（Post）：**
* id：文章 ID
* title：标题
* slug：文章唯一标识
* summary：摘要（可为空）
* content：正文
* cover_image：封面图（可为空）
* status：文章状态（draft / published）
* theme_id：主题 ID（可为空）
* view_count：浏览计数
* created_at / updated_at：创建/更新时间

---

<a id="public-stats"></a>

#### Stats 统计

**说明：** 获取站点统计数据（文章总数、总浏览量、总字数）。

```bash
GET /api/public/stats
```

**请求**

无需参数

**响应**

```json
{
    "success": true,
    "data": {
        "total_posts": 12,
        "total_views": 4567,
        "total_words": 123456
    },
    "message": null
}
```

**字段说明：**
* total_posts：已发布文章总数
* total_views：所有已发布文章浏览量总和
* total_words：所有已发布文章内容字符总长度

---

<a id="public-comments"></a>

#### Comments 评论

**说明：** 获取某篇文章下的评论树（包含子评论）。

```bash
GET /api/public/posts/:slug/comments
```

**请求**

```json
{
    "slug": "article-slug"
}
```

**响应（评论树，data 是 PublicCommentNode 数组；不含 IP / 原始 UA）**

```json
{
    "success": true,
    "data": [
        {
            "comment": {
                "id": 1,
                "post_id": 1,
                "content": "评论内容",
                "guest_nick": "张三",
                "guest_email": "zhangsan@example.com",
                "guest_website": "https://example.com",
                "parent_id": null,
                "root_id": null,
                "visitor_info": "Desktop Chrome · macOS",
                "avatar_url": "https://www.gravatar.com/avatar/...",
                "created_at": "2026-01-01T00:00:00+08:00"
            },
            "children": []
        }
    ],
    "message": null
}
```

**说明：** 获取某条评论的直接回复列表（按评论 id）。

```bash
GET /api/public/posts/:slug/comments/:id
```

**请求**

```json
{
    "id": 123
}
```

**响应（data 是 PublicComment 数组）**

```json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "post_id": 1,
            "content": "评论内容",
            "guest_nick": "张三",
            "guest_email": "zhangsan@example.com",
            "guest_website": "https://example.com",
            "parent_id": null,
            "root_id": null,
            "visitor_info": "Desktop Chrome · macOS",
            "avatar_url": "https://www.gravatar.com/avatar/...",
            "created_at": "2026-01-01T00:00:00+08:00"
        }
    ],
    "message": null
}
```

**说明：** 在某篇文章下提交评论（支持回复：parent_id 不为空）。

```bash
POST /api/public/posts/:slug/comments
```

**请求（Path + JSON Body）**

```json
{
    "slug": "article-slug",
    "body": {
        "nickname": "张三",
        "email": "zhangsan@example.com",
        "content": "评论内容",
        "parent_id": null,
        "website": "https://example.com"
    }
}
```

**响应**

```json
{
    "success": true,
    "data": {
        "id": 1,
        "created_at": "2026-01-01T00:00:00+08:00"
    },
    "message": null
}
```

**字段说明：**
* PublicCommentNode：`comment` 是评论本体，`children` 是子评论数组
* 公开接口返回访客主动填写的 `guest_email`，不返回 `ip` / 原始 `ua`；头像用 `avatar_url`（Gravatar）
* 提交评论只需返回 `id` 和 `created_at`，默认进入 pending 审核

---

<a id="public-links"></a>

#### Links 友链

**说明：** 获取前台可展示的友链列表。

```bash
GET /api/public/links
```

**请求**

```json
{}
```

**响应**

```json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "title": "站点",
            "url": "https://example.com",
            "avatar": "https://example.com/a.png",
            "description": "描述",
            "status": "active",
            "created_at": "2026-01-01T00:00:00+08:00"
        }
    ],
    "message": null
}
```

**说明：** 申请添加友链（提交后通常为 pending，等待管理员审核）。

```bash
POST /api/public/links/submit
```

**请求（JSON Body）**

```json
{
    "title": "站点",
    "url": "https://example.com",
    "avatar": "https://example.com/a.png",
    "description": "描述"
}
```

**响应**

```json
{
    "success": true,
    "data": {
        "id": 1,
        "message": "友链申请已提交，待管理员审核"
    },
    "message": null
}
```

**字段说明（Link）：**
* status：active / pending / broken

---

<a id="public-notes"></a>

#### Notes 随记

**说明：** 获取随记列表（分页，仅已发布）。

```bash
GET /api/public/notes
```

**请求（Query）**

**字段说明：**
* page：页码（从 1 开始，默认 1）
* page_size：每页数量（默认 10，最大 20）

```json
{
    "page": 1,
    "page_size": 10
}
```

**响应（分页）**

```json
{
    "success": true,
    "data": {
        "items": [
            {
                "id": 1,
                "content": "今天学了 Rust 的 lifetime...",
                "mood": "thinking",
                "status": "published",
                "created_at": "2026-03-10T14:30:00+08:00",
                "updated_at": "2026-03-10T14:30:00+08:00"
            }
        ],
        "total": 42,
        "page": 1,
        "page_size": 10,
        "total_pages": 5
    },
    "message": null
}
```

**说明：** 获取随记详情（仅已发布）。

```bash
GET /api/public/notes/:id
```

**请求**

```json
{ "id": 1 }
```

**响应（data 为 Note）**

```json
{
    "success": true,
    "data": {
        "id": 1,
        "content": "今天学了 Rust 的 lifetime...",
        "mood": "thinking",
        "status": "published",
        "created_at": "2026-03-10T14:30:00+08:00",
        "updated_at": "2026-03-10T14:30:00+08:00"
    },
    "message": null
}
```

> 与 `GET /api/public/notes` 的 data.items 数组元素结构一致

**字段说明（Note）：**
* id：随记 ID
* content：Markdown 内容
* mood：心情标记（可为空），自由文本字符串（如 `happy`、`drifting`、`lucid`），前端 config 维护预设查询表，后端不做枚举校验
* status：状态（published / draft / private）
* created_at / updated_at：创建/更新时间

---

<a id="admin"></a>
## Admin（管理接口，JWT 保护）

**说明：** 除 `POST /api/admin/login` 外，其余 admin 接口都需要请求头：

```bash
Authorization: Bearer <token>
```

> 以下接口响应体一致（均为 `data = null`）：
> - DELETE /api/admin/themes/:id
> - DELETE /api/admin/tags/:id
> - DELETE /api/admin/posts/:slug
> - DELETE /api/admin/comments/:id
> - DELETE /api/admin/links/:id
> - DELETE /api/admin/notes/:id

<a id="admin-themes"></a>
#### Themes 主题

**说明：** 创建主题。

```bash
POST /api/admin/themes
```

**请求（JSON Body）**

```json
{
    "name": "技术",
    "slug": "tech",
    "description": "..."
}
```

**响应（data 为 Theme）**

```json
{
    "success": true,
    "data": {
        "id": 1,
        "name": "技术",
        "slug": "tech",
        "description": "...",
        "post_count": 0,
        "view_count": 0,
        "created_at": "2026-01-01T00:00:00+08:00"
    },
    "message": null
}
```

**说明：** 更新主题（按 id）。

```bash
PUT /api/admin/themes/:id
```

**请求**

```json
{
    "id": 1,
    "body": {
        "name": "新名称",
        "slug": "new-slug",
        "description": null
    }
}
```

**响应（data 为 Theme）**

```json
{
    "success": true,
    "data": {
        "id": 1,
        "name": "新名称",
        "slug": "new-slug",
        "description": null,
        "post_count": 0,
        "view_count": 0,
        "created_at": "2026-01-01T00:00:00+08:00"
    },
    "message": null
}
```

**说明：** 删除主题（按 id）。

```bash
DELETE /api/admin/themes/:id
```

**请求**

```json
{ "id": 1 }
```

**响应（data 为 null）**

```json
{
    "success": true,
    "data": null,
    "message": null
}
```

<a id="admin-tags"></a>
#### Tags 标签

**说明：** 创建标签。

```bash
POST /api/admin/tags
```

**请求（JSON Body）**

```json
{
    "name": "Rust",
    "slug": "rust"
}
```

**响应（data 为 Tag）**

```json
{
    "success": true,
    "data": {
        "id": 1,
        "name": "Rust",
        "slug": "rust",
        "post_count": 0,
        "view_count": 0,
        "created_at": "2026-01-01T00:00:00+08:00"
    },
    "message": null
}
```

**说明：** 更新标签（按 id）。

```bash
PUT /api/admin/tags/:id
```

**请求**

```json
{
    "id": 1,
    "body": {
        "name": "Rust Lang",
        "slug": "rust"
    }
}
```

**响应（data 为 Tag）**

```json
{
    "success": true,
    "data": {
        "id": 1,
        "name": "Rust Lang",
        "slug": "rust",
        "post_count": 0,
        "view_count": 0,
        "created_at": "2026-01-01T00:00:00+08:00"
    },
    "message": null
}
```

**说明：** 删除标签（按 id）。

```bash
DELETE /api/admin/tags/:id
```

**请求**

```json
{ "id": 1 }
```

**响应（data 为 null）**

```json
{
    "success": true,
    "data": null,
    "message": null
}
```

**说明：** 合并标签：把 source_ids 合并到 target_id（文章关联会迁移到 target）。

```bash
POST /api/admin/tags/merge
```

**请求（JSON Body）**

```json
{
    "target_id": 1,
    "source_ids": [2, 3]
}
```

**响应（data 为 Tag，合并后的目标标签）**

```json
{
    "success": true,
    "data": {
        "id": 1,
        "name": "Rust",
        "slug": "rust",
        "post_count": 0,
        "view_count": 0,
        "created_at": "2026-01-01T00:00:00+08:00"
    },
    "message": null
}
```

<a id="admin-posts"></a>
#### Posts 文章

**说明：** 管理端文章列表（支持分页、排序、状态筛选、主题/标签筛选）。

```bash
GET /api/admin/posts
```

**请求（Query）**

**字段说明：**
* sort：排序字段，可选值：`created_at` / `updated_at` / `view_count`
* status：文章状态筛选，可选值：`draft` / `published`
* theme_slugs：多个主题用英文逗号分隔
* tag_slugs：多个标签用英文逗号分隔（AND 关系）

```json
{
    "page": 1,
    "page_size": 10,
    "sort": "created_at",
    "status": "draft",
    "theme_slugs": "tech,life",
    "tag_slugs": "rust,backend"
}
```

**响应（分页，items 为 Post）**

```json
{
    "success": true,
    "data": {
        "items": [
            {
                "id": 1,
                "title": "文章标题",
                "slug": "article-slug",
                "summary": "摘要",
                "content": "内容",
                "cover_image": "https://...",
                "status": "draft",
                "theme_id": 1,
                "view_count": 0,
                "created_at": "2026-01-01T00:00:00+08:00",
                "updated_at": "2026-01-01T00:00:00+08:00"
            }
        ],
        "total": 1,
        "page": 1,
        "page_size": 10,
        "total_pages": 1
    },
    "message": null
}
```

**说明：** 创建文章。

```bash
POST /api/admin/posts
```

**请求（JSON Body）**

```json
{
    "title": "标题",
    "slug": "article-slug",
    "content": "内容",
    "summary": "摘要",
    "cover_image": "https://...",
    "status": "draft",
    "theme_slug": "tech",
    "tag_slugs": ["rust", "backend"]
}
```

**响应（data 为 Post）**

```json
{
    "success": true,
    "data": {
        "id": 1,
        "title": "标题",
        "slug": "article-slug",
        "summary": "摘要",
        "content": "内容",
        "cover_image": "https://...",
        "status": "draft",
        "theme_id": 1,
        "view_count": 0,
        "created_at": "2026-01-01T00:00:00+08:00",
        "updated_at": "2026-01-01T00:00:00+08:00"
    },
    "message": null
}
```

**说明：** 更新文章（按 slug）。

```bash
PUT /api/admin/posts/:slug
```

**请求**

```json
{
    "slug": "article-slug",
    "body": {
        "title": "新标题",
        "status": "published",
        "tag_slugs": ["rust"]
    }
}
```

**响应（data 为 Post）**

```json
{
    "success": true,
    "data": {
        "id": 1,
        "title": "新标题",
        "slug": "article-slug",
        "summary": "摘要",
        "content": "内容",
        "cover_image": "https://...",
        "status": "published",
        "theme_id": 1,
        "view_count": 0,
        "created_at": "2026-01-01T00:00:00+08:00",
        "updated_at": "2026-01-02T00:00:00+08:00"
    },
    "message": null
}
```

**说明：** 删除文章（按 slug）。

```bash
DELETE /api/admin/posts/:slug
```

**请求**

```json
{ "slug": "article-slug" }
```

**响应（data 为 null）**

```json
{
    "success": true,
    "data": null,
    "message": null
}
```

<a id="admin-comments"></a>
#### Comments 评论

**说明：** 管理端评论列表（支持分页、排序、按文章过滤）。

```bash
GET /api/admin/comments
```

**请求（Query）**

**字段说明：**
* sort：排序方式，可选值：`created_at_asc` / `created_at_desc`

```json
{
    "page": 1,
    "page_size": 10,
    "sort": "created_at_desc",
    "post_slug": "article-slug"
}
```

**响应（分页，items 为 Comment）**

```json
{
    "success": true,
    "data": {
        "items": [
            {
                "id": 1,
                "post_id": 1,
                "content": "评论内容",
                "guest_nick": "张三",
                "guest_email": "zhangsan@example.com",
                "guest_website": "https://example.com",
                "parent_id": null,
                "root_id": null,
                "status": "pending",
                "ip": null,
                "ua": null,
                "created_at": "2026-01-01T00:00:00+08:00"
            }
        ],
        "total": 1,
        "page": 1,
        "page_size": 10,
        "total_pages": 1
    },
    "message": null
}
```

**说明：** 获取所有待审核评论。

```bash
GET /api/admin/comments/pending
```

**请求**

```json
{}
```

**响应（data 为 Comment[]）**

```json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "post_id": 1,
            "content": "评论内容",
            "guest_nick": "张三",
            "guest_email": "zhangsan@example.com",
            "guest_website": "https://example.com",
            "parent_id": null,
            "root_id": null,
            "status": "pending",
            "ip": null,
            "ua": null,
            "created_at": "2026-01-01T00:00:00+08:00"
        }
    ],
    "message": null
}
```

**说明：** 审核通过某条评论（按 id）。

```bash
PUT /api/admin/comments/:id/approve
```

**请求**

```json
{ "id": 1 }
```

**响应（data 为 Comment）**

```json
{
    "success": true,
    "data": {
        "id": 1,
        "post_id": 1,
        "content": "评论内容",
        "guest_nick": "张三",
        "guest_email": "zhangsan@example.com",
        "guest_website": "https://example.com",
        "parent_id": null,
        "root_id": null,
        "status": "approved",
        "ip": null,
        "ua": null,
        "created_at": "2026-01-01T00:00:00+08:00"
    },
    "message": null
}
```

**说明：** 拒绝/标记某条评论为垃圾（按 id）。

```bash
PUT /api/admin/comments/:id/reject
```

**请求**

```json
{ "id": 1 }
```

**响应（data 为 Comment）**

```json
{
    "success": true,
    "data": {
        "id": 1,
        "post_id": 1,
        "content": "评论内容",
        "guest_nick": "张三",
        "guest_email": "zhangsan@example.com",
        "guest_website": "https://example.com",
        "parent_id": null,
        "root_id": null,
        "status": "spam",
        "ip": null,
        "ua": null,
        "created_at": "2026-01-01T00:00:00+08:00"
    },
    "message": null
}
```

**说明：** 编辑评论内容与访客信息（按 id）。

```bash
PUT /api/admin/comments/:id
```

**请求**

```json
{
    "id": 1,
    "body": {
        "content": "新内容",
        "guest_nick": "新昵称",
        "guest_email": "new@example.com",
        "guest_website": "https://new.example.com"
    }
}
```

**响应（data 为 Comment）**

```json
{
    "success": true,
    "data": {
        "id": 1,
        "post_id": 1,
        "content": "新内容",
        "guest_nick": "新昵称",
        "guest_email": "new@example.com",
        "guest_website": "https://new.example.com",
        "parent_id": null,
        "root_id": null,
        "status": "approved",
        "ip": null,
        "ua": null,
        "created_at": "2026-01-01T00:00:00+08:00"
    },
    "message": null
}
```

**说明：** 删除评论（按 id）。

```bash
DELETE /api/admin/comments/:id
```

**请求**

```json
{ "id": 1 }
```

**响应（data 为 null）**

```json
{
    "success": true,
    "data": null,
    "message": null
}
```

<a id="admin-links"></a>
#### Links 友链

**说明：** 管理端友链列表（支持排序）。

```bash
GET /api/admin/links
```

**请求（Query）**

**字段说明：**
* sort：排序方式，可选值：`created_at_asc` / `created_at_desc`

```json
{
    "sort": "created_at_desc"
}
```

**响应（data 为 Link[]）**

```json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "title": "站点",
            "url": "https://example.com",
            "avatar": "https://example.com/a.png",
            "description": "描述",
            "status": "pending",
            "created_at": "2026-01-01T00:00:00+08:00"
        }
    ],
    "message": null
}
```

**说明：** 获取所有待审核的友链申请。

```bash
GET /api/admin/links/pending
```

**请求**

```json
{}
```

**响应（data 为 Link[]）**

```json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "title": "站点",
            "url": "https://example.com",
            "avatar": "https://example.com/a.png",
            "description": "描述",
            "status": "pending",
            "created_at": "2026-01-01T00:00:00+08:00"
        }
    ],
    "message": null
}
```

**说明：** 审核通过友链申请（按 id）。

```bash
PUT /api/admin/links/:id/approve
```

**请求**

```json
{ "id": 1 }
```

**响应（data 为 Link）**

```json
{
    "success": true,
    "data": {
        "id": 1,
        "title": "站点",
        "url": "https://example.com",
        "avatar": "https://example.com/a.png",
        "description": "描述",
        "status": "active",
        "created_at": "2026-01-01T00:00:00+08:00"
    },
    "message": null
}
```

**说明：** 标记友链为失效（按 id）。

```bash
PUT /api/admin/links/:id/broken
```

**请求**

```json
{ "id": 1 }
```

**响应（data 为 Link）**

```json
{
    "success": true,
    "data": {
        "id": 1,
        "title": "站点",
        "url": "https://example.com",
        "avatar": "https://example.com/a.png",
        "description": "描述",
        "status": "broken",
        "created_at": "2026-01-01T00:00:00+08:00"
    },
    "message": null
}
```

**说明：** 编辑友链信息（按 id）。

```bash
PUT /api/admin/links/:id
```

**请求**

```json
{
    "id": 1,
    "body": {
        "title": "新名称",
        "url": "https://new-url.com",
        "avatar": "https://.../a.png",
        "description": "新描述"
    }
}
```

**响应（data 为 Link）**

```json
{
    "success": true,
    "data": {
        "id": 1,
        "title": "新名称",
        "url": "https://new-url.com",
        "avatar": "https://.../a.png",
        "description": "新描述",
        "status": "active",
        "created_at": "2026-01-01T00:00:00+08:00"
    },
    "message": null
}
```

**说明：** 删除友链（按 id）。

```bash
DELETE /api/admin/links/:id
```

**请求**

```json
{ "id": 1 }
```

**响应（data 为 null）**

```json
{
    "success": true,
    "data": null,
    "message": null
}
```

<a id="admin-notes"></a>
#### Notes 随记

**说明：** 管理端随记列表（含草稿/私密，支持分页和状态筛选）。

```bash
GET /api/admin/notes
```

**请求（Query）**

**字段说明：**
* page：页码（从 1 开始，默认 1）
* page_size：每页数量（默认 10）
* status：状态筛选，可选值：`published` / `draft` / `private`

```json
{
    "page": 1,
    "page_size": 10,
    "status": "draft"
}
```

**响应（分页，items 为 Note）**

```json
{
    "success": true,
    "data": {
        "items": [
            {
                "id": 1,
                "content": "今天学了 Rust 的 lifetime...",
                "mood": "thinking",
                "status": "draft",
                "created_at": "2026-03-10T14:30:00+08:00",
                "updated_at": "2026-03-10T14:30:00+08:00"
            }
        ],
        "total": 5,
        "page": 1,
        "page_size": 10,
        "total_pages": 1
    },
    "message": null
}
```

**说明：** 创建随记。

```bash
POST /api/admin/notes
```

**请求（JSON Body）**

**字段说明：**
* content：Markdown 内容（必填）
* mood：心情标记（可选），自由文本字符串（如 `happy`、`drifting`、`lucid`），前端 config 维护预设查询表，后端不做枚举校验
* status：状态（可选，默认 published），可选值：published / draft / private

```json
{
    "content": "今天学了 Rust 的 lifetime...",
    "mood": "thinking",
    "status": "published"
}
```

**响应（data 为 Note）**

```json
{
    "success": true,
    "data": {
        "id": 1,
        "content": "今天学了 Rust 的 lifetime...",
        "mood": "thinking",
        "status": "published",
        "created_at": "2026-03-10T14:30:00+08:00",
        "updated_at": "2026-03-10T14:30:00+08:00"
    },
    "message": null
}
```

**说明：** 更新随记（按 id）。

```bash
PUT /api/admin/notes/:id
```

**请求**

**字段说明：**
* content：新内容（不传不修改）
* mood：三态字段（不传=不改，null=清空，"happy"=设置）
* status：新状态（不传不修改）

```json
{
    "id": 1,
    "body": {
        "content": "修改后的内容",
        "mood": "happy",
        "status": "draft"
    }
}
```

**响应（data 为 Note）**

```json
{
    "success": true,
    "data": {
        "id": 1,
        "content": "修改后的内容",
        "mood": "happy",
        "status": "draft",
        "created_at": "2026-03-10T14:30:00+08:00",
        "updated_at": "2026-03-11T10:00:00+08:00"
    },
    "message": null
}
```

**说明：** 删除随记（按 id）。

```bash
DELETE /api/admin/notes/:id
```

**请求**

```json
{ "id": 1 }
```

**响应（data 为 null）**

```json
{
    "success": true,
    "data": null,
    "message": null
}
```
