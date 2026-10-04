use std::collections::{HashMap, HashSet};

use askama::Template;
use axum::{
    extract::{Path, Query, State},
    response::Html,
};
use chrono::{DateTime, Datelike, FixedOffset, TimeZone, Utc};
use sea_orm::{
    ColumnTrait, EntityTrait, QueryFilter, QueryOrder, QuerySelect,
    prelude::Uuid,
    sea_query::{Expr, Query as SeaQuery},
};
use serde::Deserialize;
use serde_json::Value;

use crate::{
    AppState,
    content::settings::{
        BrandPosition, NavigationVariant, ShellWidth, SiteSettingsWrite, SocialLink,
    },
    entities::{
        article_metrics, article_tags, articles, categories, comments, dynamics, friend_links,
        media_assets, page_layouts, site_settings, tags,
    },
    error::AppError,
    layout::{ComponentType, LayoutNode, PageLayoutDocument},
    markdown,
};

const ARTICLE_LIMIT: u64 = 48;
const ARTICLE_PAGE_SIZE: u64 = 12;
const HOME_ARTICLE_LIMIT: u64 = 12;
const HOME_DYNAMIC_LIMIT: u64 = 8;

#[derive(Clone)]
struct SiteView {
    title: String,
    description: String,
    owner_name: String,
    owner_bio: String,
    avatar_url: String,
    social_links: Vec<SocialLink>,
    navigation_class: &'static str,
    navigation_options: &'static str,
    page_width_class: &'static str,
    show_search: bool,
    mail_enabled: bool,
    font_class: &'static str,
    background: String,
    surface: String,
    surface_muted: String,
    text: String,
    text_muted: String,
    primary: String,
    secondary: String,
    border: String,
    radius: u8,
    scale: f32,
}

#[derive(Clone)]
struct ArticleCard {
    title: String,
    slug: String,
    summary: String,
    category: String,
    category_slug: String,
    tags: Vec<TagCard>,
    cover_url: String,
    published: String,
    published_year: i32,
    views: i64,
    likes: i64,
}

#[derive(Clone)]
struct TagCard {
    name: String,
    slug: String,
}

#[derive(Default)]
struct ArticleFilter {
    category_id: Option<Uuid>,
    tag_id: Option<Uuid>,
    published_from: Option<DateTime<FixedOffset>>,
    published_before: Option<DateTime<FixedOffset>>,
}

struct DynamicCard {
    id: Uuid,
    content_html: String,
    published: String,
}

struct FriendCard {
    name: String,
    url: String,
    description: String,
    avatar_url: String,
}

struct CommentCard {
    display_name: String,
    website: String,
    content: String,
    created: String,
}

struct RenderContext<'a> {
    site: &'a SiteView,
    articles: &'a [ArticleCard],
    dynamics: &'a [DynamicCard],
    media_urls: &'a HashMap<String, String>,
    home_content_id: &'a str,
}

