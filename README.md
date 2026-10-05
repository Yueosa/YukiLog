<div align="center">

## YukiLog ❄️

</div>

**YukiLog** 是一个追求完全自控力的全栈博客系统。
后端用 Rust 服务端渲染公开页面，管理后台是 Lit 单页应用，通过自己的 REST API 通信，用来做一个属于开发者个人的数字花园。

> 这是重写后的正式实现，不兼容历史数据库、API、前端组件或资源地址。
>
> 仓库只提供 CMS 源代码：不附带任何默认背景、封面或图片素材，
> 站点用到的全部媒体请在部署后通过管理后台自行上传。

---

## 整体架构

公开页服务端渲染，管理端单页应用，REST JSON 通信。

* **公开页：** Rust + Askama SSR，真实数据直出，无 JS 也可阅读
* **管理后台：** Lit Web Components SPA（`/admin`），含布局工作室
* **数据库：** PostgreSQL（无 Redis；限流为进程内 + nginx 双层）

---

## 技术栈

**Backend (Rust)**
* Framework: `Axum`
* Runtime: `Tokio`
* ORM: `SeaORM`
* Template: `Askama`
* Auth: `Argon2` + 会话 Cookie（双提交 CSRF）
* Markdown: 自研渲染管线 + `ammonia` 消毒

**Frontend (TypeScript)**
* `Lit` Web Components + `Vite`
* 可组合组件布局引擎（布局工作室）

**Infrastructure**
* PostgreSQL
* Nginx + systemd（见 `ops/`）
* systemd-nspawn 隔离部署演练（见 `ops/rehearsal/`）

---

## 文档

#### 设计

[产品形态](./docs/product-shape.md)

[架构](./docs/architecture.md)

[数据库](./docs/database.md)

[布局系统](./docs/layout-system.md)

#### 接口与功能

[内容 API](./docs/content-api.md)

[认证](./docs/authentication.md)

[公开站](./docs/public-web.md)

[管理后台](./docs/admin-web.md)

[媒体](./docs/media.md)

[订阅与邮件](./docs/subscriptions.md)

[邮件测试](./docs/mail-testing.md)

#### 部署

[运维指南](./ops/README.md)

[隔离部署演练](./ops/rehearsal/README.md)

---

## 开发

```bash
# Rust 服务
cargo run -p yukilog-server

# 数据库迁移
cargo run -p yukilog-migration -- up

# 交互式创建管理员
cargo run -p yukilog-server --bin yukilog-admin -- \
  create-admin <username> <display-name>

# Lit 开发服务器
pnpm install
pnpm dev
```

## 部署

提供从干净 Ubuntu 主机到上线的完整工具链：交互式初始化、原子发布与回滚、
数据库与媒体备份恢复、Let's Encrypt 证书。

```bash
sudo ./ops/bootstrap-host.sh      # 询问域名、证书邮箱、是否安装 PostgreSQL
sudo yukilog-deploy /var/www/yukilog/incoming/yukilog-<version>.tar.gz
sudo yukilog-enable-https
```

发布前可用 nspawn 容器在隔离环境完整演练一遍（不碰宿主机）：

```bash
sudo ./ops/rehearsal/run.sh
```

---

## License

本项目采用组合授权协议：

* Source Code is licensed under GNU AGPL-3.0
    * 意味着如果你对源代码进行了修改并用于云服务，你需要公开你的源代码。

* Blog Content and Creative Materials are licensed under CC BY-NC-SA 4.0
    * 署名-非商业性使用-相同方式共享。
