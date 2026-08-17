// ================================
// YukiLog 全局配置（唯一配置源）
// ================================
// 说明：
// 1) 这个文件放在项目根目录，便于前台/后台/脚本统一读取。
// 2) src/lib/config.ts 仅作为兼容导出层，不再保存业务配置。
// 3) 样式 CSS 变量定义在 src/styles/tokens.css，这里的 designTokens 是
//    运行时同步副本（用于 JS 动态着色等场景），两者需保持一致。

import type { NavItem, SiteConfig } from "./src/types";

/**
 * 设计色板（运行时）
 * - 用于组件脚本、后台配置面板等 JS/TS 场景
 * - CSS 变量定义在 src/styles/tokens.css，此处值需与之保持同步
 */
export const designTokens = {
  colors: {
    lianBlue: "#7EB6D9",     // 代码与理性
    lianPink: "#E8A4B4",     // 情绪与温柔
    lianWhite: "#FAFAFA",    // 纸张
    lianBg: "#F6F7F9",       // 页面背景
    lianText: "#2C3E50",     // 主文本
    lianTextLight: "#7F8EA3",// 次要文本
    lianTextMuted: "#A8B4C6",// 弱文本（对应 tokens.css --color-text-muted）
    lianBorder: "#E1E8F0",   // 边框（对应 tokens.css --color-border）
    lianDivider: "#EFF2F7",  // 分隔线（对应 tokens.css --color-divider）
  },
} as const;

/**
 * 站点基本配置
 * - 前台 SEO、页脚、个人信息面板、欢迎文案等统一来源
 */
export const siteConfig = {
  name: "YukiLog",
  lang: "zh-CN",
  themeColor: "#E8A4B4",
  title: "恋的博客 - 一个温柔的技术日记本",
  description: "记录技术、思考、情绪与挣扎",
  welcomeText: "欢迎来看恋的博客",
  author: {
    name: "Lian",
    nickname: "恋",
    avatar: "https://q1.qlogo.cn/g?b=qq&nk=1303028790&s=640",
    bio: "我能走到这里，是因为你没有放弃",
    birthday: "2005-05-16",
    genderIdentity: "非二元",
    systemLog: {
      timestamp: "2024-06-09 08:48:29",
      message: "这不是你亲手开启的故事吗？",
    },
  },
  social: [
    {
      name: "GitHub",
      url: "https://github.com/Yueosa",
      icon: "github",
      color: "#6E7F8D",
    },
    {
      name: "QQ Group",
      url: "https://qm.qq.com/cgi-bin/qm/qr?k=O6KD1bt5WDvQw47kzjaDuYIASzar_y-F&jump_from=webapi&authKey=AnF+0ddOwtFY4laf9lDJ9Om7tj5oZE2dfuHJlQfOO2CXaeTOOVdJxlxIg9wSs4WQ",
      icon: "qq",
      color: "#E3A0AE",
    },
    {
      name: "Bilibili",
      url: "https://space.bilibili.com/433677987",
      icon: "bilibili",
      color: "#7EB6D9",
    },
    {
      name: "X (Twitter)",
      url: "https://x.com/Yosa04942475621",
      icon: "twitter",
      color: "#8FAFC4",
    },
    {
      name: "网易云音乐",
      url: "https://music.163.com/#/user/home?id=630887153",
      icon: "netease-music",
      color: "#E8A4B4",
    },
    {
      name: "Gmail",
      url: "mailto:yichengxin7@gmail.com",
      icon: "gmail",
      color: "#D6A1AE",
    },
  ],
  startDate: "2026-02-11",
  seo: {
    keywords: ["YukiLog", "恋的博客", "个人博客", "Lian"],
    ogImage: "",
  },
} satisfies SiteConfig;

/**
 * 顶部导航配置
 * - NavBar 组件统一读取
 * - icon 字段对应 src/assets/icon/nav 下的文件名（不含扩展名）
 */
