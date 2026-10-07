# YukiLog

个人博客系统（blog.yeastar.xin）：Rust 后端 + Lit 公开站 SPA + Lit 管理端 SPA + SSR 书简版，
PostgreSQL 存储，自研标记语言 LianMarkup 渲染正文。

## 双仓库规则（最重要）

- **上游 `../LianMarkup`**：语法与解析器的**唯一修改点**（src/ tests/ examples/ docs/）
- **本仓库 `lianmarkup/`**：内嵌 crate，**只同步不修改**
- 同步方式：上游提交后，把上游 `src/*.rs`、`tests/*.rs`、`examples/first-post.ly`、`docs/*.md`
  复制进 `lianmarkup/` 对应目录，保持 `diff -rq` 干净，然后在本仓库单独提交"同步上游"的 commit

## 结构

- `server/`：Rust 后端。`http/` 路由；`content/` 业务（公开 API/管理 API）；`site/` SSR 书简版；
  `markup/` .ly→HTML 渲染管线（lianmarkup + syntect + ammonia）；`ops/` media/mail/feed/seo；
  `entities/mod.rs` 全部 SeaORM 实体
- `web/src/ui/`：公开站 Lit SPA（yuki-app 结构 / app-styles 样式 / article-fx 文章页增强 /
  enhance KaTeX+mermaid / store）
- `web/src/admin/`：管理端 Lit SPA（views×14 + components + store）
- `migration/`：数据库迁移。**正式版发布前只有一个 baseline**：schema 改动直接改
  `migration/db/20261004_000001_create_baseline.up.sql`，已运行的数据库用等价 ALTER 手动对齐
- `ops/`：build-release.sh / yukilog-deploy / rehearsal/（nspawn 隔离演练）
- `docs/`：项目文档，**改代码必须同步改文档**（硬要求）

## 命令

- 测试：`cargo test --workspace`（server+lianmarkup+migration）、`cd web && pnpm vitest run`、`pnpm tsc --noEmit`
- 前端构建：`cd web && pnpm build`
- 部署：`./ops/build-release.sh <版本戳>-<gitsha>` → 产物 scp 到服务器
  `/var/www/yukilog/incoming/` → `sudo yukilog-deploy /var/www/yukilog/incoming/<包>.tar.gz`
  （原子切换 + 自动备份 + 失败回滚；部署会自动跑迁移，但目前只有 baseline）
- 冒烟：`cd web && pnpm vite --config vite.smoke.config.ts --port 5197`（/api、/media 代理生产）

## 约定

- 双前端：Lit 沉浸版给人类访客，SSR 书简版给爬虫/无 JS（`?ssr=1` 调试）。装饰性视觉
  （刊头背景、动画特效）只属 Lit，SSR 保持纸面静态
- 文章正文是 LianMarkup（`.ly`），不是 Markdown；写作/重构前加载 `lianmarkup` skill
  （用户级 `~/.kimi-code/skills/lianmarkup/SKILL.md`）或读 `lianmarkup/docs/语法速查.md`
- git：commit 由 agent 做，**push 一律由用户本人执行**
- 数据库是生产库，改数据前想清楚；临时文件放 `.build-tmp/`（不进 git）
- 文档同步：改行为就改 `docs/` 对应页（database/content-api/public-web/admin-web 等）
