# 布局与组件系统

主题与布局是两套独立数据：

- `site_settings.theme`：颜色、字体、间距、圆角、阴影和动画 Token；
- `site_settings.shell_layout`：全局导航和页面外壳；
- `page_layouts.layout`：各页面的组件树与响应式排版。

数据库只保存声明式 JSON。组件实现、属性 schema 和安全规则都在代码注册表中。

主题 schema v1 使用固定语义 Token：背景、表面、正文、弱化文字、主色、辅色和
边框色；颜色只接受 6/8 位十六进制。字体选择映射到代码内置字体栈，字号比例限制在
`0.8–1.4`，圆角限制在 `0–32px`。外壳 schema v1 负责导航类型、品牌位置、搜索、
透明效果和页面宽度。数据库值永远不会直接拼接成任意 CSS。

## 布局文档

```json
{
  "schemaVersion": 1,
  "id": "home-main",
  "label": "首页",
  "description": "首页内容布局",
  "root": {
    "id": "home-root",
    "type": "grid",
    "props": {
      "columns": "280px minmax(0, 1fr)",
      "gap": "lg"
    },
    "responsive": {
      "mobile": { "columns": "1fr" }
    },
    "children": [
      { "id": "profile", "type": "profile-card", "props": { "flip": true } },
      {
        "id": "feed",
        "type": "article-feed",
        "props": {
          "variant": "alternating",
          "fields": ["cover", "title", "summary", "date", "category", "tags"]
        }
      }
    ]
  }
}
```

页面布局不重复保存主题和导航。完整设计方案导入时由后台拆成主题 Token、全局外壳
和各页面布局后，再分别写入对应记录；导出时再组合为一个设计包。

节点只有三类：

1. 布局容器：`stack`、`grid`、`split`、`bento`；
2. 内容组件：首屏、个人卡、文章 Feed、动态、友链、搜索等；
3. 装饰组件：分隔、标题、引语和留白。

导航属于外壳组件，首批注册 `topbar`、`sidebar`、`floating-dock`。文章 Feed 首批
注册 `alternating`、`editorial`、`cover-overlay` 和 `compact` 四种卡片形态。

## 后台搭建器

布局工作室采用三栏结构：

- 左侧组件库：拖入已注册组件；
- 中间实时预览：选择、排序、嵌套和调整区域；
- 右侧属性面板：组件变体、显示字段、列数、间距和响应式覆盖。

桌面、平板、手机配置共享同一组件树，只覆盖必要的布局属性。布局可导入导出为
带 `schemaVersion` 的 JSON，导入时必须通过注册表 schema 校验。

管理员通过 `GET /api/admin/layouts` 读取全部页面布局，通过
`GET/PUT /api/admin/layouts/{page_key}` 读取或原子替换单页布局。保存前前端与
Rust 后端执行同一套规则：最多 128 个节点、最多 12 层嵌套、节点 ID 唯一，并且
只接受注册表声明的属性及枚举值。数据库继续负责页面键格式和 JSONB 顶层类型。

站点资料、主题和外壳通过 `GET/PUT /api/admin/settings` 管理。写入时校验主题
schema、社交链接协议和头像媒体类型；标题、简介、外键和字段长度仍由 PostgreSQL
约束负责。

第一阶段不允许任意脚本。高级自定义 CSS 可以在布局系统稳定后单独设计，不能绕过
后台和公开页面的安全边界。