#[derive(Template)]
#[template(
    source = r#"<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="{{ site.description }}">
  <link rel="alternate" type="application/rss+xml" title="{{ site.title }}" href="/feed.xml">
  <title>{{ page_title }} · {{ site.title }}</title>
  <style>
    :root{--bg:{{ site.background }};--surface:{{ site.surface }};--muted-surface:{{ site.surface_muted }};--text:{{ site.text }};--muted:{{ site.text_muted }};--primary:{{ site.primary }};--secondary:{{ site.secondary }};--border:{{ site.border }};--radius:{{ site.radius }}px;--scale:{{ site.scale }}}
    *{box-sizing:border-box}html{color-scheme:light dark;scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font:calc(16px * var(--scale))/1.75 system-ui,sans-serif}body.font-serif{font-family:Georgia,"Noto Serif SC",serif}body.font-rounded{font-family:ui-rounded,"Noto Sans SC",sans-serif}body.font-mono{font-family:ui-monospace,monospace}a{color:inherit;text-decoration:none}img{max-width:100%;display:block}.site-nav{z-index:20;padding:1rem 1.5rem;background:var(--surface);border-bottom:1px solid var(--border)}.nav-translucent{background:color-mix(in srgb,var(--surface) 88%,transparent);backdrop-filter:blur(18px)}.brand-center .brand{margin:auto}.nav-topbar{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between}.nav-links{display:flex;gap:1rem;flex-wrap:wrap}.nav-sidebar{position:fixed;inset:0 auto 0 0;width:240px;display:flex;flex-direction:column;gap:2rem}.nav-sidebar .nav-links{flex-direction:column}.nav-floating-dock{position:fixed;left:50%;bottom:1rem;transform:translateX(-50%);border:1px solid var(--border);border-radius:999px;display:flex;gap:1rem}.shell-sidebar main{margin-left:240px}.page{width:min(1180px,calc(100% - 2rem));margin:auto;padding:2rem 0 6rem}.width-content{max-width:880px}.width-wide{max-width:1180px}.width-full{max-width:none}.layout-stack{display:flex;flex-direction:column}.gap-none{gap:0}.gap-sm{gap:.6rem}.gap-md{gap:1rem}.gap-lg{gap:2rem}.gap-xl{gap:4rem}.layout-grid{display:grid;grid-template-columns:minmax(0,1fr) 280px}.grid-aside-first{grid-template-columns:280px minmax(0,1fr)}.layout-split{display:grid;grid-template-columns:270px minmax(0,1fr)}.split-right{grid-template-columns:minmax(0,1fr) 270px}.layout-bento{display:grid;grid-template-columns:repeat(12,minmax(0,1fr))}.area-3-7{grid-area:span 3/span 7}.area-4-5{grid-area:span 4/span 5}.area-8-5{grid-area:span 8/span 5}.area-9-7{grid-area:span 9/span 7}.hero{min-height:55vh;display:grid;place-items:center;padding:4rem 2rem;text-align:center;border-radius:var(--radius);background:linear-gradient(135deg,color-mix(in srgb,var(--primary) 24%,var(--surface)),color-mix(in srgb,var(--secondary) 24%,var(--surface)))}.hero h1,.masthead h1{font-size:clamp(2.5rem,8vw,6rem);line-height:1.05;margin:.4em 0}.masthead{padding:4rem 0;border-bottom:1px solid var(--border)}.profile,.quote,.stats,.dynamic-card,.friend-card,.article{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}.profile,.quote,.stats{padding:1.4rem}.avatar{width:5rem;height:5rem;border-radius:50%;object-fit:cover;background:var(--muted-surface)}.article-feed{display:grid;gap:1.2rem}.feed-editorial{grid-template-columns:repeat(2,minmax(0,1fr))}.feed-cover-overlay{grid-template-columns:repeat(3,minmax(0,1fr))}.article{display:grid;grid-template-columns:minmax(180px,36%) 1fr}.feed-compact .article,.feed-editorial .article,.feed-cover-overlay .article{display:block}.article-cover{aspect-ratio:16/10;width:100%;object-fit:cover;background:var(--muted-surface)}.article-copy{padding:1.3rem}.article h2{margin:.25rem 0;font-size:1.35rem}.meta{display:flex;gap:.6rem;flex-wrap:wrap;color:var(--muted);font-size:.86rem}.pill{color:var(--primary)}.prose{max-width:760px;margin:auto}.prose img{border-radius:var(--radius)}.prose pre{overflow:auto;padding:1rem;background:var(--muted-surface);border-radius:var(--radius)}.dynamics,.friends,.comments{display:grid;gap:1rem}.dynamic-card,.friend-card,.comment{padding:1.3rem}.friend-card{display:flex;gap:1rem}.friend-card .avatar{width:3rem;height:3rem}.empty{padding:4rem;text-align:center;color:var(--muted)}footer{padding:3rem;text-align:center;color:var(--muted)}
    @media(max-width:800px){.nav-sidebar{position:sticky;width:auto;inset:auto;flex-direction:row}.nav-sidebar .nav-links{flex-direction:row}.shell-sidebar main{margin-left:0}.layout-grid,.layout-split{grid-template-columns:1fr}.layout-bento{display:block}.feed-editorial,.feed-cover-overlay{grid-template-columns:1fr}.article{display:block}.page{padding-top:1rem}.nav-floating-dock .brand{display:none}}
  </style>
  <style>
    .layout-grid.grid-three-rail{width:min(1420px,calc(100% - 3rem));grid-template-columns:minmax(220px,280px) minmax(0,900px) minmax(220px,280px);justify-content:center}
    .layout-card{display:flex;min-width:0;flex-direction:column;gap:1rem;border:1px solid var(--border);background:var(--surface);color:var(--text)}
    .card-glass{background:color-mix(in srgb,var(--surface) 82%,transparent);backdrop-filter:blur(18px)}
    .card-outlined{border-width:2px;background:transparent}.card-paper{border-radius:2px;background:var(--surface)}
    .padding-none{padding:0}.padding-sm{padding:.75rem}.padding-md{padding:1.25rem}.padding-lg{padding:1.75rem}.padding-xl{padding:2.5rem}
    .radius-none{border-radius:0}.radius-sm{border-radius:8px}.radius-md{border-radius:16px}.radius-lg{border-radius:24px}.radius-pill{border-radius:999px}
    .shadow-none{box-shadow:none}.shadow-soft{box-shadow:0 18px 48px rgb(38 57 78/.1)}.shadow-blue{box-shadow:-7px 9px 0 color-mix(in srgb,var(--primary) 14%,transparent)}.shadow-pink{box-shadow:7px 9px 0 color-mix(in srgb,var(--secondary) 15%,transparent)}
    .align-start{align-items:start}.align-center{align-items:center}.align-stretch{align-items:stretch}.is-sticky{position:sticky;top:5.5rem;align-self:start}
    .primitive-avatar{display:grid;flex:0 0 auto;place-items:center;object-fit:cover;background:linear-gradient(145deg,var(--secondary),var(--primary));color:white}
    .avatar-sm{width:44px;height:44px}.avatar-md{width:64px;height:64px}.avatar-lg{width:88px;height:88px}.avatar-xl{width:104px;height:104px}.avatar-circle{border-radius:50%}.avatar-rounded{border-radius:20px}.avatar-square{border-radius:0}
    .primitive-text{width:100%}.text-eyebrow{color:var(--secondary);font-size:.7rem;font-weight:700;letter-spacing:.2em}.text-heading{color:var(--secondary);font-size:1.5rem;font-weight:700}.text-body,.text-caption{color:var(--muted)}.text-caption{font-size:.75rem}.text-left{text-align:left}.text-center{text-align:center}.text-right{text-align:right}
    .primitive-socials{display:flex;width:100%;flex-wrap:wrap;gap:.5rem}.primitive-socials a{color:var(--primary);font-size:.8rem}.socials-labels{flex-direction:column}.socials-labels a{padding:.5rem .65rem;border-radius:9px;background:var(--muted-surface)}.socials-pills a,.socials-icons a{padding:.45rem .7rem;border:1px solid var(--border);border-radius:999px}
    .primitive-status{width:100%;padding:.65rem .75rem;border-radius:9px;background:var(--muted-surface);color:var(--muted);font:.7rem/1.5 ui-monospace,monospace}.status-online{color:#35835c}.status-accent{color:var(--secondary)}
    .layout-card>.quote,.layout-card>.stats{padding:0;border:0;background:transparent}
    .nav-corners{position:fixed;z-index:21;top:0;right:0;left:0;display:flex;height:50px;align-items:center;justify-content:space-between;padding:0 clamp(1rem,3vw,3rem);pointer-events:none;transition:opacity .4s ease}.nav-corners>*{pointer-events:auto}.nav-corners.hidden{opacity:0;pointer-events:none}.nav-actions{display:flex;gap:.55rem}.nav-action{display:grid;width:32px;height:32px;place-items:center;border:0;border-radius:8px;background:transparent;color:var(--text);font:inherit;cursor:pointer}.nav-action:hover{background:rgb(255 255 255/.28);color:var(--primary)}
    .site-nav.nav-topbar{position:fixed;z-index:20;top:0;left:50%;display:flex;width:100%;height:50px;align-items:center;justify-content:center;gap:1rem;padding:0 1.5rem;transform:translateX(-50%);border:0;background:var(--surface);opacity:0;pointer-events:none;transition:opacity .4s ease,width .5s cubic-bezier(.22,.61,.36,1),border-radius .5s cubic-bezier(.22,.61,.36,1),top .5s cubic-bezier(.22,.61,.36,1),box-shadow .5s ease}.site-nav.nav-topbar.nav-active{opacity:1;pointer-events:auto}.site-nav.nav-topbar.nav-sticky{top:10px;width:auto;border-radius:999px;opacity:1;pointer-events:auto;box-shadow:-8px 10px 0 color-mix(in srgb,var(--primary) 16%,transparent),0 4px 16px rgb(23 42 66/.12)}.immersive-home .nav-topbar:not(.nav-sticky) .brand{display:none}.site-nav.nav-topbar .nav-links{flex-wrap:nowrap}.site-nav.nav-topbar .nav-links a{padding:.42rem .7rem;border-radius:8px;opacity:0;transform:translateX(28px)}.site-nav.nav-topbar.nav-active .nav-links a,.site-nav.nav-topbar.nav-sticky .nav-links a{animation:nav-item-in .55s cubic-bezier(.22,.61,.36,1) forwards}.site-nav.nav-topbar .nav-links a:nth-child(2){animation-delay:.08s}.site-nav.nav-topbar .nav-links a:nth-child(3){animation-delay:.16s}.site-nav.nav-topbar .nav-links a:nth-child(4){animation-delay:.24s}.site-nav.nav-topbar .nav-links a:nth-child(5){animation-delay:.32s}.site-nav.nav-topbar .nav-links a:nth-child(6){animation-delay:.4s}.site-nav.nav-topbar .nav-links a:hover{background:var(--muted-surface);color:var(--primary)}
    .immersive-home .page{width:100%;max-width:none;padding:0}.immersive-home .hero{position:relative;display:grid;width:100%;min-height:100svh;place-items:center;overflow:hidden;isolation:isolate;border-radius:0;background:#15283e;color:#fff}.immersive-home .hero::before,.immersive-home .hero::after{position:absolute;z-index:-2;content:"";inset:0}.immersive-home .hero::before{background:radial-gradient(circle at 78% 18%,rgb(255 219 221/.78),transparent 13%),radial-gradient(ellipse at 16% 95%,rgb(23 49 77/.92),transparent 38%),linear-gradient(162deg,transparent 52%,rgb(239 179 194/.42) 53% 58%,transparent 59%),linear-gradient(155deg,#15283e 0%,#456884 42%,#9db5c3 68%,#dca9b6 100%);animation:hero-fallback-in 1.2s cubic-bezier(.22,.61,.36,1) both}.immersive-home .hero.has-media::before{display:none}.immersive-home .hero::after{z-index:-1;background:linear-gradient(90deg,rgb(4 12 24/.32),transparent 58%),linear-gradient(180deg,rgb(6 14 28/var(--hero-shade-top,.12)),rgb(6 14 28/var(--hero-shade-bottom,.52)))}.hero-background{position:absolute;z-index:-2;inset:-2%;background-repeat:no-repeat;background-size:cover;filter:brightness(.3) blur(8px);transform:scale(1.06);animation:hero-media-in 1.2s cubic-bezier(.22,.61,.36,1) forwards}.overlay-soft{--hero-brightness:.82;--hero-shade-top:.06;--hero-shade-bottom:.34}.overlay-medium{--hero-brightness:.7;--hero-shade-top:.12;--hero-shade-bottom:.52}.overlay-strong{--hero-brightness:.56;--hero-shade-top:.2;--hero-shade-bottom:.68}
    .hero-inner{display:flex;width:min(580px,70vw);align-items:center;flex-direction:column;padding:7rem 0 5rem;text-align:center}.hero-kicker{margin:0 0 .5rem;padding:.35rem .7rem;border:1px solid rgb(255 255 255/.22);border-radius:999px;background:rgb(0 0 0/.14);color:rgb(255 255 255/.76);font-size:.68rem;font-weight:700;letter-spacing:.12em}.immersive-home .hero h1{display:flex;flex-wrap:wrap;justify-content:center;margin:0;padding:1rem 0;font-size:clamp(2.2rem,5vw,3.2rem);font-weight:900;line-height:1.15;letter-spacing:.03em;text-shadow:0 2px 16px rgb(0 0 0/.5)}.hero-character{display:inline-block;opacity:0;transform:translateY(12px);animation:hero-char-in .5s calc(var(--char-index) * .08s) cubic-bezier(.22,.61,.36,1) forwards}.hero-info{width:100%;margin-top:.75rem;padding:.75rem 1.5rem;border-radius:20px;background:rgb(0 0 0/.6)}.hero-info p{margin:.6rem 0;color:rgb(255 255 255/.86);font-weight:600}.hero-socials{display:flex;justify-content:center;gap:1rem}.hero-socials a{padding:.45rem .7rem;border-radius:999px;color:rgb(255 255 255/.78);font-size:.82rem}.hero-socials a:hover{background:rgb(255 255 255/.12);color:#fff}.scroll-arrow{position:absolute;bottom:34px;left:50%;display:grid;width:40px;height:40px;place-items:center;transform:translateX(-50%);border:1px solid rgb(255 255 255/.2);border-radius:50%;background:rgb(0 0 0/.16);color:rgb(255 255 255/.76);font-size:1.8rem;animation:hero-arrow 2.5s ease-in-out infinite}
    .immersive-home .layout-grid.grid-three-rail{width:100%;min-height:100vh;padding:70px clamp(1rem,2vw,2rem) 6rem;background:var(--bg);column-gap:28px}.immersive-home .layout-card{border:0}.immersive-home .layout-card.shadow-pink{box-shadow:8px 10px 0 color-mix(in srgb,var(--secondary) 18%,transparent),0 18px 48px rgb(38 57 78/.08)}.immersive-home .layout-card.shadow-blue{box-shadow:-8px 10px 0 color-mix(in srgb,var(--primary) 18%,transparent),0 18px 48px rgb(38 57 78/.08)}
    @keyframes nav-item-in{to{opacity:1;transform:translateX(0)}}@keyframes hero-char-in{to{opacity:1;transform:translateY(0)}}@keyframes hero-arrow{0%,100%{translate:0 0}50%{translate:0 9px}}@keyframes hero-media-in{from{filter:brightness(.3) blur(8px);transform:scale(1.08)}to{filter:brightness(var(--hero-brightness,.7)) blur(0);transform:scale(1.02)}}@keyframes hero-fallback-in{from{filter:brightness(.45) blur(8px);transform:scale(1.08)}to{filter:brightness(.85) blur(0);transform:scale(1.02)}}
    @media(max-width:1400px){.layout-grid.grid-three-rail{grid-template-columns:1fr;max-width:900px}.is-sticky{position:static}}
    @media(max-width:700px){.site-nav.nav-topbar{max-width:calc(100% - 16px)}.site-nav.nav-topbar .brand{display:none}.site-nav.nav-topbar .nav-links{max-width:100%;overflow:auto}.hero-inner{width:min(88vw,580px)}.immersive-home .hero h1{font-size:clamp(2rem,10vw,2.6rem)}.hero-info{padding:.65rem 1rem}.nav-corners{padding:0 1rem}}
    @media(prefers-reduced-motion:reduce){.hero-background,.hero::before,.hero-character,.scroll-arrow,.site-nav.nav-topbar .nav-links a{animation:none!important;opacity:1;transform:none}}
  </style>
</head>
<body class="{{ site.font_class }} shell-{{ site.navigation_class }}{% if immersive_home %} immersive-home{% endif %}">
  {% if immersive_home %}<div class="nav-corners" id="nav-corners"><a class="brand" href="/">{{ site.title }}</a><div class="nav-actions">{% if site.show_search %}<a class="nav-action" href="/search" aria-label="搜索">⌕</a>{% endif %}<button class="nav-action" type="button" aria-label="菜单">☰</button></div></div>{% endif %}
  <nav id="site-nav" class="site-nav nav-{{ site.navigation_class }} {{ site.navigation_options }}{% if immersive_home %}{% else %} nav-sticky{% endif %}" aria-label="主导航"><a class="brand" href="/">{{ site.title }}</a><div class="nav-links"><a href="/">首页</a><a href="/articles">文章</a><a href="/dynamics">动态</a><a href="/friends">友链</a>{% if site.show_search %}<a href="/search">搜索</a>{% endif %}<a href="/feed.xml">RSS</a></div></nav>
  <main><div class="page {{ site.page_width_class }}">{{ content|safe }}</div></main>
  <footer>{% if site.mail_enabled %}<form method="post" action="/subscriptions"><strong>订阅更新</strong> <input type="email" name="email" required maxlength="254" autocomplete="email" placeholder="you@example.com"> <label><input type="checkbox" name="articles" checked>文章</label><label><input type="checkbox" name="dynamics">动态</label><button>订阅</button></form>{% endif %}<p>© {{ site.owner_name }} · YukiLog</p></footer>
  <script>
    (() => {
      const nav = document.getElementById('site-nav');
      const corners = document.getElementById('nav-corners');
      if (!nav || !document.body.classList.contains('immersive-home')) return;
      const sync = () => {
        const pastHero = window.scrollY >= window.innerHeight - 50;
        nav.classList.toggle('nav-sticky', pastHero);
        if (pastHero) nav.classList.remove('nav-active');
        corners?.classList.toggle('hidden', pastHero);
      };
      document.addEventListener('pointermove', (event) => {
        if (window.scrollY >= window.innerHeight - 50) return;
        nav.classList.toggle('nav-active', event.clientY < 80);
      }, { passive: true });
      window.addEventListener('scroll', sync, { passive: true });
      sync();
    })();
  </script>
</body>
</html>"#,
    ext = "html"
)]
struct PageTemplate<'a> {
    site: &'a SiteView,
    page_title: &'a str,
    content: &'a str,
    immersive_home: bool,
}

