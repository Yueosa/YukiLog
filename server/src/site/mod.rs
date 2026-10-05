pub mod article;
mod components;
pub mod gateway;
pub mod home;
pub mod lists;

use std::collections::HashMap;

use askama::Template;
use axum::response::Html;
use chrono::{DateTime, Datelike, FixedOffset, Utc};
use sea_orm::{
    ColumnTrait, EntityTrait, JoinType, QueryFilter, QueryOrder, QuerySelect, RelationTrait,
    Select,
    prelude::Uuid,
    sea_query::{Expr, Query as SeaQuery},
};

use crate::{
    AppState,
    content::settings::{
        BrandPosition, NavigationVariant, ShellWidth, SiteSettingsWrite, SocialLink,
    },
    entities::{
        article_metrics, article_tags, articles, categories, comments, dynamic_media,
        dynamic_metrics, dynamics, media_assets, page_layouts, site_settings, tags,
    },
    error::AppError,
    layout::PageLayoutDocument,
    markup,
};

const ARTICLE_LIMIT: u64 = 48;
const ARTICLE_PAGE_SIZE: u64 = 12;
const HOME_ARTICLE_LIMIT: u64 = 12;
const HOME_DYNAMIC_LIMIT: u64 = 8;
const COVER_CLASSES: [&str; 6] = [
    "cover-one",
    "cover-two",
    "cover-three",
    "cover-four",
    "cover-five",
    "cover-six",
];

#[derive(Clone)]
struct SiteView {
    title: String,
    description: String,
    owner_name: String,
    owner_bio: String,
    avatar_url: String,
    masthead_url: String,
    hero_backgrounds: Vec<String>,
    hero_quote: String,
    favicon_url: String,
    origin: String,
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
    masthead_tint: u8,
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
    cover_class: String,
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

#[derive(Clone, Copy, PartialEq, Eq)]
enum ArticleSort {
    Featured,
    Popular,
    Recent,
}

impl ArticleSort {
    fn as_str(self) -> &'static str {
        match self {
            Self::Featured => "featured",
            Self::Popular => "popular",
            Self::Recent => "recent",
        }
    }

    fn masthead_title(self) -> &'static str {
        match self {
            Self::Featured => "精选文章",
            Self::Popular => "最热文章",
            Self::Recent => "最近文章",
        }
    }
}

struct DynamicCard {
    id: Uuid,
    content_html: String,
    mood: Option<String>,
    published: String,
    time_iso: String,
    rel: String,
    likes: i64,
    allow_comments: bool,
    media: Vec<DynamicMediaCard>,
    comments: Vec<MomentComment>,
    comment_count: usize,
    comments_html: String,
}

#[derive(Clone)]
struct DynamicMediaCard {
    url: String,
    alt: String,
    width: Option<i32>,
    height: Option<i32>,
}

struct MomentComment {
    avatar_url: String,
    fallback_svg: &'static str,
    display_name: String,
    website: String,
    agent_label: String,
    content: String,
    created: String,
    is_owner: bool,
    children: Vec<MomentComment>,
}

fn moment_comment_count(comments: &[MomentComment]) -> usize {
    comments
        .iter()
        .map(|comment| 1 + moment_comment_count(&comment.children))
        .sum()
}

fn moment_comments_html(comments: &[MomentComment]) -> String {
    let mut out = String::new();
    for comment in comments {
        push_moment_comment(&mut out, comment);
    }
    out
}

