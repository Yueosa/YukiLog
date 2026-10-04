# 媒体文件

媒体本体不进入 PostgreSQL，也不保存为 Base64。`YUKILOG_MEDIA_DIR` 指向发布目录
之外的持久目录：

```text
YUKILOG_MEDIA_DIR/
├── assets/   # 公开、内容寻址的文件
└── staging/  # 不公开的上传暂存文件
```

管理员通过 `POST /api/admin/media` 上传 multipart `file` 字段。接口要求有效管理
会话、匹配的 `Origin` 和 `X-CSRF-Token`。

## 规则

- 图片上限 20 MiB，视频上限 200 MiB；
- 支持 JPEG、PNG、WebP、GIF、AVIF、MP4 和 WebM；
- 依据文件魔数识别类型，不信任文件名或 multipart MIME；
- 图片边长不超过 16384，像素总量不超过一亿；
- SVG 不接受；
- 文件流式写入暂存区，同时计算 SHA-256；
- 最终路径为 `<hash-prefix>/<sha256>.<trusted-extension>`；
- 相同内容复用已有文件和 `media_assets` 记录。

公开文件由 `/media/` 提供，使用一年 immutable 缓存。`ServeDir` 负责流式响应、
Range、HEAD、路径规范化和正确的 Content-Length，因此视频可以拖动和断点读取。

暂不提供媒体删除：Markdown 内的媒体引用不是数据库外键，贸然删除可能破坏文章。
清理机制要等内容引用规则确定后再实现。
