# Database migrations

下一阶段将在这里建立 SeaORM Migrator。任何 migration 必须满足：

- 从空 PostgreSQL 数据库可完整执行；
- 迁移历史记录在数据库中，而不是本地文本文件；
- 不使用 `DROP ... CASCADE` 作为初始化或升级手段；
- 部署前完成备份，并使用 advisory lock 防止并发迁移；
- 内容模型不包含历史数据库兼容字段。