fn push_moment_comment(out: &mut String, comment: &MomentComment) {
    out.push_str(r#"<div class="m-comment">"#);
    if comment.avatar_url.is_empty() {
        out.push_str(r#"<span class="comment-avatar">"#);
        out.push_str(comment.fallback_svg);
        out.push_str("</span>");
    } else {
        out.push_str(r#"<span class="comment-avatar has-img"><img src=""#);
        out.push_str(&escape_html(&comment.avatar_url));
        out.push_str(
            r#"" alt="" loading="lazy" onerror="this.classList.add('is-broken')">"#,
        );
        out.push_str(comment.fallback_svg);
        out.push_str("</span>");
    }
    out.push_str(r#"<div class="m-comment-body"><div class="m-comment-line">"#);
    let owner_class = if comment.is_owner { " is-owner" } else { "" };
    if comment.website.is_empty() {
        out.push_str(&format!(
            r#"<span class="comment-name{owner_class}">{}</span>"#,
            escape_html(&comment.display_name)
        ));
    } else {
        out.push_str(&format!(
            r#"<a class="comment-name{owner_class}" href="{}" rel="ugc nofollow noopener">{}</a>"#,
            escape_html(&comment.website),
            escape_html(&comment.display_name)
        ));
    }
    if comment.is_owner {
        out.push_str(r#"<span class="comment-badge">作者</span>"#);
    }
    out.push_str(&format!("<time>{}</time></div>", escape_html(&comment.created)));
    out.push_str(&format!("<p>{}</p>", escape_html(&comment.content)));
    if !comment.agent_label.is_empty() {
        out.push_str(&format!(
            r#"<span class="m-comment-agent">{}</span>"#,
            escape_html(&comment.agent_label)
        ));
    }
    if !comment.children.is_empty() {
        out.push_str(r#"<div class="m-children">"#);
        for child in &comment.children {
            push_moment_comment(out, child);
        }
        out.push_str("</div>");
    }
    out.push_str("</div></div>");
}

#[derive(Clone, Copy, Default)]
struct HomeStats {
    articles: i64,
    dynamics: i64,
    friends: i64,
    views: i64,
}

#[derive(Template)]
#[template(
    source = r##"<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="{{ site.description }}">
  <link rel="canonical" href="{{ canonical_url }}">
  <meta property="og:title" content="{{ og_title }}">
  <meta property="og:description" content="{{ og_description }}">
  <meta property="og:type" content="{{ og_type }}">
  <meta property="og:url" content="{{ canonical_url }}">
  <meta property="og:site_name" content="{{ site.title }}">
  {% if og_image != "" %}<meta property="og:image" content="{{ og_image }}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="{{ og_image }}">
  {% else %}<meta name="twitter:card" content="summary">
  {% endif %}
  <meta name="twitter:title" content="{{ og_title }}">
  <meta name="twitter:description" content="{{ og_description }}">
  {% if json_ld != "" %}<script type="application/ld+json">{{ json_ld|safe }}</script>{% endif %}
  <link rel="alternate" type="application/rss+xml" title="{{ site.title }}" href="/feed.xml">
  {% if site.favicon_url != "" %}<link rel="icon" href="{{ site.favicon_url }}">{% endif %}
  <title data-away="唔, 不看我了吗...Ծ‸Ծ">{{ page_title }} · {{ site.title }}</title>
  <script>(()=>{const d=document.documentElement;try{if(window.sessionStorage.getItem('yukilog.splash'))return}catch{return}d.classList.add('splash-run','is-intro')})();</script>
  <style>
    :root{--page:{{ site.background }};--surface:{{ site.surface }};--surface-soft:#eef2f5;--ink:{{ site.text }};--muted:{{ site.text_muted }};--faint:#a7b5c2;--line:{{ site.border }};--primary:{{ site.primary }};--primary-d:#4a93c2;--secondary:{{ site.secondary }};--secondary-d:#d57f95;--radius:{{ site.radius }}px;--scale:{{ site.scale }};--masthead-tint:{{ site.masthead_tint }}%;--serif:'LXGW WenKai GB','Noto Serif SC','Songti SC',Georgia,serif;--mono:ui-monospace,'SFMono-Regular',Consolas,monospace}
    *{box-sizing:border-box}
    @view-transition{navigation:auto}
    ::view-transition-old(root),::view-transition-new(root){animation-duration:240ms;animation-timing-function:cubic-bezier(.22,.61,.36,1)}
    ::view-transition-old(root){animation-name:page-leave}
    ::view-transition-new(root){animation-name:page-enter}
    @keyframes page-leave{to{opacity:0;translate:0 -10px}}
    @keyframes page-enter{from{opacity:0;translate:0 14px}}
    body{margin:0;min-height:100dvh;background:var(--page);color:var(--ink);font-family:'Noto Sans CJK SC','Noto Sans CJK HK','PingFang SC','Microsoft YaHei',system-ui,sans-serif;font-size:calc(16px * var(--scale));line-height:1.75;scroll-behavior:smooth}
    body.font-serif{font-family:var(--serif)}
    body.font-rounded{font-family:ui-rounded,'Noto Sans SC',sans-serif}
    body.font-mono{font-family:var(--mono)}
    button,input{font:inherit}
    button{cursor:pointer}
    a{color:inherit;text-decoration:none}
    img{max-width:100%}
    .caps{font-size:11px;font-weight:600;letter-spacing:.26em;text-transform:uppercase}
    .site-nav{z-index:50}
    .nav-corners{position:fixed;z-index:51;top:0;right:0;left:0;display:grid;height:84px;align-items:center;grid-template-columns:1fr auto 1fr;padding:0 52px;color:rgb(238 243 248/92%);text-shadow:0 2px 12px rgb(0 0 0/28%);pointer-events:none;transition:opacity 380ms ease,translate 380ms cubic-bezier(.22,.61,.36,1),visibility 380ms}
    .nav-corners.hidden{opacity:0;visibility:hidden;translate:0 -10px}
    .nav-corners>*{pointer-events:auto}
    .nav-corners.hidden>*{pointer-events:none}
    .brand{flex-shrink:0;color:inherit;font-size:20px;font-weight:600;letter-spacing:.14em;white-space:nowrap}
    .nav-corners .brand{justify-self:start;text-transform:uppercase}
    .nav-links{display:flex;min-width:0;align-items:center;flex-wrap:nowrap;gap:4px}
    .nav-corners .nav-links{justify-self:center;gap:26px}
    .nav-corners .nav-actions{justify-self:end}
    .nav-corners .nav-item{padding:4px 0;color:rgb(238 243 248/80%);font-size:12px;font-weight:500;letter-spacing:.18em;transition:color 250ms ease}
    .nav-corners .nav-item:hover,.nav-corners .nav-item.active{color:#fff}
    .nav-corners .nav-icon{display:none}
    .nav-topbar{position:fixed;top:14px;left:50%;display:flex;width:auto;align-items:center;gap:2px;padding:6px;border:1px solid var(--line);border-radius:999px;background:rgb(255 255 255/92%);box-shadow:0 8px 28px rgb(28 39 51/10%);color:var(--ink);opacity:0;visibility:hidden;translate:-50% -12px;backdrop-filter:blur(12px);transition:opacity 380ms ease,translate 380ms cubic-bezier(.22,.61,.36,1),visibility 380ms}
    .nav-topbar.nav-sticky{opacity:1;visibility:visible;translate:-50% 0}
    .nav-topbar .brand{display:none}
    .nav-topbar .nav-item{display:flex;align-items:center;gap:6px;padding:8px 18px;border-radius:999px;color:var(--muted);font-size:13.5px;font-weight:500;white-space:nowrap;transition:color 250ms ease,background 250ms ease}
    .nav-topbar .nav-item:hover{color:var(--ink)}
    .nav-topbar .nav-item.active{background:var(--ink);color:#fff}
    .nav-topbar .nav-icon{display:none}
    .nav-actions{display:flex;align-items:center;gap:8px}
    .nav-inner-actions{display:flex}
    .nav-action{display:grid;width:32px;height:32px;padding:6px;place-items:center;border:0;border-radius:16px;background:transparent;color:inherit;transition:color 200ms ease,background 200ms ease}
    .nav-action:hover{background:var(--surface-soft);color:var(--primary-d)}
    .nav-corners .nav-action:hover{background:rgb(255 255 255/14%);color:#fff}
    .nav-icon{display:flex;width:20px;height:20px;flex:0 0 20px;align-items:center;justify-content:center}
    .nav-icon svg,.nav-action svg,.enter-button svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    .social-icon svg{width:20px;height:20px;fill:currentColor;stroke:none;transition:transform 300ms cubic-bezier(.22,.61,.36,1)}
    .nav-label{line-height:1}
    .nav-hamburger{display:none}
    .mobile-menu-overlay{position:fixed;z-index:220;inset:0;display:flex;align-items:flex-end;background:rgb(0 0 0/45%);backdrop-filter:blur(6px)}
    .mobile-menu-overlay[hidden]{display:none}
    .mobile-menu{width:100%;padding:24px 32px calc(48px + env(safe-area-inset-bottom));border-radius:28px 28px 0 0;background:var(--surface);color:var(--ink);box-shadow:0 -8px 32px rgb(0 0 0/16%);animation:mobile-menu-up 280ms cubic-bezier(.22,.61,.36,1) both}
    @keyframes mobile-menu-up{from{transform:translateY(48px);opacity:0}to{transform:translateY(0);opacity:1}}
    .mobile-menu-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid var(--line);font-size:20px}
    .mobile-menu-nav{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    .mobile-nav-item{display:flex;min-height:88px;align-items:center;justify-content:center;flex-direction:column;gap:8px;border:1px solid var(--line);border-radius:20px;background:var(--page);color:var(--ink);font-size:14px;font-weight:500}
    .mobile-menu-nav .nav-icon{display:flex}
    .mobile-nav-item:hover{border-color:var(--primary);background:var(--surface);color:var(--primary-d)}
    .mobile-nav-item.active{border-color:var(--secondary);background:var(--surface);color:var(--secondary-d)}
    .nav-sidebar{position:fixed;top:0;bottom:0;left:0;display:flex;width:238px;flex-direction:column;padding:100px 30px 36px;border-right:1px solid var(--line);background:color-mix(in srgb,var(--surface) 94%,transparent)}
    .nav-sidebar .nav-links{align-items:stretch;flex-direction:column;margin-top:48px}
    .nav-sidebar .nav-links a{padding:8px 4px;border-radius:4px;transition:padding 180ms ease,color 180ms ease}
    .nav-sidebar .nav-links a:hover{padding-left:18px;color:var(--secondary-d)}
    .shell-sidebar main{margin-left:238px}
    .nav-dock,.nav-floating-dock{position:fixed;bottom:22px;left:50%;display:flex;align-items:center;gap:5px;padding:8px 10px;transform:translateX(-50%);border:1px solid var(--line);border-radius:18px;background:rgb(23 29 39/82%);color:#eff3f8;box-shadow:0 18px 50px rgb(0 0 0/34%);backdrop-filter:blur(18px);transition:transform 200ms ease}
    .nav-dock .brand,.nav-floating-dock .brand{padding:0 12px;color:var(--primary)}
    .nav-dock .nav-links a,.nav-floating-dock .nav-links a{display:grid;width:40px;height:40px;place-items:center;padding:8px;font-size:0;transition:background 160ms ease,transform 160ms ease}
    .nav-dock .nav-links a::first-letter,.nav-floating-dock .nav-links a::first-letter{font-size:14px}
    .nav-dock .nav-links a:hover,.nav-floating-dock .nav-links a:hover{background:var(--surface-soft);transform:translateY(-5px)}
    html.reveal-ready [data-reveal]{opacity:0;translate:0 26px;transition:opacity 700ms cubic-bezier(.22,.61,.36,1),translate 700ms cubic-bezier(.22,.61,.36,1)}
    html.reveal-ready [data-reveal].in{opacity:1;translate:0 0}
    .page{width:min(1180px,calc(100% - 64px));min-height:100dvh;margin:0 auto;padding:128px 0 96px}
    .page.width-content{max-width:880px}
    .page.width-full{max-width:none}
    body.immersive-home .page{width:100%;max-width:none;padding:0}
    .page-head{margin-bottom:52px;padding-bottom:36px;border-bottom:1px solid var(--line)}
    .page-head.center{text-align:center}
    .page-head .kicker{margin:0 0 16px;color:var(--secondary-d)}
    .page-head h1{margin:0;font-family:var(--serif);font-size:clamp(40px,5vw,58px);font-weight:700;line-height:1.15}
    .page-head .inner-lede{max-width:560px;margin:12px 0 0;color:var(--muted);font-size:15px;line-height:1.8}
    .page-head.center .inner-lede{margin-inline:auto}
    .archive-year{margin-bottom:44px}
    .archive-year>h2{display:flex;align-items:baseline;gap:14px;margin:0 0 6px;color:var(--faint);font-family:var(--serif);font-size:26px}
    .archive-year>h2 span{color:var(--faint);font-family:var(--mono);font-size:11px;letter-spacing:.2em}
    .archive-row{display:grid;grid-template-columns:104px minmax(0,1fr) auto;gap:22px;align-items:baseline;padding:19px 4px;border-bottom:1px solid var(--line);color:inherit;transition:translate 300ms cubic-bezier(.22,.61,.36,1)}
    .archive-row:hover{translate:8px 0}
    .archive-row time{color:var(--faint);font-family:var(--mono);font-size:12px}
    .archive-row h3{margin:0;font-family:var(--serif);font-size:19.5px;font-weight:700;line-height:1.5}
    .archive-row h3 span{background-image:linear-gradient(currentColor,currentColor);background-repeat:no-repeat;background-size:0 1.5px;background-position:0 97%;transition:background-size 400ms cubic-bezier(.22,.61,.36,1)}
    .archive-row:hover h3 span{background-size:100% 1.5px}
    .archive-row .meta{display:flex;gap:14px;color:var(--faint);font-size:12px}
    .archive-row .cat{font-weight:600}
    .cat-b{color:var(--primary-d)}
    .cat-p{color:var(--secondary-d)}
    .timeline{position:relative;max-width:720px;margin:0 auto}
    .timeline::before{position:absolute;top:8px;bottom:0;left:6px;width:1px;content:'';background:var(--line)}
    .moment{position:relative;padding:0 0 48px 34px}
    .moment::before{position:absolute;top:26px;left:2px;width:9px;height:9px;border-radius:50%;content:'';background:var(--primary);transition:background 300ms ease,scale 300ms ease;z-index:1}
    .moment:hover::before{background:var(--secondary);scale:1.4}
    .moment-card{padding:18px 20px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);transition:border-color 300ms ease,box-shadow 300ms ease}
    .moment:hover .moment-card{border-color:color-mix(in srgb,var(--primary) 40%,var(--line));box-shadow:0 14px 34px -22px rgb(28 39 51/35%)}
    .moment-head{display:flex;align-items:center;gap:12px}
    .moment-avatar{width:40px;height:40px}
    .moment-who{display:flex;flex-direction:column;gap:2px;min-width:0}
    .moment-author{color:var(--ink);font-size:15px;font-weight:700}
    .moment-who time{color:var(--faint);font-family:var(--mono);font-size:11px;letter-spacing:.08em;cursor:help}
    .moment-mood{margin-left:auto;flex:none;max-width:45%;overflow:hidden;padding:3px 12px;border-radius:999px;background:color-mix(in srgb,var(--secondary) 16%,var(--surface));color:var(--secondary-d);font-size:11.5px;text-overflow:ellipsis;white-space:nowrap}
    .moment-text{margin-top:10px;font-size:15px;line-height:1.9}
    .m-single{margin-top:12px;max-width:420px}
    .m-single img{display:block;width:100%;height:auto;border-radius:10px}
    .m-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:12px;max-width:420px}
    .m-grid.count-2,.m-grid.count-4{grid-template-columns:repeat(2,1fr);max-width:300px}
    .m-grid img{display:block;width:100%;aspect-ratio:1;border-radius:8px;object-fit:cover;transition:scale 420ms cubic-bezier(.22,.61,.36,1)}
    .m-grid img:hover{scale:1.04}
    .mfoot{display:flex;align-items:center;gap:12px;margin-top:12px;color:var(--faint);font-size:12px}
    .m-count{display:inline-flex;align-items:center;gap:6px;color:var(--faint);font-size:12px}
    .m-count svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8}
    .comment-badge{padding:1px 8px;border-radius:999px;background:color-mix(in srgb,var(--primary) 18%,var(--surface));color:var(--primary-d);font-size:10.5px;font-weight:600}
    .comment-name.is-owner{color:var(--primary-d)}
    .m-comments{margin-top:14px;padding:12px 14px;border-radius:12px;background:color-mix(in srgb,var(--ink) 4%,var(--page))}
    .m-comment{display:flex;gap:10px;padding:8px 0}
    .m-comment .comment-avatar{width:26px;height:26px}
    .m-comment-body{min-width:0;flex:1}
    .m-comment-line{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px}
    .m-comment-line .comment-name{font-size:13px}
    .m-comment-line time{color:var(--faint);font-family:var(--mono);font-size:11px}
    .m-comment p{margin:3px 0 0;font-size:13.5px;line-height:1.75;overflow-wrap:break-word}
    .m-comment-agent{display:block;margin-top:3px;color:var(--faint);font-family:var(--mono);font-size:10.5px}
    .m-children{margin-top:8px;padding:2px 0 2px 12px;border-left:2px solid var(--line)}
    .m-reply{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
    .m-reply input{box-sizing:border-box;min-width:0;padding:8px 12px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--ink);font-family:inherit;font-size:13px;transition:border-color 250ms ease,box-shadow 250ms ease}
    .m-reply input:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 18%,transparent)}
    .m-reply>input[name="content"]{flex:1}
    .m-reply-more{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;flex-basis:100%;order:3}
    .m-reply-more input{width:100%}
    .m-reply>button{flex:none;padding:0 16px;border:0;border-radius:999px;background:var(--ink);color:var(--page);font-size:12.5px;cursor:pointer;transition:background 250ms ease}
    .m-reply>button:hover{background:var(--primary-d)}
    .m-reply-note{flex-basis:100%;order:4;margin:2px 0 0;color:var(--faint);font-size:12px}
    .friends-grid{display:grid;grid-template-columns:1fr 1fr;gap:26px}
    .friend{display:flex;align-items:flex-start;gap:20px;padding:26px 28px;border:1px solid var(--line);border-radius:16px;background:var(--surface);color:inherit;transition:translate 350ms cubic-bezier(.22,.61,.36,1),box-shadow 350ms ease,border-color 350ms ease}
    .friend:hover{translate:0 -6px;border-color:transparent}
    .friend:nth-child(odd):hover{box-shadow:0 20px 40px -14px rgb(74 147 194/35%)}
    .friend:nth-child(even):hover{box-shadow:0 20px 40px -14px rgb(213 127 149/35%)}
    .friend-avatar{position:relative;display:grid;width:54px;height:54px;flex:0 0 54px;place-items:center;overflow:hidden;border-radius:50%;background:var(--cover);color:#fff;font-family:var(--serif);font-size:21px}
    .friend-avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:var(--cover)}
    .friend h3{margin:0;font-family:var(--serif);font-size:19px}
    .friend .furl{display:block;margin:2px 0 8px;color:var(--primary-d);font-family:var(--mono);font-size:11px;letter-spacing:.08em}
    .friend p{margin:0;color:var(--muted);font-size:13.5px;line-height:1.8}
    .friend-apply{margin-top:40px;padding:34px 36px;border:1px solid var(--line);border-radius:16px;background:var(--surface)}
    .friend-apply .kicker{margin:0 0 10px;color:var(--secondary-d)}
    .friend-apply h2{margin:0;font-family:var(--serif);font-size:24px}
    .friend-apply-lede{margin:8px 0 22px;color:var(--muted);font-size:14px;line-height:1.8}
    .friend-apply-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
    .friend-apply label{display:flex;flex-direction:column;gap:7px;color:var(--faint);font-family:var(--mono);font-size:11px;letter-spacing:.12em}
    .friend-apply input,.friend-apply textarea{box-sizing:border-box;width:100%;padding:10px 14px;border:1px solid var(--line);border-radius:10px;background:transparent;color:var(--ink);font-family:inherit;font-size:14px;transition:border-color 250ms ease,box-shadow 250ms ease}
    .friend-apply input:focus,.friend-apply textarea:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 18%,transparent)}
    .friend-apply textarea{resize:vertical;line-height:1.8}
    .friend-apply-desc{margin-bottom:16px}
    .friend-apply-foot{display:flex;align-items:center;justify-content:space-between;gap:16px}
    .friend-apply-note{margin:0;color:var(--faint);font-size:12.5px}
    .friend-apply-note.ok{color:var(--primary-d)}
    .friend-apply button{flex:none;padding:10px 26px;border:0;border-radius:999px;background:var(--ink);color:var(--page);font-size:13.5px;letter-spacing:.08em;cursor:pointer;transition:background 250ms ease,transform 250ms ease}
    .friend-apply button:hover{background:var(--primary-d);transform:translateY(-1px)}
    .friend-apply button:disabled{opacity:.6;cursor:default;transform:none}
    .search-box{display:flex;max-width:680px;align-items:center;gap:12px;margin:0 auto;padding:6px 8px 6px 26px;border:1px solid var(--line);border-radius:999px;background:var(--surface);transition:border-color 300ms ease,box-shadow 300ms ease}
    .search-box:focus-within{border-color:var(--primary);box-shadow:0 12px 32px -12px rgb(74 147 194/40%)}
    .search-box input{min-width:0;flex:1;padding:12px 0;border:0;outline:0;background:none;color:var(--ink);font-family:var(--serif);font-size:17px}
    .search-box input::placeholder{color:var(--faint)}
    .search-box button{padding:11px 22px;border:0;border-radius:999px;background:var(--ink);color:#fff;font-size:13px;letter-spacing:.1em;transition:background 250ms ease}
    .search-box button:hover{background:var(--primary-d)}
    .search-hint{margin:12px 0 0;color:var(--faint);font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-align:center}
    .filter-bar{display:flex;justify-content:center;flex-wrap:wrap;gap:10px;margin:26px 0 0}
    .filter-chip{padding:6px 15px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:12.5px;transition:color 250ms ease,border-color 250ms ease}
    .filter-chip:hover{border-color:var(--primary);color:var(--primary-d)}
    .filter-chip.on{border-color:var(--ink);background:var(--ink);color:#fff}
    .results{max-width:760px;margin:52px auto 0}
    .results .cap{margin:0 0 8px;color:var(--faint);font-size:12px;letter-spacing:.18em}
    .result{display:block;padding:22px 4px;border-bottom:1px solid var(--line);color:inherit;transition:translate 300ms cubic-bezier(.22,.61,.36,1)}
    .result:hover{translate:6px 0}
    .result .meta{display:flex;gap:12px;margin-bottom:6px;color:var(--faint);font-size:12px}
    .result .meta .cat{color:var(--primary-d);font-weight:600}
    .result h3{margin:0;font-family:var(--serif);font-size:20px;font-weight:700}
    .result p{margin:6px 0 0;color:var(--muted);font-size:14px;line-height:1.85}
    .result mark{padding:0 2px;border-radius:2px;background:rgb(232 164 180/40%);color:inherit}
    .article-page{position:relative;width:min(760px,100%);margin:0 auto}
    .post-back{display:inline-block;margin-bottom:28px;color:var(--muted);font-size:13px;transition:color 250ms ease}
    .post-back:hover{color:var(--primary-d)}
    .post-head{margin-bottom:36px}
    .post-cover{width:100%;margin:0 0 32px;border-radius:14px;background:var(--surface-soft) center/cover no-repeat;aspect-ratio:16/10}
    .article-page h1{margin:0 0 12px;font-family:var(--serif);font-size:clamp(30px,4.4vw,42px);font-weight:700;line-height:1.3}
    .post-meta{display:flex;flex-wrap:wrap;gap:10px;margin:0;color:var(--faint);font-family:var(--mono);font-size:12px;letter-spacing:.06em}
    .post-summary{margin:14px 0 0;color:var(--muted);font-size:15.5px;line-height:1.9}
    .post-toc{display:none}
    .post-toc-mobile{margin:0 0 28px;padding:14px 18px;border:1px solid var(--line);border-radius:12px;background:var(--surface)}
    .post-toc-mobile summary{color:var(--muted);font-family:var(--mono);font-size:12px;letter-spacing:.14em;cursor:pointer}
    .post-toc-mobile .post-toc-item{margin-top:10px}
    .post-toc-kicker{margin:0 0 14px;color:var(--faint);font-family:var(--mono);font-size:10px;letter-spacing:.26em;text-transform:uppercase}
    .post-toc-item{display:block;padding:6px 0;color:var(--muted);font-family:var(--mono);font-size:12px;line-height:1.85;transition:color 200ms ease}
    .post-toc-item:hover{color:var(--primary-d)}
    .post-toc-item.level-2{padding-left:12px}
    .post-toc-item.level-3{padding-left:24px}
    .post-toc-item.is-active{color:var(--primary-d)}
    @media(min-width:1280px){
      .post-toc{position:absolute;top:0;right:calc(100% + 56px);display:block;width:220px;height:100%}
      .post-toc-sticky{position:sticky;top:110px;max-height:calc(100dvh - 140px);overflow-y:auto;padding-right:8px;padding-left:16px;border-left:1px solid var(--line);scrollbar-width:thin;scrollbar-color:transparent transparent}
      .post-toc-sticky:hover{scrollbar-color:rgb(28 39 51/22%) transparent}
      .post-toc-sticky::-webkit-scrollbar{width:5px}
      .post-toc-sticky::-webkit-scrollbar-track{background:transparent}
      .post-toc-sticky::-webkit-scrollbar-thumb{border-radius:3px;background:transparent}
      .post-toc-sticky:hover::-webkit-scrollbar-thumb{background:rgb(28 39 51/20%)}
      .post-toc-sticky::-webkit-scrollbar-thumb:hover{background:rgb(28 39 51/34%)}
      .post-toc-mobile{display:none}
    }
    .article-page .prose{margin-top:32px;font-size:16.5px;line-height:2}
    .layout-stack{display:flex;flex-direction:column;gap:var(--node-gap,0)}
    .gap-none{--node-gap:0;gap:0}
    .gap-sm{--node-gap:10px;gap:10px}
    .gap-md{--node-gap:18px;gap:18px}
    .gap-lg{--node-gap:32px;gap:32px}
    .gap-xl{--node-gap:54px;gap:54px}
    .align-start{align-items:start}
    .align-center{align-items:center}
    .align-stretch{align-items:stretch}
    .is-sticky{position:sticky;top:92px;align-self:start}
    .layout-grid{display:grid;width:min(1120px,calc(100% - 48px));grid-template-columns:minmax(0,1fr) 280px;gap:56px;margin:0 auto;padding:130px 0 120px}
    .layout-grid.grid-aside-first{grid-template-columns:280px minmax(0,1fr)}
    .layout-grid.grid-identity{width:min(1180px,calc(100% - 64px));grid-template-columns:auto minmax(0,1fr) auto;gap:40px;align-items:center;padding:44px 0;border-bottom:1px solid var(--line);scroll-margin-top:88px}
    .grid-identity .primitive-avatar{width:76px;height:76px;border-radius:50%;object-fit:cover;transition:box-shadow 350ms ease}
    .grid-identity .primitive-avatar:hover{box-shadow:0 0 0 4px var(--page),0 0 0 6px var(--primary)}
    .grid-identity .layout-stack{gap:4px}
    .grid-identity .text-heading{font-family:var(--serif);font-size:24px;font-weight:700}
    .grid-identity .text-body{color:var(--muted);font-size:14px}
    .grid-identity .text-caption{color:var(--secondary-d);font-size:11px;letter-spacing:.14em}
    .grid-identity .profile-log{padding:0;border:0;background:none;text-align:right}
    .layout-grid.grid-feed-rail{width:min(1180px,calc(100% - 64px));grid-template-columns:minmax(0,1fr) 300px;gap:64px;align-items:start;padding:72px 0 96px}
    .layout-split{display:grid;grid-template-columns:270px minmax(0,1fr);gap:48px}
    .layout-split.split-right{grid-template-columns:minmax(0,1fr) 270px}
    .layout-bento{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:20px}
    .area-3-7{grid-area:span 3/span 7}
    .area-4-5{grid-area:span 4/span 5}
    .area-8-5{grid-area:span 8/span 5}
    .area-9-7{grid-area:span 9/span 7}
    .layout-grid.grid-three-rail{width:min(1760px,calc(100% - 3rem));grid-template-columns:minmax(260px,320px) minmax(640px,1fr) minmax(260px,320px);justify-content:center}
    .layout-card{display:flex;min-width:0;flex-direction:column;gap:1rem;border:1px solid var(--line);background:var(--surface);color:var(--ink)}
    .card-glass{background:color-mix(in srgb,var(--surface) 82%,transparent);backdrop-filter:blur(18px)}
    .card-outlined{border-width:2px;background:transparent}
    .card-paper{border-radius:2px;background:var(--surface)}
    .padding-none{padding:0}
    .padding-sm{padding:.75rem}
    .padding-md{padding:1.25rem}
    .padding-lg{padding:1.75rem}
    .padding-xl{padding:2.5rem}
    .radius-none{border-radius:0}
    .radius-sm{border-radius:8px}
    .radius-md{border-radius:16px}
    .radius-lg{border-radius:24px}
    .radius-pill{border-radius:999px}
    .shadow-none{box-shadow:none}
    .shadow-soft{box-shadow:0 18px 48px rgb(38 57 78/.1)}
    .shadow-blue{box-shadow:-7px 9px 0 color-mix(in srgb,var(--primary) 14%,transparent)}
    .shadow-pink{box-shadow:7px 9px 0 color-mix(in srgb,var(--secondary) 15%,transparent)}
    .primitive-avatar{display:grid;flex:0 0 auto;place-items:center;object-fit:cover;background:linear-gradient(145deg,var(--secondary),var(--primary));color:#fff}
    .avatar-sm{width:44px;height:44px}
    .avatar-md{width:64px;height:64px}
    .avatar-lg{width:88px;height:88px}
    .avatar-xl{width:104px;height:104px}
    .avatar-circle{border-radius:50%}
    .avatar-rounded{border-radius:20px}
    .avatar-square{border-radius:0}
    .primitive-text{width:100%}
    .text-eyebrow{color:var(--secondary);font-size:.7rem;font-weight:700;letter-spacing:.2em}
    .text-heading{color:var(--secondary);font-size:1.5rem;font-weight:700}
    .text-body,.text-caption{color:var(--muted)}
    .text-caption{font-size:.75rem}
    .text-left{text-align:left}
    .text-center{text-align:center}
    .text-right{text-align:right}
    .primitive-socials{display:flex;width:100%;flex-wrap:wrap;gap:.5rem}
    .primitive-socials a{color:var(--primary);font-size:.8rem}
    .socials-labels{flex-direction:column}
    .socials-labels a{padding:.5rem .65rem;border-radius:9px;background:var(--surface-soft)}
    .socials-pills a,.socials-icons a{padding:.45rem .7rem;border:1px solid var(--line);border-radius:999px}
    .primitive-status{width:100%;margin:0;padding:.65rem .75rem;border-radius:9px;background:var(--surface-soft);color:var(--muted);font-family:var(--mono);font-size:.7rem;line-height:1.5;white-space:pre-line}
    .status-online{color:#35835c}
    .status-accent{color:var(--secondary)}
    .profile-log{margin:0;color:var(--muted);font-family:var(--mono);font-size:11.5px;line-height:1.9;white-space:pre-line}
    .hero{position:relative;display:grid;min-height:100svh;place-items:center;overflow:hidden;isolation:isolate;background:radial-gradient(circle at 70% 18%,rgb(74 147 194/24%),transparent 46%),linear-gradient(180deg,#122539,#0e1d30);color:#eef3f8}
    .hero::before{position:absolute;z-index:-1;inset:0;content:'';background:linear-gradient(180deg,rgb(6 14 26/55%),rgb(6 14 26/18%) 45%,rgb(9 17 30/66%) 100%)}
    .hero::after{position:absolute;z-index:-1;right:0;bottom:0;left:0;height:16vh;content:'';background:linear-gradient(180deg,transparent,rgb(247 248 247/82%))}
    .hero-background{position:absolute;z-index:-2;top:-32%;left:0;width:100%;height:132%;background:center/cover no-repeat;will-change:transform}
    .hero:not(.has-media) .hero-background{display:none}
    .hero-inner{display:flex;width:min(680px,88vw);align-items:center;flex-direction:column;gap:5.5vh;text-align:center;will-change:transform,opacity}
    .hero-info{display:flex;width:100%;flex-direction:column}
    .component-kicker{margin:0;font-size:11px;font-weight:600;letter-spacing:.26em;text-transform:uppercase}
    .hero-inner>.component-kicker{color:rgb(238 243 248/72%)}
    .hero h1{margin:0;font-family:var(--serif);font-size:clamp(52px,7.5vw,96px);font-weight:700;letter-spacing:.02em;line-height:1.06;text-shadow:0 6px 40px rgb(0 0 0/50%)}
    .hero-character{display:inline-block;animation:hero-char-in 700ms cubic-bezier(.22,.61,.36,1) both;animation-delay:calc(var(--char-index) * 55ms)}
    .hero-character.accent{color:var(--secondary)}
    @keyframes hero-char-in{from{opacity:0;translate:0 22px}to{opacity:1;translate:0 0}}
    .hero-info,.enter-button{transition:opacity 800ms cubic-bezier(.22,.61,.36,1),translate 800ms cubic-bezier(.22,.61,.36,1)}
    .hero-info{transition-delay:.15s}
    .enter-button{transition-delay:.35s}
    html.is-intro .hero-character{animation-play-state:paused}
    html.is-intro .hero-info,html.is-intro .enter-button{opacity:0}
    html.is-intro .hero-info{translate:0 22px}
    html.is-intro .enter-button{translate:-50% 22px}
    .welcome-quote{display:flex;width:100%;align-items:center;flex-direction:column;gap:18px;padding:24px 36px 20px;border:1px solid rgb(255 255 255/8%);border-radius:24px;background:rgb(6 12 22/55%)}
    .quote-mark{display:none}
    .quote-text{font-family:var(--serif);font-size:17px;line-height:1.9;color:rgb(255 255 255/88%);text-align:center}
    .social-row{display:flex;align-items:center;justify-content:center;gap:18px}
    .social-icon{display:grid;width:34px;height:34px;place-items:center;border-radius:50%;transition:filter 300ms cubic-bezier(.22,.61,.36,1),transform 300ms cubic-bezier(.22,.61,.36,1)}
    .social-icon:hover{filter:brightness(1.35);transform:translateY(-2px)}
    .social-icon:hover svg{transform:scale(1.12)}
    .enter-button{position:absolute;bottom:32px;left:50%;display:flex;align-items:center;flex-direction:column;gap:8px;padding:0;border:0;background:none;color:rgb(238 243 248/66%);translate:-50%;filter:drop-shadow(0 2px 10px rgb(9 17 30/55%))}
    .enter-button span{font-size:10px;letter-spacing:.3em}
    .enter-button svg{width:30px;height:30px;animation:enter-bob 2.4s ease-in-out infinite}
    @keyframes enter-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(7px)}}
    .hero-compact .hero-inner,.hero-split .hero-inner{gap:18px}
    .masthead-minimal{display:flex;align-items:baseline;gap:20px;margin-bottom:44px}
    .masthead-minimal .kicker{margin:0;color:var(--secondary-d);font-family:var(--mono);font-size:12px;letter-spacing:.08em}
    .masthead-minimal h1{margin:0;font-family:var(--serif);font-size:32px;font-weight:700}
    .masthead-minimal .lead{margin:0 0 0 auto;color:var(--faint);font-size:12px}
    .masthead-editorial{margin-bottom:44px}
    .masthead-editorial .kicker{margin:0 0 12px;color:var(--secondary-d)}
    .masthead-editorial h1{margin:0;font-family:var(--serif);font-size:clamp(34px,4.6vw,48px)}
    .masthead-editorial .lead{margin:10px 0 0;color:var(--muted)}
    .page-head.has-bg,.masthead.has-bg{position:relative;isolation:isolate;overflow:hidden;padding:64px 44px;border:0;border-radius:20px}
    .masthead-bg{position:absolute;z-index:-2;inset:0;background:center/cover no-repeat}
    .page-head.has-bg::before,.masthead.has-bg::before{position:absolute;z-index:-1;inset:0;content:'';background:color-mix(in srgb,var(--page) var(--masthead-tint,58%),transparent)}
    .profile-card{width:min(100%,420px)}
    .profile-button{display:block;width:100%;padding:26px;border:1px solid var(--line);border-radius:16px;background:var(--surface);color:var(--ink);text-align:center}
    .profile-face{display:block}
    .profile-face .avatar{display:grid;width:64px;height:64px;margin:0 auto 12px;place-items:center;overflow:hidden;border-radius:50%;background:linear-gradient(150deg,#3d5a80,#7eb6d9 55%,#c9a0b4);color:#fff;font-family:var(--serif);font-size:24px}
    .profile-face .avatar img{width:100%;height:100%;object-fit:cover}
    .profile-face h2{margin:0 0 6px;font-family:var(--serif);font-size:20px}
    .profile-face p{margin:0;color:var(--muted);font-size:13.5px;line-height:1.8}
    .article-feed{min-width:0}
    .feed-alternating{display:flex;flex-direction:column;gap:56px}
    .feed-alternating .article{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:32px;align-items:center}
    .feed-alternating .article:nth-of-type(even){grid-template-columns:minmax(0,7fr) minmax(0,5fr)}
    .feed-alternating .article:nth-of-type(even) .article-cover{order:2}
    .feed-alternating .article:has(.is-portrait){grid-template-columns:minmax(0,4fr) minmax(0,8fr)}
    .feed-alternating .article:nth-of-type(even):has(.is-portrait){grid-template-columns:minmax(0,8fr) minmax(0,4fr)}
    .article-cover{display:block;overflow:hidden;border-radius:14px;background:var(--cover) center/cover no-repeat;aspect-ratio:16/10;transition:translate 450ms cubic-bezier(.22,.61,.36,1),box-shadow 450ms ease}
    .article-cover.is-portrait{aspect-ratio:3/4}
    .article:hover .article-cover{translate:0 -6px;box-shadow:0 22px 44px -14px rgb(74 147 194/38%)}
    .article:nth-of-type(even):hover .article-cover{box-shadow:0 22px 44px -14px rgb(213 127 149/38%)}
    .cover-one{--cover:linear-gradient(150deg,#3d5a80,#7eb6d9 55%,#c9a0b4)}
    .cover-two{--cover:linear-gradient(150deg,#1d2b4a,#45618f 60%,#7eb6d9)}
    .cover-three{--cover:linear-gradient(150deg,#5c4a72,#a17fa8 55%,#e8a4b4)}
    .cover-four{--cover:linear-gradient(150deg,#274c57,#3f7d8c 55%,#8fc7c9)}
    .cover-five{--cover:linear-gradient(150deg,#6b4a68,#b07fa0 55%,#e8c9b4)}
    .cover-six{--cover:linear-gradient(150deg,#2c3e50,#5f7d9c 55%,#a9c6de)}
    .article-copy{min-width:0}
    .article-copy .meta{display:flex;align-items:center;gap:12px;margin-bottom:12px;color:var(--faint);font-size:12px}
    .article-copy .meta .cat{color:var(--primary-d);font-weight:600;letter-spacing:.1em}
    .article:nth-of-type(even) .article-copy .meta .cat{color:var(--secondary-d)}
    .article-copy h3{margin:0;font-family:var(--serif);font-size:25px;font-weight:700;line-height:1.45}
    .article-copy h3 a{background-image:linear-gradient(currentColor,currentColor);background-repeat:no-repeat;background-size:0 1.5px;background-position:0 97%;transition:background-size 400ms cubic-bezier(.22,.61,.36,1)}
    .article-copy h3 a:hover{background-size:100% 1.5px}
    .article-copy .summary{margin:10px 0 0;color:var(--muted);font-size:14.5px;line-height:1.95}
    .article-copy .foot{display:flex;gap:16px;margin-top:14px;color:var(--faint);font-size:12px}
    .article-copy .foot .tags{display:flex;gap:10px;margin-right:auto}
    .article-copy .foot .tags a:hover{color:var(--primary-d)}
    .feed-editorial,.feed-cover-overlay,.feed-compact{display:grid;gap:24px}
    .stats-card,.quote-card,.dynamic-strip{display:block;margin:0;padding:18px 0 0;border-top:2px solid var(--ink);background:none}
    .stats-card>.component-kicker{display:block;margin-bottom:18px;color:var(--ink);font-size:12px;font-weight:700;letter-spacing:.22em}
    .dynamic-strip>.component-kicker{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;color:var(--ink);font-size:12px;font-weight:700;letter-spacing:.22em}
    .strip-more{display:grid;width:22px;height:22px;flex:0 0 22px;place-items:center;border:1px solid var(--line);border-radius:50%;color:var(--faint);font-size:15px;line-height:1;transition:color 250ms ease,border-color 250ms ease}
    .strip-more:hover{border-color:var(--primary);color:var(--primary-d)}
    .stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px 12px}
    .stat strong{display:block;font-family:var(--serif);font-size:26px;font-weight:700}
    .stat:nth-child(1) strong{color:var(--primary-d)}
    .stat:nth-child(2) strong{color:var(--secondary-d)}
    .stat span{color:var(--faint);font-size:11.5px}
    .quote-card{font-family:var(--serif);font-size:15.5px;line-height:2}
    .quote-card cite{display:block;margin-top:10px;color:var(--faint);font-family:var(--serif);font-size:12px;font-style:normal;text-align:right}
    .dynamic-item{display:block;padding:13px 0;border-bottom:1px dashed var(--line);color:var(--muted);font-size:13.5px;line-height:1.75;transition:color 250ms ease,translate 250ms ease}
    .dynamic-item:last-child{border-bottom:0}
    .dynamic-item:hover{color:var(--ink);translate:4px 0}
    .dynamic-item time{display:block;margin-bottom:2px;color:var(--faint);font-family:var(--mono);font-size:10.5px}
    .dynamic-item span p{margin:0}
    .site-footer{display:flex;justify-content:space-between;gap:16px;padding:44px;border-top:1px solid var(--line);color:var(--faint);font-size:12px;letter-spacing:.14em}
    .site-footer a:hover{color:var(--primary-d)}
    .subscribe{width:min(680px,calc(100% - 64px));margin:0 auto;padding:56px 0;text-align:center}
    .subscribe form{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:12px}
    .subscribe strong{font-family:var(--serif)}
    .subscribe input[type=email]{min-width:min(260px,100%);padding:10px 18px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--ink)}
    .subscribe label{display:flex;align-items:center;gap:4px;color:var(--muted);font-size:13px}
    .subscribe button{padding:10px 24px;border:0;border-radius:999px;background:var(--ink);color:#fff;letter-spacing:.08em}
    .subscribe button:hover{background:var(--primary-d)}
    .comments{width:min(760px,100%);margin:56px auto 0}
    .comments-head{display:flex;align-items:baseline;gap:14px;margin:0 0 8px}
    .comments-head h2{margin:0;font-family:var(--serif);font-size:22px}
    .comments-count{color:var(--faint);font-size:12px}
    .comment-list{list-style:none;margin:0;padding:0}
    .comment{padding:18px 0;border-bottom:1px solid var(--line)}
    .comment header{display:flex;align-items:center;gap:12px;margin-bottom:8px}
    .comment-who{display:flex;flex-direction:column;gap:3px;min-width:0}
    .comment-line{display:flex;align-items:baseline;gap:10px}
    .comment-meta{display:flex;flex-wrap:wrap;gap:12px;color:var(--faint);font-family:var(--mono);font-size:11px}
    .comment-site{color:var(--primary-d);transition:text-decoration-color 250ms ease}
    .comment-site:hover{text-decoration:underline;text-underline-offset:3px}
    .comment-name{color:var(--ink);font-size:14px;font-weight:700}
    a.comment-name{transition:color 250ms ease}
    a.comment-name:hover{color:var(--primary-d)}
    .comment time{color:var(--faint);font-family:var(--mono);font-size:11px}
    .comment p{margin:0;font-size:14.5px;line-height:1.9}
    .comment-avatar{display:inline-flex;flex:none;width:32px;height:32px;overflow:hidden;border-radius:50%}
    .comment-avatar svg,.comment-avatar img{width:100%;height:100%;object-fit:cover}
    .comment-avatar.has-img svg{display:none}
    .comment-avatar.has-img img.is-broken{display:none}
    .comment-avatar.has-img img.is-broken + svg{display:block}
    .comment-compose{display:flex;align-items:center;gap:12px;box-sizing:border-box;width:100%;margin-top:24px;padding:10px 18px 10px 10px;border:1px solid var(--line);border-radius:999px;background:transparent;color:var(--faint);font-size:13.5px;text-align:left;cursor:pointer;transition:border-color 250ms ease,color 250ms ease}
    .comment-compose:hover{border-color:var(--primary);color:var(--muted)}
    .comment-compose .comment-avatar{width:30px;height:30px}
    .comment-compose-hint{flex:1}
    .comment-compose svg:last-child{width:16px;height:16px}
    .comment-form{margin-top:30px}
    .comment-form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:14px}
    .comment-form label{display:flex;flex-direction:column;gap:7px;color:var(--faint);font-family:var(--mono);font-size:11px;letter-spacing:.12em}
    .comment-form input,.comment-form textarea{box-sizing:border-box;width:100%;padding:10px 14px;border:1px solid var(--line);border-radius:10px;background:transparent;color:var(--ink);font-family:inherit;font-size:14px;transition:border-color 250ms ease,box-shadow 250ms ease}
    .comment-form input:focus,.comment-form textarea:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 18%,transparent)}
    .comment-content{margin-bottom:16px}
    .comment-form textarea{min-height:110px;resize:vertical;line-height:1.8}
    .comment-form-foot{display:flex;align-items:center;justify-content:space-between;gap:16px}
    .comment-note{margin:0;color:var(--faint);font-size:12px}
    .comment-form button{padding:10px 26px;border:0;border-radius:999px;background:var(--ink);color:var(--page);font-size:13.5px;letter-spacing:.08em;cursor:pointer;transition:background 250ms ease,transform 250ms ease}
    .comment-form button:hover{background:var(--primary-d);transform:translateY(-1px)}
    .comment-form button:disabled{opacity:.6;cursor:default;transform:none}
    .comment-form-actions{display:flex;align-items:center;gap:14px}
    .comment-form button.comment-cancel{padding:10px 6px;border:0;background:transparent;color:var(--faint);font-size:13px;cursor:pointer;transition:color 250ms ease}
    .comment-form button.comment-cancel:hover{background:transparent;color:var(--ink);transform:none}
    .comment-form.is-open{animation:comment-form-in 320ms cubic-bezier(.22,.61,.36,1) both}
    @keyframes comment-form-in{from{opacity:0;translate:0 -8px}to{opacity:1;translate:0 0}}
    .comment-submitted{margin:12px 0 0;color:var(--primary-d);font-size:13px}
    .empty{padding:64px 0;text-align:center;color:var(--faint)}
    .pagination{display:flex;justify-content:center;gap:24px;margin-top:56px;color:var(--muted);font-size:14px}
    .pagination a:hover{color:var(--primary-d)}
    .prose{overflow-wrap:break-word}
    .prose p{margin:0 0 1.5em}
    .prose h1,.prose h2,.prose h3{scroll-margin-top:96px}
    .prose h2{margin:2.3em 0 1em;padding-bottom:12px;background:linear-gradient(var(--primary),var(--primary)) left bottom/30px 2px no-repeat;font-family:var(--serif);font-size:25px;font-weight:700;line-height:1.5}
    .prose h3{margin:2em 0 .8em;font-family:var(--serif);font-size:20px;font-weight:700;line-height:1.55}
    .prose img{max-width:100%;border-radius:14px}
    .prose a{color:var(--primary-d);text-decoration:underline;text-decoration-color:color-mix(in srgb,var(--primary) 45%,transparent);text-underline-offset:3px;transition:text-decoration-color 250ms ease}
    .prose a:hover{text-decoration-color:var(--primary-d)}
    .prose blockquote{margin:2em 0;padding:2px 0 2px 20px;border-left:2px solid var(--primary);color:var(--muted);font-family:var(--serif);font-size:17px}
    .prose blockquote p{margin:0 0 .8em}
    .prose blockquote p:last-child{margin-bottom:0}
    .prose code{padding:2px 7px;border-radius:6px;background:color-mix(in srgb,var(--primary) 14%,transparent);font-family:var(--mono);font-size:.86em}
    .prose pre{margin:2em 0;padding:20px 22px;overflow-x:auto;border:1px solid var(--line);border-radius:14px;background:#f6f8fa;color:var(--ink);font-size:13.5px;line-height:1.8}
    .prose pre code{padding:0;background:none;font-size:inherit}
    .prose ul,.prose ol{margin:0 0 1.5em;padding-left:1.5em}
    .prose li{margin:.45em 0}
    .prose li::marker{color:var(--primary-d)}
    .prose li:has(>input[type=checkbox]){margin-left:-1.5em;list-style:none}
    .prose input[type=checkbox]{margin:0 8px 0 0;accent-color:var(--primary-d)}
    .prose hr{margin:3em 0;border:0;border-top:1px solid var(--line)}
    .prose table{display:block;margin:2em 0;overflow-x:auto;border-collapse:collapse;font-size:14.5px}
    .prose th,.prose td{padding:8px 16px;border:1px solid var(--line);text-align:left}
    .prose th{background:var(--surface-soft);font-family:var(--mono);font-size:12px;letter-spacing:.08em}
    .prose .footnote-reference{font-family:var(--mono);font-size:.75em}
    .prose .footnote-definition{color:var(--muted);font-size:13.5px}
    .prose .footnote-definition p{margin:0 0 .4em}
    .masthead-minimal:has(+ .article-feed){flex-wrap:wrap;row-gap:12px;margin-bottom:0}
    .sort-tabs{display:flex;gap:8px;margin:0 0 0 auto}
    .sort-tabs a{padding:6px 16px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:12.5px;transition:color 250ms ease,border-color 250ms ease,background 250ms ease}
    .sort-tabs a:hover{border-color:var(--primary);color:var(--primary-d)}
    .sort-tabs a.active{border-color:var(--ink);background:var(--ink);color:#fff}
    .archive-more{display:grid;grid-column:1/-1;grid-template-rows:0fr;transition:grid-template-rows 420ms cubic-bezier(.22,.61,.36,1)}
    .archive-more-in{display:flex;min-height:0;align-items:center;gap:18px;overflow:hidden;opacity:0;transition:opacity 320ms ease}
    .archive-row:hover .archive-more{grid-template-rows:1fr}
    .archive-row:hover .archive-more-in{opacity:1}
    .archive-cover{display:block;width:120px;flex:0 0 120px;border-radius:10px;background:var(--cover) center/cover no-repeat;aspect-ratio:16/10}
    .archive-summary{margin:12px 0;color:var(--muted);font-size:13.5px;line-height:1.8}
    .heart-button{display:inline-flex;align-items:center;gap:6px;padding:4px 12px 4px 8px;border:1px solid var(--line);border-radius:999px;background:none;color:var(--faint);font-size:12px;transition:color 250ms ease,border-color 250ms ease}
    .heart-button svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linejoin:round;transition:fill 250ms ease,stroke 250ms ease,scale 200ms cubic-bezier(.22,.61,.36,1)}
    .heart-button:hover{border-color:var(--secondary);color:var(--secondary-d)}
    .heart-button:active svg{scale:1.3}
    .heart-button.liked{border-color:var(--secondary);color:var(--secondary-d)}
    .heart-button.liked svg{fill:var(--secondary);stroke:var(--secondary)}
    .to-top{position:fixed;z-index:60;right:26px;bottom:26px;display:grid;width:46px;height:46px;padding:0;place-items:center;border:0;border-radius:50%;background:var(--ink);color:#fff;box-shadow:0 10px 28px rgb(28 39 51/24%);opacity:0;visibility:hidden;translate:0 12px;transition:opacity 320ms ease,translate 320ms cubic-bezier(.22,.61,.36,1),visibility 320ms,background 250ms ease}
    .to-top.show{opacity:1;visibility:visible;translate:0 0}
    .to-top:hover{background:var(--primary-d)}
    .to-top .ring{position:absolute;inset:0;width:100%;height:100%;fill:none;transform:rotate(-90deg)}
    .to-top .ring-bg{stroke:rgb(255 255 255/18%);stroke-width:2}
    .to-top .ring-fg{stroke:var(--secondary);stroke-width:2;stroke-linecap:round;stroke-dasharray:125.66;stroke-dashoffset:125.66}
    .to-top .arrow{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    @media(max-width:1400px){.layout-grid.grid-three-rail{grid-template-columns:1fr;max-width:900px}}
    @media(max-width:1080px){.layout-grid.grid-feed-rail{grid-template-columns:1fr}.grid-feed-rail .is-sticky{position:static;max-height:none}.layout-grid.grid-identity{grid-template-columns:auto minmax(0,1fr)}.grid-identity .profile-log{display:none}}
    @media(max-width:968px){.nav-corners{padding:0 24px}.nav-corners .nav-links{display:none}.nav-corners .nav-actions{display:flex}}
    @media(max-width:900px){.nav-sidebar{position:sticky;top:0;width:100%;height:auto;padding:80px 18px 14px;border-right:0;border-bottom:1px solid var(--line)}.nav-sidebar .nav-links{flex-direction:row;margin-top:14px;overflow:auto}.shell-sidebar main{margin-left:0}.layout-bento{width:min(100% - 24px,680px);grid-template-columns:1fr;grid-auto-rows:auto}.is-sticky{position:relative;top:auto}.layout-split,.layout-split.split-right{grid-template-columns:1fr}}
    @media(max-width:760px){.page{width:min(100% - 40px,1180px);padding-top:108px}.archive-row{grid-template-columns:64px minmax(0,1fr)}.archive-row .meta{display:none}.friends-grid{grid-template-columns:1fr}.feed-alternating .article,.feed-alternating .article:nth-of-type(even),.feed-alternating .article:has(.is-portrait),.feed-alternating .article:nth-of-type(even):has(.is-portrait){grid-template-columns:1fr}.feed-alternating .article:nth-of-type(even) .article-cover{order:0}.feed-alternating .article-cover.is-portrait{width:min(320px,88%)}.layout-grid,.layout-grid.grid-three-rail{grid-template-columns:minmax(0,1fr);gap:20px;padding:76px 16px 56px}}
    @media(max-width:760px){.comment-form-grid,.friend-apply-grid{grid-template-columns:1fr}}
    @media(max-width:640px){.hero h1{font-size:clamp(36px,11vw,48px)}.hero-inner{gap:4vh}.welcome-quote{padding:22px 20px}.quote-text{font-size:15px}.nav-topbar .nav-links{display:none}.nav-hamburger{display:grid}.mobile-menu{padding-inline:24px}.layout-grid.grid-identity{width:min(100% - 40px,1180px);gap:20px}.layout-grid.grid-feed-rail{width:min(100% - 40px,1180px);gap:48px;padding:56px 0 72px}.site-footer{flex-direction:column;align-items:center;gap:6px;text-align:center}}
    .prelude{position:fixed;inset:0;z-index:300;display:none;overflow:hidden;background:var(--page)}
    html.splash-run .prelude{display:grid;grid-template-rows:1fr auto;animation:prelude-exit .9s cubic-bezier(.22,.7,.2,1) 2.3s forwards}
    html.splash-run .prelude.is-skipped{animation-name:prelude-exit-now;animation-delay:0s}
    html.is-intro body{overflow:hidden}
    .prelude.is-leaving{pointer-events:none}
    .prelude-bloom{position:absolute;top:46%;left:50%;width:min(60vw,560px);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--secondary) 18%,transparent),color-mix(in srgb,var(--primary) 7%,transparent) 46%,transparent 72%);opacity:0;transform:translate(-50%,-50%) scale(.8);animation:prelude-bloom 1.9s ease-out 1.15s}
    .prelude-stage{position:relative;display:grid;place-content:center;justify-items:center;gap:18px;padding:6vw;text-align:center}
    .prelude-kicker{margin:0;color:var(--secondary-d);font-family:var(--mono);font-size:11px;letter-spacing:.42em;text-transform:uppercase;animation:prelude-arrive .8s cubic-bezier(.2,.8,.2,1) both}
    .prelude-title{font-family:var(--serif);font-size:clamp(48px,10vw,104px);font-weight:700;line-height:1;letter-spacing:-.02em;animation:prelude-arrive .8s cubic-bezier(.2,.8,.2,1) .12s both}
    .prelude-flake{color:var(--primary-d);font-size:22px;line-height:1;opacity:0;transform:scale(.4);animation:prelude-flake .7s cubic-bezier(.18,.82,.22,1) 1.15s forwards}
    .prelude-trace{position:relative;height:80px;margin:0 8vw 9vh}
    .prelude-trace svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
    .prelude-track{fill:none;stroke:var(--ink);stroke-width:1;opacity:.08}
    .prelude-line{fill:none;stroke:var(--primary-d);stroke-width:1.6;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;opacity:.6;animation:prelude-trace 1.5s cubic-bezier(.3,.05,.25,1) .2s forwards}
    .prelude-hint{position:absolute;right:24px;bottom:16px;color:var(--faint);font-family:var(--mono);font-size:10px;letter-spacing:.2em}
    @keyframes prelude-exit{to{opacity:0;filter:blur(3px);transform:scale(1.015);visibility:hidden}}
    @keyframes prelude-exit-now{to{opacity:0;filter:blur(3px);transform:scale(1.015);visibility:hidden}}
    @keyframes prelude-arrive{from{opacity:0;transform:translateY(10px)}}
    @keyframes prelude-bloom{0%{opacity:0;transform:translate(-50%,-50%) scale(.8)}22%{opacity:.85;transform:translate(-50%,-50%) scale(1.02)}58%{opacity:.3;transform:translate(-50%,-50%) scale(1.1)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.22)}}
    @keyframes prelude-flake{to{opacity:1;transform:scale(1)}}
    @keyframes prelude-trace{0%{stroke-dashoffset:1}70%{stroke-dashoffset:0;opacity:.6}100%{stroke-dashoffset:0;opacity:.25}}
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important}::view-transition-old(root),::view-transition-new(root){animation-duration:.01ms!important}}
  </style>
</head>
<body class="{{ site.font_class }} shell-{{ site.navigation_class }}{% if immersive_home %} immersive-home{% endif %}">
  <div class="prelude" data-prelude aria-hidden="true">
    <div class="prelude-bloom"></div>
    <div class="prelude-stage">
      <p class="prelude-kicker">YukiLog — Night Flight</p>
      <strong class="prelude-title">{{ site.title }}</strong>
      <span class="prelude-flake">❄</span>
    </div>
    <div class="prelude-trace">
      <svg viewBox="0 0 1200 60" preserveAspectRatio="none" focusable="false">
        <path class="prelude-track" d="M0 30H1200"/>
        <path class="prelude-line" pathLength="1" d="M0 30H1200"/>
      </svg>
    </div>
    <span class="prelude-hint">点击或按任意键跳过</span>
  </div>
  {% if immersive_home %}<div class="nav-corners" id="nav-corners"><a class="brand" href="/">{{ site.title }}</a><div class="nav-links"><a class="nav-item{% if current_section == "home" %} active{% endif %}" href="/"><span class="nav-label">首页</span></a><a class="nav-item{% if current_section == "articles" %} active{% endif %}" href="/articles"><span class="nav-label">文章</span></a><a class="nav-item{% if current_section == "dynamics" %} active{% endif %}" href="/dynamics"><span class="nav-label">动态</span></a><a class="nav-item{% if current_section == "friends" %} active{% endif %}" href="/friends"><span class="nav-label">友链</span></a></div><div class="nav-actions">{% if site.show_search %}<a class="nav-action" href="/search" aria-label="搜索"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg></a>{% endif %}<button class="nav-action nav-hamburger menu-toggle" type="button" aria-label="打开菜单"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button></div></div>{% endif %}
  <nav id="site-nav" class="site-nav nav-{{ site.navigation_class }} {{ site.navigation_options }}{% if immersive_home %}{% else %} nav-sticky{% endif %}" aria-label="主导航">
    <a class="brand" href="/">{{ site.title }}</a>
    <div class="nav-links">
      <a class="nav-item{% if current_section == "home" %} active{% endif %}" href="/"><span class="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5v8a1.5 1.5 0 0 1-1.5 1.5h-5v-6h-5v6h-5A1.5 1.5 0 0 1 3 19.5z"/></svg></span><span class="nav-label">首页</span></a>
      <a class="nav-item{% if current_section == "articles" %} active{% endif %}" href="/articles"><span class="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6zM9 10h6M9 14h6M9 18h4M15 3v4h4"/></svg></span><span class="nav-label">文章</span></a>
      <a class="nav-item{% if current_section == "dynamics" %} active{% endif %}" href="/dynamics"><span class="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H8l-4 4zM8 9h8M8 13h5"/></svg></span><span class="nav-label">动态</span></a>
      <a class="nav-item{% if current_section == "friends" %} active{% endif %}" href="/friends"><span class="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3.5 20c.6-3.3 2.4-5 5.5-5s4.9 1.7 5.5 5M14 15.5c3.7-.8 5.8.7 6.5 3.5"/></svg></span><span class="nav-label">友链</span></a>
    </div>
    <div class="nav-inner-actions"><div class="nav-actions">{% if site.show_search %}<a class="nav-action" href="/search" aria-label="搜索"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg></a>{% endif %}<button class="nav-action nav-hamburger menu-toggle" type="button" aria-label="打开菜单"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button></div></div>
  </nav>
  <div class="mobile-menu-overlay" id="mobile-menu" role="dialog" aria-modal="true" aria-label="导航菜单" hidden>
    <section class="mobile-menu">
      <header class="mobile-menu-header"><strong>{{ site.title }}</strong><button class="nav-action menu-close" type="button" aria-label="关闭菜单"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
      <nav class="mobile-menu-nav">
        <a class="mobile-nav-item{% if current_section == "home" %} active{% endif %}" href="/"><span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5v8a1.5 1.5 0 0 1-1.5 1.5h-5v-6h-5v6h-5A1.5 1.5 0 0 1 3 19.5z"/></svg></span><span>首页</span></a>
        <a class="mobile-nav-item{% if current_section == "articles" %} active{% endif %}" href="/articles"><span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6zM9 10h6M9 14h6M9 18h4M15 3v4h4"/></svg></span><span>文章</span></a>
        <a class="mobile-nav-item{% if current_section == "dynamics" %} active{% endif %}" href="/dynamics"><span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4zM8 9h8M8 13h5"/></svg></span><span>动态</span></a>
        <a class="mobile-nav-item{% if current_section == "friends" %} active{% endif %}" href="/friends"><span class="nav-icon"><svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3.5 20c.6-3.3 2.4-5 5.5-5s4.9 1.7 5.5 5M14 15.5c3.7-.8 5.8.7 6.5 3.5"/></svg></span><span>友链</span></a>
      </nav>
    </section>
  </div>
  <main><div class="page {{ site.page_width_class }}">{{ content|safe }}</div></main>
  {% if site.mail_enabled %}<section class="subscribe" id="subscribe"><form method="post" action="/subscriptions"><strong>订阅更新</strong><input type="email" name="email" required maxlength="254" autocomplete="email" placeholder="you@example.com"><label><input type="checkbox" name="articles" checked>文章</label><label><input type="checkbox" name="dynamics">动态</label><button type="submit">订阅</button></form></section>{% endif %}
  <footer class="site-footer"><span>© {{ site.owner_name }} · YukiLog</span><span><a href="/feed.xml">RSS</a>{% if site.mail_enabled %} · <a href="#subscribe">MAIL</a>{% endif %}</span></footer>
  <button class="to-top" type="button" aria-label="回到顶部"><svg class="ring" viewBox="0 0 46 46" aria-hidden="true"><circle class="ring-bg" cx="23" cy="23" r="20"></circle><circle class="ring-fg" cx="23" cy="23" r="20"></circle></svg><svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-7 7 7-7 7 7"/></svg></button>
  <script>
    (() => {
      const titleElement = document.querySelector('title[data-away]');
      if (titleElement) {
        const homeTitle = titleElement.textContent;
        document.addEventListener('visibilitychange', () => {
          titleElement.textContent = document.hidden
            ? titleElement.getAttribute('data-away')
            : homeTitle;
        });
      }
      const nav = document.getElementById('site-nav');
      const corners = document.getElementById('nav-corners');
      const mobileMenu = document.getElementById('mobile-menu');
      const menuToggles = document.querySelectorAll('.menu-toggle');
      const closeMenu = () => {
        if (!mobileMenu) return;
        mobileMenu.hidden = true;
        document.body.style.overflow = '';
        menuToggles.forEach((button) => button.setAttribute('aria-expanded', 'false'));
      };
      const openMenu = () => {
        if (!mobileMenu) return;
        mobileMenu.hidden = false;
        document.body.style.overflow = 'hidden';
        menuToggles.forEach((button) => button.setAttribute('aria-expanded', 'true'));
      };
      menuToggles.forEach((button) => button.addEventListener('click', openMenu));
      document.querySelector('.menu-close')?.addEventListener('click', closeMenu);
      mobileMenu?.addEventListener('click', (event) => {
        if (event.target === mobileMenu) closeMenu();
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeMenu();
      });
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const startReveal = () => {
        if (reduced || !('IntersectionObserver' in window)) return;
        document.documentElement.classList.add('reveal-ready');
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('in');
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.1, rootMargin: '0px 0px 10% 0px' });
        document.querySelectorAll('[data-reveal]').forEach((element, index) => {
          element.style.transitionDelay = (index % 8) * 80 + 'ms';
          observer.observe(element);
        });
      };
      let deferReveal = false;
      const prelude = document.querySelector('[data-prelude]');
      if (prelude) {
        const intro = document.documentElement.classList.contains('splash-run');
        if (!intro || reduced) {
          prelude.remove();
          document.documentElement.classList.remove('is-intro', 'splash-run');
        } else {
          let leaving = false;
          deferReveal = true;
          const leave = () => {
            if (leaving) return;
            leaving = true;
            try {
              window.sessionStorage.setItem('yukilog.splash', '1');
            } catch {
            }
            document.documentElement.classList.remove('is-intro', 'splash-run');
            prelude.classList.add('is-leaving');
            startReveal();
            const exitAnim = (prelude.getAnimations ? prelude.getAnimations() : [])
              .find((animation) => animation.animationName && animation.animationName.startsWith('prelude-exit'));
            if (exitAnim) exitAnim.finished.then(() => prelude.remove(), () => prelude.remove());
            else prelude.remove();
          };
          const skip = () => {
            if (leaving) return;
            prelude.classList.add('is-skipped');
            leave();
          };
          prelude.addEventListener('click', skip);
          window.addEventListener('keydown', skip, { once: true });
          setTimeout(leave, 2300);
          setTimeout(leave, 6000);
        }
      }
      document.querySelector('.enter-button')?.addEventListener('click', (event) => {
        event.preventDefault();
        window.scrollTo({ top: window.innerHeight, behavior: reduced ? 'auto' : 'smooth' });
      });
      document.querySelector('.post-back')?.addEventListener('click', (event) => {
        if (window.history.length <= 1) return;
        try {
          const referrer = document.referrer ? new URL(document.referrer) : null;
          if (referrer && referrer.origin === window.location.origin) {
            event.preventDefault();
            window.history.back();
          }
        } catch {
        }
      });
      const toTop = document.querySelector('.to-top');
      const ringFg = toTop ? toTop.querySelector('.ring-fg') : null;
      const immersiveHome = nav && document.body.classList.contains('immersive-home');
      const heroInner = immersiveHome ? document.querySelector('.hero-inner') : null;
      const heroBackground = immersiveHome ? document.querySelector('.hero-background') : null;
      let ticking = false;
      const sync = () => {
        ticking = false;
        const y = window.scrollY;
        const height = window.innerHeight;
        const past = y >= height * 0.72;
        if (toTop) {
          toTop.classList.toggle('show', past);
          if (ringFg) {
            const max = Math.max(document.documentElement.scrollHeight - height, 1);
            ringFg.style.strokeDashoffset = String(125.66 * (1 - Math.min(y / max, 1)));
          }
        }
        if (immersiveHome) {
          nav.classList.toggle('nav-sticky', past);
          corners?.classList.toggle('hidden', past);
          if (!reduced && y < height) {
            if (heroInner) {
              heroInner.style.transform = 'translateY(' + y * 0.28 + 'px)';
              heroInner.style.opacity = String(1 - y / (height * 0.72));
            }
            if (heroBackground) {
              heroBackground.style.transform = 'translateY(' + y * 0.18 + 'px)';
            }
          }
        }
      };
      window.addEventListener('scroll', () => {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(sync);
        }
      }, { passive: true });
      sync();
      toTop?.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      });
      document.querySelectorAll('.heart-button').forEach((button) => {
        button.addEventListener('click', async () => {
          const id = button.getAttribute('data-dynamic-id');
          if (!id) return;
          const liked = button.classList.contains('liked');
          try {
            const response = await fetch('/api/dynamics/' + id + '/like', {
              method: liked ? 'DELETE' : 'POST',
            });
            if (!response.ok) return;
            const data = await response.json();
            button.classList.toggle('liked', Boolean(data.liked));
            button.setAttribute('aria-pressed', data.liked ? 'true' : 'false');
            const count = button.querySelector('.heart-count');
            if (count) count.textContent = String(data.like_count);
          } catch {
          }
        });
      });
      const tocLinks = document.querySelectorAll('.post-toc-item[href^="#"]');
      if (tocLinks.length && 'IntersectionObserver' in window) {
        const tocById = new Map();
        tocLinks.forEach((link) => {
          const id = link.getAttribute('href').slice(1);
          if (!tocById.has(id)) tocById.set(id, []);
          tocById.get(id).push(link);
        });
        const spy = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              tocLinks.forEach((link) => link.classList.remove('is-active'));
              (tocById.get(entry.target.id) || []).forEach((link) => link.classList.add('is-active'));
            }
          });
        }, { rootMargin: '-90px 0px -70% 0px' });
        document.querySelectorAll('.prose h1[id], .prose h2[id], .prose h3[id]').forEach((heading) => spy.observe(heading));
      }
      const commentCompose = document.querySelector('.comment-compose');
      const commentForm = document.querySelector('.comment-form');
      if (commentCompose && commentForm) {
        const commentNote = commentForm.querySelector('.comment-note');
        const noteText = commentNote ? commentNote.textContent : '';
        commentCompose.addEventListener('click', () => {
          commentCompose.hidden = true;
          commentForm.hidden = false;
          commentForm.classList.add('is-open');
          commentCompose.setAttribute('aria-expanded', 'true');
          const first = commentForm.querySelector('input[name="display_name"]');
          if (first) first.focus();
        });
        commentForm.querySelector('.comment-cancel')?.addEventListener('click', () => {
          commentForm.hidden = true;
          commentCompose.hidden = false;
          commentCompose.setAttribute('aria-expanded', 'false');
        });
        commentForm.addEventListener('submit', async (event) => {
          event.preventDefault();
          const id = commentForm.getAttribute('data-article-id');
          if (!id) return;
          const submitButton = commentForm.querySelector('button[type="submit"]');
          const field = (name) => {
            const input = commentForm.elements.namedItem(name);
            return input ? input.value.trim() : '';
          };
          if (submitButton) submitButton.disabled = true;
          try {
            const response = await fetch('/api/articles/' + id + '/comments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                display_name: field('display_name'),
                email: field('email') || null,
                website: field('website') || null,
                content: field('content'),
              }),
            });
            if (!response.ok) {
              const data = await response.json().catch(() => null);
              if (commentNote) commentNote.textContent = (data && data.message) || '提交失败，请稍后再试。';
              return;
            }
            commentForm.reset();
            commentForm.hidden = true;
            commentCompose.hidden = false;
            commentCompose.setAttribute('aria-expanded', 'false');
            if (commentNote) commentNote.textContent = noteText;
            const submitted = document.querySelector('.comment-submitted');
            if (submitted) submitted.hidden = false;
          } catch {
            if (commentNote) commentNote.textContent = '网络异常，请稍后再试。';
          } finally {
            if (submitButton) submitButton.disabled = false;
          }
        });
      }
      document.querySelectorAll('.m-reply').forEach((form) => {
        const more = form.querySelector('.m-reply-more');
        const note = form.querySelector('.m-reply-note');
        const field = (name) => {
          const input = form.elements.namedItem(name);
          return input ? input.value.trim() : '';
        };
        const saved = (() => {
          try { return JSON.parse(localStorage.getItem('yukilog-commenter') || '{}'); }
          catch { return {}; }
        })();
        ['display_name', 'email', 'website'].forEach((name) => {
          const input = form.elements.namedItem(name);
          if (input && saved[name]) input.value = saved[name];
        });
        const contentInput = form.elements.namedItem('content');
        contentInput?.addEventListener('focus', () => {
          if (more) more.hidden = false;
        });
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const id = form.getAttribute('data-dynamic-id');
          if (!id) return;
          if (more) more.hidden = false;
          const displayName = field('display_name');
          if (!displayName) {
            form.elements.namedItem('display_name')?.focus();
            return;
          }
          const button = form.querySelector('button[type="submit"]');
          if (button) button.disabled = true;
          try {
            const response = await fetch('/api/dynamics/' + id + '/comments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                display_name: displayName,
                email: field('email') || null,
                website: field('website') || null,
                content: field('content'),
              }),
            });
            if (!response.ok) {
              const data = await response.json().catch(() => null);
              if (note) { note.hidden = false; note.textContent = (data && data.message) || '提交失败，请稍后再试。'; }
              return;
            }
            try {
              localStorage.setItem('yukilog-commenter', JSON.stringify({
                display_name: displayName, email: field('email'), website: field('website'),
              }));
            } catch {}
            if (contentInput) contentInput.value = '';
            if (note) { note.hidden = false; note.textContent = '评论已寄出，审核通过后会显示。'; }
          } catch {
            if (note) { note.hidden = false; note.textContent = '网络异常，请稍后再试。'; }
          } finally {
            if (button) button.disabled = false;
          }
        });
      });
      if (!deferReveal) startReveal();
    })();
  </script>