#[derive(Template)]
#[template(
    source = r#"<header class="masthead"><h1>{{ title }}</h1><p>{{ lead }}</p></header>"#,
    ext = "html"
)]
struct MastheadTemplate<'a> {
    title: &'a str,
    lead: &'a str,
}

#[derive(Template)]
#[template(
    source = r#"<aside class="profile">{% if avatar_url != "" %}<img class="avatar" src="{{ avatar_url }}" alt="">{% endif %}<h2>{{ name }}</h2><p>{{ bio }}</p></aside>"#,
    ext = "html"
)]
struct ProfileTemplate<'a> {
    name: &'a str,
    bio: &'a str,
    avatar_url: &'a str,
}

#[derive(Template)]
#[template(
    source = r#"<section class="article-feed feed-{{ variant }}">{% for article in articles %}<article class="article">{% if show_cover && article.cover_url != "" %}<img class="article-cover" src="{{ article.cover_url }}" alt="">{% endif %}<div class="article-copy"><div class="meta">{% if show_date %}<a href="/articles?year={{ article.published_year }}"><time>{{ article.published }}</time></a>{% endif %}{% if show_category %}<a class="pill" href="/articles?category={{ article.category_slug }}">{{ article.category }}</a>{% endif %}</div><h2><a href="/articles/{{ article.slug }}">{{ article.title }}</a></h2>{% if show_summary %}<p>{{ article.summary }}</p>{% endif %}<div class="meta">{% if show_tags %}{% for tag in article.tags %}<a href="/articles?tag={{ tag.slug }}">#{{ tag.name }}</a>{% endfor %}{% endif %}{% if show_views %}<span>{{ article.views }} 阅读</span>{% endif %}{% if show_likes %}<span>{{ article.likes }} 喜欢</span>{% endif %}</div></div></article>{% endfor %}{% if articles.is_empty() %}<p class="empty">这里还没有公开文章。</p>{% endif %}</section>"#,
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

