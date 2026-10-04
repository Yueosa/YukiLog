# 公开 Web

公开站点由 Axum 查询 PostgreSQL，Askama 输出完整 HTML。浏览器不执行 JavaScript
也能阅读首页、文章、动态、评论、友链和搜索结果；Lit 只负责后续渐进增强。

## 路由

- `/`：读取 `page_layouts.home` 并递归渲染注册组件；
- `/articles`：已发布文章列表；支持 `tag`、`category`、`year` 与 `page` 查询参数；
- `/articles/{slug}`：文章正文和公开评论；
- `/dynamics`：已发布动态；
- `/friends`：公开友链；
- `/search?q=`：在已发布文章标题、摘要和正文中搜索。
- `/feed.xml`：文章与动态聚合 RSS；
- `/feeds/articles.xml`：文章 RSS；
- `/feeds/dynamics.xml`：动态 RSS。

公开查询只选择 `status = published` 且发布时间不晚于当前时间的内容。站点设置或
首页布局不存在时返回 `503 site_not_configured`，不会使用隐藏默认值或测试数据。

文章列表每页 12 篇，最多接受第 10000 页。分类、标签和日期直接从文章卡片链接到
筛选结果，不额外建立分类、标签或归档导航页；不存在的合法 slug 返回空列表，格式
非法的筛选值返回 `422`。

## 渲染边界

布局 JSON 只能选择注册组件、枚举属性和预先定义的 CSS class。颜色是已经校验过的
十六进制 Token；Hero 背景只能引用已验证的图片媒体 ID，由服务端解析为同源
`/media/` 地址。数据库内容不会成为任意脚本或自由 CSS。

Markdown 先由 `pulldown-cmark` 转换，再由 `ammonia` 清理。Askama 默认转义标题、
摘要、评论、站点资料和搜索词；只有清理后的 Markdown 及由服务端组件模板生成的
HTML 会进入安全输出位置。

RSS 使用配置中的公开 Origin 生成绝对链接和稳定 GUID，最多返回最近 50 项，响应为
`application/rss+xml` 并缓存 5 分钟。文章摘要缺失时只截取正文前 500 个字符；
动态条目链接到公开动态页面中的稳定锚点。

首页以旧版花恋的沉浸首屏、三栏内容区和双态导航作为首发视觉基准。无脚本时页面仍
完整可读；少量脚本只增强顶部感应导航和滚动状态。后续视觉调整不改变内容查询、
布局 schema 或安全边界。