</body>
</html>"##,
    ext = "html"
)]
struct PageTemplate<'a> {
    site: &'a SiteView,
    page_title: &'a str,
    content: &'a str,
    immersive_home: bool,
    current_section: &'a str,
    canonical_url: &'a str,
    og_title: &'a str,
    og_description: &'a str,
    og_type: &'a str,
    og_image: &'a str,
    json_ld: &'a str,
}

struct PageMeta {
    title: String,
    canonical_path: String,
    description: String,
    og_type: String,
    og_image: String,
    json_ld: String,
}

impl PageMeta {
    fn new(site: &SiteView, title: &str, canonical_path: &str) -> Self {
        Self {
            title: title.to_owned(),
            canonical_path: canonical_path.to_owned(),
            description: site.description.clone(),
            og_type: "website".to_owned(),
            og_image: absolute_url(&site.origin, &site.avatar_url),
            json_ld: String::new(),
        }
    }
}

fn absolute_url(origin: &str, url: &str) -> String {
    if url.is_empty() || url.starts_with("http://") || url.starts_with("https://") {
        url.to_owned()
    } else {
        format!("{origin}{url}")
    }
}

fn page(site: &SiteView, meta: &PageMeta, content: &str) -> Result<Html<String>, AppError> {
    let title = meta.title.as_str();
    let current_section = match title {
        "首页" => "home",
        "文章" => "articles",
        "动态" => "dynamics",
        "友链" => "friends",
        "搜索" => "search",
        _ => "",
    };
    let canonical_url = format!("{}{}", site.origin, meta.canonical_path);
    let og_title = format!("{title} · {}", site.title);
    PageTemplate {
        site,
        page_title: title,
        content,
        immersive_home: title == "首页",
        current_section,
        canonical_url: &canonical_url,
        og_title: &og_title,
        og_description: &meta.description,
        og_type: &meta.og_type,
        og_image: &meta.og_image,
        json_ld: &meta.json_ld,
    }
    .render()
    .map(Html)
    .map_err(|_| AppError::Internal("render page"))
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
        avatar_external_url: model.avatar_external_url,
        masthead_media_id: model.masthead_media_id,
        hero_background_media_ids: crate::ops::media::hero_background_ids(
            &model.hero_background_media_ids,
        )?,
        hero_quote: model.hero_quote,
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
    let hero_backgrounds =
        crate::ops::media::image_media_urls(&state.database, &settings.hero_background_media_ids)
            .await?;
    let avatar_media_url = media_url(state, settings.avatar_media_id).await?;
    let avatar_external_url = settings.avatar_external_url.clone().unwrap_or_default();
    let avatar_url = if avatar_media_url.is_empty() {
        avatar_external_url.clone()
    } else {
        avatar_media_url.clone()
    };
    let favicon_url = if avatar_external_url.is_empty() {
        avatar_media_url
    } else {
        avatar_external_url
    };
    let masthead_url = media_url(state, settings.masthead_media_id).await?;
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
        masthead_url,
        hero_backgrounds,
        hero_quote: settings.hero_quote.unwrap_or_default(),
        favicon_url,
        origin: state.auth.public_origin().to_owned(),
        social_links: settings.social_links,
        navigation_class,
        navigation_options,
        page_width_class,
        show_search: settings.shell_layout.show_search,
        mail_enabled: crate::ops::subscriptions::mail_enabled(),
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
        masthead_tint: (settings.theme.masthead_overlay.unwrap_or(0.58) * 100.0).round() as u8,
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

fn apply_article_sort(
    query: Select<articles::Entity>,
    sort: ArticleSort,
) -> Select<articles::Entity> {
    match sort {
        ArticleSort::Featured => query
            .order_by_with_nulls(
                articles::Column::FeaturedAt,
                sea_orm::sea_query::Order::Desc,
                sea_orm::sea_query::NullOrdering::Last,
            )
            .order_by_desc(articles::Column::PublishedAt),
        ArticleSort::Recent => query.order_by_desc(articles::Column::PublishedAt),
        ArticleSort::Popular => query
            .join(JoinType::LeftJoin, articles::Relation::ArticleMetrics.def())
            .order_by(
                Expr::cust(
                    "COALESCE(article_metrics.like_count, 0) * 20 + COALESCE(article_metrics.view_count, 0)",
                ),
                sea_orm::sea_query::Order::Desc,
            )
            .order_by_desc(articles::Column::PublishedAt),
    }
}

async fn load_articles(
    state: &AppState,
    limit: u64,
    offset: u64,
    search: Option<&str>,
    filter: &ArticleFilter,
    sort: ArticleSort,
) -> Result<Vec<ArticleCard>, AppError> {
    let mut query = articles::Entity::find()
        .filter(articles::Column::Status.eq("published"))
        .filter(articles::Column::PublishedAt.lte(Utc::now().fixed_offset()))
        .offset(offset)
        .limit(limit);
    query = apply_article_sort(query, sort);
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
    for (index, card) in cards.iter_mut().enumerate() {
        if card.cover_url.is_empty() {
            card.cover_class = cover_class(index).to_owned();
        }
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
        cover_class: String::new(),
        published: date(published_at),
        published_year: published_at.year(),
        views: metrics.view_count,
        likes: metrics.like_count,
    })
}

