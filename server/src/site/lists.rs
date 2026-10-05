use askama::Template;
use axum::{
    extract::{Query, State},
    response::Html,
};
use chrono::{TimeZone, Utc};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder, QuerySelect, prelude::Uuid};
use serde::Deserialize;

use crate::{
    AppState,
    entities::{categories, friend_links, tags},
    error::AppError,
};

use super::{
    ARTICLE_LIMIT, ARTICLE_PAGE_SIZE, ArticleFilter, ArticleSort, DynamicCard, avatar_fallback,
    cover_class, escape_html, host_of, load_articles, load_dynamics, load_moment_comments,
    load_site, media_url, moment_comment_count, moment_comments_html, page,
};

struct FriendCard {
    name: String,
    url: String,
    host: String,
    description: String,
    avatar_url: String,
    cover_class: String,
    initial: String,
}

#[derive(Template)]
#[template(
    source = r#"{% if dynamics.is_empty() %}<p class="empty">这里还没有公开动态。</p>{% else %}<div class="timeline">{% for item in dynamics %}<div class="moment" data-reveal id="dynamic-{{ item.id }}"><div class="moment-card"><header class="moment-head">{% if owner_avatar != "" %}<span class="comment-avatar moment-avatar has-img"><img src="{{ owner_avatar }}" alt="" loading="lazy" onerror="this.classList.add('is-broken')">{{ owner_fallback|safe }}</span>{% else %}<span class="comment-avatar moment-avatar">{{ owner_fallback|safe }}</span>{% endif %}<div class="moment-who"><span class="moment-author">{{ owner_name }}</span><time datetime="{{ item.time_iso }}" title="{{ item.time_iso }}">{{ item.rel }}</time></div>{% if let Some(mood) = item.mood %}<span class="moment-mood">{{ mood }}</span>{% endif %}</header><div class="prose moment-text">{{ item.content_html|safe }}</div>{% if item.media.len() == 1 %}<div class="m-single"><img src="{{ item.media[0].url }}" alt="{{ item.media[0].alt }}"{% if let Some(width) = item.media[0].width %} width="{{ width }}"{% endif %}{% if let Some(height) = item.media[0].height %} height="{{ height }}"{% endif %} loading="lazy"></div>{% else if item.media.len() > 1 %}<div class="m-grid count-{{ item.media.len() }}">{% for media in item.media %}<img src="{{ media.url }}" alt="{{ media.alt }}" loading="lazy">{% endfor %}</div>{% endif %}<div class="mfoot"><button class="heart-button" type="button" data-dynamic-id="{{ item.id }}" aria-pressed="false" aria-label="喜欢"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3C7.2 16.9 3.5 13.6 3.5 9.9 3.5 7.2 5.6 5 8.3 5c1.5 0 2.9.7 3.7 1.9C12.8 5.7 14.2 5 15.7 5c2.7 0 4.8 2.2 4.8 4.9 0 3.7-3.7 7-8.5 10.4Z"/></svg><span class="heart-count">{{ item.likes }}</span></button><span class="m-count"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-8 8H4l2.3-2.9A8 8 0 1 1 21 12Z"/></svg>{{ item.comment_count }}</span></div>{% if item.comment_count > 0 || item.allow_comments %}<div class="m-comments">{{ item.comments_html|safe }}{% if item.allow_comments %}<form class="m-reply" data-dynamic-id="{{ item.id }}"><input name="content" type="text" maxlength="5000" placeholder="说点什么…" aria-label="评论这条动态" autocomplete="off" required><button type="submit">发送</button><div class="m-reply-more" hidden><input name="display_name" type="text" maxlength="80" placeholder="昵称（必填）" aria-label="昵称" autocomplete="nickname"><input name="email" type="email" maxlength="254" placeholder="邮箱（选填，会公开）" aria-label="邮箱" autocomplete="email"><input name="website" type="url" maxlength="2048" placeholder="网站（选填）" aria-label="网站" autocomplete="url"></div><p class="m-reply-note" hidden></p></form>{% endif %}</div>{% endif %}</div></div>{% endfor %}</div>{% endif %}"#,
    ext = "html"
)]
struct DynamicListTemplate<'a> {
    dynamics: &'a [DynamicCard],
    owner_name: &'a str,
    owner_avatar: &'a str,
    owner_fallback: &'a str,
}

