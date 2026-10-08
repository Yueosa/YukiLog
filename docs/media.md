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

## 图片变体

JPEG、PNG、WebP、GIF 图片落盘原图后，在阻塞线程池生成两档 webp 变体，
与原图同目录、同哈希前缀：

| 变体 | 文件 | 最长边 | 用途 |
| --- | --- | --- | --- |
| `card` | `<hash>.card.webp` | 1200 | 封面、列表卡片 |
| `thumb` | `<hash>.thumb.webp` | 360 | 缩略图、九宫格 |

- 等比缩放、只缩不放；GIF 取首帧；AVIF 与视频不生成变体；
- 变体使用 webp 无损编码（image-webp 目前只提供 VP8L 无损，没有纯 Rust
  有损实现）；尺寸先砍到 1200/360 后体积仍远小于原图；
- 生成失败不致命：记 warning，变体列留 `NULL`，原图照常入库；
- 变体的 storage key 记录在 `media_assets.card_key` / `thumb_key`，
  响应字段为 `card_url` / `thumb_url`（`/media/{key}`，无变体时为 `null`）；
- 消费口径：文章封面（公开 API、SSR、邮件）与 SSR 动态九宫格、邮件动态附图
  一律用 card 变体（无变体回退原图）；公开动态 API 同时给 `mediaUrls`（原图，
  灯箱用）与 `mediaCardUrls`（card）；hero 首屏背景保持原图；
- 删除媒体时变体文件一并删除；
- 存量图片用 `yukilog-admin media-backfill-variants` 回填（需要
  `DATABASE_URL` 与 `YUKILOG_MEDIA_DIR`），扫描变体列为 `NULL` 的图片资产，
  生成变体并回写，打印进度与汇总。

公开文件由 `/media/` 提供，使用一年 immutable 缓存。`ServeDir` 负责流式响应、
Range、HEAD、路径规范化和正确的 Content-Length，因此视频可以拖动和断点读取。

媒体删除前先检查引用（文章封面、动态配图、站点头像、刊头背景、友链头像），
仍被引用时返回 `409` 与引用清单；未被引用才删除记录并清理磁盘上的原图与
变体文件。