async fn load_dynamics(state: &AppState, limit: u64) -> Result<Vec<DynamicCard>, AppError> {
    let models = dynamics::Entity::find()
        .filter(dynamics::Column::Status.eq("published"))
        .filter(dynamics::Column::PublishedAt.lte(Utc::now().fixed_offset()))
        .order_by_desc(dynamics::Column::PublishedAt)
        .limit(limit)
        .all(&state.database)
        .await?;
    let metrics = if models.is_empty() {
        Vec::new()
    } else {
        dynamic_metrics::Entity::find()
            .filter(dynamic_metrics::Column::DynamicId.is_in(models.iter().map(|model| model.id)))
            .all(&state.database)
            .await?
    };
    let likes = metrics
        .into_iter()
        .map(|metric| (metric.dynamic_id, metric.like_count))
        .collect::<HashMap<_, _>>();
    let attachments = if models.is_empty() {
        Vec::new()
    } else {
        dynamic_media::Entity::find()
            .filter(dynamic_media::Column::DynamicId.is_in(models.iter().map(|model| model.id)))
            .order_by_asc(dynamic_media::Column::Position)
            .all(&state.database)
            .await?
    };
    let assets = if attachments.is_empty() {
        HashMap::new()
    } else {
        media_assets::Entity::find()
            .filter(
                media_assets::Column::Id
                    .is_in(attachments.iter().map(|row| row.media_id).collect::<Vec<_>>()),
            )
            .all(&state.database)
            .await?
            .into_iter()
            .map(|media| (media.id, media))
            .collect::<HashMap<_, _>>()
    };
    let mut media = HashMap::<Uuid, Vec<DynamicMediaCard>>::new();
    for attachment in attachments {
        let Some(asset) = assets.get(&attachment.media_id) else {
            continue;
        };
        media
            .entry(attachment.dynamic_id)
            .or_default()
            .push(DynamicMediaCard {
                url: format!("/media/{}", asset.storage_key),
                alt: asset.original_name.clone(),
                width: asset.width,
                height: asset.height,
            });
    }
    let now = Utc::now().fixed_offset();
    Ok(models
        .into_iter()
        .map(|item| {
            let published_at = item.published_at.expect("published dynamic has timestamp");
            DynamicCard {
                id: item.id,
                content_html: markup::render(&item.content_markdown).html,
                mood: item.mood,
                published: date(published_at),
                time_iso: published_at.to_rfc3339(),
                rel: relative_time(now, published_at),
                likes: likes.get(&item.id).copied().unwrap_or(0),
                allow_comments: item.allow_comments,
                media: media.remove(&item.id).unwrap_or_default(),
                comments: Vec::new(),
                comment_count: 0,
                comments_html: String::new(),
            }
        })
        .collect())
}

