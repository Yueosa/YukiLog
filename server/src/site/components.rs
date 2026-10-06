//! SSR 首页固定布局渲染：原布局工作室「夜航」节点树的硬编码版本。
//! 布局不再可编辑；根区域结构与 web/src/ui/home-layout.ts 一一对应。

use std::collections::HashSet;

use askama::Template;

use crate::error::AppError;

use super::{ArticleCard, ArticleSort, DynamicCard, FeedFields, HomeStats, SiteView, escape_html};

/// 固定布局常量（与 Lit 端 home-layout.ts 保持一致）。
const HOME_CONTENT_ID: &str = "nf-identity";
const HERO_LEAD: &str = "这里分享她所热爱的技术、思考，以及情绪、挣扎";
const IDENTITY_STATUS: &str = "system.log\n这不是你亲手开启的故事吗？\n[2024-06-09 08:48:29]\n";
const AVATAR_LABEL: &str = "恋的头像";
const MASTHEAD_KICKER: &str = "01";
const MASTHEAD_LEAD: &str = "ARCHIVE / 6";
const QUOTE_TEXT: &str = "把每一个今天过得比昨天好一点，这样就够了。";
const QUOTE_ATTRIBUTION: &str = "—— 《比宇宙更远的地方》";
const DYNAMIC_STRIP_LIMIT: usize = 4;

pub(super) struct RenderContext<'a> {
    pub(super) site: &'a SiteView,
    pub(super) articles: &'a [ArticleCard],
    pub(super) dynamics: &'a [DynamicCard],
    pub(super) stats: &'a HomeStats,
    pub(super) sort: ArticleSort,
}

#[derive(Template)]
#[template(
    source = r#"<header class="masthead masthead-{{ variant }}{% if masthead_url != "" %} has-bg{% endif %}" data-part="masthead" data-reveal>{% if masthead_url != "" %}<div class="masthead-bg" aria-hidden="true" style="background-image:url({{ masthead_url }})"></div>{% endif %}<p class="kicker">{{ kicker }}</p><h1>{{ title }}</h1>{% if show_tabs %}<div class="sort-tabs" role="group" aria-label="文章排序"><a href="/?sort=featured"{% if sort == "featured" %} class="active" aria-pressed="true"{% endif %}>精选</a><a href="/?sort=popular"{% if sort == "popular" %} class="active" aria-pressed="true"{% endif %}>最热</a><a href="/?sort=recent"{% if sort == "recent" %} class="active" aria-pressed="true"{% endif %}>最近</a></div>{% else %}<p class="lead">{{ lead }}</p>{% endif %}</header>"#,
    ext = "html"
)]
struct MastheadTemplate<'a> {
    kicker: &'a str,
    title: &'a str,
    lead: &'a str,
    variant: &'a str,
    show_tabs: bool,
    sort: &'a str,
    masthead_url: &'a str,
}

#[derive(Template)]
#[template(
    source = r#"<section class="article-feed feed-{{ variant }}" data-part="article-feed">{% for article in articles %}<article class="article" data-reveal>{% if show_cover %}{% if article.cover_url != "" %}<a class="article-cover" href="/articles/{{ article.slug }}" style="background-image:url({{ article.cover_url }})" aria-label="{{ article.title }}"></a>{% else %}<a class="article-cover {{ article.cover_class }}" href="/articles/{{ article.slug }}" aria-label="{{ article.title }}"></a>{% endif %}{% endif %}<div class="article-copy"><div class="meta">{% if show_category %}<a class="cat" href="/articles?category={{ article.category_slug }}">{{ article.category }}</a>{% endif %}{% if show_date %}<time>{{ article.published }}</time>{% endif %}</div><h3><a href="/articles/{{ article.slug }}">{{ article.title }}</a></h3>{% if show_summary %}<p class="summary">{{ article.summary }}</p>{% endif %}<div class="foot">{% if show_tags %}<div class="tags">{% for tag in article.tags %}<a href="/articles?tag={{ tag.slug }}">#{{ tag.name }}</a>{% endfor %}</div>{% endif %}{% if show_views %}<span>{{ article.views }} 阅读</span>{% endif %}{% if show_likes %}<span>{{ article.likes }} 喜欢</span>{% endif %}</div></div></article>{% endfor %}{% if articles.is_empty() %}<p class="empty">这里还没有公开文章。</p>{% endif %}</section>"#,
    ext = "html"
)]
struct ArticleFeedTemplate<'a> {
    articles: &'a [ArticleCard],
    variant: &'a str,
    show_cover: bool,
    show_summary: bool,
    show_date: bool,
    show_category: bool,
    show_tags: bool,
    show_views: bool,
    show_likes: bool,
}

