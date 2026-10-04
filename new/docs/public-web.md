# 公开 Web

公开站点由 Axum 查询 PostgreSQL，Askama 输出完整 HTML。浏览器不执行 JavaScript
也能阅读首页、文章、动态、评论、友链和搜索结果；Lit 只负责后续渐进增强。

## 路由

- `/`：读取 `page_layouts.home` 并递归渲染注册组件；
- `/articles`：已发布文章列表；
- `/articles/{slug}`：文章正文和公开评论；
- `/dynamics`：已发布动态；
- `/friends`：公开友链；
- `/search?q=`：在已发布文章标题、摘要和正文中搜索。
- `/feed.xml`：文章与动态聚合 RSS；
- `/feeds/articles.xml`：文章 RSS；
- `/feeds/dynamics.xml`：动态 RSS。

公开查询只选择 `status = published` 且发布时间不晚于当前时间的内容。站点设置或
首页布局不存在时返回 `503 site_not_configured`，不会使用隐藏默认值或测试数据。

## 渲染边界

布局 JSON 只能选择注册组件、枚举属性和预先定义的 CSS class。颜色是已经校验过的
十六进制 Token；数据库内容不会直接成为 `style`、脚本或组件 HTML。

Markdown 先由 `pulldown-cmark` 转换，再由 `ammonia` 清理。Askama 默认转义标题、
摘要、评论、站点资料和搜索词；只有清理后的 Markdown 及由服务端组件模板生成的
HTML 会进入安全输出位置。

RSS 使用配置中的公开 Origin 生成绝对链接和稳定 GUID，最多返回最近 50 项，响应为
`application/rss+xml` 并缓存 5 分钟。文章摘要缺失时只截取正文前 500 个字符；
动态条目链接到公开动态页面中的稳定锚点。

当前 Askama 样式用于验证数据流、布局差异和无脚本访问，不是最终视觉稿。后续前端
设计只替换组件模板和样式，不改变内容查询、布局 schema 或安全边界。
