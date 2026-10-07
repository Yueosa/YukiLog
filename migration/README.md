# 数据库迁移

初始 migration 从空 PostgreSQL 数据库建立完整 YukiLog schema。

```bash
export DATABASE_URL=postgresql://yukilog:password@127.0.0.1:5432/yukilog
cargo run -p yukilog-migration -- up
cargo run -p yukilog-migration -- status
```

开发期可以执行往返检查：

```bash
cargo run -p yukilog-migration -- down
cargo run -p yukilog-migration -- up
```

约束：

- SQL 一律写在 `migration/db/<版本号>_<名称>.up.sql` / `.down.sql` 文件对中，不嵌在
  Rust 字符串里；Rust 侧只是 `include_str!` 薄加载层；
- 迁移名通过手动实现 `MigrationName::name()` 锁定为稳定字符串（见
  `src/baseline.rs`），不依赖文件名约定；
- **正式版发布前只有一个基线迁移**：schema 改动直接改 baseline 的 CREATE TABLE，
  已运行的数据库用等价的 ALTER 手动对齐；发布后再冻结 baseline、改为追加前向迁移
  （新增迁移时：新建一对 .sql 文件、新建一个薄 .rs 模块并在 `src/lib.rs` 的
  `migrations()` 里按顺序追加一行注册）；
- 从空 PostgreSQL 数据库可完整执行；
- 迁移历史记录在数据库中，而不是本地文本文件；
- 不使用 `DROP ... CASCADE` 作为初始化或升级手段；
- 部署前完成备份，并使用 advisory lock 防止并发迁移；
- 内容模型不包含历史数据库兼容字段。

字段及锁策略见 `docs/database.md`。
