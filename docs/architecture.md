# 架构边界

YukiLog 是一个模块化单体，不拆分微服务。

## 运行形态

```text
Browser
  ├─ Rust SSR HTML
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
- Askama 负责公开页面的 HTML，Lit 只增强需要状态的交互。
- 管理后台使用 Lit SPA，但复用同一套 API 和 Web Components。
- PostgreSQL 是持久业务数据的唯一事实来源。
- 初始系统不依赖 Redis；确实出现跨进程短期状态需求时再引入。
- 媒体文件保存在发布目录之外，数据库只保存元数据与引用。

## 代码组织

`server/src/` 按职责分层：

- 根部：`main.rs`/`lib.rs`/`config.rs`/`error.rs`/`database.rs`，以及布局 schema
  `layout.rs` 与单文件 `auth.rs`；
- `entities/`：SeaORM 实体；
- `http/`：路由注册、中间件与健康检查；
- `markup/`：Markdown 渲染与 User-Agent 短标签解析；
- `content/`：内容与互动的 API handler（`public`/`admin`/`design`/`settings`，
  以及仪表盘聚合 `overview`）；
- `site/`：公开 SSR——`mod.rs` 是页面外壳（PageTemplate/共享 loader/共享卡片模型），
  `home.rs` 首页与排序，`article.rs` 文章详情与评论区，`lists.rs` 归档/动态/友链/搜索
  列表页，`components.rs` 布局节点渲染与组件模板；
- `ops/`：站点运营链路——`feed`（RSS）、`mail`（SMTP worker）、`notifications`、
  `subscriptions`、`media`（上传与存储）。

## 新代码规则

1. 仓库根目录只包含新系统，不引用历史源码、构建产物或运行配置。
2. HTTP DTO、领域模型和数据库模型相互分离。
3. 数据库修改只能由 SeaORM migration 完成。
4. 发布文章或动态时，同一事务直接生成订阅投递任务；不预建通用事件系统。
5. RSS 直接读取已发布内容；邮件发送失败不能回滚内容发布。
6. 页面布局只能组合注册过的组件和受校验的配置，不能存任意可执行代码。
7. 评论邮箱按表单声明公开；订阅邮箱和会话信息始终私密。

## 发布边界

生产环境使用 nginx、systemd 和版本目录。代码、配置、媒体、数据库备份分别存放；切换版本使用原子软链接，不在发布目录保存可变数据。
