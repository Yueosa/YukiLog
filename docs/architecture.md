# 架构边界

YukiLog 是一个模块化单体，不拆分微服务。

## 运行形态

```text
Browser
  ├─ Lit 访客 SPA（人类 UA，数据走 /api/public/*）
  ├─ Rust SSR HTML（爬虫 UA 与 ?ssr=1）
  ├─ Lit Web Components
  └─ Admin Lit SPA
          │
       Axum /api
          │
     PostgreSQL
          │
    Media metadata
          │
    Filesystem media
```

- Axum 是唯一处理 HTTP 的应用进程；SMTP worker 是独立的后台投递进程。
- 公开页面双形态：人类访客得到 `yuki-app` SPA 壳（`site/gateway.rs` 按 UA 与
  `?ssr=1` 分流），爬虫和无 JS 环境得到 Askama SSR 完整 HTML；SSR 保留为 SEO
  与降级通道。
- 管理后台使用 Lit SPA，但复用同一套 API 和 Web Components。
- PostgreSQL 是持久业务数据的唯一事实来源。
- 初始系统不依赖 Redis；确实出现跨进程短期状态需求时再引入。
- 媒体文件保存在发布目录之外，数据库只保存元数据与引用。

## 代码组织

`server/src/` 按职责分层：

- 根部：`main.rs`/`lib.rs`/`config.rs`/`error.rs`/`database.rs`，以及单文件
  `auth.rs`；
- `entities/`：SeaORM 实体；
- `http/`：路由注册、中间件与健康检查；
- `markup/`：LianMarkup(.ly) 正文渲染（含 syntect 代码高亮、ammonia 白名单）
  与 User-Agent 短标签解析；
- `content/`：内容与互动的 API handler（`public`/`public_api`/`admin`/
  `settings`，以及仪表盘聚合 `overview`）；`public_api` 是访客 SPA 的只读 JSON
  数据源，`public` 是评论/点赞/浏览等互动端点；
- `site/`：公开 SSR 与 UA 分流——`gateway.rs` 按 User-Agent 与 `?ssr=1` 在 SPA 壳
  和 SSR 之间分流并解析 vite manifest，`mod.rs` 是页面外壳（PageTemplate/共享
  loader/共享卡片模型），`home.rs` 首页与排序，`article.rs` 文章详情与评论区，
  `lists.rs` 归档/动态/友链/搜索列表页，`components.rs` 首页固定布局渲染与组件模板；
- `ops/`：站点运营链路——`feed`（RSS）、`hitokoto`（一言代理与兜底）、`mail`
  （SMTP worker）、`notifications`、`subscriptions`、`media`（上传与存储）。

## 新代码规则

1. 仓库根目录只包含新系统，不引用历史源码、构建产物或运行配置。
2. HTTP DTO、领域模型和数据库模型相互分离。
3. 数据库修改只能由 SeaORM migration 完成。
4. 发布文章或动态时，同一事务直接生成订阅投递任务；不预建通用事件系统。
5. RSS 直接读取已发布内容；邮件发送失败不能回滚内容发布。
6. 配置值只能落在受校验的字段白名单内，不能存任意可执行代码。
7. 评论邮箱按表单声明公开；订阅邮箱和会话信息始终私密。

## 发布边界

生产环境使用 nginx、systemd 和版本目录。代码、配置、媒体、数据库备份分别存放；切换版本使用原子软链接，不在发布目录保存可变数据。