#[derive(Template)]
#[template(
    source = r#"<header class="page-head" data-reveal><p class="kicker caps">YukiLog — Friends</p><h1>友链</h1><p class="inner-lede">互联网很大，但总有一些站点值得互相留一盏灯。</p></header>{% if friends.is_empty() %}<p class="empty">暂时还没有公开友链。</p>{% else %}<div class="friends-grid">{% for friend in friends %}<a class="friend" data-reveal href="{{ friend.url }}" target="_blank" rel="friend noopener"><span class="friend-avatar {{ friend.cover_class }}">{{ friend.initial }}{% if friend.avatar_url != "" %}<img src="{{ friend.avatar_url }}" alt="" loading="lazy" onerror="this.remove()">{% endif %}</span><div><h3>{{ friend.name }}</h3><span class="furl">{{ friend.host }}</span><p>{{ friend.description }}</p></div></a>{% endfor %}</div>{% endif %}"#,
    ext = "html"
)]
struct FriendListTemplate<'a> {
    friends: &'a [FriendCard],
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
        ArticleSort::Recent,
    )
    .await?;
    let has_next = articles.len() as u64 > ARTICLE_PAGE_SIZE;
    articles.truncate(ARTICLE_PAGE_SIZE as usize);
    let mut content = String::from(
        r#"<header class="page-head" data-reveal><p class="kicker caps">YukiLog — Archive</p><h1>文章</h1><p class="inner-lede">长文、随笔与手记，按时间倒序。写得慢，但每一篇都算数。</p></header>"#,
    );
    if articles.is_empty() {
        content.push_str(r#"<p class="empty">这里还没有公开文章。</p>"#);
    }
    let mut cursor = 0;
    while cursor < articles.len() {
        let year = articles[cursor].published_year;
        let mut end = cursor;
        while end < articles.len() && articles[end].published_year == year {
            end += 1;
        }
        content.push_str(&format!(
            r#"<section class="archive-year"><h2 data-reveal>{year} <span>{} 篇</span></h2>"#,
            end - cursor
        ));
        for (index, article) in articles[cursor..end].iter().enumerate() {
            let category_class = if index % 2 == 0 { "cat-b" } else { "cat-p" };
            let cover = if article.cover_url.is_empty() {
                format!(
                    r#"<i class="archive-cover {}" role="img" aria-label="{}"></i>"#,
                    article.cover_class,
                    escape_html(&article.title)
                )
            } else {
                format!(
                    r#"<i class="archive-cover" role="img" aria-label="{}" style="background-image:url({})"></i>"#,
                    escape_html(&article.title),
                    escape_html(&article.cover_url)
                )
            };
            content.push_str(&format!(
                r#"<a class="archive-row" data-reveal href="/articles/{}"><time>{}</time><h3><span>{}</span></h3><div class="meta"><span class="cat {}">{}</span><span>{} 阅读</span></div><div class="archive-more"><div class="archive-more-in">{}<p class="archive-summary">{}</p></div></div></a>"#,
                escape_html(&article.slug),
                escape_html(&article.published[5..].replace('-', ".")),
                escape_html(&article.title),
                category_class,
                escape_html(&article.category),
                article.views,
                cover,
                escape_html(&article.summary)
            ));
        }
        content.push_str("</section>");
        cursor = end;
    }
    let pagination = pagination_html(&query, page_number, has_next);
    page(&site, "文章", &format!("{content}{pagination}"))
}