#[derive(Template)]
#[template(
    source = r#"<section class="dynamics">{% for item in dynamics %}<article class="dynamic-card" id="dynamic-{{ item.id }}"><div class="meta"><time>{{ item.published }}</time></div><div class="prose">{{ item.content_html|safe }}</div></article>{% endfor %}{% if dynamics.is_empty() %}<p class="empty">这里还没有公开动态。</p>{% endif %}</section>"#,
    ext = "html"
)]
struct DynamicListTemplate<'a> {
    dynamics: &'a [DynamicCard],
}

#[derive(Template)]
#[template(
    source = r#"<article><header class="masthead"><p class="pill">{{ category }}</p><h1>{{ title }}</h1><div class="meta"><time>{{ published }}</time><span>{{ views }} 阅读</span><span>{{ likes }} 喜欢</span></div></header>{% if cover_url != "" %}<img class="article-cover" src="{{ cover_url }}" alt="">{% endif %}<div class="prose">{{ body_html|safe }}</div></article><section class="comments"><h2>评论</h2>{% for comment in comments %}<article class="comment"><div class="meta"><strong>{{ comment.display_name }}</strong><time>{{ comment.created }}</time></div><p>{{ comment.content }}</p>{% if comment.website != "" %}<a class="pill" href="{{ comment.website }}" rel="ugc nofollow noopener">个人网站</a>{% endif %}</article>{% endfor %}{% if comments.is_empty() %}<p class="empty">暂时还没有评论。</p>{% endif %}</section>"#,
    ext = "html"
)]
struct ArticleDetailTemplate<'a> {
    title: &'a str,
    category: &'a str,
    published: &'a str,
    cover_url: &'a str,
    body_html: &'a str,
    views: i64,
    likes: i64,
    comments: &'a [CommentCard],
}

#[derive(Template)]
#[template(
    source = r#"<header class="masthead"><h1>友链</h1><p>一些值得穿过互联网去拜访的地方。</p></header><section class="friends">{% for friend in friends %}<a class="friend-card" href="{{ friend.url }}" rel="friend noopener">{% if friend.avatar_url != "" %}<img class="avatar" src="{{ friend.avatar_url }}" alt="">{% endif %}<span><strong>{{ friend.name }}</strong><br>{{ friend.description }}</span></a>{% endfor %}{% if friends.is_empty() %}<p class="empty">暂时还没有公开友链。</p>{% endif %}</section>"#,
    ext = "html"
)]
struct FriendListTemplate<'a> {
    friends: &'a [FriendCard],
}

pub async fn home(State(state): State<AppState>) -> Result<Html<String>, AppError> {
    let site = load_site(&state).await?;
    let layout = load_layout(&state, "home").await?;
    let articles = load_articles(
        &state,
        HOME_ARTICLE_LIMIT,
        0,
        None,
        &ArticleFilter::default(),
    )
    .await?;
    let dynamics = load_dynamics(&state, HOME_DYNAMIC_LIMIT).await?;
    let media_urls = load_layout_media(&state, &layout.root).await?;
    let home_content_id = layout
        .root
        .children
        .iter()
        .find(|node| !matches!(node.component_type, ComponentType::Hero))
        .map(|node| node.id.as_str())
        .unwrap_or(layout.root.id.as_str());
    let content = render_node(
        &layout.root,
        &RenderContext {
            site: &site,
            articles: &articles,
            dynamics: &dynamics,
            media_urls: &media_urls,
            home_content_id,
        },
    )?;
    page(&site, "首页", &content)
}

#[derive(Debug, Default, Deserialize)]
pub struct ArticleListQuery {
    tag: Option<String>,
    category: Option<String>,
    year: Option<i32>,
    #[serde(default = "first_page")]
    page: u64,
}

