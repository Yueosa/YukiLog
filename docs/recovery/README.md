# YukiLog 恢复基线

V1 在开始 V2 重构前固定为以下 Git 引用：

- 分支：`archive/v1-sveltekit`
- 标签：`v1-sveltekit-archive`
- 提交：`237845352e0002fca3a615b4c183e0b255480a72`

旧内容备份保持只读。不要对备份目录运行格式化、自动修复或原地迁移；后续导入器必须读取副本并支持 dry-run。

## 重新校验备份

```bash
python3 tools/audit_backup.py \
  --source /home/Sakurine/Documents/QQ/content \
  --output-dir docs/recovery/backup-audit
```

校验器只把文件路径、大小、SHA-256 和有限的 front matter 摘要写入仓库，不复制文章或随记正文。当前基线见：

- [`backup-audit/manifest.json`](./backup-audit/manifest.json)
- [`backup-audit/report.md`](./backup-audit/report.md)

## 数据安全边界

- `yukilog-database/db/yukilog.sql` 和 `yukilog-database/version/v1.sql` 含有删表语句，不得用于恢复或升级现有数据库。
- 在 V2 导入器完成前，不把旧 Markdown 写入任何数据库。
- 正式迁移前必须同时保留 PostgreSQL dump、Markdown 原件、媒体目录和校验清单。
