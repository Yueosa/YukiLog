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

## 邮件模板

所有外发邮件（订阅确认、新文章、新动态、管理员通知）都是
`multipart/alternative`：`text/plain` 兜底 + `text/html` 品牌模板。HTML
模板（`server/src/ops/mail.rs` 的 `brand_html`）是 table + 内联样式布局
（兼容 QQ 邮箱、Outlook，不用 flex/grid）：浅色背景、主题色 `#3278d4`
标题栏、白色圆角内容卡、底部小字区（订阅邮件放退订链接）。文章邮件含封面
`<img>`（`{origin}/media/{storage_key}` 绝对 URL）与「阅读全文」按钮；
动态邮件正文由 `markup::render` 渲染，附图最多 4 张，超出时标注「共 N 张图」。
内容构建器是纯函数（`*_content` 系列），单测直接断言 HTML/纯文本结构，
不依赖数据库与 SMTP。

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
