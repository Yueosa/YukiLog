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
        dynamic_metrics, dynamics, friend_links, media_assets, site_settings, tags,
    },
    error::AppError,
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
    /// 品牌旋钮覆盖后的导航品牌文字（默认 = title）
    brand_text: String,
    /// hero-title 旋钮覆盖后的首屏大文字（默认 = parts::DEFAULT_HERO_TITLE）
    hero_title: String,
    /// hero-title accent 旋钮覆盖后的高亮字符（默认 = parts::DEFAULT_HERO_ACCENT）
    hero_accent: String,
    /// 部件旋钮落成的 `--part-*` 声明串（已按白名单+CSS 消毒）
    part_vars: String,
    /// identity-band traits 旋钮覆盖后的标签行（默认 = parts::DEFAULT_IDENTITY_TRAITS）
    identity_traits: String,
    /// masthead default-sort 旋钮：首页无 ?sort= 参数时的排序（默认精选）
    default_sort: ArticleSort,
    /// article-feed 字段开关（默认全 true）
    feed_fields: FeedFields,
    description: String,
    owner_name: String,
    owner_bio: String,
    avatar_url: String,
    masthead_url: String,
    hero_backgrounds: Vec<(String, Option<String>, Option<String>)>,
    hero_quote: String,
    favicon_url: String,
    origin: String,
    social_links: Vec<SocialLink>,
    navigation_class: &'static str,
    navigation_options: String,
    nav_corners_class: &'static str,
    /// hero-enter style 旋钮挂到 hero 容器的类（"" / " enter-wave" / " enter-none"）
    enter_class: &'static str,
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
    masthead_position: String,
    masthead_fit: String,
}

