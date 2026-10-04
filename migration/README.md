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

- 从空 PostgreSQL 数据库可完整执行；
- 迁移历史记录在数据库中，而不是本地文本文件；
- 不使用 `DROP ... CASCADE` 作为初始化或升级手段；
- 部署前完成备份，并使用 advisory lock 防止并发迁移；
- 内容模型不包含历史数据库兼容字段。
- 第一次生产部署前允许重写 baseline；上线后 baseline 冻结，只追加前向迁移。

字段及锁策略见 `docs/database.md`。