async fn load_moment_comments(
    state: &AppState,
    dynamic_ids: &[Uuid],
    owner_name: &str,
) -> Result<HashMap<Uuid, Vec<MomentComment>>, AppError> {
    let mut grouped = HashMap::new();
    if dynamic_ids.is_empty() {
        return Ok(grouped);
    }
    let models = comments::Entity::find()
        .filter(comments::Column::DynamicId.is_in(dynamic_ids.to_vec()))
        .filter(comments::Column::Status.eq("visible"))
        .order_by_asc(comments::Column::CreatedAt)
        .all(&state.database)
        .await?;
    let owner = owner_name.trim();
    let mut by_dynamic: HashMap<Uuid, Vec<comments::Model>> = HashMap::new();
    for model in models {
        if let Some(dynamic_id) = model.dynamic_id {
            by_dynamic.entry(dynamic_id).or_default().push(model);
        }
    }
    for (dynamic_id, models) in by_dynamic {
        let mut by_parent: HashMap<Option<Uuid>, Vec<comments::Model>> = HashMap::new();
        for model in models {
            by_parent.entry(model.parent_id).or_default().push(model);
        }
        let roots = build_moment_comments(None, &mut by_parent, owner);
        grouped.insert(dynamic_id, roots);
    }
    Ok(grouped)
}

