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
- 媒体上传、预览、复制完整 URL 及文章封面/头像选择；
- 站点资料（含 QQ 头像外链与全站刊头背景图）、主题 Token 和导航外壳；
- 订阅者和邮件投递状态，失败任务重试或取消。

2026-10 大重构已删除布局工作室：首页布局硬编码固定，不再提供布局编辑；
后续以「部件 token」形式按部件开放样式配置（见 docs/public-web.md 部件清单）。

管理页面当前样式只用于建立可靠交互和响应式骨架。最终视觉语言、图标、拖拽布局、
Markdown 编辑体验和移动端细节会在后续 UI 设计中替换，不改变 API 客户端与组件
边界。

Vite 开发服务器将 `/api`、`/media` 和 `/subscriptions` 代理到
`127.0.0.1:3000`。开发时 `YUKILOG_PUBLIC_ORIGIN` 应与浏览器实际打开的 Origin
一致，否则后端会按设计拒绝写请求。