struct DynamicStripItem<'a> {
    date: &'a str,
    content_html: &'a str,
}

#[derive(Template)]
#[template(
    source = r#"<section class="dynamic-strip" data-part="dynamic-strip" data-reveal><p class="component-kicker">最近动态<a class="strip-more" href="/dynamics" aria-label="查看全部动态" title="全部动态">›</a></p>{% for item in items %}<div class="dynamic-item"><time>{{ item.date }}</time><span>{{ item.content_html|safe }}</span></div>{% endfor %}</section>"#,
    ext = "html"
)]
struct DynamicStripTemplate<'a> {
    items: &'a [DynamicStripItem<'a>],
}

/// 首页固定结构：hero → 个人信息带 → 文章流 + 侧栏。
pub(super) fn render_home(context: &RenderContext<'_>) -> Result<String, AppError> {
    let hero = render_hero(context);
    let identity = render_identity_band(context);
    let masthead = MastheadTemplate {
        kicker: MASTHEAD_KICKER,
        title: context.sort.masthead_title(),
        lead: MASTHEAD_LEAD,
        variant: "minimal",
        show_tabs: true,
        sort: context.sort.as_str(),
        masthead_url: &context.site.masthead_url,
    }
    .render()
    .map_err(|_| AppError::Internal("render masthead"))?;
    let feed = ArticleFeedTemplate {
        articles: context.articles,
        variant: "alternating",
        show_cover: context.site.feed_fields.cover,
        show_summary: context.site.feed_fields.summary,
        show_date: context.site.feed_fields.date,
        show_category: context.site.feed_fields.category,
        show_tags: context.site.feed_fields.tags,
        show_views: context.site.feed_fields.views,
        show_likes: context.site.feed_fields.likes,
    }
    .render()
    .map_err(|_| AppError::Internal("render article feed"))?;
    let stats = render_stats(context.stats);
    let quote = format!(
        r#"<aside class="quote-card" data-part="free-panel" data-reveal>{}<cite>{}</cite></aside>"#,
        escape_html(QUOTE_TEXT),
        escape_html(QUOTE_ATTRIBUTION)
    );
    let strip_items = context
        .dynamics
        .iter()
        .take(DYNAMIC_STRIP_LIMIT)
        .map(|item| DynamicStripItem {
            date: item.published.get(5..10).unwrap_or(&item.published),
            content_html: &item.content_html,
        })
        .collect::<Vec<_>>();
    let strip = DynamicStripTemplate { items: &strip_items }
        .render()
        .map_err(|_| AppError::Internal("render dynamic strip"))?;
    Ok(format!(
        r#"<section id="nf-root" class="layout-stack gap-none" data-reveal>{hero}<section id="nf-identity" class="layout-grid gap-lg grid-identity" data-part="identity-band" data-reveal>{identity}</section><section id="nf-stage" class="layout-grid gap-xl grid-feed-rail" data-reveal><section id="nf-main" class="layout-stack gap-xl" data-reveal>{masthead}{feed}</section><section id="nf-rail" class="layout-stack gap-lg is-sticky" data-reveal>{stats}{quote}{strip}</section></section></section>"#
    ))
}