pub async fn article_list(
    State(state): State<AppState>,
    Query(query): Query<ArticleListQuery>,
) -> Result<Html<String>, AppError> {
    let site = load_site(&state).await?;
    let page_number = query.page.clamp(1, 10_000);
    let filter = resolve_article_filter(&state, &query).await?;
    let mut articles = load_articles(
        &state,
        ARTICLE_PAGE_SIZE + 1,
        (page_number - 1) * ARTICLE_PAGE_SIZE,
        None,
        &filter,
    )
    .await?;
    let has_next = articles.len() as u64 > ARTICLE_PAGE_SIZE;
    articles.truncate(ARTICLE_PAGE_SIZE as usize);
    let content = ArticleFeedTemplate {
        articles: &articles,
        variant: "editorial",
        show_cover: true,
        show_summary: true,
        show_date: true,
        show_category: true,
        show_tags: true,
        show_views: true,
        show_likes: true,
    }
    .render()
    .map_err(|_| AppError::Internal("render article list"))?;
    let pagination = pagination_html(&query, page_number, has_next);
    page(&site, "文章", &format!("{content}{pagination}"))
}

pub async fn article_detail(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Html<String>, AppError> {
    let site = load_site(&state).await?;
    let article = articles::Entity::find()
        .filter(articles::Column::Slug.eq(slug))
        .filter(articles::Column::Status.eq("published"))
        .filter(articles::Column::PublishedAt.lte(Utc::now().fixed_offset()))
        .one(&state.database)
        .await?
        .ok_or(AppError::NotFound)?;
    let category = categories::Entity::find_by_id(article.category_id)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotFound)?;
    let metrics = article_metrics::Entity::find_by_id(article.id)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotFound)?;
    let cover_url = media_url(&state, article.cover_media_id).await?;
    let comment_models = comments::Entity::find()
        .filter(comments::Column::ArticleId.eq(article.id))
        .filter(comments::Column::Status.eq("visible"))
        .order_by_asc(comments::Column::CreatedAt)
        .all(&state.database)
        .await?;
    let comment_cards = comment_models
        .into_iter()
        .map(|comment| CommentCard {
            display_name: comment.display_name,
            website: comment.website.unwrap_or_default(),
            content: comment.content,
            created: date(comment.created_at),
        })
        .collect::<Vec<_>>();
    let body_html = markdown::render(&article.body_markdown);
    let published = date(
        article
            .published_at
            .expect("published article has timestamp"),
    );
    let content = ArticleDetailTemplate {
        title: &article.title,
        category: &category.name,
        published: &published,
        cover_url: &cover_url,
        body_html: &body_html,
        views: metrics.view_count,
        likes: metrics.like_count,
        comments: &comment_cards,
    }
    .render()
    .map_err(|_| AppError::Internal("render article"))?;
    page(&site, &article.title, &content)
}

pub async fn dynamic_list(State(state): State<AppState>) -> Result<Html<String>, AppError> {
    let site = load_site(&state).await?;
    let dynamics = load_dynamics(&state, ARTICLE_LIMIT).await?;
    let content = DynamicListTemplate {
        dynamics: &dynamics,
    }
    .render()
    .map_err(|_| AppError::Internal("render dynamics"))?;
    page(&site, "动态", &content)
}

pub async fn friend_list(State(state): State<AppState>) -> Result<Html<String>, AppError> {
    let site = load_site(&state).await?;
    let models = friend_links::Entity::find()
        .filter(friend_links::Column::IsVisible.eq(true))
        .order_by_asc(friend_links::Column::SortOrder)
        .order_by_asc(friend_links::Column::Name)
        .all(&state.database)
        .await?;
    let mut friends = Vec::with_capacity(models.len());
    for model in models {
        friends.push(FriendCard {
            name: model.name,
            url: model.url,
            description: model.description.unwrap_or_default(),
            avatar_url: media_url(&state, model.avatar_media_id).await?,
        });
    }
    let content = FriendListTemplate { friends: &friends }
        .render()
        .map_err(|_| AppError::Internal("render friend links"))?;
    page(&site, "友链", &content)
}

#[derive(Deserialize)]
pub struct SearchQuery {
    #[serde(default)]
    q: String,
}

pub async fn search(
    State(state): State<AppState>,
    Query(query): Query<SearchQuery>,
) -> Result<Html<String>, AppError> {
    let site = load_site(&state).await?;
    let term = query.q.trim();
    let articles = if term.is_empty() {
        Vec::new()
    } else {
        load_articles(
            &state,
            ARTICLE_LIMIT,
            0,
            Some(term),
            &ArticleFilter::default(),
        )
        .await?
    };
    let title = if term.is_empty() {
        "搜索".to_owned()
    } else {
        format!("搜索：{term}")
    };
    let feed = ArticleFeedTemplate {
        articles: &articles,
        variant: "compact",
        show_cover: false,
        show_summary: true,
        show_date: true,
        show_category: true,
        show_tags: true,
        show_views: false,
        show_likes: false,
    }
    .render()
    .map_err(|_| AppError::Internal("render search"))?;
    let content = format!(
        r#"<header class="masthead"><h1>{}</h1><form method="get"><input name="q" value="{}" maxlength="100" aria-label="搜索关键词"><button>搜索</button></form></header>{}"#,
        escape_html(&title),
        escape_html(term),
        feed
    );
    page(&site, "搜索", &content)
}

fn page(site: &SiteView, title: &str, content: &str) -> Result<Html<String>, AppError> {
    PageTemplate {
        site,
        page_title: title,
        content,
        immersive_home: title == "首页",
    }
    .render()
    .map(Html)
    .map_err(|_| AppError::Internal("render page"))
}

