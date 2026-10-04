# Operations

生产环境目标：

- nginx 终止 TLS 并分发静态媒体；
- systemd 管理唯一的 YukiLog 应用进程；
- `/var/www/yukilog/releases/<release>` 保存不可变发布产物；
- `/var/www/yukilog/current` 原子指向当前版本；
- `/var/lib/yukilog/media` 保存媒体；
- `/var/backups/yukilog` 保存数据库与媒体备份；
- `/etc/yukilog/yukilog.env` 保存 root 可读的运行配置。

部署工具将在服务、迁移和媒体模型稳定后实现。
