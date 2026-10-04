# 管理员鉴权

YukiLog 使用服务端不透明会话，不使用 JWT。

## 初始化

迁移完成后，通过交互式命令创建管理员：

```bash
cargo run -p yukilog-server --bin yukilog-admin -- \
  create-admin <username> <display-name>
```

密码不会出现在参数、环境变量或 shell history 中。数据库只保存 Argon2id 哈希。

## HTTP 接口

- `POST /api/admin/auth/login`
- `GET /api/admin/auth/session`
- `POST /api/admin/auth/logout`
- `PUT /api/admin/auth/password`

登录成功后设置两个 Cookie：

- Session Cookie：`HttpOnly`，保存 256-bit 随机令牌；
- CSRF Cookie：允许前端读取，并在写请求中复制到 `X-CSRF-Token`。

生产 HTTPS 使用 `__Host-` Cookie、`Secure`、`Path=/` 和
`SameSite=Strict`。写请求还必须携带与 `YUKILOG_PUBLIC_ORIGIN` 完全相同的
`Origin`。

数据库只保存 Session 与 CSRF 令牌的 SHA-256。会话七天到期；修改密码会在同一
事务中更新密码哈希并删除该管理员的全部会话。

登录接口对未知账号、错误密码和停用账号返回相同错误，并按连接 IP 在进程内限制
十五分钟最多十次尝试。部署时 nginx 还应设置外层登录限流。