fn render_hero(node: &LayoutNode, context: &RenderContext<'_>) -> String {
    let title = text_prop(node, "title");
    let title_characters = title
        .chars()
        .enumerate()
        .map(|(index, character)| {
            format!(
                r#"<span class="hero-character" style="--char-index:{index}">{}</span>"#,
                escape_html(&character.to_string())
            )
        })
        .collect::<String>();
    let background_url = node
        .props
        .get("backgroundMediaId")
        .and_then(Value::as_str)
        .and_then(|id| context.media_urls.get(id))
        .map(String::as_str)
        .unwrap_or_default();
    let background = if background_url.is_empty() {
        String::new()
    } else {
        format!(
            r#"<div class="hero-background" role="img" aria-label="首页背景" style="background-image:url(&quot;{}&quot;);background-position:{}"></div>"#,
            escape_html(background_url),
            escape_html(text_prop_or(node, "backgroundPosition", "center"))
        )
    };
    let mut socials = String::new();
    if bool_prop(node, "showSocials") {
        for link in &context.site.social_links {
            socials.push_str(&format!(
                r#"<a href="{}" rel="me noopener">{}</a>"#,
                escape_html(&link.url),
                escape_html(&link.label)
            ));
        }
        if !socials.is_empty() {
            socials = format!(r#"<nav class="hero-socials">{socials}</nav>"#);
        }
    }
    let enter = if bool_prop(node, "showEnter") {
        format!(
            r##"<a class="scroll-arrow" href="#{}" aria-label="进入文章区域">⌄</a>"##,
            escape_html(context.home_content_id)
        )
    } else {
        String::new()
    };
    let media_class = if background_url.is_empty() {
        ""
    } else {
        " has-media"
    };

    format!(
        r#"<section id="{}" class="hero hero-{} overlay-{}{}">{background}<div class="hero-inner"><p class="hero-kicker">YukiLog · 写给时间的长信</p><h1>{title_characters}</h1><div class="hero-info"><p>{}</p>{socials}</div>{enter}</div></section>"#,
        escape_html(&node.id),
        escape_html(text_prop_or(node, "variant", "cinematic")),
        escape_html(text_prop_or(node, "overlay", "medium")),
        media_class,
        escape_html(text_prop(node, "lead")),
    )
}

fn render_node(node: &LayoutNode, context: &RenderContext<'_>) -> Result<String, AppError> {
    if node.component_type.accepts_children() {
        let mut children = String::new();
        for child in &node.children {
            children.push_str(&render_node(child, context)?);
        }
        let base = match node.component_type {
            ComponentType::Stack => "layout-stack",
            ComponentType::Grid => "layout-grid",
            ComponentType::Split => "layout-split",
            ComponentType::Bento => "layout-bento",
            ComponentType::Card => "layout-card",
            _ => unreachable!(),
        };
        let classes = layout_classes(node, base);
        return Ok(format!(
            r#"<section id="{}" class="{classes}">{children}</section>"#,
            escape_html(&node.id)
        ));
    }

    let rendered = match node.component_type {
        ComponentType::Hero => Ok(render_hero(node, context)),
        ComponentType::Masthead => MastheadTemplate {
            title: text_prop(node, "title"),
            lead: text_prop(node, "lead"),
        }
        .render(),
        ComponentType::Avatar => {
            let label = text_prop_or(node, "label", &context.site.owner_name);
            if text_prop_or(node, "source", "site-owner") == "site-owner"
                && !context.site.avatar_url.is_empty()
            {
                Ok(format!(
                    r#"<img class="primitive-avatar avatar-{} avatar-{}" src="{}" alt="{}">"#,
                    escape_html(text_prop_or(node, "size", "md")),
                    escape_html(text_prop_or(node, "shape", "circle")),
                    escape_html(&context.site.avatar_url),
                    escape_html(label)
                ))
            } else {
                Ok(format!(
                    r#"<div class="primitive-avatar avatar-{} avatar-{}" aria-label="{}">{}</div>"#,
                    escape_html(text_prop_or(node, "size", "md")),
                    escape_html(text_prop_or(node, "shape", "circle")),
                    escape_html(label),
                    escape_html(&label.chars().next().unwrap_or('雪').to_string())
                ))
            }
        }
        ComponentType::TextBlock => {
            let text = match text_prop_or(node, "source", "literal") {
                "owner-name" => &context.site.owner_name,
                "owner-bio" => &context.site.owner_bio,
                "site-title" => &context.site.title,
                "site-description" => &context.site.description,
                _ => text_prop(node, "text"),
            };
            Ok(format!(
                r#"<div class="primitive-text text-{} text-{}">{}</div>"#,
                escape_html(text_prop_or(node, "variant", "body")),
                escape_html(text_prop_or(node, "alignment", "left")),
                escape_html(text)
            ))
        }
        ComponentType::SocialLinks => {
            let mut links = String::new();
            for link in &context.site.social_links {
                links.push_str(&format!(
                    r#"<a href="{}" rel="me noopener">{}</a>"#,
                    escape_html(&link.url),
                    escape_html(&link.label)
                ));
            }
            Ok(format!(
                r#"<nav class="primitive-socials socials-{} text-{}">{links}</nav>"#,
                escape_html(text_prop_or(node, "variant", "labels")),
                escape_html(text_prop_or(node, "alignment", "left"))
            ))
        }
        ComponentType::StatusLine => Ok(format!(
            r#"<div class="primitive-status status-{}">{}</div>"#,
            escape_html(text_prop_or(node, "tone", "neutral")),
            escape_html(text_prop(node, "text"))
        )),
        ComponentType::ProfileCard => ProfileTemplate {
            name: &context.site.owner_name,
            bio: &context.site.owner_bio,
            avatar_url: &context.site.avatar_url,
        }
        .render(),
        ComponentType::ArticleFeed => {
            let fields = node
                .props
                .get("fields")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            let has = |field: &str| fields.iter().any(|value| value.as_str() == Some(field));
            ArticleFeedTemplate {
                articles: context.articles,
                variant: text_prop_or(node, "variant", "compact"),
                show_cover: has("cover"),
                show_summary: has("summary"),
                show_date: has("date"),
                show_category: has("category"),
                show_tags: has("tags"),
                show_views: has("views"),
                show_likes: has("likes"),
            }
            .render()
        }
        ComponentType::Quote => Ok(format!(
            r#"<blockquote class="quote">“{}”<footer>— {}</footer></blockquote>"#,
            escape_html(text_prop(node, "text")),
            escape_html(text_prop(node, "attribution"))
        )),
        ComponentType::Stats => Ok(format!(
            r#"<section class="stats"><strong>{}</strong> 篇文章 · <strong>{}</strong> 条动态</section>"#,
            context.articles.len(),
            context.dynamics.len()
        )),
        ComponentType::DynamicStrip => DynamicListTemplate {
            dynamics: context.dynamics,
        }
        .render(),
        _ => unreachable!(),
    }
    .map_err(|_| AppError::Internal("render component"))?;
    Ok(apply_placement(node, rendered))
}

async fn load_site(state: &AppState) -> Result<SiteView, AppError> {
    let model = site_settings::Entity::find_by_id(true)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotConfigured)?;
    let settings = SiteSettingsWrite {
        site_title: model.site_title,
        site_description: model.site_description,
        owner_name: model.owner_name,
        owner_bio: model.owner_bio,
        avatar_media_id: model.avatar_media_id,
        social_links: serde_json::from_value(model.social_links)
            .map_err(|_| AppError::Internal("decode social links"))?,
        theme: serde_json::from_value(model.theme)
            .map_err(|_| AppError::Internal("decode theme"))?,
        shell_layout: serde_json::from_value(model.shell_layout)
            .map_err(|_| AppError::Internal("decode shell layout"))?,
    };
    settings
        .validate()
        .map_err(|_| AppError::Internal("stored site settings failed validation"))?;
    let avatar_url = media_url(state, settings.avatar_media_id).await?;
    let navigation_class = match settings.shell_layout.navigation {
        NavigationVariant::Topbar => "topbar",
        NavigationVariant::Sidebar => "sidebar",
        NavigationVariant::FloatingDock => "floating-dock",
    };
    let navigation_options = match (
        settings.shell_layout.brand_position,
        settings.shell_layout.translucent,
    ) {
        (BrandPosition::Center, true) => "brand-center nav-translucent",
        (BrandPosition::Center, false) => "brand-center",
        (BrandPosition::Start, true) => "nav-translucent",
        (BrandPosition::Start, false) => "",
    };
    let page_width_class = match settings.shell_layout.max_width {
        ShellWidth::Content => "width-content",
        ShellWidth::Wide => "width-wide",
        ShellWidth::Full => "width-full",
    };
    let font_class = match settings.theme.typography.body {
        crate::content::settings::FontFamily::System => "font-system",
        crate::content::settings::FontFamily::Serif => "font-serif",
        crate::content::settings::FontFamily::Rounded => "font-rounded",
        crate::content::settings::FontFamily::Mono => "font-mono",
    };
    Ok(SiteView {
        title: settings.site_title,
        description: settings.site_description.unwrap_or_default(),
        owner_name: settings.owner_name,
        owner_bio: settings.owner_bio,
        avatar_url,
        social_links: settings.social_links,
        navigation_class,
        navigation_options,
        page_width_class,
        show_search: settings.shell_layout.show_search,
        mail_enabled: crate::subscriptions::mail_enabled(),
        font_class,
        background: settings.theme.colors.background,
        surface: settings.theme.colors.surface,
        surface_muted: settings.theme.colors.surface_muted,
        text: settings.theme.colors.text,
        text_muted: settings.theme.colors.text_muted,
        primary: settings.theme.colors.primary,
        secondary: settings.theme.colors.secondary,
        border: settings.theme.colors.border,
        radius: settings.theme.shape.radius,
        scale: settings.theme.typography.scale,
    })
}

