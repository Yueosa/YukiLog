# 邮件订阅

公开页面和 `POST /api/subscriptions` 都可以提交邮箱以及文章/动态偏好。响应始终只
表示“请求已接受”，不会暴露邮箱是否已经订阅。相同 IP 与邮箱组合一分钟只能提交
一次。写入事务先按规范化邮箱获取 PostgreSQL transaction advisory lock，避免多个
Web 实例同时首次创建同一地址时竞争。

## 令牌

每位订阅者保存一个 16 字节随机 nonce。确认和退订令牌包含订阅者 UUID、nonce 和
用途，再使用 `YUKILOG_SUBSCRIPTION_SECRET` 做 HMAC-SHA-256 签名。密钥至少
32 字节，令牌使用 URL-safe Base64：

- 确认令牌只能用于确认；
- 退订令牌只能用于退订；
- 重新订阅会轮换 nonce，旧链接立即失效；
- 数据库和日志都不保存令牌明文。

确认链接为 `GET /subscriptions/confirm/{token}`。退订链接先显示确认页面，再通过
`POST /subscriptions/unsubscribe/{token}` 改变状态；JSON 客户端可以调用
`POST /api/subscriptions/unsubscribe`。

## SMTP worker

`yukilog-mailer` 是独立进程，不阻塞 Web 请求。它通过单条 PostgreSQL
`UPDATE ... FOR UPDATE SKIP LOCKED` 每次只领取一个任务，并把状态改为
`sending` 后提交。SMTP 明确返回临时拒绝时使用从 60 秒开始的指数退避，最多尝试
10 次；永久拒绝不自动重试。

网络中断、超时或 worker 在 SMTP 成功后、数据库提交前退出时，系统无法判断收件
服务器是否已经接受邮件。锁定超过 15 分钟的 `sending` 任务因此改为
`uncertain`，绝不自动重发；管理员核对后才能手工重试。重试 `uncertain` 任务时
后台必须显示重复投递警告。发送期间会锁定订阅者和投递行，退订、撤回或管理员取消
会与发送串行化。

所需环境变量：

- `DATABASE_URL`
- `YUKILOG_PUBLIC_ORIGIN`
- `YUKILOG_SUBSCRIPTION_SECRET`
- `YUKILOG_MAIL_ENABLED`（只有精确设置为 `true` 才允许启动 worker）
- `YUKILOG_SMTP_HOST`
- `YUKILOG_SMTP_PORT`（默认 `587`）
- `YUKILOG_SMTP_USERNAME`
- `YUKILOG_SMTP_PASSWORD`
- `YUKILOG_SMTP_FROM`（例如 `YukiLog <blog@example.com>`）

SMTP 固定使用 STARTTLS。密码只从进程环境读取，不进入数据库、日志或配置 API。

## 管理员提醒

评论、友链申请和真正新增的点赞会先写入 `admin_notifications`，因此邮件关闭时站内
消息仍然完整。管理员可以分别开关三类邮件，并选择立即、一小时后或一天后发送。
同一篇文章的未读点赞合并计数，邮件只发送尚未投递的新增数量。

管理员提醒与订阅邮件共用相同的保守状态机：明确的 SMTP 4xx 才自动重试；永久拒绝
停止自动重试；网络错误或崩溃窗口进入 `uncertain` 并等待人工确认。全局
`YUKILOG_MAIL_ENABLED` 仍优先于账号设置。全局关闭时产生的站内消息直接标记为
`suppressed`，以后开启邮件也不会补发历史积压。

全局邮件关闭时，公开邮件订阅接口返回 `503`，公开页隐藏订阅表单，内容发布也不会
建立订阅投递任务。RSS 始终可用。这样在灰度测试期间不会累积一批未来突然发出的
确认信或内容通知。