/// article-feed 部件的字段开关（article-feed.* 旋钮，未设置 = 全显示）。
#[derive(Clone)]
struct FeedFields {
    cover: bool,
    category: bool,
    date: bool,
    summary: bool,
    tags: bool,
    views: bool,
    likes: bool,
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

/// 站点脉搏条目（最近评论 + 新友链混合时间线）
#[derive(Clone)]
struct PulseCard {
    /// "comment" | "friend"
    kind: &'static str,
    author: String,
    target_title: String,
    target_url: String,
    rel_time: String,
}

/// 相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前 / N 周前 / 具体日期（与 Lit relTime 一致）
fn rel_time(of: &chrono::DateTime<chrono::FixedOffset>) -> String {
    let elapsed = chrono::Utc::now().signed_duration_since(of.with_timezone(&chrono::Utc));
    let minutes = elapsed.num_seconds().max(0) / 60;
    if minutes < 1 {
        return "刚刚".to_owned();
    }
    if minutes < 60 {
        return format!("{minutes} 分钟前");
    }
    let hours = minutes / 60;
    if hours < 24 {
        return format!("{hours} 小时前");
    }
    let days = hours / 24;
    if days < 7 {
        return format!("{days} 天前");
    }
    let weeks = days / 7;
    if weeks < 5 {
        return format!("{weeks} 周前");
    }
    of.format("%Y · %m · %d").to_string()
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
  <style>
    :root{--paper:#f3efe7;--surface:#faf8f2;--ink:#181712;--muted:#777064;--faint:#a39a8c;--line:#d7d0c3;--red:#e43c4a;--blue:#3453f4;--soft:#e8e2d5;--serif:'LXGW WenKai GB','Noto Serif SC','Songti SC',Georgia,serif;--mono:ui-monospace,'SFMono-Regular',Consolas,monospace}
    *{box-sizing:border-box}
    html{background:var(--paper);color:var(--ink);font-family:var(--serif);scroll-behavior:smooth}
    body{margin:0;min-height:100dvh;background:var(--paper);color:var(--ink);font-size:17px;line-height:1.85}
    ::selection{background:color-mix(in srgb,var(--blue) 22%,transparent)}
    a{color:inherit}
    img{display:block;max-width:100%}
    button{font:inherit;color:inherit}
    .page{width:min(100% - 48px,780px);margin:0 auto;padding:0 0 72px}
    .page.width-wide{width:min(100% - 48px,980px)}
    .page.width-full{width:min(100% - 48px,1180px)}
    /* ---------- 顶栏：一行书简字 ---------- */
    .site-nav{display:flex;align-items:baseline;gap:28px;padding:26px 0 18px;margin:0 auto 8px;width:min(100% - 48px,780px);border-bottom:1px solid var(--line)}
    .width-wide .site-nav,.site-nav{width:min(100% - 48px,780px)}
    .site-nav .brand{color:var(--ink);font-family:var(--serif);font-size:21px;font-weight:700;letter-spacing:.12em;text-decoration:none;text-transform:uppercase}
    .site-nav .nav-links{display:flex;flex-wrap:wrap;gap:4px 22px;margin-left:auto}
    .site-nav .nav-item{color:var(--muted);font-size:14px;text-decoration:none}
    .site-nav .nav-item:hover{color:var(--blue)}
    .site-nav .nav-item.active{color:var(--ink);border-bottom:2px solid var(--red)}
    .site-nav .nav-icon{display:none}
    .nav-actions{display:flex;margin-left:16px}
    .site-nav .nav-links + .nav-inner-actions,.nav-inner-actions{margin-left:auto}
    .nav-inner-actions .nav-actions{margin-left:0}
    .site-nav:has(.nav-links) .nav-inner-actions{margin-left:16px}
    .site-nav .nav-item.active + .nav-item{border-bottom:0}
    .nav-action{color:var(--muted);text-decoration:none}
    .nav-action:hover{color:var(--blue)}
    .nav-action svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;vertical-align:-3px}
    .nav-corners{display:none}
    .nav-topbar.nav-sticky{position:sticky;top:0;z-index:50;background:color-mix(in srgb,var(--paper) 92%,transparent);backdrop-filter:blur(8px)}
    /* ---------- 首屏：题字 + 引语 ---------- */
    .hero{padding:72px 0 0;text-align:left}
    .hero.has-media{padding-top:0}
    .hero-background{display:block;width:100%;aspect-ratio:21/9;overflow:hidden;border-radius:8px;background:var(--soft) center/cover no-repeat}
    .hero h1{margin:0;font-family:var(--serif);font-size:clamp(40px,7vw,64px);font-weight:700;line-height:1.2}
    .hero .hero-character.accent{color:var(--red)}
    .hero-inner{display:flex;flex-direction:column;gap:22px;padding-top:34px}
    .hero.has-media .hero-inner{padding-top:28px}
    .welcome-quote{max-width:640px;padding:0;border:0;background:none}
    .welcome-quote .quote-text{display:block;color:var(--muted);font-family:var(--serif);font-size:16.5px;line-height:1.9}
    .social-row{display:flex;flex-wrap:wrap;gap:10px 20px;margin-top:14px}
    .social-icon{display:inline-flex;width:auto;height:auto;color:var(--muted);text-decoration:none}
    .social-icon:hover{color:var(--blue)}
    .social-icon svg{width:19px;height:19px;fill:currentColor}
    .enter-button{display:inline-flex;align-items:center;gap:8px;margin:34px 0 0;padding:0 0 4px;border:0;border-bottom:1px solid var(--faint);background:none;color:var(--muted);font-family:var(--mono);font-size:12px;letter-spacing:.24em;text-decoration:none}
    .enter-button:hover{border-color:var(--blue);color:var(--blue)}
    .enter-guide{display:inline-flex;align-items:center;gap:8px}
    .enter-guide svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8}
    /* ---------- 首页结构 ---------- */
    .layout-stack{display:grid}
    .layout-stack.gap-none{gap:0}
    .layout-stack.gap-sm{gap:12px}
    .layout-stack.gap-lg{gap:26px}
    .layout-stack.gap-xl{gap:44px}
    .layout-grid{display:grid;gap:44px;padding:64px 0 0}
    .layout-grid.gap-lg{gap:26px}
    .layout-grid.gap-xl{gap:44px}
    .grid-identity{grid-template-columns:auto minmax(0,1fr);align-items:center}
    .grid-feed-rail{grid-template-columns:minmax(0,1fr) 280px;align-items:start}
    .is-sticky{position:sticky;top:88px}
    .primitive-avatar{display:grid;width:72px;height:72px;place-items:center;overflow:hidden;border-radius:50%;background:var(--soft);color:var(--muted);font-size:26px;object-fit:cover}
    .primitive-avatar img,img.primitive-avatar{width:72px;height:72px;border-radius:50%;object-fit:cover}
    .text-heading{font-size:21px;font-weight:700;line-height:1.4}
    .text-body{color:var(--muted);font-size:14.5px;line-height:1.8}
    .text-caption{color:var(--faint);font-family:var(--mono);font-size:11.5px;letter-spacing:.12em}
    .profile-log{display:none}
    /* ---------- 刊头与排序 ---------- */
    .component-kicker,.kicker{margin:0;color:var(--faint);font-family:var(--mono);font-size:10.5px;letter-spacing:.26em;text-transform:uppercase}
    .kicker.caps{margin:0 0 10px;color:var(--faint);font-family:var(--mono);font-size:10.5px;letter-spacing:.26em;text-transform:uppercase}
    .masthead{display:flex;align-items:baseline;gap:18px;margin:0 0 26px;padding:0 0 14px;border-bottom:1px solid var(--ink)}
    .masthead h1{margin:0;font-family:var(--serif);font-size:26px;font-weight:700}
    .masthead .lead{margin:0;color:var(--faint);font-family:var(--mono);font-size:11px;letter-spacing:.14em}
    .masthead .sort-tabs{display:flex;gap:6px;margin-left:auto}
    .sort-tabs a{padding:3px 12px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:12px;text-decoration:none}
    .sort-tabs a:hover{border-color:var(--blue);color:var(--blue)}
    .sort-tabs a.active{border-color:var(--ink);background:var(--ink);color:var(--paper)}
    .page-head{margin:0 0 34px;padding:0 0 22px;border-bottom:1px solid var(--ink)}
    .page-head h1{margin:0;font-family:var(--serif);font-size:34px;font-weight:700;line-height:1.3}
    .page-head .inner-lede{margin:12px 0 0;max-width:56ch;color:var(--muted);font-size:14.5px;line-height:1.85}
    .page-head.has-bg{position:relative;overflow:hidden;padding:34px 26px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
    .page-head.has-bg::before{display:none}
    .masthead-bg{position:absolute;inset:0;z-index:0;opacity:.14;background:center/cover no-repeat;filter:saturate(.7)}
    .page-head.has-bg > *{position:relative;z-index:1}
    /* ---------- 文章卡片流 ---------- */
    .article-feed{display:grid;gap:38px}
    .feed-alternating .article{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:26px;align-items:start;padding:0 0 30px;border-bottom:1px solid var(--line)}
    .feed-alternating .article:nth-of-type(even){grid-template-columns:minmax(0,7fr) minmax(0,5fr)}
    .feed-alternating .article:nth-of-type(even) .article-cover{order:2}
    .feed-alternating .article:has(.is-portrait){grid-template-columns:minmax(0,4fr) minmax(0,8fr)}
    .feed-alternating .article:nth-of-type(even):has(.is-portrait){grid-template-columns:minmax(0,8fr) minmax(0,4fr)}
    .article-cover{display:block;overflow:hidden;border-radius:8px;aspect-ratio:16/10;background:var(--soft) center/cover no-repeat}
    .article-cover.is-portrait{aspect-ratio:3/4}
    .article-cover.cover-one{background:linear-gradient(150deg,#3d5a80,#7eb6d9 55%,#c9a0b4)}
    .article-cover.cover-two{background:linear-gradient(150deg,#1d2b4a,#45618f 60%,#7eb6d9)}
    .article-cover.cover-three{background:linear-gradient(150deg,#5c4a72,#a17fa8 55%,#e8a4b4)}
    .article-cover.cover-four{background:linear-gradient(150deg,#274c57,#3f7d8c 55%,#8fc7c9)}
    .article-cover.cover-five{background:linear-gradient(150deg,#6b4a68,#b07fa0 55%,#e8c9b4)}
    .article-cover.cover-six{background:linear-gradient(150deg,#2c3e50,#5f7d9c 55%,#a9c6de)}
    .article-cover img{width:100%;height:100%;object-fit:cover}
    .article-copy{min-width:0}
    .article-copy .meta{display:flex;align-items:center;gap:12px;margin:0 0 8px;color:var(--faint);font-family:var(--mono);font-size:11px}
    .article-copy .cat{color:var(--blue);font-weight:600;text-decoration:none}
    .article-copy h3{margin:0;font-family:var(--serif);font-size:22px;font-weight:700;line-height:1.45}
    .article-copy h3 a{text-decoration:none}
    .article-copy h3 a:hover{color:var(--blue)}
    .article-copy .summary{margin:8px 0 0;color:var(--muted);font-size:14px;line-height:1.85}
    .article-copy .foot{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px;color:var(--faint);font-size:12px}
    .article-copy .foot .tags{display:flex;flex-wrap:wrap;gap:4px 10px;margin-right:auto}
    .article-copy .foot .tags a{color:var(--faint);text-decoration:none}
    .article-copy .foot .tags a:hover{color:var(--blue)}
    .feed-more{justify-self:start;padding:6px 18px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:13px;text-decoration:none}
    .feed-more:hover{border-color:var(--blue);color:var(--blue)}
    /* ---------- 侧栏 ---------- */
    .stats-card,.quote-card,.dynamic-strip,.pulse-panel{display:block;margin:0;padding:16px 0 0;border-top:1px solid var(--ink);background:none}
    .stats-card .component-kicker,.dynamic-strip .component-kicker,.pulse-panel .component-kicker{display:block;margin-bottom:12px}
    .stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 16px}
    .stat strong{display:block;font-family:var(--serif);font-size:24px;font-weight:700;line-height:1.2}
    .stat:nth-child(odd) strong{color:var(--blue)}
    .stat:nth-child(even) strong{color:var(--red)}
    .stat span{color:var(--faint);font-size:11px}
    .quote-card{margin:0;color:var(--muted);font-family:var(--serif);font-size:14.5px;font-style:italic;line-height:1.9}
    .quote-card cite{display:block;margin-top:8px;color:var(--faint);font-size:12px;font-style:normal;text-align:right}
    .dynamic-item{display:block;padding:11px 0;border-bottom:1px dashed var(--line);color:var(--muted);font-size:13px;line-height:1.75;text-decoration:none}
    .dynamic-item:last-child{border-bottom:0}
    .dynamic-item:hover{color:var(--ink)}
    .dynamic-item time{display:block;margin-bottom:2px;color:var(--faint);font-family:var(--mono);font-size:10.5px}
    .strip-more{float:right;color:var(--faint);text-decoration:none}
    .strip-more:hover{color:var(--blue)}
    .strip-note{color:var(--faint);font-size:12px}
    .pulse-item{display:block;padding:11px 0;border-bottom:1px dashed var(--line);color:var(--muted);font-size:13px;line-height:1.75;text-decoration:none}
    .pulse-item:last-child{border-bottom:0}
    .pulse-item:hover{color:var(--ink)}
    .pulse-item time{display:block;margin-bottom:2px;color:var(--faint);font-family:var(--mono);font-size:10.5px}
    .pulse-dot{display:inline-block;width:6px;height:6px;margin-right:8px;border-radius:50%;translate:0 -1px}
    .pulse-dot.pulse-comment{background:var(--blue)}
    .pulse-dot.pulse-friend{background:var(--red)}
    .pulse-text strong{color:var(--ink);font-weight:600}
    /* ---------- 归档 ---------- */
    .archive-year{margin:0 0 34px}
    .archive-year h2{margin:0 0 6px;color:var(--faint);font-family:var(--serif);font-size:22px;font-weight:400}
    .archive-year h2 span{font-size:13px}
    .archive-row{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:16px;align-items:baseline;padding:12px 2px;border-bottom:1px solid var(--line);color:inherit;text-decoration:none}
    .archive-row:hover h3 span{background-size:100% 1.5px}
    .archive-row time{color:var(--faint);font-family:var(--mono);font-size:11px}
    .archive-row h3{margin:0;font-family:var(--serif);font-size:17px;font-weight:700;line-height:1.5}
    .archive-row h3 span{background-image:linear-gradient(currentColor,currentColor);background-repeat:no-repeat;background-size:0 1.5px;background-position:0 97%;transition:background-size .3s ease}
    .archive-row .meta{display:flex;gap:12px;color:var(--faint);font-size:11.5px}
    .archive-row .cat{font-weight:600}
    .cat-b{color:var(--blue)}
    .cat-p{color:var(--red)}
    .archive-more{display:grid;grid-column:1/-1;grid-template-rows:0fr;transition:grid-template-rows .35s ease}
    .archive-row:hover .archive-more{grid-template-rows:1fr}
    .archive-more-in{display:flex;min-height:0;align-items:center;gap:16px;overflow:hidden;opacity:0;transition:opacity .25s ease}
    .archive-row:hover .archive-more-in{opacity:1}
    .archive-cover{display:block;width:120px;flex:0 0 120px;border-radius:8px;background:var(--soft) center/cover no-repeat;aspect-ratio:16/10}
    .archive-summary{margin:10px 0 4px;color:var(--muted);font-size:13px;line-height:1.8}
    /* ---------- 动态 ---------- */
    .timeline{max-width:none}
    .moment{margin:0 0 26px;padding:0 0 22px;border-bottom:1px solid var(--line)}
    .moment-card{min-width:0}
    .moment-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}
    .moment-avatar{display:grid;width:34px;height:34px;flex:none;place-items:center;overflow:hidden;border-radius:50%;background:var(--soft);color:var(--muted);font-size:14px}
    .moment-avatar img{width:100%;height:100%;object-fit:cover}
    .moment-who{display:flex;align-items:baseline;gap:10px;min-width:0}
    .moment-author{font-weight:600;font-size:14px}
    .moment-who time{color:var(--faint);font-family:var(--mono);font-size:11px}
    .moment-mood{padding:1px 10px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:11px}
    .moment-text{font-size:15px}
    .moment-text p{margin:0 0 .9em}
    .m-single{margin:12px 0;border-radius:8px;overflow:hidden}
    .m-single img{border-radius:8px}
    .m-grid{display:grid;gap:8px;margin:12px 0}
    .m-grid.count-2,.m-grid.count-4{grid-template-columns:1fr 1fr}
    .m-grid.count-3{grid-template-columns:1fr 1fr 1fr}
    .m-grid img{width:100%;border-radius:8px;object-fit:cover}
    .mfoot{display:flex;align-items:center;gap:16px;margin-top:10px}
    .m-like{margin:0;padding:0}
    .heart-button{display:inline-flex;align-items:center;gap:6px;padding:2px 12px 2px 6px;border:1px solid var(--line);border-radius:999px;background:none;color:var(--faint);font-size:12px;cursor:pointer}
    .heart-button:hover{border-color:var(--red);color:var(--red)}
    .heart-button svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linejoin:round}
    .m-count{display:inline-flex;align-items:center;gap:6px;color:var(--faint);font-size:12px}
    .m-count svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.6}
    .m-comments{margin-top:12px;padding:12px 14px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
    .m-comments .comment{margin:0 0 12px;padding:0;border:0}
    .m-reply{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
    .m-reply input[name=content]{flex:1 1 100%;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink);font:inherit;font-size:13.5px}
    .m-reply-more{display:flex;flex:1 1 100%;gap:8px}
    .m-reply-more input{flex:1;min-width:0;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink);font:inherit;font-size:13px}
    .m-reply button{padding:8px 20px;border:1px solid var(--ink);border-radius:999px;background:var(--ink);color:var(--paper);font-size:12.5px;cursor:pointer}
    .m-reply button:hover{background:var(--blue);border-color:var(--blue)}
    /* ---------- 友链 ---------- */
    .friends-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .friend{display:flex;align-items:flex-start;gap:14px;padding:16px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:inherit;text-decoration:none}
    .friend:hover{border-color:var(--blue)}
    .friend-avatar{display:grid;width:44px;height:44px;flex:none;place-items:center;overflow:hidden;border-radius:50%;background:var(--soft);color:var(--muted);font-size:17px}
    .friend-avatar img{width:100%;height:100%;object-fit:cover}
    .friend h3{margin:0 0 2px;font-family:var(--serif);font-size:16px;font-weight:700}
    .friend .furl{display:block;color:var(--faint);font-family:var(--mono);font-size:11px}
    .friend p{margin:6px 0 0;color:var(--muted);font-size:12.5px;line-height:1.7}
    .friend-apply{margin-top:40px;padding-top:26px;border-top:1px solid var(--ink)}
    .friend-apply h2{margin:8px 0 10px;font-family:var(--serif);font-size:22px;font-weight:700}
    .friend-apply-lede{margin:0 0 18px;max-width:52ch;color:var(--muted);font-size:13.5px;line-height:1.85}
    .friend-apply-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
    .friend-apply label,.friend-apply-desc{display:grid;gap:6px;color:var(--muted);font-size:12px}
    .friend-apply input,.friend-apply textarea{box-sizing:border-box;width:100%;padding:9px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font:inherit;font-size:13.5px}
    .friend-apply input:focus,.friend-apply textarea:focus{outline:none;border-color:var(--blue)}
    .friend-apply-foot{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:14px}
    .friend-apply-note{margin:0;color:var(--muted);font-size:12px}
    .friend-apply-note.ok{color:var(--blue)}
    .friend-apply button{padding:9px 24px;border:1px solid var(--ink);border-radius:999px;background:var(--ink);color:var(--paper);font-size:13px;cursor:pointer}
    .friend-apply button:hover{background:var(--blue);border-color:var(--blue)}
    /* ---------- 搜索 ---------- */
    .search-box{display:flex;gap:10px;margin:0 0 26px}
    .search-box input{flex:1;padding:10px 14px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font:inherit;font-size:15px}
    .search-box input:focus{outline:none;border-color:var(--blue)}
    .search-box button{padding:10px 24px;border:1px solid var(--ink);border-radius:999px;background:var(--ink);color:var(--paper);font-size:13.5px;cursor:pointer}
    .filter-group{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 26px}
    .filter-chip{padding:3px 12px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:12px;text-decoration:none}
    .filter-chip:hover{border-color:var(--blue);color:var(--blue)}
    .filter-chip.on{border-color:var(--ink);background:var(--ink);color:var(--paper)}
    .results{display:grid;gap:0}
    .results .cap{margin:0 0 8px;color:var(--faint);font-size:12px;letter-spacing:.14em}
    .result{display:block;padding:12px 2px;border-bottom:1px solid var(--line);color:inherit;text-decoration:none}
    .result:hover h3{color:var(--blue)}
    .result h3{margin:0 0 4px;font-family:var(--serif);font-size:16.5px;font-weight:700}
    .result p{margin:0;color:var(--muted);font-size:13px;line-height:1.8}
    .result mark{padding:0 2px;border-radius:2px;background:color-mix(in srgb,var(--red) 22%,transparent);color:inherit}
    /* ---------- 文章页 ---------- */
    .article-page{position:relative;width:min(100%,720px);margin:0 auto}
    .post-back{display:inline-block;margin-bottom:26px;color:var(--faint);font-size:13px;text-decoration:none}
    .post-back:hover{color:var(--blue)}
    .post-head{margin-bottom:30px}
    .article-page h1{margin:0 0 12px;font-family:var(--serif);font-size:clamp(28px,4.6vw,38px);font-weight:700;line-height:1.35}
    .post-meta{display:flex;flex-wrap:wrap;gap:10px;margin:0;color:var(--faint);font-family:var(--mono);font-size:11.5px}
    .post-summary{margin:14px 0 0;color:var(--muted);font-size:15px;line-height:1.85}
    .post-cover{width:100%;margin:0 0 34px;border-radius:8px;background:var(--soft) center/cover no-repeat;aspect-ratio:16/10}
    .post-cover.natural{max-height:68vh}
    .post-cover.shrink{width:min(100%,calc(68vh * var(--r)));margin-right:auto;margin-left:auto}
    .post-toc{display:none}
    .post-toc-mobile{margin:0 0 26px;padding:12px 16px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
    .post-toc-mobile summary{color:var(--muted);font-family:var(--mono);font-size:11.5px;letter-spacing:.14em;cursor:pointer}
    .post-toc-mobile .post-toc-item{margin-top:8px}
    .post-toc-kicker{margin:0 0 12px;color:var(--faint);font-family:var(--mono);font-size:10px;letter-spacing:.26em;text-transform:uppercase}
    .post-toc-item{display:block;padding:5px 0;color:var(--muted);font-family:var(--serif);font-size:13px;text-decoration:none}
    .post-toc-item:hover{color:var(--blue)}
    .post-toc-item.level-2{padding-left:12px}
    .post-toc-item.level-3{padding-left:24px}
    .post-toc-item.is-active{color:var(--blue)}
    @media(min-width:1280px){
      .post-toc{position:absolute;top:0;right:calc(100% + 48px);display:block;width:200px;height:100%}
      .post-toc-sticky{position:sticky;top:96px;max-height:calc(100dvh - 130px);overflow-y:auto;padding-left:14px;border-left:1px solid var(--line);scrollbar-width:thin}
    }
    .post-notes{display:block;margin:36px 0 0;padding:16px 0 0;border-top:1px solid var(--line)}
    .post-notes-kicker{margin:0 0 12px;color:var(--faint);font-family:var(--mono);font-size:10px;letter-spacing:.26em;text-transform:uppercase}
    .post-note{display:flex;gap:8px;margin:0 0 10px;color:var(--muted);font-size:13px;line-height:1.8}
    .post-note:target{background:color-mix(in srgb,var(--blue) 8%,transparent);border-radius:6px}
    .post-note-index{flex:none;color:var(--red);font-family:var(--mono);font-size:11px}
    @media(min-width:1280px){
      .post-notes{position:absolute;top:0;left:calc(100% + 48px);width:230px;height:100%;margin:0;padding:0 0 0 16px;border-top:0;border-left:1px solid var(--line)}
      .post-notes-sticky{position:sticky;top:96px;max-height:calc(100dvh - 130px);overflow-y:auto}
    }
    /* ---------- 正文排版 ---------- */
    .article-page .prose{font-size:16.5px;line-height:2}
    .prose p{margin:0 0 1.5em}
    .prose h2{margin:2.2em 0 1em;padding-bottom:10px;border-bottom:1px solid var(--line);font-family:var(--serif);font-size:24px;font-weight:700;line-height:1.5}
    .prose h3{margin:1.9em 0 .8em;font-family:var(--serif);font-size:19px;font-weight:700;line-height:1.55}
    .prose h4,.prose h5,.prose h6{margin:1.6em 0 .7em;font-family:var(--serif);font-size:16.5px;font-weight:700}
    .prose a{color:var(--blue);text-decoration:underline;text-decoration-color:color-mix(in srgb,var(--blue) 40%,transparent);text-underline-offset:3px}
    .prose a:hover{text-decoration-color:var(--blue)}
    .prose blockquote{margin:1.8em 0;padding:2px 0 2px 18px;border-left:2px solid var(--red);color:var(--muted);font-size:16px}
    .prose blockquote p{margin:0 0 .8em}
    .prose blockquote p:last-child{margin-bottom:0}
    .prose code{padding:2px 6px;border-radius:4px;background:color-mix(in srgb,var(--blue) 10%,transparent);font-family:var(--mono);font-size:.86em}
    .prose pre{margin:1.8em 0;padding:16px 18px;overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font-size:13.5px;line-height:1.8}
    .prose pre code{padding:0;background:none;font-size:inherit}
    .prose ul,.prose ol{margin:0 0 1.5em;padding-left:1.5em}
    .prose li{margin:.4em 0}
    .prose li::marker{color:var(--red)}
    .prose hr{margin:2.6em 0;border:0;border-top:1px solid var(--line)}
    .prose img{border-radius:8px}
    .prose table{display:block;margin:1.8em 0;overflow-x:auto;border-collapse:collapse;font-size:14px}
    .prose th,.prose td{padding:7px 14px;border:1px solid var(--line);text-align:left}
    .prose th{background:var(--surface);font-family:var(--mono);font-size:12px}
    .prose .lm-callout{margin:1.8em 0;padding:12px 16px;border:1px solid var(--line);border-left:3px solid var(--blue);border-radius:8px;background:color-mix(in srgb,var(--blue) 4%,var(--surface))}
    .prose .lm-callout-title{margin:0 0 6px;font-weight:700}
    .prose .lm-callout>:last-child{margin-bottom:0}
    .prose .lm-callout[data-kind="!"]{border-left-color:var(--red);background:color-mix(in srgb,var(--red) 5%,var(--surface))}
    .prose .lm-callout[data-kind="x"]{border-left-color:#b33;background:color-mix(in srgb,#b33 5%,var(--surface))}
    .prose .lm-callout[data-kind="+"]{border-left-color:#3a7d44;background:color-mix(in srgb,#3a7d44 6%,var(--surface))}
    .prose .lm-callout[data-kind="i"]{border-left-color:var(--blue);background:color-mix(in srgb,var(--blue) 5%,var(--surface))}
    .prose .lm-fold{margin:1.8em 0;padding:10px 16px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
    .prose .lm-fold>summary{color:var(--muted);font-weight:700;cursor:pointer}
    .prose .lm-fold[open]>summary{margin-bottom:8px}
    .prose .lm-spoiler{padding:0 4px;border-radius:3px;background:var(--ink);color:transparent;cursor:help}
    .prose .lm-spoiler:hover,.prose .lm-spoiler:active{background:color-mix(in srgb,var(--ink) 12%,transparent);color:var(--ink)}
    .prose .lm-noteref a{padding:0 2px;color:var(--red);font-size:.78em;text-decoration:none}
    .prose .lm-math{margin:1.5em 0;padding:12px 16px;overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:var(--surface);font-family:var(--mono);font-size:14px;white-space:pre-wrap}
    .prose span.lm-math{padding:2px 6px;margin:0;white-space:nowrap}
    .prose .lm-verbatim,.prose .lm-mermaid{font-family:var(--mono)}
    .prose pre.lm-mermaid{padding:16px;border:1px solid var(--line);background:var(--surface);color:var(--ink);text-align:center}
    .prose .lm-mermaid svg{max-width:100%;height:auto}
    .prose .lm-ruby rt{color:var(--faint);font-size:.65em}
    .prose .lm-task{list-style:none;padding-left:.2em}
    .prose .lm-task input{margin-right:8px;accent-color:var(--blue)}
    .prose .lm-notes{color:var(--muted);font-size:13.5px}
    .prose .lm-notes li{margin:.3em 0}
    /* ---------- 评论 ---------- */
    .comments{margin-top:52px;padding-top:22px;border-top:1px solid var(--ink)}
    .comments-head{display:flex;align-items:baseline;gap:12px;margin-bottom:18px}
    .comments-head h2{margin:0;font-family:var(--serif);font-size:21px;font-weight:700}
    .comments-count{color:var(--faint);font-size:12px}
    .comment{padding:14px 0;border-bottom:1px dashed var(--line)}
    .comment:last-child{border-bottom:0}
    .comment header{display:flex;gap:10px;margin-bottom:6px}
    .comment-avatar{display:grid;width:32px;height:32px;flex:none;place-items:center;overflow:hidden;border-radius:50%;background:var(--soft);color:var(--muted);font-size:13px}
    .comment-avatar img{width:100%;height:100%;object-fit:cover}
    .comment-line{display:flex;align-items:baseline;gap:10px}
    .comment-name{color:var(--ink);font-weight:700;font-size:14px;text-decoration:none}
    .comment-name.is-owner{color:var(--red)}
    .comment-line time{color:var(--faint);font-family:var(--mono);font-size:10.5px}
    .comment-meta{display:flex;gap:10px;color:var(--faint);font-family:var(--mono);font-size:10.5px}
    .comment-meta a{color:var(--faint)}
    .comment p{margin:0;color:var(--ink);font-size:14.5px;line-height:1.8}
    .comment-form{margin:0 0 26px;padding:16px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
    .comment-form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px}
    .comment-form label{display:grid;gap:6px;color:var(--muted);font-size:12px}
    .comment-form input,.comment-form textarea{box-sizing:border-box;width:100%;padding:9px 12px;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink);font:inherit;font-size:13.5px}
    .comment-form input:focus,.comment-form textarea:focus{outline:none;border-color:var(--blue)}
    .comment-content{margin-bottom:12px}
    .comment-form-foot{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .comment-note{margin:0;color:var(--faint);font-size:11.5px}
    .comment-form button{padding:9px 24px;border:1px solid var(--ink);border-radius:999px;background:var(--ink);color:var(--paper);font-size:13px;cursor:pointer}
    .comment-form button:hover{background:var(--blue);border-color:var(--blue)}
    .comment-submitted{margin:0 0 16px;padding:10px 14px;border:1px solid var(--blue);border-radius:8px;color:var(--blue);font-size:13px}
    /* ---------- 订阅 / 页脚 / 杂项 ---------- */
    .subscribe{margin:56px auto 0;width:min(100% - 48px,780px);padding:18px 0 0;border-top:1px solid var(--ink)}
    .subscribe form{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
    .subscribe strong{margin-right:8px;font-family:var(--serif);font-size:16px}
    .subscribe input[type=email]{flex:1;min-width:200px;padding:9px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font:inherit;font-size:13.5px}
    .subscribe label{display:flex;align-items:center;gap:5px;color:var(--muted);font-size:12.5px}
    .subscribe button{padding:9px 22px;border:1px solid var(--ink);border-radius:999px;background:var(--ink);color:var(--paper);font-size:13px;cursor:pointer}
    .subscribe button:hover{background:var(--blue);border-color:var(--blue)}
    .site-footer{display:flex;justify-content:space-between;gap:14px;width:min(100% - 48px,780px);margin:48px auto 0;padding:22px 0 30px;border-top:1px solid var(--line);color:var(--faint);font-family:var(--mono);font-size:11px;letter-spacing:.12em}
    .site-footer a:hover{color:var(--blue)}
    .empty{padding:34px 0;color:var(--faint);text-align:center;font-size:13.5px}
    .pager{display:flex;justify-content:center;gap:8px;margin:36px 0 0}
    .pager a{min-width:34px;padding:5px 10px;border:1px solid var(--line);border-radius:8px;color:var(--muted);font-family:var(--mono);font-size:12px;text-align:center;text-decoration:none}
    .pager a:hover{border-color:var(--blue);color:var(--blue)}
    .pager a.active{border-color:var(--ink);background:var(--ink);color:var(--paper)}
    /* ---------- 响应式 ---------- */
    @media(max-width:968px){
      .grid-feed-rail{grid-template-columns:minmax(0,1fr)}
      .is-sticky{position:static}
      .layout-grid{padding-top:48px}
    }
    @media(max-width:760px){
      body{font-size:16px}
      .site-nav{gap:18px;padding:20px 0 14px}
      .site-nav .nav-links{gap:4px 14px}
      .hero{padding-top:44px}
      .feed-alternating .article,.feed-alternating .article:nth-of-type(even),.feed-alternating .article:has(.is-portrait),.feed-alternating .article:nth-of-type(even):has(.is-portrait){grid-template-columns:1fr}
      .feed-alternating .article:nth-of-type(even) .article-cover{order:0}
      .article-cover.is-portrait{width:min(300px,86%);margin:0 auto}
      .friends-grid{grid-template-columns:1fr}
      .friend-apply-grid,.comment-form-grid{grid-template-columns:1fr}
      .archive-row{grid-template-columns:52px minmax(0,1fr)}
      .archive-row .meta{display:none}
      .site-footer{flex-direction:column;gap:6px;text-align:center}
      .m-grid.count-3{grid-template-columns:1fr 1fr}
    }
  </style>
</head>
<body class="{{ site.font_class }} shell-{{ site.navigation_class }}{% if immersive_home %} immersive-home{% endif %}">
  {% if immersive_home %}<div class="nav-corners{{ site.nav_corners_class }}" id="nav-corners"><a class="brand" href="/">{{ site.brand_text }}</a><div class="nav-links"><a class="nav-item{% if current_section == "home" %} active{% endif %}" href="/"><span class="nav-label">首页</span></a><a class="nav-item{% if current_section == "articles" %} active{% endif %}" href="/articles"><span class="nav-label">文章</span></a><a class="nav-item{% if current_section == "dynamics" %} active{% endif %}" href="/dynamics"><span class="nav-label">动态</span></a><a class="nav-item{% if current_section == "friends" %} active{% endif %}" href="/friends"><span class="nav-label">友链</span></a></div><div class="nav-actions">{% if site.show_search %}<a class="nav-action" href="/search" aria-label="搜索"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg></a>{% endif %}</div></div>{% endif %}
  <nav id="site-nav" class="site-nav nav-{{ site.navigation_class }} {{ site.navigation_options }}{% if immersive_home %}{% else %} nav-sticky{% endif %}" aria-label="主导航">
    <a class="brand" href="/">{{ site.brand_text }}</a>
    <div class="nav-links">
      <a class="nav-item{% if current_section == "home" %} active{% endif %}" href="/"><span class="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5v8a1.5 1.5 0 0 1-1.5 1.5h-5v-6h-5v6h-5A1.5 1.5 0 0 1 3 19.5z"/></svg></span><span class="nav-label">首页</span></a>
      <a class="nav-item{% if current_section == "articles" %} active{% endif %}" href="/articles"><span class="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6zM9 10h6M9 14h6M9 18h4M15 3v4h4"/></svg></span><span class="nav-label">文章</span></a>
      <a class="nav-item{% if current_section == "dynamics" %} active{% endif %}" href="/dynamics"><span class="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H8l-4 4zM8 9h8M8 13h5"/></svg></span><span class="nav-label">动态</span></a>
      <a class="nav-item{% if current_section == "friends" %} active{% endif %}" href="/friends"><span class="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3.5 20c.6-3.3 2.4-5 5.5-5s4.9 1.7 5.5 5M14 15.5c3.7-.8 5.8.7 6.5 3.5"/></svg></span><span class="nav-label">友链</span></a>
    </div>
    <div class="nav-inner-actions"><div class="nav-actions">{% if site.show_search %}<a class="nav-action" href="/search" aria-label="搜索"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg></a>{% endif %}</div></div>
  </nav>
  <main><div class="page {{ site.page_width_class }}">{{ content|safe }}</div></main>
  {% if site.mail_enabled %}<section class="subscribe" id="subscribe"><form method="post" action="/subscriptions"><strong>订阅更新</strong><input type="email" name="email" required maxlength="254" autocomplete="email" placeholder="you@example.com"><label><input type="checkbox" name="articles" checked>文章</label><label><input type="checkbox" name="dynamics">动态</label><button type="submit">订阅</button></form></section>{% endif %}
  <footer class="site-footer"><span>© {{ site.owner_name }} · YukiLog</span><span><a href="?ssr=0">沉浸版</a> · <a href="/feed.xml">RSS</a>{% if site.mail_enabled %} · <a href="#subscribe">MAIL</a>{% endif %}</span></footer>
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
        hero_background_media_ids: serde_json::from_value(model.hero_background_media_ids)
            .map_err(|_| AppError::Internal("stored hero backgrounds do not match schema"))?,
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
        crate::ops::media::hero_background_urls(&state.database, &settings.hero_background_media_ids)
            .await;
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
    let navigation_options = {
        let mut options = match (
            settings.shell_layout.brand_position,
            settings.shell_layout.translucent,
        ) {
            (BrandPosition::Center, true) => "brand-center nav-translucent".to_owned(),
            (BrandPosition::Center, false) => "brand-center".to_owned(),
            (BrandPosition::Start, true) => "nav-translucent".to_owned(),
            (BrandPosition::Start, false) => String::new(),
        };
        // topnav display 旋钮：SSR 内页顶栏有图标，角导航没有（始终保留文字）
        match crate::content::parts::part_text(&settings.theme.parts, "topnav", "display") {
            Some("icons") => options.push_str(" topnav-icons"),
            Some("text") => options.push_str(" topnav-text"),
            Some("both") => options.push_str(" topnav-both"),
            _ => {}
        }
        options
    };
    // topnav align 旋钮：角导航对齐（居中 = 现状空串）
    let nav_corners_class = match crate::content::parts::part_text(&settings.theme.parts, "topnav", "align") {
        Some("start") => " topnav-align-start",
        Some("end") => " topnav-align-end",
        _ => "",
    };
    // hero-enter style 旋钮：白雾（默认）/ 波浪 / 无背景
    let enter_class = match crate::content::parts::part_text(&settings.theme.parts, "hero-enter", "style") {
        Some("wave") => " enter-wave",
        Some("none") => " enter-none",
        _ => "",
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
        brand_text: crate::content::parts::part_text(&settings.theme.parts, "brand", "text")
            .unwrap_or(&settings.site_title)
            .to_owned(),
        hero_title: crate::content::parts::part_text(&settings.theme.parts, "hero-title", "text")
            .unwrap_or(crate::content::parts::DEFAULT_HERO_TITLE)
            .to_owned(),
        hero_accent: crate::content::parts::part_text(&settings.theme.parts, "hero-title", "accent")
            .unwrap_or(crate::content::parts::DEFAULT_HERO_ACCENT)
            .to_owned(),
        part_vars: crate::content::parts::part_vars_css(&settings.theme.parts),
        identity_traits: crate::content::parts::part_text(
            &settings.theme.parts,
            "identity-band",
            "traits",
        )
        .unwrap_or(crate::content::parts::DEFAULT_IDENTITY_TRAITS)
        .to_owned(),
        default_sort: match crate::content::parts::part_text(
            &settings.theme.parts,
            "masthead",
            "default-sort",
        ) {
            Some("popular") => ArticleSort::Popular,
            Some("recent") => ArticleSort::Recent,
            _ => ArticleSort::Featured,
        },
        feed_fields: FeedFields {
            cover: crate::content::parts::part_bool(&settings.theme.parts, "article-feed", "cover", true),
            category: crate::content::parts::part_bool(&settings.theme.parts, "article-feed", "category", true),
            date: crate::content::parts::part_bool(&settings.theme.parts, "article-feed", "date", true),
            summary: crate::content::parts::part_bool(&settings.theme.parts, "article-feed", "summary", true),
            tags: crate::content::parts::part_bool(&settings.theme.parts, "article-feed", "tags", true),
            views: crate::content::parts::part_bool(&settings.theme.parts, "article-feed", "views", true),
            likes: crate::content::parts::part_bool(&settings.theme.parts, "article-feed", "likes", true),
        },
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
        nav_corners_class,
        enter_class,
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
        masthead_tint: (settings.theme.masthead_overlay.unwrap_or(0.0) * 100.0).round() as u8,
        masthead_position: settings
            .theme
            .masthead_position
            .unwrap_or_else(|| "center".to_owned()),
        masthead_fit: match settings.theme.masthead_fit.as_deref() {
            Some("contain") => "contain".to_owned(),
            Some("stretch") => "100% 100%".to_owned(),
            _ => "cover".to_owned(),
        },
    })
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

/// 站点脉搏：最近可见评论 + 新友链（与 /api/public/pulse 同口径，SSR 首页用）。
async fn load_pulse(state: &AppState, limit: usize) -> Result<Vec<PulseCard>, AppError> {
    let recent_comments = comments::Entity::find()
        .filter(comments::Column::Status.eq("visible"))
        .order_by_desc(comments::Column::CreatedAt)
        .limit(4)
        .all(&state.database)
        .await?;
    let mut dated: Vec<(chrono::DateTime<chrono::FixedOffset>, PulseCard)> = Vec::new();
    for comment in recent_comments {
        let (title, url) = if let Some(article_id) = comment.article_id {
            let Some(article) = articles::Entity::find_by_id(article_id)
                .one(&state.database)
                .await?
            else {
                continue;
            };
            (article.title, format!("/articles/{}#comments", article.slug))
        } else if let Some(dynamic_id) = comment.dynamic_id {
            (String::new(), format!("/dynamics#dynamic-{dynamic_id}"))
        } else {
            continue;
        };
        dated.push((comment.created_at, PulseCard {
            kind: "comment",
            author: comment.display_name,
            target_title: title,
            target_url: url,
            rel_time: rel_time(&comment.created_at),
        }));
    }
    let recent_friends = friend_links::Entity::find()
        .filter(friend_links::Column::IsVisible.eq(true))
        .order_by_desc(friend_links::Column::CreatedAt)
        .limit(3)
        .all(&state.database)
        .await?;
    for friend in recent_friends {
        dated.push((friend.created_at, PulseCard {
            kind: "friend",
            author: friend.name,
            target_title: String::new(),
            target_url: friend.url,
            rel_time: rel_time(&friend.created_at),
        }));
    }
    dated.sort_by(|a, b| b.0.cmp(&a.0));
    Ok(dated.into_iter().take(limit).map(|(_, card)| card).collect())
}

async fn load_dynamics(state: &AppState, limit: u64) -> Result<Vec<DynamicCard>, AppError> {    let models = dynamics::Entity::find()
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

/// 封面 URL + 图片宽高比（宽/高；无媒体或缺尺寸时为 None）。
async fn cover_url_and_ratio(
    state: &AppState,
    id: Option<Uuid>,
) -> Result<(String, Option<f64>), AppError> {
    let Some(id) = id else {
        return Ok((String::new(), None));
    };
    let media = media_assets::Entity::find_by_id(id)
        .one(&state.database)
        .await?;
    Ok(match media {
        Some(media) => {
            let ratio = match (media.width, media.height) {
                (Some(width), Some(height)) if width > 0 && height > 0 => {
                    Some(width as f64 / height as f64)
                }
                _ => None,
            };
            (format!("/media/{}", media.storage_key), ratio)
        }
        None => (String::new(), None),
    })
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
            navigation_options: String::new(),
            nav_corners_class: "",
            enter_class: "",
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
            masthead_position: "center".to_owned(),
            masthead_fit: "cover".to_owned(),
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