fn build_moment_comments(
    parent: Option<Uuid>,
    by_parent: &mut HashMap<Option<Uuid>, Vec<comments::Model>>,
    owner: &str,
) -> Vec<MomentComment> {
    by_parent
        .remove(&parent)
        .unwrap_or_default()
        .into_iter()
        .map(|model| {
            let id = model.id;
            let avatar_url = crate::content::public::comment_avatar_url(
                model.website.as_deref(),
                model.email.as_deref(),
            );
            let children = build_moment_comments(Some(id), by_parent, owner);
            MomentComment {
                fallback_svg: avatar_fallback(&model.display_name),
                is_owner: model.display_name.trim() == owner,
                display_name: model.display_name,
                website: model.website.unwrap_or_default(),
                agent_label: markup::agent_label(model.user_agent.as_deref().unwrap_or("")),
                content: model.content,
                created: model.created_at.format("%Y-%m-%d %H:%M").to_string(),
                avatar_url,
                children,
            }
        })
        .collect()
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

fn date(value: DateTime<FixedOffset>) -> String {
    value.format("%Y-%m-%d").to_string()
}

fn masthead_backdrop(site: &SiteView) -> String {
    if site.masthead_url.is_empty() {
        String::new()
    } else {
        format!(
            r#"<div class="masthead-bg" aria-hidden="true" style="background-image:url({})"></div>"#,
            escape_html(&site.masthead_url)
        )
    }
}

fn page_head(site: &SiteView, kicker: &str, title: &str, lede: &str, center: bool) -> String {
    let mut class = String::from("page-head");
    if center {
        class.push_str(" center");
    }
    if !site.masthead_url.is_empty() {
        class.push_str(" has-bg");
    }
    format!(
        r#"<header class="{class}" data-reveal>{}<p class="kicker caps">{kicker}</p><h1>{title}</h1><p class="inner-lede">{lede}</p></header>"#,
        masthead_backdrop(site)
    )
}

fn cover_class(index: usize) -> &'static str {
    COVER_CLASSES[index % COVER_CLASSES.len()]
}