async fn load_layout(state: &AppState, key: &str) -> Result<PageLayoutDocument, AppError> {
    let model = page_layouts::Entity::find_by_id(key)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotConfigured)?;
    let layout: PageLayoutDocument = serde_json::from_value(model.layout)
        .map_err(|_| AppError::Internal("decode page layout"))?;
    layout
        .validate()
        .map_err(|_| AppError::Internal("stored page layout failed validation"))?;
    Ok(layout)
}

async fn load_layout_media(
    state: &AppState,
    root: &LayoutNode,
) -> Result<HashMap<String, String>, AppError> {
    let mut ids = HashSet::new();
    collect_layout_media_ids(root, &mut ids);
    if ids.is_empty() {
        return Ok(HashMap::new());
    }
    let parsed = ids
        .iter()
        .filter_map(|id| Uuid::parse_str(id).ok())
        .collect::<Vec<_>>();
    let media = media_assets::Entity::find()
        .filter(media_assets::Column::Id.is_in(parsed))
        .all(&state.database)
        .await?;
    Ok(media
        .into_iter()
        .filter(|item| item.media_type.starts_with("image/"))
        .map(|item| (item.id.to_string(), format!("/media/{}", item.storage_key)))
        .collect())
}

fn collect_layout_media_ids(node: &LayoutNode, ids: &mut HashSet<String>) {
    if let Some(id) = node.props.get("backgroundMediaId").and_then(Value::as_str) {
        ids.insert(id.to_owned());
    }
    for child in &node.children {
        collect_layout_media_ids(child, ids);
    }
}

fn first_page() -> u64 {
    1
}

async fn resolve_article_filter(
    state: &AppState,
    query: &ArticleListQuery,
) -> Result<ArticleFilter, AppError> {
    let category_id = if let Some(slug) = query.category.as_deref() {
        validate_filter_slug(slug)?;
        Some(
            categories::Entity::find()
                .filter(categories::Column::Slug.eq(slug))
                .one(&state.database)
                .await?
                .map(|category| category.id)
                .unwrap_or(Uuid::nil()),
        )
    } else {
        None
    };
    let tag_id = if let Some(slug) = query.tag.as_deref() {
        validate_filter_slug(slug)?;
        Some(
            tags::Entity::find()
                .filter(tags::Column::Slug.eq(slug))
                .one(&state.database)
                .await?
                .map(|tag| tag.id)
                .unwrap_or(Uuid::nil()),
        )
    } else {
        None
    };
    let (published_from, published_before) = if let Some(year) = query.year {
        if !(1970..=9998).contains(&year) {
            return Err(AppError::InvalidRequest("归档年份无效"));
        }
        (
            Some(
                Utc.with_ymd_and_hms(year, 1, 1, 0, 0, 0)
                    .single()
                    .ok_or(AppError::InvalidRequest("归档年份无效"))?
                    .fixed_offset(),
            ),
            Some(
                Utc.with_ymd_and_hms(year + 1, 1, 1, 0, 0, 0)
                    .single()
                    .ok_or(AppError::InvalidRequest("归档年份无效"))?
                    .fixed_offset(),
            ),
        )
    } else {
        (None, None)
    };
    Ok(ArticleFilter {
        category_id,
        tag_id,
        published_from,
        published_before,
    })
}

fn validate_filter_slug(value: &str) -> Result<(), AppError> {
    let valid = !value.is_empty()
        && value.len() <= 80
        && value
            .split('-')
            .all(|part| !part.is_empty() && part.bytes().all(|byte| byte.is_ascii_alphanumeric()));
    if valid && value.bytes().all(|byte| !byte.is_ascii_uppercase()) {
        Ok(())
    } else {
        Err(AppError::InvalidRequest("筛选 slug 无效"))
    }
}

fn pagination_html(query: &ArticleListQuery, page: u64, has_next: bool) -> String {
    if page == 1 && !has_next {
        return String::new();
    }
    let mut links = String::from(r#"<nav class="meta" aria-label="文章分页">"#);
    if page > 1 {
        links.push_str(&format!(
            r#"<a href="{}">← 上一页</a>"#,
            escape_html(&article_list_url(query, page - 1))
        ));
    }
    if has_next {
        links.push_str(&format!(
            r#"<a href="{}">下一页 →</a>"#,
            escape_html(&article_list_url(query, page + 1))
        ));
    }
    links.push_str("</nav>");
    links
}

fn article_list_url(query: &ArticleListQuery, page: u64) -> String {
    let mut parameters = Vec::new();
    if let Some(tag) = &query.tag {
        parameters.push(format!("tag={tag}"));
    }
    if let Some(category) = &query.category {
        parameters.push(format!("category={category}"));
    }
    if let Some(year) = query.year {
        parameters.push(format!("year={year}"));
    }
    if page > 1 {
        parameters.push(format!("page={page}"));
    }
    if parameters.is_empty() {
        "/articles".to_owned()
    } else {
        format!("/articles?{}", parameters.join("&"))
    }
}

async fn load_articles(
    state: &AppState,
    limit: u64,
    offset: u64,
    search: Option<&str>,
    filter: &ArticleFilter,
) -> Result<Vec<ArticleCard>, AppError> {
    let mut query = articles::Entity::find()
        .filter(articles::Column::Status.eq("published"))
        .filter(articles::Column::PublishedAt.lte(Utc::now().fixed_offset()))
        .order_by_desc(articles::Column::PublishedAt)
        .offset(offset)
        .limit(limit);
    if let Some(category_id) = filter.category_id {
        query = query.filter(articles::Column::CategoryId.eq(category_id));
    }
    if let Some(tag_id) = filter.tag_id {
        let tag_articles = SeaQuery::select()
            .column(article_tags::Column::ArticleId)
            .from(article_tags::Entity)
            .and_where(Expr::col(article_tags::Column::TagId).eq(tag_id))
            .to_owned();
        query = query.filter(articles::Column::Id.in_subquery(tag_articles));
    }
    if let Some(from) = filter.published_from {
        query = query.filter(articles::Column::PublishedAt.gte(from));
    }
    if let Some(before) = filter.published_before {
        query = query.filter(articles::Column::PublishedAt.lt(before));
    }
    if let Some(search) = search {
        let pattern = format!("%{}%", search.replace('%', "\\%").replace('_', "\\_"));
        query = query.filter(
            Expr::col(articles::Column::Title)
                .like(&pattern)
                .or(Expr::col(articles::Column::Summary).like(&pattern))
                .or(Expr::col(articles::Column::BodyMarkdown).like(&pattern)),
        );
    }
    let models = query.all(&state.database).await?;
    let mut cards = Vec::with_capacity(models.len());
    for model in models {
        cards.push(article_card(state, model).await?);
    }
    Ok(cards)
}

async fn article_card(state: &AppState, article: articles::Model) -> Result<ArticleCard, AppError> {
    let category = categories::Entity::find_by_id(article.category_id)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotFound)?;
    let metrics = article_metrics::Entity::find_by_id(article.id)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotFound)?;
    let tag_links = article_tags::Entity::find()
        .filter(article_tags::Column::ArticleId.eq(article.id))
        .all(&state.database)
        .await?;
    let mut tag_cards = Vec::with_capacity(tag_links.len());
    for link in tag_links {
        if let Some(tag) = tags::Entity::find_by_id(link.tag_id)
            .one(&state.database)
            .await?
        {
            tag_cards.push(TagCard {
                name: tag.name,
                slug: tag.slug,
            });
        }
    }
    let cover_url = media_url(state, article.cover_media_id).await?;
    let published_at = article
        .published_at
        .expect("published article has timestamp");
    Ok(ArticleCard {
        title: article.title,
        slug: article.slug,
        summary: article.summary.unwrap_or_default(),
        category: category.name,
        category_slug: category.slug,
        tags: tag_cards,
        cover_url,
        published: date(published_at),
        published_year: published_at.year(),
        views: metrics.view_count,
        likes: metrics.like_count,
    })
}

