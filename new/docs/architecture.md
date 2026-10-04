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

## 新代码规则

1. `new/` 不引用父目录源码、构建产物或运行配置。
2. HTTP DTO、领域模型和数据库模型相互分离。
3. 数据库修改只能由 SeaORM migration 完成。
4. 发布文章或动态时，同一事务直接生成订阅投递任务；不预建通用事件系统。
5. RSS 直接读取已发布内容；邮件发送失败不能回滚内容发布。
6. 页面布局只能组合注册过的组件和受校验的配置，不能存任意可执行代码。
7. 评论邮箱按表单声明公开；订阅邮箱和会话信息始终私密。

## 发布边界

生产环境使用 nginx、systemd 和版本目录。代码、配置、媒体、数据库备份分别存放；切换版本使用原子软链接，不在发布目录保存可变数据。