/// 个人信息带：头像 + 名字/bio/标签行 + 状态行。
fn render_identity_band(context: &RenderContext<'_>) -> String {
    let site = context.site;
    let avatar = if site.avatar_url.is_empty() {
        format!(
            r#"<div class="primitive-avatar avatar-xl avatar-circle" aria-label="{}" data-reveal>{}</div>"#,
            escape_html(AVATAR_LABEL),
            escape_html(&site.owner_name.chars().next().unwrap_or('雪').to_string())
        )
    } else {
        format!(
            r#"<img class="primitive-avatar avatar-xl avatar-circle" src="{}" alt="{}" data-reveal>"#,
            escape_html(&site.avatar_url),
            escape_html(AVATAR_LABEL)
        )
    };
    format!(
        r#"{avatar}<section id="nf-who" class="layout-stack gap-sm" data-reveal><div class="primitive-text text-heading text-left" data-reveal>{}</div><div class="primitive-text text-body text-left" data-reveal>{}</div><div class="primitive-text text-caption text-left" data-reveal>{}</div></section><pre class="profile-log" data-reveal>{}</pre>"#,
        escape_html(&site.owner_name),
        escape_html(&site.owner_bio),
        escape_html(&site.identity_traits),
        escape_html(IDENTITY_STATUS)
    )
}

fn render_stats(stats: &HomeStats) -> String {
    let available = [
        (stats.articles, "文章"),
        (stats.dynamics, "动态"),
        (stats.friends, "友链"),
        (stats.views, "总阅读"),
    ];
    let mut grid = String::new();
    for (value, label) in available {
        grid.push_str(&format!(
            r#"<div class="stat"><strong>{value}</strong><span>{label}</span></div>"#
        ));
    }
    format!(
        r#"<section class="stats-card" data-part="stats-panel" data-reveal><p class="component-kicker">站点信息</p><div class="stats-grid">{grid}</div></section>"#
    )
}