pub async fn dynamic_list(State(state): State<AppState>) -> Result<Html<String>, AppError> {
    let site = load_site(&state).await?;
    let mut dynamics = load_dynamics(&state, ARTICLE_LIMIT).await?;
    let ids = dynamics.iter().map(|item| item.id).collect::<Vec<_>>();
    let mut comments = load_moment_comments(&state, &ids, &site.owner_name).await?;
    for item in &mut dynamics {
        item.comments = comments.remove(&item.id).unwrap_or_default();
        item.comment_count = moment_comment_count(&item.comments);
        item.comments_html = moment_comments_html(&item.comments);
    }
    let timeline = DynamicListTemplate {
        dynamics: &dynamics,
        owner_name: &site.owner_name,
        owner_avatar: &site.avatar_url,
        owner_fallback: avatar_fallback(&site.owner_name),
    }
    .render()
    .map_err(|_| AppError::Internal("render dynamics"))?;
    let content = format!(
        r#"<header class="page-head" data-reveal><p class="kicker caps">YukiLog — Moments</p><h1>动态</h1><p class="inner-lede">短句与片刻，散落在时间里的星。不必完整，真实就好。</p></header>{timeline}"#
    );
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
    for (index, model) in models.into_iter().enumerate() {
        let avatar_url = match model.avatar_url {
            Some(url) => url,
            None => {
                let local = media_url(&state, model.avatar_media_id).await?;
                if local.is_empty() {
                    format!("https://{}/favicon.ico", host_of(&model.url))
                } else {
                    local
                }
            }
        };
        friends.push(FriendCard {
            initial: model.name.chars().next().unwrap_or('雪').to_string(),
            host: host_of(&model.url),
            name: model.name,
            url: model.url,
            description: model.description.unwrap_or_default(),
            avatar_url,
            cover_class: cover_class(index).to_owned(),
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
    let term_owned: String = query.q.trim().chars().take(100).collect();
    let term = term_owned.as_str();
    let articles = if term.is_empty() {
        Vec::new()
    } else {
        load_articles(
            &state,
            ARTICLE_LIMIT,
            0,
            Some(term),
            &ArticleFilter::default(),
            ArticleSort::Recent,
        )
        .await?
    };
    let mut content = String::from(
        r#"<header class="page-head center" data-reveal><p class="kicker caps">YukiLog — Search</p><h1>搜索</h1><p class="inner-lede">在文章、动态与随记里，找一段你还记得的话。</p></header>"#,
    );
    let hint_tags = tags::Entity::find()
        .order_by_asc(tags::Column::Name)
        .limit(3)
        .all(&state.database)
        .await?;
    let placeholder = if hint_tags.is_empty() {
        "输入关键词，回车搜索".to_owned()
    } else {
        let words = hint_tags
            .iter()
            .map(|tag| tag.name.as_str())
            .collect::<Vec<_>>()
            .join("、");
        format!("试着搜搜：{words}……")
    };
    content.push_str(&format!(
        r#"<form class="search-box" method="get" action="/search"><input name="q" value="{}" maxlength="100" aria-label="搜索关键词" placeholder="{}"><button type="submit">搜索</button></form><p class="search-hint">ENTER 搜索 · 支持标题 / 正文 / 标签</p>"#,
        escape_html(term),
        escape_html(&placeholder)
    ));
    if !term.is_empty() {
        if articles.is_empty() {
            content.push_str(r#"<p class="search-hint">没有符合这些条件的文章。</p>"#);
        } else {
            content.push_str(&format!(
                r#"<div class="results"><p class="cap" data-reveal>「{}」· {} 条结果</p>"#,
                escape_html(term),
                articles.len()
            ));
            for article in &articles {
                content.push_str(&format!(
                    r#"<a class="result" data-reveal href="/articles/{}"><div class="meta"><span class="cat">{}</span><time>{}</time></div><h3>{}</h3><p>{}</p></a>"#,
                    escape_html(&article.slug),
                    escape_html(&article.category),
                    escape_html(&article.published),
                    highlight(&article.title, term),
                    highlight(&article.summary, term)
                ));
            }
            content.push_str("</div>");
        }
    }
    page(&site, "搜索", &content)
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
    let mut links = String::from(r#"<nav class="pagination" aria-label="文章分页">"#);
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

fn highlight(text: &str, term: &str) -> String {
    let escaped = escape_html(text);
    let needle = escape_html(term);
    if needle.is_empty() {
        return escaped;
    }
    escaped.replace(&needle, &format!("<mark>{needle}</mark>"))
}

#[cfg(test)]
mod tests {
    use super::*;

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
