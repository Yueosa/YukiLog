<div align="center">

## YukiLog ❄️

</div>

**YukiLog** 是一个追求极致性能与完全自控力的全栈博客系统。
后端用 Rust，前端用 SvelteKit，通过自己的 REST API 通信，用来做一个属于开发者个人的数字花园。

> 正在重构中: 这几天我在写自己的网盘+图床应用(为了替换openlist), 然后因为这个博客的封面直接使用了 openlist 分享链接, 所以开始检查相关逻辑
>
> 检查过程中发现有很多Bug, 尤其是手机端使用体验不佳, 部分硬编码数据和页面需要修改, 还需要添加一些新的功能
>
> 希望花三个月的时间能弄完吧, 同时打算把那一堆半人半AI的水文全部删掉, 重构成质量更高的东西(比如设计思想?)

---

## 整体架构

前后端分离，REST JSON 通信。

* **后端：** Rust + Axum + SeaORM + PostgreSQL，Redis 做浏览/评论/友链限流。
* **前端：** SvelteKit 2 + Svelte 5，公开页 SSR，管理后台走 JWT。样式是自定义 CSS 变量，没有 Tailwind，也没有暗色主题。
* **数据库：** PostgreSQL。评论用 `parent_id` / `root_id` 做树。

---

## 技术栈

**Backend (Rust)**
* Framework: `Axum`
* Runtime: `Tokio`
* ORM: `SeaORM`
* Auth: `Argon2` + `JWT`
* Cache: `Redis`

**Frontend (TypeScript)**
* `SvelteKit 2` + `Svelte 5`
* Markdown: `marked` + `shiki` + `katex` + `mermaid`
* Adapter: `@sveltejs/adapter-node`

**Infrastructure**
* PostgreSQL
* Nginx + systemd（见部署脚本）

---

## 文档

#### 后端

[YukiLog 设计文档](./yukilog-backend/docs/yukilog.md)

[YukiLog API文档](./yukilog-backend/docs/api.md)

[YukiLog 保留接口文档](./yukilog-backend/docs/_api.md)

[YukiLog 数据库映射文档](./yukilog-backend/docs/orm.md)

[YukiLog 仓储层定义文档](./yukilog-backend/docs/repo.md)

[YukiLog 业务层封装文档](./yukilog-backend/docs/service.md)

[YukiLog 运行时配置文档](./yukilog-backend/docs/config.md)

[YukiLog 处理层规范文档](./yukilog-backend/docs/handler.md)

[YukiLog 公共接口文档](./yukilog-backend/docs/handler_public.md)

[YukiLog 管理接口文档](./yukilog-backend/docs/handler_admin.md)

[YukiLog 应用层文档](./yukilog-backend/docs/axum.md)

[YukiLog 网络路由文档](./yukilog-backend/docs/route.md)

#### 前端

站点配置在 `yukilog-hanakoi/yukilog.config.ts`。前端还没有单独的文档目录。

#### 部署

[YukiLog 部署指南](./docs/deploy.md)

---

## 部署

YukiLog 提供一键部署脚本，自动完成环境检测、依赖安装、构建、服务注册和 SSL 配置。

```bash
# 克隆仓库后在根目录执行
chmod +x deploy.sh
sudo ./deploy.sh
```

### 功能特性

- 全自动化 — 一条命令完成从零到上线
- 智能换源 — 自动切换国内镜像（中科大 / 阿里云）
- 端口避让 — 自动检测可用端口，避免冲突
- 幂等设计 — 可安全重复执行，不覆盖已有配置
- 更新友好 — 支持代码更新后重新构建
- 零配置 SSL — Let's Encrypt 自动申请 HTTPS 证书

### 部署模式

| 模式 | 触发条件 | 行为 |
|------|---------|------|
| **首次部署** | 无构建产物 | 完整安装 + 编译构建 + 服务注册 |
| **更新模式** | 检测到已有构建 | 询问是否重新构建 → 重启服务 |
| **配置变更** | 手动编辑 `.env` | 无需脚本，直接 `systemctl restart` |

**快速运维命令**：

```bash
# 查看服务状态
sudo systemctl status yukilog-backend yukilog-hanakoi

# 实时查看日志
journalctl -u yukilog-backend -f

# 重启服务（配置变更后）
sudo systemctl restart yukilog-backend yukilog-hanakoi
```

---

## License

本项目采用组合授权协议：

* Source Code is licensed under GNU AGPL-3.0
    * 意味着如果你对源代码进行了修改并用于云服务，你需要公开你的源代码。

* Blog Content and Creative Materials are licensed under CC BY-NC-SA 4.0
    * 署名-非商业性使用-相同方式共享。