export const navItems = [
  { label: "主页", href: "/", icon: "home" },
  { label: "主题", href: "/themes", icon: "theme" },
  { label: "归档", href: "/archive", icon: "archive" },
  { label: "标签", href: "/tags", icon: "tag" },
  { label: "友链", href: "/links", icon: "links" },
  { label: "随记", href: "/notes", icon: "notes" },
  { label: "关于", href: "/about", icon: "about" },
] satisfies NavItem[];

/**
 * 文案与资源配置（首批）
 * - 逐步将页面硬编码文案迁移到这里
 */
export const contentConfig = {
  hero: {
    headerGif: "mc.gif",
  },
  markdown: {
    headingPrefixes: {
      h1: "✨ ",
      h2: "✦ ",
      h3: "▸ ",
      h4: "• ",
      h5: "· ",
      h6: "— ",
    },
  },
  ui: {
    tabHiddenTitle: "...你 ... 要走了吗?",
  },
  components: {
    navbar: {
      brand: "YukiLog",
    },
    welcomeCard: {
      quoteText: "这里分享她所热爱的技术、思考，以及情绪、挣扎",
    },
    siteInfoCard: {
      title: "站点信息",
      mainSite: {
        name: "主站",
        value: "yeastar.xin",
        url: "https://yeastar.xin",
      },
      github: {
        name: "GitHub",
        value: "Yueosa/YukiLog",
        url: "https://github.com/Yueosa/YukiLog",
      },
      labels: {
        totalViews: "总浏览量",
        uptime: "已运行",
        calculating: "计算中...",
      },
    },
    applyLinkModal: {
      hint: "也想出现在这里吗？",
      triggerButton: "申请友链",
      title: "写一封信给恋",
      subtitle: "留下你的站点信息，我会认真查看每一份申请",
      submitText: "寄出",
      submitLoadingText: "寄送中...",
      successEmoji: "✨",
    },
    comments: {
      sectionTitle: "💬 评论区",
      sectionSubtitle: "留下你的足迹，分享你的想法",
      emptyText: "这里还没有评论，来做第一个进来的人吧~ ~",
      emptyIcon: "💬",
      countSuffix: "条评论",
      replyIcon: "↩️",
      replyLabel: "💬 回复",
      replyModalTitle: "💬 回复",
      submitText: "✉️ 提交",
      submitLoadingText: "提交中…",
      cancelText: "取消",
      form: {
        placeholder: "💭 写点什么…",
        nickLabel: "昵称 *",
        nickPlaceholder: "你的昵称",
        emailLabel: "邮箱 *",
        emailPlaceholder: "邮箱地址",
        websiteLabel: "个人网站",
        websitePlaceholder: "站点地址（选填）",
        hint: "支持 Markdown 基础语法 · 提交后需等待审核",
      },
      item: {
        emailIcon: "✉️",
        websiteIcon: "🔗",
      },
    },
    tableOfContents: {
      title: "目录",
    },
    hitokotoCard: {
      title: "一言",
    },
    scrollProgress: {
      backToTop: "回到顶部",
    },
    search: {
      placeholder: "搜索文章标题、摘要、内容…",
      hint: "输入关键词开始搜索",
      loading: "搜索中…",
      noResult: "没有找到相关文章",
      prevPage: "上一页",
      nextPage: "下一页",
      keyboard: {
        navigate: "导航",
        open: "打开",
        close: "关闭",
      },
    },
  },
  pages: {
    error404: {
      icon: "🌙",
      title: "页面走失了",
      description: "你要找的页面好像不在这里...\n也许它从未存在，也许它已经离开。",
      primaryButton: "返回首页",
      secondaryButton: "返回上一页",
    },
    error500: {
      icon: "⚠️",
      title: "服务器开小差了",
      description: "后端服务暂时无法响应。\n这可能是因为：",
      reasons: [
        "后端服务未启动（Rust Axum 服务）",
        "数据库连接失败（PostgreSQL）",
        "Redis 缓存服务不可用",
        "API 地址配置错误（检查 .env 文件）",
      ],
      primaryButton: "返回首页",
      secondaryButton: "刷新页面",
      hint: "如果问题持续，请检查后端服务是否正常运行。",
    },
    links: {
      greeting: "能走到这里的人，大概都是温柔的吧。",
      friendsTitle: "朋友们",
      bestFriend: {
        name: "Duo 云站",
        description: "MathForest官方🌲|程序及数学可视化✨|屑魔女游世界🔮",
        avatar: "https://www.mduo.cloud/elaina_q.jpg",
        url: "https://www.mduo.cloud/",
        message: "愿你的梦中常有我相伴",
        friendSince: "2026.02.06",
        greeting: "致最好的你，",
        sinceLabel: "认识于",
        visitText: "去看看她的世界",
      },

    },
    about: {
      opening: "你好，我是",
      nameHighlight: " 恋",
      socialTitle: "找到我",
      dialogueLeftTitle: "代码与理性",
      dialogueRightTitle: "情绪与挣扎",
    },
    themes: {
      heroSubtitle: "按类别浏览文章",
      postCountSuffix: "篇文章",
      backToAll: "← 返回全部主题",
    },
    archive: {
      heroSubtitlePrefix: "共",
      heroSubtitleSuffix: "篇文章，记录着走过的路",
      timelineEndText: "故事从这里开始",
    },
    tags: {
      emptyText: "这个标签下暂时还没有文章",
      colorCycle: [0, 2, 1, 0, 1, 2, 1, 0, 2, 0, 1, 2, 0, 2, 1, 0, 1, 2],
      colorNames: ["pink", "blue", "white"],
    },
    notes: {
      heroSubtitle: "记录碎片化的想法与日常",
      emptyText: "还没有随记，快去写一条吧~",
      moodLabels: {
        happy: "😊 开心",
        thinking: "🤔 思考",
        sad: "😢 难过",
        angry: "😤 生气",
        calm: "😌 平静",
        excited: "🤩 兴奋",
        tired: "😴 疲惫",
        nostalgic: "🥹 怀旧",
        grateful: "🙏 感恩",
        relieved: "😮‍💨 释然",
        anxious: "😰 焦虑",
        bored: "😑 无聊",
        focused: "🎯 专注",
        proud: "🥲 自豪",
        lonely: "🌧️ 孤独",
        content: "☕ 满足",
        hopeful: "🌱 期待",
        frustrated: "😩 沮丧",
        surprised: "😲 惊讶",
        confused: "🤯 困惑",
        motivated: "🔥 斗志",
        peaceful: "🌸 宁静",
        melancholy: "🌙 忧郁",
        energetic: "⚡ 元气",
        stressed: "💆 压力",
        playful: "🎮 玩闹",
        moved: "🥺 感动",
        embarrassed: "😳 尴尬",
        sick: "🤒 生病",
        hollow: "🫥 空洞",
        drifting: "🌫️ 漂浮",
        fractured: "🧩 破碎",
        unreal: "🪞 失真",
        fading: "🍂 凋零",
        waiting: "⏳ 等待",
        ignored: "📭 被忽视",
        tangled: "🕸️ 纠缠",
        yearning: "🥀 渴望",
        guarded: "🛡️ 防备",
        spiraling: "🌀 下坠思考",
        detached: "🧊 抽离",
        questioning: "❓ 质疑",
        lucid: "💡 清醒",
        drained: "🪫 枯竭",
        numb: "🧍 麻木",
        poetic: "🖋️ 诗性",
        fragile: "🫧 易碎",
        echoing: "📡 回声",
        quiet: "🌑 寂静",
      },
      loadMoreText: "—— 暂时只有这些了 ——",
      loadingText: "加载中…",
    },
    home: {
      articleList: {
        loadMoreText: "—— 暂时只有这些了 ——",
      },
    },
    admin: {
      dashboardCards: {
        posts: "📝",
        comments: "💬",
        themes: "🎨",
        tags: "🏷️",
        links: "🔗",
        notes: "📓",
      },
    },
  },
} as const;

/**
 * 汇总导出，便于后台配置面板一次性读取
 */
export const yukilogConfig = {
  designTokens,
  siteConfig,
  navItems,
  contentConfig,
} as const;

