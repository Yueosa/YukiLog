# YukiLog

这是全新 YukiLog 的洁净开发区。它不兼容历史数据库、API、前端组件或资源地址。

## 目录

- `server/`：Rust、Axum，以及后续的 Askama 服务端渲染
- `migration/`：SeaORM PostgreSQL 迁移
- `web/`：Lit Web Components 与管理后台
- `ops/`：nginx、systemd、发布与备份工具
- `docs/`：产品、架构和接口决策

## 开发

```bash
# Rust 服务
cargo run -p yukilog-server

# 数据库迁移
cargo run -p yukilog-migration -- up

# Lit 开发服务器
pnpm install
pnpm dev
```

## 约束

1. 新代码只能依赖本目录中的模块和明确声明的第三方包。
2. 历史实现只能用于审查思路，不得整体复制。
3. 数据库从空 schema 开始，所有变化必须通过迁移表达。
4. 公开页面必须支持服务端渲染、键盘操作和减少动态效果。
5. 密钥、运行数据、上传文件和构建产物不得提交到 Git。
