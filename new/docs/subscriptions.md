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
`UPDATE ... FOR UPDATE SKIP LOCKED` 每批领取 10 个任务，并把状态改为
`sending` 后提交。发送成功标记为 `sent`；失败使用从 60 秒开始的指数退避，最多
尝试 10 次。锁定超过 15 分钟的 `sending` 任务会被其他 worker 回收。

所需环境变量：

- `DATABASE_URL`
- `YUKILOG_PUBLIC_ORIGIN`
- `YUKILOG_SUBSCRIPTION_SECRET`
- `YUKILOG_SMTP_HOST`
- `YUKILOG_SMTP_PORT`（默认 `587`）
- `YUKILOG_SMTP_USERNAME`
- `YUKILOG_SMTP_PASSWORD`
- `YUKILOG_SMTP_FROM`（例如 `YukiLog <blog@example.com>`）

SMTP 固定使用 STARTTLS。密码只从进程环境读取，不进入数据库、日志或配置 API。
