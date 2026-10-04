# 内容与互动 API

所有 `/api/admin/*` 写接口都要求管理员 Session、匹配
`YUKILOG_PUBLIC_ORIGIN` 的 `Origin`，以及与 CSRF Cookie 相同的
`X-CSRF-Token`。

## 管理端

- `/api/admin/categories`：分类列表与创建；
- `/api/admin/categories/{id}`：分类修改与删除；
- `/api/admin/tags`、`/api/admin/tags/{id}`：标签 CRUD；
- `/api/admin/articles`、`/api/admin/articles/{id}`：文章 CRUD；
- `/api/admin/articles/{id}/publish|withdraw`：发布与撤回；
- `/api/admin/dynamics`、`/api/admin/dynamics/{id}`：动态 CRUD；
- `/api/admin/dynamics/{id}/publish|withdraw`：发布与撤回；
- `/api/admin/comments`、`/api/admin/comments/{id}`：审核与删除；
- `/api/admin/friend-links`、`/api/admin/friend-links/{id}`：友链 CRUD；
- `GET /api/admin/media`：媒体选择列表。

文章保存会在事务中锁定文章行并整体替换标签。首次发布内容时，同一事务为符合
偏好的活跃订阅者建立 `email_deliveries`；编辑已发布内容不会再次通知。撤回会
取消尚未发送的任务。

## 公开互动

- `GET|POST /api/articles/{id}/comments`
- `GET|POST /api/dynamics/{id}/comments`
- `GET /api/articles/{id}/metrics`
- `POST /api/articles/{id}/view`
- `PUT|DELETE /api/articles/{id}/like`

评论默认进入 `pending`，仅 `visible` 评论公开。评论表单中的昵称、邮箱、网站与
正文按页面声明公开；订阅邮箱仍然私密。

浏览量按 IP、文章和 30 秒窗口进行进程内限频。仅当请求来自本机反向代理时才信任
`X-Real-IP`。评论按目标和 IP 限制为每分钟一次。

点赞使用一年有效的 HttpOnly 匿名访客 Cookie。Cookie 保存随机令牌，数据库只
保存 SHA-256；联合主键和触发器负责去重及维护点赞数。

本阶段只存储 Markdown 原文。HTML 安全渲染、RSS、搜索和邮件发送 worker 属于
下一阶段。
