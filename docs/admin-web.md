# Lit 管理后台

管理后台是原生 Lit Web Components 单页应用，不引入 React/Vue 或客户端状态框架。
访问 `/admin` 时加载 `yuki-admin`；开发入口 `/` 保留布局实验室。

## 会话与请求

启动时调用 `/api/admin/auth/session` 恢复 HttpOnly Session。写请求从可读的
`yukilog_csrf` 或 `__Host-yukilog_csrf` Cookie 取得令牌并放入
`X-CSRF-Token`；浏览器同时发送 `Origin` 和 Session Cookie。API 客户端统一解析
后端错误，不把失败响应当作成功数据。

## 首批功能

- 文章、动态的创建、编辑、发布、撤回和删除；
- 分类、标签和友链 CRUD；
- 评论审核与删除；
- 媒体上传（支持多选/多文件拖放，逐文件队列展示真实进度，失败可重试）、
  预览、复制完整 URL 及文章封面/头像选择；媒体库网格、文章列表封面与
  媒体选择器用 360px `thumb_url` 变体做缩略图（旧数据无变体时回退原图），
  媒体页支持从外链 URL
  拉取图片入库（SSRF 防护见 docs/content-api.md），「外链」标签页实时列出
  文章/动态正文里的站外图片并可逐项拉取入库；文章编辑封面除媒体库选择外
  也支持粘贴 URL 拉取；
- 站点资料（含 QQ 头像外链与全站刊头背景图）、主题 Token 和导航外壳——
  编辑界面已并入外观页（外观页顶栏「站点设置」tab 内嵌原设置视图，
  `#/settings` 重定向到 `#/appearance`）；
- 外观页（`#/appearance`）：100vh 工作区。顶栏部件 tabs（另有「站点设置」
  tab）+ 保存区，中间实时预览（375/768/1280/1920/全宽 + 自定义宽度，
  postMessage 注入未保存草稿，不落库），底部密集选项面板；旋钮白名单从
  `GET /api/admin/parts/registry` 拉取，与写入校验同源（见 docs/layout-system.md
  「部件 token」一节）；
- 订阅者和邮件投递状态，失败任务重试或取消。

2026-10 大重构已删除布局工作室：首页布局硬编码固定，不再提供布局编辑；
后续以「部件 token」形式按部件开放样式配置（见 docs/public-web.md 部件清单）。

管理页面当前样式只用于建立可靠交互和响应式骨架。最终视觉语言、图标、拖拽布局、
Markdown 编辑体验和移动端细节会在后续 UI 设计中替换，不改变 API 客户端与组件
边界。

Vite 开发服务器将 `/api`、`/media` 和 `/subscriptions` 代理到
`127.0.0.1:3000`。开发时 `YUKILOG_PUBLIC_ORIGIN` 应与浏览器实际打开的 Origin
一致，否则后端会按设计拒绝写请求。
