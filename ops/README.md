# Operations

## 生产目录

- nginx 终止 TLS 并分发静态媒体；
- systemd 分别管理 Web 服务和 SMTP worker；
- `/var/www/yukilog/releases/<release>` 保存不可变发布产物；
- `/var/www/yukilog/current` 原子指向当前版本；
- `/var/lib/yukilog/media` 保存媒体；
- `/var/backups/yukilog` 保存数据库与媒体备份；
- `/etc/yukilog/yukilog.env` 保存 root 可读的运行配置。

release 包含四个二进制、Vite 管理后台和 SHA-256 清单，不包含环境变量、媒体、
数据库或历史备份。

## 构建

版本号使用 UTC 时间和 Git commit：

```bash
VERSION="$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short=12 HEAD)"
./ops/build-release.sh "$VERSION"
```

Rust target、Cargo 缓存和临时文件默认全部位于项目目录，不使用 `/tmp`。构建脚本
限制 Cargo 为 2 个 job，并关闭增量编译。

## 首次主机初始化

将当前 `ops/` 目录复制到 Ubuntu 服务器，并把 release tarball 及同名
`.sha256` 一起上传后运行：

```bash
sudo ./ops/bootstrap-host.sh
sudo yukilog-deploy /var/www/yukilog/incoming/yukilog-<version>.tar.gz
sudo yukilog-enable-https you@example.com
```

初始化脚本安装 nginx、Certbot 和 PostgreSQL，创建无登录 shell 的 `yukilog`
用户、数据库、随机数据库密码和订阅签名密钥。若 `/etc/yukilog/yukilog.env`
已经存在，脚本会拒绝覆盖。

mailer 默认由 `YUKILOG_MAIL_ENABLED=false` 强制关闭。只有完成假 SMTP 故障注入
和管理员邮箱灰度验证后，才可填入 SMTP 配置并把该值精确改为 `true`，随后再次部署
或手动执行：

```bash
sudo systemctl enable --now yukilog-mailer.service
```

## 发布与回滚

`yukilog-deploy` 串行执行：

1. 拒绝危险 tar 路径并验证内部 SHA-256；
2. 创建数据库、媒体和环境文件备份；
3. 对新 release 执行迁移；
4. 原子替换 `current` 软链接；
5. 重启服务并轮询 `/health/ready`；
6. 健康检查失败时恢复上一条软链接。

release 不会被自动删除。应用回滚不会自动回滚数据库，因此后续迁移必须在至少一个
release 窗口内保持向后兼容。首次 baseline 迁移发生在站点没有旧应用时。

## 备份与恢复

```bash
sudo yukilog-backup
sudo yukilog-restore 20261004T150000Z --confirm-restore
```

备份目录包含 PostgreSQL custom dump、媒体压缩包、环境文件副本、release 路径和
校验清单；工具不会自动清理旧备份。

恢复会先把 dump 导入临时数据库，成功后才停止服务并原子交换数据库名。旧数据库和
旧媒体都会保留，不会直接删除。恢复属于破坏性操作，因此必须提供精确确认参数。