fn render_hero(context: &RenderContext<'_>) -> String {
    let accent: HashSet<char> = context.site.hero_accent.chars().collect();
    let title_characters = context
        .site
        .hero_title
        .chars()
        .enumerate()
        .map(|(index, character)| {
            let accent_class = if accent.contains(&character) {
                " accent"
            } else {
                ""
            };
            format!(
                r#"<span class="hero-character{accent_class}" style="--char-index:{index}">{}</span>"#,
                escape_html(&character.to_string())
            )
        })
        .collect::<String>();
    // 首屏背景来自站点设置的轮换列表（焦点图用 cover/自定义缩放精确还原框选，
    // 普通图走全局适应变量 --hero-pos / --hero-fit）。
    let background_urls = &context.site.hero_backgrounds;
    let background_url = background_urls
        .first()
        .map(|(url, ..)| url.as_str())
        .unwrap_or_default();
    let (first_position, first_size) = background_urls
        .first()
        .map(|(_, position, size)| match position {
            Some(pos) => (
                pos.clone(),
                size.clone().unwrap_or_else(|| "cover".to_owned()),
            ),
            None => (
                "var(--hero-pos, center)".to_owned(),
                "var(--hero-fit, cover)".to_owned(),
            ),
        })
        .unwrap_or((
            "var(--hero-pos, center)".to_owned(),
            "var(--hero-fit, cover)".to_owned(),
        ));
    let mut background = if background_url.is_empty() {
        String::new()
    } else {
        format!(
            r#"<div class="hero-background" role="img" aria-label="首页背景" style="background-image:url(&quot;{}&quot;);background-position:{};background-size:{}"></div>"#,
            escape_html(background_url),
            escape_html(&first_position),
            escape_html(&first_size)
        )
    };
    if background_urls.len() > 1 {
        let images: Vec<&str> = background_urls.iter().map(|(url, ..)| url.as_str()).collect();
        let positions: Vec<Option<&str>> = background_urls
            .iter()
            .map(|(_, position, _)| position.as_deref())
            .collect();
        let sizes: Vec<Option<&str>> = background_urls
            .iter()
            .map(|(_, _, size)| size.as_deref())
            .collect();
        let images = serde_json::to_string(&images).unwrap_or_default();
        let positions = serde_json::to_string(&positions).unwrap_or_default();
        let sizes = serde_json::to_string(&sizes).unwrap_or_default();
        background.push_str(&format!(
            r#"<script>(()=>{{const images={images},positions={positions},sizes={sizes};if(images.length<2)return;try{{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return}}catch(_){{}}const base=document.currentScript.previousElementSibling;if(!base||!base.classList.contains('hero-background'))return;base.style.transition='opacity 1.2s ease';let index=0;images.slice(1).forEach((src)=>{{const preload=new Image();preload.src=src}});window.setInterval(()=>{{index=(index+1)%images.length;base.style.opacity='0';window.setTimeout(()=>{{base.style.backgroundImage='url("'+images[index]+'")';base.style.backgroundPosition=positions[index]||'';base.style.backgroundSize=sizes[index]||(positions[index]?'cover':'');base.style.opacity='1'}},1200)}},8000)}})();</script>"#
        ));
    }
    let mut socials = String::new();
    let colors = [
        "#6e7f8d", "#e3a0ae", "#7eb6d9", "#8fafc4", "#e8a4b4", "#d6a1ae",
    ];
    for (index, link) in context.site.social_links.iter().enumerate() {
        let external = if link.url.starts_with("http://") || link.url.starts_with("https://") {
            r#" target="_blank""#
        } else {
            ""
        };
        socials.push_str(&format!(
            r##"<a class="social-icon" href="{}" rel="me noopener"{} aria-label="{}" title="{}" style="color:{}">{}</a>"##,
            escape_html(&link.url),
            external,
            escape_html(&link.label),
            escape_html(&link.label),
            colors[index % colors.len()],
            hero_social_icon(&link.label, index),
        ));
    }
    socials.push_str(
        r##"<a class="social-icon" href="/feed.xml" aria-label="RSS" title="RSS" style="color:#f0a65a"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-1-8a1 1 0 0 1 1-1 8 8 0 0 1 8 8 1 1 0 1 1-2 0 6 6 0 0 0-6-6 1 1 0 0 1-1-1Zm0-6a1 1 0 0 1 1-1 14 14 0 0 1 14 14 1 1 0 1 1-2 0A12 12 0 0 0 5 7a1 1 0 0 1-1-1Z"/></svg></a>"##,
    );
    socials = format!(r#"<nav class="social-row" aria-label="社交链接">{socials}</nav>"#);
    let enter = format!(
        r##"<a class="enter-button" data-part="hero-enter" href="#{}" aria-label="进入文章区域"><span class="enter-guide"><span>ENTER</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 9 7 7 7-7"/></svg></span></a>"##,
        HOME_CONTENT_ID
    );
    let media_class = if background_url.is_empty() {
        ""
    } else {
        " has-media"
    };
    // 语录卡：hero_quote 优先，空则站点说明，再空回退固定 lead。
    let quote = if !context.site.hero_quote.is_empty() {
        context.site.hero_quote.as_str()
    } else if !context.site.description.is_empty() {
        context.site.description.as_str()
    } else {
        HERO_LEAD
    };
    format!(
        r#"<section id="nf-hero" class="hero hero-cinematic overlay-medium{}" data-part="hero">{background}<div class="hero-inner"><h1 data-part="hero-title">{title_characters}</h1><div class="hero-info"><div class="welcome-quote" data-part="hero-quote-card"><span class="quote-text">{}</span>{socials}</div></div></div>{enter}</section>"#,
        media_class,
        escape_html(quote),
    )
}

fn hero_social_icon(label: &str, index: usize) -> &'static str {
    let label = label.to_ascii_lowercase();
    if label.contains("github") {
        return r#"<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.884 18.653c-.3-.2-.558-.455-.86-.816a51 51 0 0 1-.466-.579c-.463-.575-.755-.841-1.056-.95a1 1 0 1 1 .675-1.882c.752.27 1.261.735 1.947 1.588c-.094-.117.34.427.433.539c.19.227.33.365.44.438c.204.137.588.196 1.15.14c.024-.382.094-.753.202-1.095c-2.968-.726-4.648-2.64-4.648-6.396c0-1.24.37-2.356 1.058-3.292c-.218-.894-.185-1.975.302-3.192a1 1 0 0 1 .63-.582c.081-.024.127-.035.208-.047c.803-.124 1.937.17 3.415 1.096a11.7 11.7 0 0 1 2.687-.308c.912 0 1.819.104 2.684.308c1.477-.933 2.614-1.227 3.422-1.096q.128.02.218.05a1 1 0 0 1 .616.58c.487 1.216.52 2.296.302 3.19c.691.936 1.058 2.045 1.058 3.293c0 3.757-1.674 5.665-4.642 6.392c.125.415.19.878.19 1.38c0 .665-.002 1.299-.007 2.01c0 .19-.002.394-.005.706a1 1 0 0 1-.018 1.958c-1.14.227-1.984-.532-1.984-1.525l.002-.447l.005-.705c.005-.707.008-1.337.008-1.997c0-.697-.184-1.152-.426-1.361c-.661-.57-.326-1.654.541-1.751c2.966-.333 4.336-1.482 4.336-4.66c0-.955-.312-1.744-.913-2.404A1 1 0 0 1 17.2 6.19c.166-.414.236-.957.095-1.614l-.01.003c-.491.139-1.11.44-1.858.949a1 1 0 0 1-.833.135a9.6 9.6 0 0 0-2.592-.349c-.89 0-1.772.118-2.592.35a1 1 0 0 1-.829-.134c-.753-.507-1.374-.807-1.87-.947c-.143.653-.072 1.194.093 1.607a1 1 0 0 1-.189 1.045c-.597.655-.913 1.458-.913 2.404c0 3.172 1.371 4.328 4.322 4.66c.865.097 1.202 1.177.545 1.748c-.193.168-.43.732-.43 1.364v3.15c0 .985-.834 1.725-1.96 1.528a1 1 0 0 1-.04-1.962v-.99c-.91.061-1.661-.088-2.254-.485"/></svg>"#;
    }
    if label.contains("qq") {
        return r#"<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m17.536 12.514l-.696-1.796c0-.021.01-.375.01-.558C16.85 7.088 15.447 4 12 4s-4.848 3.088-4.848 6.16c0.183.009.537.01.557l-.696 1.797c-.19.515-.38 1.05-.517 1.51c-.657 2.189-.444 3.095-.282 3.115c.348.043 1.354-1.648 1.354-1.648c0 .98.487 2.258 1.542 3.18c-.394.127-.878.32-1.188.557c-.28.214-.245.431-.194.52c.22.385 3.79.245 4.82.125c1.03.12 4.599.26 4.82-.126c.05-.088.085-.305-.194-.519c-.311-.237-.795-.43-1.19-.556c1.055-.923 1.542-2.202 1.542-3.181c0 0 1.007 1.691 1.355 1.648c.162-.02.378-.928-.283-3.116a27 27 0 0 0-.516-1.509m1.021 8.227c-.373.652-.833.892-1.438 1.057a5 5 0 0 1-.794.138c-.44.045-.986.065-1.613.064a33 33 0 0 1-2.71-.116c-.692.065-1.785.114-2.71.116a16 16 0 0 1-1.614-.064a5 5 0 0 1-.793-.138c-.605-.164-1.065-.405-1.44-1.059a2.27 2.27 0 0 1-.239-1.652c-.592-.132-1.001-.482-1.279-.911a2.4 2.4 0 0 1-.309-.71a4 4 0 0 1-.116-1.106c.013-.785.187-1.762.532-2.912c.14-.466.327-1.008.567-1.655l.554-1.43l-.002-.203C5.153 5.605 7.589 2 12 2c4.413 0 6.848 3.605 6.848 8.16l-.001.203l.553 1.43l.01.026c.225.606.413 1.153.556 1.626c.348 1.15.522 2.128.535 2.916q.012.61-.118 1.108c-.066.246-.161.48-.31.708c-.276.427-.684.776-1.277.91c.13.554.055 1.14-.24 1.654"/></svg>"#;
    }
    if label.contains("bili") || label.contains("视频") {
        return r#"<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.172 2.757L10.414 6h3.171l3.243-3.242a1 1 0 1 1 1.415 1.415L16.414 6H18.5A3.5 3.5 0 0 1 22 9.5v8a3.5 3.5 0 0 1-3.5 3.5h-13A3.5 3.5 0 0 1 2 17.5v-8A3.5 3.5 0 0 1 5.5 6h2.085L5.757 4.171a1 1 0 0 1 1.415-1.415M18.5 8h-13a1.5 1.5 0 0 0-1.493 1.356L4 9.5v8a1.5 1.5 0 0 0 1.356 1.493L5.5 19h13a1.5 1.5 0 0 0 1.493-1.355L20 17.5v-8A1.5 1.5 0 0 0 18.5 8M8 11a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1m8 0a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1"/></svg>"#;
    }
    if label == "x" || label.contains("twitter") {
        return r#"<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m17.687 3.063l-4.996 5.711l-4.32-5.711H2.112l7.477 9.776l-7.086 8.099h3.034l5.469-6.25l4.78 6.25h6.102l-7.794-10.304l6.625-7.571zm-1.064 16.06L5.654 4.782h1.803l10.846 14.34z"/></svg>"#;
    }
    if label.contains("music") || label.contains("音乐") {
        return r#"<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.422 11.375c-.294 1.028.012 2.065.784 2.653c1.061.81 2.565.3 2.874-.995c.08-.337.103-.722.027-1.056c-.23-1.001-.521-1.988-.792-2.996c-1.33.154-2.543 1.172-2.893 2.394m5.548-.287c.273 1.012.285 2.017-.127 3c-1.128 2.69-4.722 3.14-6.573.826c-1.302-1.627-1.28-3.961.06-5.734c.78-1.032 1.804-1.707 3.048-2.054l.379-.104c-.084-.415-.188-.816-.243-1.224c-.176-1.317.512-2.503 1.744-3.04c1.226-.535 2.708-.216 3.53.76c.406.479.395 1.08-.025 1.464c-.412.377-.997.346-1.435-.09c-.247-.246-.51-.44-.877-.436c-.525.006-.987.418-.945.937c.037.468.172.93.3 1.386c.022.078.216.135.338.153c1.333.197 2.504.731 3.472 1.676c2.558 2.493 2.861 6.531.672 9.44c-1.529 2.032-3.61 3.169-6.127 3.409c-4.621.44-8.664-2.53-9.7-7.058C2.516 10.255 4.84 5.831 8.796 4.25c.586-.234 1.143-.031 1.371.498c.232.537-.019 1.086-.61 1.35c-2.368 1.06-3.817 2.855-4.215 5.424c-.533 3.433 1.656 6.776 5 7.72c2.723.77 5.658-.166 7.308-2.33c1.586-2.08 1.4-5.099-.427-6.873A4 4 0 0 0 15.4 9.026c.198.716.389 1.388.57 2.062"/></svg>"#;
    }
    if label.contains("mail") || label.contains("邮箱") || label.contains("gmail") {
        return r#"<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1m17 4.238l-7.928 7.1L4 7.216V19h16zM4.511 5l7.55 6.662L19.502 5z"/></svg>"#;
    }
    const FALLBACK: [&str; 6] = [
        r#"<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><path d="M9 19c-4.5 1.4-4.5-2.4-6.2-3M15 21v-3.5c0-1 .1-1.5-.5-2.1 2.8-.3 5.7-1.4 5.7-6.2"/></svg>"#,
        r#"<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><path d="M4 5h16v11H9l-5 4z"/></svg>"#,
        r#"<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/></svg>"#,
        r#"<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><path d="m5 4 14 16M19 4 5 20"/></svg>"#,
        r#"<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/></svg>"#,
        r#"<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>"#,
    ];
    FALLBACK[index % FALLBACK.len()]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::site::HomeStats;

    fn site_view() -> SiteView {
        SiteView {
            title: "YukiLog".to_owned(),
            brand_text: "YukiLog".to_owned(),
            hero_title: crate::content::parts::DEFAULT_HERO_TITLE.to_owned(),
            hero_accent: crate::content::parts::DEFAULT_HERO_ACCENT.to_owned(),
            part_vars: String::new(),
            identity_traits: crate::content::parts::DEFAULT_IDENTITY_TRAITS.to_owned(),
            default_sort: ArticleSort::Featured,
            feed_fields: FeedFields {
                cover: true,
                category: true,
                date: true,
                summary: true,
                tags: true,
                views: true,
                likes: true,
            },
            description: "站点说明".to_owned(),
            owner_name: "Sakurine".to_owned(),
            owner_bio: String::new(),
            avatar_url: String::new(),
            masthead_url: String::new(),
            hero_backgrounds: Vec::new(),
            hero_quote: String::new(),
            favicon_url: String::new(),
            origin: "https://blog.example.com".to_owned(),
            social_links: Vec::new(),
            navigation_class: "topbar",
            navigation_options: String::new(),
            nav_corners_class: "",
            page_width_class: "width-wide",
            show_search: true,
            mail_enabled: false,
            font_class: "font-system",
            background: "#ffffff".to_owned(),
            surface: "#ffffff".to_owned(),
            surface_muted: "#f2f4f8".to_owned(),
            text: "#20232a".to_owned(),
            text_muted: "#667085".to_owned(),
            primary: "#3278d4".to_owned(),
            secondary: "#ef78ac".to_owned(),
            border: "#dfe3ea".to_owned(),
            radius: 16,
            scale: 1.0,
            masthead_tint: 0,
            masthead_position: "center".to_owned(),
            masthead_fit: "cover".to_owned(),
        }
    }

    fn context<'a>(
        site: &'a SiteView,
        articles: &'a [ArticleCard],
        dynamics: &'a [DynamicCard],
        stats: &'a HomeStats,
    ) -> RenderContext<'a> {
        RenderContext {
            site,
            articles,
            dynamics,
            stats,
            sort: ArticleSort::Featured,
        }
    }

    fn stats() -> HomeStats {
        HomeStats {
            articles: 1,
            dynamics: 1,
            friends: 1,
            views: 1,
        }
    }

    #[test]
    fn hero_uses_first_background_and_rotates_the_rest() {
        let mut site = site_view();
        site.hero_backgrounds = vec![
            ("/media/aa/one.png".to_owned(), None, None),
            (
                "/media/bb/two.png".to_owned(),
                Some("50% 20%".to_owned()),
                Some("230% 172%".to_owned()),
            ),
        ];
        site.hero_quote = "语录文本".to_owned();
        let html = render_hero(&context(&site, &[], &[], &stats()));
        assert!(html.contains("background-image:url(&quot;/media/aa/one.png&quot;)"));
        assert!(html.contains(r#"const images=["/media/aa/one.png","/media/bb/two.png"]"#));
        assert!(html.contains("},8000)"));
        assert!(html.contains("prefers-reduced-motion"));
        assert!(html.contains("has-media"));
        assert!(html.contains("<span class=\"quote-text\">语录文本</span>"));
    }

    #[test]
    fn hero_quote_falls_back_to_fixed_lead_when_site_texts_empty() {
        let mut site = site_view();
        site.description = String::new();
        let html = render_hero(&context(&site, &[], &[], &stats()));
        assert!(!html.contains("hero-background"));
        assert!(!html.contains("has-media"));
        assert!(html.contains(&format!("<span class=\"quote-text\">{HERO_LEAD}</span>")));
    }

    #[test]
    fn home_renders_fixed_structure() {
        let site = site_view();
        let html = render_home(&context(&site, &[], &[], &stats())).unwrap();
        for needle in [
            r#"id="nf-root""#,
            r#"id="nf-identity""#,
            r#"id="nf-stage""#,
            r#"id="nf-main""#,
            r#"id="nf-rail""#,
            r#"data-part="hero""#,
            r#"data-part="identity-band""#,
            r#"data-part="masthead""#,
            r#"data-part="article-feed""#,
            r#"data-part="stats-panel""#,
            r#"data-part="free-panel""#,
            r#"data-part="dynamic-strip""#,
            r##"href="#nf-identity""##,
        ] {
            assert!(html.contains(needle), "missing {needle}");
        }
    }
}
