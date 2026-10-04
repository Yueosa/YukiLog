# 邮件投递测试

## 默认测试

`cargo test --workspace --locked` 会启动只监听本机随机端口的假 SMTP 服务，覆盖：

- SMTP `250` 接受；
- SMTP `451` 明确临时拒绝，只允许这种结果自动重试；
- SMTP `550` 永久拒绝，不自动重试；
- 邮件正文发送完毕后连接中断，结果必须进入 `uncertain`；
- 全局邮件开关只有精确的 `true` 才启用；
- 确认邮件冷却、通知频率和退避上限。

假 SMTP 不连接互联网，不会向真实地址发送邮件。

## PostgreSQL 故障注入

数据库测试被标记为 `ignored`，因为它会清空指定数据库。测试 URL 的数据库名必须
包含 `test`，并且必须是专用空数据库：

```bash
CARGO_HOME="$PWD/.cargo-home" \
CARGO_TARGET_DIR="$PWD/target" \
TMPDIR="$PWD/.build-tmp" \
CARGO_BUILD_JOBS=2 \
CARGO_INCREMENTAL=0 \
YUKILOG_TEST_DATABASE_URL='postgresql://user:password@127.0.0.1:5432/yukilog_test' \
cargo test -p yukilog-server \
  mail::tests::postgres_delivery_state_machine_fault_injection \
  --locked -- --ignored --exact --nocapture
```

该测试会从空数据库执行 baseline，并验证成功投递、临时拒绝、SMTP 结果不确定和
过期 `sending` 隔离。不得把生产数据库 URL 传给它。

## 生产启用顺序

1. 保持 `YUKILOG_MAIL_ENABLED=false`；
2. 在隔离 PostgreSQL 上通过上述故障注入；
3. 使用只包含管理员测试邮箱的数据开启 mailer；
4. 验证确认、退订、撤回、定时发布和 `uncertain` 人工处理；
5. 检查日志、投递上限与 SMTP 服务商记录；
6. 最后才开放公开邮件订阅。