fn host_of(url: &str) -> String {
    let without_scheme = url.split("://").nth(1).unwrap_or(url);
    without_scheme
        .split('/')
        .next()
        .unwrap_or(without_scheme)
        .trim_end_matches('/')
        .to_owned()
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

const AVATAR_FALLBACKS: [&str; 3] = [
    r##"<svg viewBox="0 0 36 36" aria-hidden="true"><defs><linearGradient id="av-g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7eb6d9"/><stop offset="1" stop-color="#e8a4b4"/></linearGradient></defs><rect width="36" height="36" rx="12" fill="url(#av-g1)"/><path d="M18 8l2.4 7.6L28 18l-7.6 2.4L18 28l-2.4-7.6L8 18l7.6-2.4z" fill="#f7f8f7"/></svg>"##,
    r##"<svg viewBox="0 0 36 36" aria-hidden="true"><rect width="36" height="36" rx="18" fill="#1c2733"/><path d="M23.5 9.5a8.5 8.5 0 1 0 4.2 16.2A10 10 0 0 1 23.5 9.5z" fill="#7eb6d9"/><circle cx="13" cy="13" r="1.6" fill="#e8a4b4"/></svg>"##,
    r##"<svg viewBox="0 0 36 36" aria-hidden="true"><rect width="36" height="36" rx="18" fill="#e8a4b4"/><circle cx="24.5" cy="11.5" r="3.5" fill="#f7f8f7"/><path d="M5 24c3-2.6 6-2.6 9 0s6 2.6 9 0 5 2.2 8 .6V31H5z" fill="#f7f8f7"/></svg>"##,
];

// 与 Lit 端 avatarFallback() 相同的选款算法：昵称哈希 % 3。
fn avatar_fallback(name: &str) -> &'static str {
    let mut hash = 0_u32;
    for ch in name.chars() {
        hash = (hash * 31 + ch as u32) % 997;
    }
    AVATAR_FALLBACKS[(hash % 3) as usize]
}

