use askama::Template;
use axum::{
    extract::{Path, State},
    response::Html,
};
use chrono::{DateTime, FixedOffset, Utc};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder};

use crate::{
    AppState,
    entities::{articles, categories, comments},
    error::AppError,
    markup,
};

use super::{avatar_fallback, date, host_of, load_site, media_url, page};

struct CommentCard {
    display_name: String,
    email: String,
    website: String,
    host: String,
    avatar_url: String,
    fallback_svg: &'static str,
    agent_label: String,
    content: String,
    created: String,
}

#[derive(Template)]
#[template(
    source = r##"<article class="article-page"><a class="post-back" href="/articles">← 返回</a><header class="post-head" data-reveal><p class="component-kicker">{{ category }}</p><h1>{{ title }}</h1><p class="post-meta"><time>{{ published }}</time></p>{% if summary != "" %}<p class="post-summary">{{ summary }}</p>{% endif %}</header>{% if toc.len() > 1 %}<nav class="post-toc" aria-label="目录"><div class="post-toc-sticky"><p class="post-toc-kicker">目录</p>{% for item in toc %}<a class="post-toc-item level-{{ item.level }}" href="#{{ item.id }}">{{ item.text }}</a>{% endfor %}</div></nav>{% endif %}{% if cover_url != "" %}<div class="post-cover" style="background-image:url({{ cover_url }})" role="img" aria-label="{{ title }}"></div>{% endif %}{% if toc.len() > 1 %}<details class="post-toc-mobile" data-reveal><summary>目录 · {{ toc.len() }} 节</summary>{% for item in toc %}<a class="post-toc-item level-{{ item.level }}" href="#{{ item.id }}">{{ item.text }}</a>{% endfor %}</details>{% endif %}<div class="prose">{{ body_html|safe }}</div></article><section class="comments" data-reveal><header class="comments-head"><h2>评论</h2><span class="comments-count">{{ comments.len() }} 条</span></header><button class="comment-compose" type="button" aria-expanded="false"><span class="comment-avatar">{{ compose_avatar|safe }}</span><span class="comment-compose-hint">写下你的想法，点这里开始评论…</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button><form class="comment-form" data-article-id="{{ article_id }}" hidden><div class="comment-form-grid"><label>昵称<input name="display_name" required maxlength="80" placeholder="怎么称呼你"></label><label>邮箱（选填，会公开展示）<input name="email" type="email" maxlength="254" placeholder="用于头像和公开展示"></label><label>网站（选填）<input name="website" type="url" maxlength="2048" placeholder="https://"></label></div><label class="comment-content">内容<textarea name="content" required rows="4" maxlength="5000" placeholder="想说什么都可以，慢一点也没关系。"></textarea></label><div class="comment-form-foot"><p class="comment-note">评论会在审核后显示；昵称和邮箱会公开展示。</p><div class="comment-form-actions"><button class="comment-cancel" type="button">先不写了</button><button type="submit">寄出评论</button></div></div></form><p class="comment-submitted" hidden>评论已寄出，审核通过后会显示。</p>{% if comments.is_empty() %}<p class="empty">暂时还没有评论。</p>{% else %}<ol class="comment-list">{% for comment in comments %}<li class="comment"><header>{% if comment.avatar_url == "" %}<span class="comment-avatar">{{ comment.fallback_svg|safe }}</span>{% else %}<span class="comment-avatar has-img"><img src="{{ comment.avatar_url }}" alt="" loading="lazy" onerror="this.classList.add('is-broken')">{{ comment.fallback_svg|safe }}</span>{% endif %}<div class="comment-who"><div class="comment-line">{% if comment.website != "" %}<a class="comment-name" href="{{ comment.website }}" rel="ugc nofollow noopener">{{ comment.display_name }}</a>{% else %}<span class="comment-name">{{ comment.display_name }}</span>{% endif %}<time>{{ comment.created }}</time></div><div class="comment-meta">{% if comment.website != "" %}<a class="comment-site" href="{{ comment.website }}" rel="ugc nofollow noopener">{{ comment.host }}</a>{% endif %}{% if comment.email != "" %}<span>{{ comment.email }}</span>{% endif %}{% if comment.agent_label != "" %}<span>{{ comment.agent_label }}</span>{% endif %}</div></div></header><p>{{ comment.content }}</p></li>{% endfor %}</ol>{% endif %}</section>"##,
    ext = "html"
)]
struct ArticleDetailTemplate<'a> {
    title: &'a str,
    category: &'a str,
    published: &'a str,
    summary: &'a str,
    cover_url: &'a str,
    body_html: &'a str,
    toc: &'a [markup::Heading],
    comments: &'a [CommentCard],
    article_id: &'a str,
    compose_avatar: &'a str,
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
    let cover_url = media_url(&state, article.cover_media_id).await?;
    let comment_models = comments::Entity::find()
        .filter(comments::Column::ArticleId.eq(article.id))
        .filter(comments::Column::Status.eq("visible"))
        .order_by_asc(comments::Column::CreatedAt)
        .all(&state.database)
        .await?;
    let comment_cards = comment_models
        .into_iter()
        .map(|comment| {
            let avatar_url = crate::content::public::comment_avatar_url(
                comment.website.as_deref(),
                comment.email.as_deref(),
            );
            let host = comment
                .website
                .as_deref()
                .map(|website| host_of(website))
                .unwrap_or_default();
            let agent_label =
                crate::markup::agent_label(comment.user_agent.as_deref().unwrap_or(""));
            let fallback_svg = avatar_fallback(&comment.display_name);
            CommentCard {
                display_name: comment.display_name,
                email: comment.email.unwrap_or_default(),
                website: comment.website.unwrap_or_default(),
                host,
                avatar_url,
                fallback_svg,
                agent_label,
                content: comment.content,
                created: comment_datetime(comment.created_at),
            }
        })
        .collect::<Vec<_>>();
    let rendered = markup::render(&article.body_markdown);
    let published = date(
        article
            .published_at
            .expect("published article has timestamp"),
    );
    let article_id = article.id.to_string();
    let content = ArticleDetailTemplate {
        title: &article.title,
        category: &category.name,
        published: &published,
        summary: article.summary.as_deref().unwrap_or_default(),
        cover_url: &cover_url,
        body_html: &rendered.html,
        toc: &rendered.headings,
        comments: &comment_cards,
        article_id: &article_id,
        compose_avatar: avatar_fallback("来访者"),
    }
    .render()
    .map_err(|_| AppError::Internal("render article"))?;
    page(&site, &article.title, &content)
}

fn comment_datetime(value: DateTime<FixedOffset>) -> String {
    value.format("%Y · %m · %d / %H:%M").to_string()
}
