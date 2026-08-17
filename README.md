<div align="center">

## YukiLog ❄️

</div>

**YukiLog** 是一个追求极致性能与完全自控力的全栈博客系统。
它抛弃了开箱即用的成品框架，采用 **Rust (Backend) + Astro (Frontend)** 的现代架构，旨在通过高性能的底层技术与精致的前端视觉效果，打造一个属于开发者个人的数字花园。

> 正在重构中: 这几天我在写自己的网盘+图床应用(为了替换openlist), 然后因为这个博客的封面直接使用了 openlist 分享链接, 所以开始检查相关逻辑
> 
> 检查过程中发现有很多Bug, 尤其是手机端使用体验不佳, 部分硬编码数据和页面需要修改, 还需要添加一些新的功能
> 
> 希望花三个月的时间能弄完吧, 同时打算把那一堆半人半AI的水文全部删掉, 重构成质量更高的东西(比如设计思想?)

---

## 🏗️ 整体架构 (Architecture)

**YukiLog** 采用前后端分离架构，通过 **RESTful API** 进行通信，确保系统的高可扩展性。

* **后端 (The Heart):** 基于 `Rust` 语言，利用 `Axum` 处理高并发请求，`SeaORM` 进行类型安全的数据库操作。
* **前端 (The Face):** 采用 `Astro` 岛屿架构，核心页面 0-JS 加载，动态交互（如评论、搜索）由 **Vue 3** 驱动，样式基于 **Tailwind CSS**。
* **数据库 (The Memory):** **PostgreSQL 16**，包含自研的无限层级评论系统模型。

---

## 🛠️ 技术栈 (Tech Stack)
**Backend (Rust)**
* **Framework:** `Axum`
* **Runtime:** `Tokio`
* **ORM:** `SeaORM`
* **Security:** `Argon2` + `JWT`

**Frontend (TypeScript)**
* **Static Site Engine:** `Astro`
* **UI Framework:** `Vue 3`
* **Styling:** `Tailwind CSS` + `SCSS`

**Infrastructure**
* **Database:** `PostgreSQL`

---

## 📖 文档 (Docs)

#### | YukiLog-BackEnd 后端

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

#### | YukiLog-Hanakoi 前端

[YukiLog 前端文档索引](./yukilog-hanakoi/docs/README.md)

[YukiLog 前端架构文档](./yukilog-hanakoi/docs/architecture.md)

[YukiLog 前端API封装文档](./yukilog-hanakoi/docs/api.md)

[YukiLog 前台页面文档](./yukilog-hanakoi/docs/pages.md)

[YukiLog 管理后台页面文档](./yukilog-hanakoi/docs/pages-admin.md)

[YukiLog 组件文档](./yukilog-hanakoi/docs/components.md)

[YukiLog 样式与配置文档](./yukilog-hanakoi/docs/config.md)

[YukiLog 工具函数与类型文档](./yukilog-hanakoi/docs/lib.md)

[YukiLog 后续功能规划](./yukilog-hanakoi/docs/roadmap.md)

#### | 部署与运维

[YukiLog 部署指南](./docs/deploy.md) — 一键部署脚本详解、运维命令、故障排查

---

## � 部署 (Deploy)

YukiLog 提供一键部署脚本，自动完成环境检测、依赖安装、构建、服务注册和 SSL 配置。

```bash
# 克隆仓库后在根目录执行
chmod +x deploy.sh
sudo ./deploy.sh
```

### 功能特性

✅ **全自动化** — 一条命令完成从零到上线  
✅ **智能换源** — 自动切换国内镜像（中科大 / 阿里云）  
✅ **端口避让** — 自动检测可用端口，避免冲突  
✅ **幂等设计** — 可安全重复执行，不覆盖已有配置  
✅ **更新友好** — 支持代码更新后重新构建  
✅ **零配置 SSL** — Let's Encrypt 自动申请 HTTPS 证书

### 部署模式

| 模式 | 触发条件 | 行为 |
|------|---------|------|
| **首次部署** | 无构建产物 | 完整安装 + 编译构建 + 服务注册 |
| **更新模式** | 检测到已有构建 | 询问是否重新构建 → 重启服务 |
| **配置变更** | 手动编辑 `.env` | 无需脚本，直接 `systemctl restart` |

### 详细文档

📖 **[完整部署指南](./docs/deploy.md)** — 包含：
- 脚本工作原理（9 步详解）
- 运行模式说明（首次 / 更新 / 配置变更）
- 日常维护命令（服务管理、日志查看、数据库备份）
- 故障排查指南（6 大常见问题）
- 手动部署步骤

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

## �📄 License
本项目采用组合授权协议：

* Source Code is licensed under GNU AGPL-3.0
    * 意味着如果你对源代码进行了修改并用于云服务，你需要公开你的源代码。

* Blog Content and Creative Materials are licensed under CC BY-NC-SA 4.0
    * 署名-非商业性使用-相同方式共享。