fn relative_time(now: DateTime<FixedOffset>, then: DateTime<FixedOffset>) -> String {
    let seconds = (now - then).num_seconds().max(0);
    if seconds < 60 {
        "刚刚".to_owned()
    } else if seconds < 3_600 {
        format!("{} 分钟前", seconds / 60)
    } else if seconds < 86_400 {
        format!("{} 小时前", seconds / 3_600)
    } else if seconds < 7 * 86_400 {
        format!("{} 天前", seconds / 86_400)
    } else {
        then.format("%Y-%m-%d").to_string()
    }
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
    fn relative_time_buckets() {
        let now = Utc::now().fixed_offset();
        assert_eq!(relative_time(now, now), "刚刚");
        assert_eq!(
            relative_time(now, now - chrono::Duration::minutes(5)),
            "5 分钟前"
        );
        assert_eq!(
            relative_time(now, now - chrono::Duration::hours(3)),
            "3 小时前"
        );
        assert_eq!(
            relative_time(now, now - chrono::Duration::days(2)),
            "2 天前"
        );
        let long_ago = now - chrono::Duration::days(30);
        assert_eq!(relative_time(now, long_ago), date(long_ago));
    }

    #[test]
    fn popular_sort_pushes_weighted_ordering_into_sql() {
        let query = apply_article_sort(articles::Entity::find(), ArticleSort::Popular)
            .offset(0)
            .limit(12);
        let sql = sea_orm::QueryTrait::build(&query, sea_orm::DatabaseBackend::Postgres)
            .to_string();
        assert!(
            sql.contains(r#"LEFT JOIN "article_metrics""#),
            "missing metrics join: {sql}"
        );
        assert!(
            sql.contains(
                "ORDER BY COALESCE(article_metrics.like_count, 0) * 20 + COALESCE(article_metrics.view_count, 0) DESC"
            ),
            "missing weighted ordering: {sql}"
        );
        assert!(sql.contains("LIMIT 12"), "missing pushed-down limit: {sql}");

        let recent = apply_article_sort(articles::Entity::find(), ArticleSort::Recent);
        let recent_sql = sea_orm::QueryTrait::build(&recent, sea_orm::DatabaseBackend::Postgres)
            .to_string();
        assert!(!recent_sql.contains("JOIN"), "recent must not join: {recent_sql}");
    }

    fn test_site() -> SiteView {
        SiteView {
            title: "YukiLog".to_owned(),
            description: "夜航西飞".to_owned(),
            owner_name: "Sakurine".to_owned(),
            owner_bio: String::new(),
            avatar_url: "/media/ab/avatar.png".to_owned(),
            masthead_url: String::new(),
            hero_backgrounds: Vec::new(),
            hero_quote: String::new(),
            favicon_url: String::new(),
            origin: "https://blog.example.com".to_owned(),
            social_links: Vec::new(),
            navigation_class: "topbar",
            navigation_options: "",
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
            masthead_tint: 58,
        }
    }

    #[test]
    fn page_renders_canonical_and_social_meta() {
        let site = test_site();
        let meta = PageMeta::new(&site, "文章", "/articles");
        let Html(html) = page(&site, &meta, "<p>content</p>").expect("render");
        assert!(
            html.contains(r#"<link rel="canonical" href="https://blog.example.com/articles">"#),
            "missing canonical: {html}"
        );
        assert!(html.contains(r#"<meta property="og:title" content="文章 · YukiLog">"#));
        assert!(html.contains(r#"<meta property="og:type" content="website">"#));
        assert!(
            html.contains(
                r#"<meta property="og:url" content="https://blog.example.com/articles">"#
            )
        );
        assert!(html.contains(r#"<meta property="og:site_name" content="YukiLog">"#));
        assert!(
            html.contains(
                r#"<meta property="og:image" content="https://blog.example.com/media/ab/avatar.png">"#
            )
        );
        assert!(html.contains(r#"<meta name="twitter:card" content="summary_large_image">"#));
        assert!(html.contains(r#"<meta name="description" content="夜航西飞">"#));
        assert!(!html.contains("application/ld+json"), "unexpected json-ld");
    }

    #[test]
    fn page_without_image_uses_summary_card() {
        let mut site = test_site();
        site.avatar_url = String::new();
        let mut meta = PageMeta::new(&site, "动态", "/dynamics");
        assert_eq!(meta.og_image, "");
        meta.json_ld = r#"{"@type":"Article"}"#.to_owned();
        let Html(html) = page(&site, &meta, "<p>content</p>").expect("render");
        assert!(html.contains(r#"<meta name="twitter:card" content="summary">"#));
        assert!(!html.contains("og:image"));
        assert!(html.contains(r#"<script type="application/ld+json">{"@type":"Article"}</script>"#));
    }

    #[test]
    fn absolute_url_only_prefixes_relative_paths() {
        assert_eq!(absolute_url("https://a.com", ""), "");
        assert_eq!(
            absolute_url("https://a.com", "https://cdn.com/x.png"),
            "https://cdn.com/x.png"
        );
        assert_eq!(absolute_url("https://a.com", "/m/x.png"), "https://a.com/m/x.png");
    }
}