async fn load_dynamics(state: &AppState, limit: u64) -> Result<Vec<DynamicCard>, AppError> {
    Ok(dynamics::Entity::find()
        .filter(dynamics::Column::Status.eq("published"))
        .filter(dynamics::Column::PublishedAt.lte(Utc::now().fixed_offset()))
        .order_by_desc(dynamics::Column::PublishedAt)
        .limit(limit)
        .all(&state.database)
        .await?
        .into_iter()
        .map(|item| DynamicCard {
            id: item.id,
            content_html: markdown::render(&item.content_markdown),
            published: date(item.published_at.expect("published dynamic has timestamp")),
        })
        .collect())
}

async fn media_url(state: &AppState, id: Option<Uuid>) -> Result<String, AppError> {
    let Some(id) = id else {
        return Ok(String::new());
    };
    Ok(media_assets::Entity::find_by_id(id)
        .one(&state.database)
        .await?
        .map(|media| format!("/media/{}", media.storage_key))
        .unwrap_or_default())
}

fn text_prop<'a>(node: &'a LayoutNode, name: &str) -> &'a str {
    text_prop_or(node, name, "")
}

fn text_prop_or<'a>(node: &'a LayoutNode, name: &str, default: &'a str) -> &'a str {
    node.props
        .get(name)
        .and_then(Value::as_str)
        .unwrap_or(default)
}

fn bool_prop(node: &LayoutNode, name: &str) -> bool {
    node.props
        .get(name)
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

fn layout_classes(node: &LayoutNode, base: &str) -> String {
    let mut classes = vec![base];
    if let Some(gap) = node.props.get("gap").and_then(Value::as_str) {
        classes.push(match gap {
            "none" => "gap-none",
            "sm" => "gap-sm",
            "md" => "gap-md",
            "lg" => "gap-lg",
            "xl" => "gap-xl",
            _ => "",
        });
    }
    if matches!(node.component_type, ComponentType::Grid)
        && node.props.get("columns").and_then(Value::as_str) == Some("280px minmax(0, 1fr)")
    {
        classes.push("grid-aside-first");
    }
    if matches!(node.component_type, ComponentType::Grid)
        && node.props.get("columns").and_then(Value::as_str) == Some("240px minmax(0, 1fr) 240px")
    {
        classes.push("grid-three-rail");
    }
    if matches!(node.component_type, ComponentType::Split)
        && node.props.get("side").and_then(Value::as_str) == Some("right")
    {
        classes.push("split-right");
    }
    if bool_prop(node, "sticky") {
        classes.push("is-sticky");
    }
    if matches!(node.component_type, ComponentType::Card) {
        classes.push(match text_prop_or(node, "variant", "plain") {
            "glass" => "card-glass",
            "outlined" => "card-outlined",
            "paper" => "card-paper",
            _ => "card-plain",
        });
        classes.push(match text_prop_or(node, "padding", "md") {
            "none" => "padding-none",
            "sm" => "padding-sm",
            "lg" => "padding-lg",
            "xl" => "padding-xl",
            _ => "padding-md",
        });
        classes.push(match text_prop_or(node, "radius", "md") {
            "none" => "radius-none",
            "sm" => "radius-sm",
            "lg" => "radius-lg",
            "pill" => "radius-pill",
            _ => "radius-md",
        });
        classes.push(match text_prop_or(node, "shadow", "none") {
            "soft" => "shadow-soft",
            "blue" => "shadow-blue",
            "pink" => "shadow-pink",
            _ => "shadow-none",
        });
        classes.push(match text_prop_or(node, "align", "stretch") {
            "start" => "align-start",
            "center" => "align-center",
            _ => "align-stretch",
        });
    }
    if let Some(area) = placement_class(node) {
        classes.push(area);
    }
    classes.join(" ")
}

fn apply_placement(node: &LayoutNode, rendered: String) -> String {
    if let Some(class) = placement_class(node) {
        format!(r#"<div class="{class}">{rendered}</div>"#)
    } else {
        rendered
    }
}

fn placement_class(node: &LayoutNode) -> Option<&'static str> {
    match node.props.get("area").and_then(Value::as_str) {
        Some("span 3 / span 7") => Some("area-3-7"),
        Some("span 4 / span 5") => Some("area-4-5"),
        Some("span 8 / span 5") => Some("area-8-5"),
        Some("span 9 / span 7") => Some("area-9-7"),
        _ => None,
    }
}

fn date(value: DateTime<FixedOffset>) -> String {
    value.format("%Y-%m-%d").to_string()
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn escapes_search_values() {
        assert_eq!(
            escape_html(r#"<script x="1">&"#),
            "&lt;script x=&quot;1&quot;&gt;&amp;"
        );
    }

    #[test]
    fn validates_filter_slugs() {
        assert!(validate_filter_slug("rust-notes").is_ok());
        assert!(validate_filter_slug("Rust").is_err());
        assert!(validate_filter_slug("rust--notes").is_err());
        assert!(validate_filter_slug("rust?next=evil").is_err());
    }

    #[test]
    fn pagination_preserves_filters() {
        let query = ArticleListQuery {
            tag: Some("rust".to_owned()),
            category: Some("technology".to_owned()),
            year: Some(2026),
            page: 1,
        };
        assert_eq!(
            article_list_url(&query, 3),
            "/articles?tag=rust&category=technology&year=2026&page=3"
        );
    }
}
