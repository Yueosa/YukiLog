use sea_orm::{ConnectionTrait, DatabaseConnection, TransactionTrait};
use chrono::{DateTime, FixedOffset};

use crate::domain::status::PostStatus;
use crate::repo;
use crate::repo::posts::{CreatePost, UpdatePost as RepoUpdatePost};
use crate::service::error::{ServiceError, ServiceResult};
use crate::service::tags::Tag;
use crate::service::themes::Theme;

// ================================
// DTO 定义
// ================================

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Post {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub summary: Option<String>,
    pub content: String,
    pub cover_image: Option<String>,
    pub status: PostStatus,
    pub is_featured: bool,
    pub theme_id: Option<i64>,
    pub view_count: i64,
    pub created_at: DateTime<FixedOffset>,
    pub updated_at: DateTime<FixedOffset>,
}

impl From<repo::posts::PostDto> for Post {
    fn from(dto: repo::posts::PostDto) -> Self {
        Self {
            id: dto.id,
            title: dto.title,
            slug: dto.slug,
            summary: dto.summary,
            content: dto.content,
            cover_image: dto.cover_image,
            status: dto.status.unwrap_or(PostStatus::Draft),
            is_featured: dto.is_featured,
            theme_id: dto.theme_id,
            view_count: dto.view_count.unwrap_or(0),
            created_at: dto.created_at.unwrap_or_else(|| chrono::Utc::now().into()),
            updated_at: dto.updated_at.unwrap_or_else(|| chrono::Utc::now().into()),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PostWithRelations {
    pub post: Post,
    pub theme: Option<Theme>,
    pub tags: Vec<Tag>,
}

#[derive(Debug, Clone)]
pub struct CreatePostInput {
    pub title: String,
    pub slug: String,
    pub summary: Option<String>,
    pub content: String,
    pub cover_image: Option<String>,
    pub theme_slug: Option<String>,
    pub tag_slugs: Vec<String>,
    pub status: PostStatus,
    pub is_featured: bool,
}

#[derive(Debug, Clone, Default)]
pub struct UpdatePostInput {
    pub title: Option<String>,
    pub slug: Option<String>,
    pub summary: Option<Option<String>>,
    pub content: Option<String>,
    pub cover_image: Option<Option<String>>,
    pub theme_slug: Option<Option<String>>,
    pub tag_slugs: Option<Vec<String>>,
    pub status: Option<PostStatus>,
    pub is_featured: Option<bool>,
}

#[derive(Debug, Clone, Default)]
pub struct PostFilter {
    pub theme_slugs: Option<Vec<String>>,
    pub tag_slugs: Option<Vec<String>>,  // AND 逻辑
    pub status: Option<PostStatus>,
    pub is_featured: Option<bool>,
    pub sort_by: Option<PostSortBy>,
    pub count: Option<u64>,
    pub page: Option<u64>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PostSortBy {
    CreatedAt,   // 按创建时间倒序（最新文章）
    UpdatedAt,   // 按更新时间倒序（最近更新）
    ViewCount,   // 按浏览量倒序（最热门）
}

// ================================
// 业务逻辑
// ================================

/// 1. 创建文章
/// 
/// 逻辑：
/// - 获取/创建所有标签
/// - 获取主题 ID（如果提供）
/// - 创建文章
/// - 创建 post_tags 关联
/// - 如果 status=published：同步 theme/tags 计数
pub async fn create_post(
    db: &DatabaseConnection,
    input: CreatePostInput,
) -> ServiceResult<Post> {
    // 校验 slug 格式
    if !is_valid_slug(&input.slug) {
        return Err(ServiceError::InvalidInput(
            "slug must contain only letters, numbers, hyphens, and underscores".to_string(),
        ));
    }

    let txn = db.begin().await?;

    // 1. 获取/创建标签
    let mut tag_ids = Vec::new();
    for tag_slug in &input.tag_slugs {
        let tag = crate::service::tags::get_or_create_tag(
            &txn,
            tag_slug,  // 用 slug 作为默认 name
            tag_slug,
        ).await?;
        tag_ids.push(tag.id);
    }

    // 2. 获取主题 ID
    let theme_id = if let Some(theme_slug) = &input.theme_slug {
        let theme = crate::service::themes::get_theme_by_slug(&txn, theme_slug).await?;
        Some(theme.id)
    } else {
        None
    };

    // 3. 创建文章
    let create_input = CreatePost {
        title: input.title,
        slug: input.slug,
        summary: input.summary,
        content: input.content,
        cover_image: input.cover_image,
        status: Some(input.status.as_str().to_string()),
        theme_id,
        is_featured: input.is_featured,
    };
    let post_dto = repo::posts::create_post(&txn, create_input).await?;

    // 4. 创建 post_tags 关联
    for tag_id in &tag_ids {
        let input = crate::repo::post_tags::CreatePostTag {
            post_id: post_dto.id,
            tag_id: *tag_id,
        };
        repo::post_tags::create_post_tag(&txn, input).await?;
    }

    // 5. 如果是已发布状态，同步计数
    if post_dto.status == Some(PostStatus::Published) {
        if let Some(tid) = theme_id {
            crate::service::themes::adjust_post_count(&txn, tid, 1).await?;
        }
        for tag_id in &tag_ids {
            crate::service::tags::adjust_post_count(&txn, *tag_id, 1).await?;
        }
    }

    txn.commit().await?;
    Ok(post_dto.into())
}

/// 2. 获取已发布文章详情（前台）
pub async fn get_published_post_by_slug(
    db: &DatabaseConnection,
    slug: &str,
) -> ServiceResult<Post> {
    let post_dto = repo::posts::get_post_by_slug(db, slug).await?;
    if post_dto.status != Some(PostStatus::Published) {
        return Err(ServiceError::NotFound);
    }
    Ok(post_dto.into())
}

/// 3. 获取文章详情（后台，包括草稿）
pub async fn get_post_by_slug(
    db: &DatabaseConnection,
    slug: &str,
) -> ServiceResult<Post> {
    let post_dto = repo::posts::get_post_by_slug(db, slug).await?;
    Ok(post_dto.into())
}

/// 4. 获取文章及其关联数据
pub async fn get_post_with_relations(
    db: &DatabaseConnection,
    slug: &str,
    include_draft: bool,
) -> ServiceResult<PostWithRelations> {
    let post = if include_draft {
        get_post_by_slug(db, slug).await?
    } else {
        get_published_post_by_slug(db, slug).await?
    };

    // 获取主题
    let theme = if let Some(theme_id) = post.theme_id {
        Some(crate::service::themes::get_theme_by_id(db, theme_id).await?)
    } else {
        None
    };

    // 获取标签
    let tags = get_post_tags(db, post.id).await?;

    Ok(PostWithRelations { post, theme, tags })
}

/// 4-2. 列出文章（含关联数据）
/// 
/// 优化版本：使用批量查询减少数据库往返
pub async fn list_posts_with_relations(
    db: &DatabaseConnection,
    filter: PostFilter,
) -> ServiceResult<Vec<PostWithRelations>> {
    // 1. 先获取文章列表
    let posts = list_posts(db, filter).await?;
    
    if posts.is_empty() {
        return Ok(vec![]);
    }
    
    // 2. 提取所有 theme_id 和 post_id
    let theme_ids: Vec<i64> = posts.iter()
        .filter_map(|p| p.theme_id)
        .collect();
    let post_ids: Vec<i64> = posts.iter()
        .map(|p| p.id)
        .collect();
    
    // 3. 批量查询所有主题（一次查询）
    let themes = if !theme_ids.is_empty() {
        crate::service::themes::get_themes_by_ids(db, &theme_ids).await?
    } else {
        vec![]
    };
    let theme_map: std::collections::HashMap<i64, Theme> = themes
        .into_iter()
        .map(|t| (t.id, t))
        .collect();
    
    // 4. 批量查询所有标签（一次查询）
    let tags_map = get_posts_tags_batch(db, &post_ids).await?;
    
    // 5. 组装数据
    let results = posts.into_iter().map(|post| {
        let theme = post.theme_id.and_then(|tid| theme_map.get(&tid).cloned());
        let tags = tags_map.get(&post.id).cloned().unwrap_or_default();
        PostWithRelations { post, theme, tags }
    }).collect();
    
    Ok(results)
}

/// 5. 列出文章
/// 
/// 支持按主题、标签（AND）、状态筛选，以及排序和分页
pub async fn list_posts(
    db: &DatabaseConnection,
    filter: PostFilter,
) -> ServiceResult<Vec<Post>> {
    // 解析主题 slug → ID
    let theme_ids = if let Some(theme_slugs) = &filter.theme_slugs {
        if !theme_slugs.is_empty() {
            Some(crate::service::themes::get_theme_ids_by_slugs(db, theme_slugs).await?)
        } else {
            None
        }
    } else {
        None
    };

    // 解析标签 slug → 文章 ID（AND 逻辑）
    let post_ids = if let Some(tag_slugs) = &filter.tag_slugs {
        if !tag_slugs.is_empty() {
            let tag_ids = crate::service::tags::get_tag_ids_by_slugs(db, tag_slugs).await?;
            if tag_ids.len() != tag_slugs.len() {
                return Ok(vec![]);
            }
            let ids = repo::posts::get_post_ids_with_all_tags(db, &tag_ids, tag_slugs.len() as i64).await?;
            if ids.is_empty() {
                return Ok(vec![]);
            }
            Some(ids)
        } else {
            None
        }
    } else {
        None
    };

    let status_str = filter.status.as_ref().map(|s| s.as_str());
    let sort_by = match filter.sort_by.unwrap_or(PostSortBy::CreatedAt) {
        PostSortBy::CreatedAt => "created_at",
        PostSortBy::UpdatedAt => "updated_at",
        PostSortBy::ViewCount => "view_count",
    };

    let dtos = repo::posts::list_posts_filtered(
        db, theme_ids, post_ids, status_str, filter.is_featured, sort_by, filter.count, filter.page,
    ).await?;

    Ok(dtos.into_iter().map(Into::into).collect())
}

/// 6. 更新文章
/// 
/// 逻辑：
/// - 处理 theme 变化（计数同步）
/// - 处理 tags 变化（计数同步）
/// - 处理 status 变化（计数同步）
pub async fn update_post(
    db: &DatabaseConnection,
    current_slug: &str,
    input: UpdatePostInput,
) -> ServiceResult<Post> {
    // 校验新 slug 格式
    if let Some(ref new_slug) = input.slug {
        if !is_valid_slug(new_slug) {
            return Err(ServiceError::InvalidInput(
                "slug must contain only letters, numbers, hyphens, and underscores".to_string(),
            ));
        }
    }

    let txn = db.begin().await?;

    // 获取当前文章
    let current_post = repo::posts::get_post_by_slug(&txn, current_slug).await?;
    let old_status = current_post.status.clone();
    let old_theme_id = current_post.theme_id;

    // 处理主题变化
    let new_theme_id = if let Some(ref theme_slug_opt) = input.theme_slug {
        match theme_slug_opt {
            None => None,
            Some(theme_slug) => {
                let theme = crate::service::themes::get_theme_by_slug(&txn, theme_slug).await?;
                Some(theme.id)
            }
        }
    } else {
        old_theme_id
    };

    // 处理标签变化
    if let Some(ref new_tag_slugs) = input.tag_slugs {
        // 获取当前标签
        let old_tags = get_post_tags(&txn, current_post.id).await?;
        let old_tag_ids: std::collections::HashSet<_> = old_tags.iter().map(|t| t.id).collect();

        // 获取/创建新标签
        let mut new_tag_ids = Vec::new();
        for tag_slug in new_tag_slugs {
            let tag = crate::service::tags::get_or_create_tag(&txn, tag_slug, tag_slug).await?;
            new_tag_ids.push(tag.id);
        }
        let new_tag_ids_set: std::collections::HashSet<_> = new_tag_ids.iter().copied().collect();

        // 计算差异
        let to_add: Vec<_> = new_tag_ids_set.difference(&old_tag_ids).copied().collect();
        let to_remove: Vec<_> = old_tag_ids.difference(&new_tag_ids_set).copied().collect();

        // 添加新标签关联
        for tag_id in &to_add {
            let input = crate::repo::post_tags::CreatePostTag {
                post_id: current_post.id,
                tag_id: *tag_id,
            };
            repo::post_tags::create_post_tag(&txn, input).await?;
            if old_status == Some(PostStatus::Published) {
                crate::service::tags::adjust_post_count(&txn, *tag_id, 1).await?;
            }
        }

        // 移除旧标签关联
        for tag_id in &to_remove {
            repo::post_tags::delete_post_tag(&txn, current_post.id, *tag_id).await?;
            if old_status == Some(PostStatus::Published) {
                crate::service::tags::adjust_post_count(&txn, *tag_id, -1).await?;
            }
        }
    }

    // 处理状态变化
    let new_status_opt = input.status.as_ref().or(old_status.as_ref());
    let status_changed = input.status.is_some() && new_status_opt != old_status.as_ref();
    
    if status_changed {
        let delta = match (&old_status, new_status_opt) {
            (Some(PostStatus::Draft), Some(PostStatus::Published)) | 
            (None, Some(PostStatus::Published)) => 1,
            (Some(PostStatus::Published), Some(PostStatus::Draft)) |
            (Some(PostStatus::Published), None) => -1,
            _ => 0,
        };

        if delta != 0 {
            // 同步主题计数
            if let Some(tid) = new_theme_id {
                crate::service::themes::adjust_post_count(&txn, tid, delta).await?;
            }
            // 同步标签计数
            let tags = get_post_tags(&txn, current_post.id).await?;
            for tag in tags {
                crate::service::tags::adjust_post_count(&txn, tag.id, delta).await?;
            }
        }
    }

    // 处理主题变化（仅在已发布状态同步计数）
    let is_published = old_status == Some(PostStatus::Published) || 
                       new_status_opt == Some(&PostStatus::Published);
    if old_theme_id != new_theme_id && is_published {
        if let Some(old_tid) = old_theme_id {
            crate::service::themes::adjust_post_count(&txn, old_tid, -1).await?;
        }
        if let Some(new_tid) = new_theme_id {
            crate::service::themes::adjust_post_count(&txn, new_tid, 1).await?;
        }
    }

    // 更新文章
    let update_input = RepoUpdatePost {
        title: input.title,
        slug: input.slug,
        summary: input.summary,
        content: input.content,
        cover_image: input.cover_image,
        status: input.status.map(Some),
        theme_id: input.theme_slug.map(|opt| opt.map(|_| new_theme_id).flatten()),
        is_featured: input.is_featured,
    };
    let updated_post = repo::posts::update_post(&txn, current_post.id, update_input).await?;

    txn.commit().await?;
    Ok(updated_post.into())
}

/// 7. 删除文章
/// 
/// 逻辑：
/// - 如果是已发布状态，同步计数
/// - 删除文章（post_tags 会被 DB CASCADE 删除）
pub async fn delete_post(
    db: &DatabaseConnection,
    slug: &str,
) -> ServiceResult<()> {
    let txn = db.begin().await?;

    let post = repo::posts::get_post_by_slug(&txn, slug).await?;

    // 如果是已发布状态，同步计数
    if post.status == Some(PostStatus::Published) {
        if let Some(theme_id) = post.theme_id {
            crate::service::themes::adjust_post_count(&txn, theme_id, -1).await?;
        }
        let tags = get_post_tags(&txn, post.id).await?;
        for tag in tags {
            crate::service::tags::adjust_post_count(&txn, tag.id, -1).await?;
        }
    }

    repo::posts::delete_post(&txn, post.id).await?;
    txn.commit().await?;
    Ok(())
}

/// 8. 增加浏览计数
pub async fn increment_view_count(
    db: &DatabaseConnection,
    post_id: i64,
) -> ServiceResult<()> {
    repo::posts::increment_view_count(db, post_id).await?;
    Ok(())
}

/// 10. 统计文章数量（SELECT COUNT(*）
///
/// 使用与 list_posts 相同的筛选条件，但不执行排序和分页，
/// 通过 repo::posts::count_posts 执行 SELECT COUNT(*) 查询。
pub async fn count_posts(
    db: &DatabaseConnection,
    filter: PostFilter,
) -> ServiceResult<u64> {
    // 解析主题 slug → ID
    let theme_ids = if let Some(theme_slugs) = &filter.theme_slugs {
        if !theme_slugs.is_empty() {
            Some(crate::service::themes::get_theme_ids_by_slugs(db, theme_slugs).await?)
        } else {
            None
        }
    } else {
        None
    };

    // 解析标签 slug → 文章 ID（AND 逻辑）
    let post_ids = if let Some(tag_slugs) = &filter.tag_slugs {
        if !tag_slugs.is_empty() {
            let tag_ids = crate::service::tags::get_tag_ids_by_slugs(db, tag_slugs).await?;
            if tag_ids.len() != tag_slugs.len() {
                return Ok(0);
            }
            let ids = repo::posts::get_post_ids_with_all_tags(db, &tag_ids, tag_slugs.len() as i64).await?;
            if ids.is_empty() {
                return Ok(0);
            }
            Some(ids)
        } else {
            None
        }
    } else {
        None
    };

    let status_str = filter.status.as_ref().map(|s| s.as_str());
    let count = repo::posts::count_posts(db, theme_ids, post_ids, status_str, filter.is_featured).await?;
    Ok(count)
}

/// 9. 获取文章的所有标签
pub async fn get_post_tags<C: ConnectionTrait>(
    db: &C,
    post_id: i64,
) -> ServiceResult<Vec<Tag>> {
    let tag_dtos = repo::post_tags::get_tags_by_post_id(db, post_id).await?;
    Ok(tag_dtos.into_iter().map(Into::into).collect())
}

/// 10. 全文搜索文章（ILIKE 模糊搜索）
///
/// 搜索 title + summary + content，仅已发布文章，返回带关联数据的结果。
/// 搜索结果中 content 被替换为高亮摘要（关键词用 <mark> 包裹）。
pub async fn search_posts(
    db: &DatabaseConnection,
    keyword: &str,
    page: u64,
    page_size: u64,
) -> ServiceResult<(Vec<PostWithRelations>, u64)> {
    // 1. 执行搜索
    let (dtos, total) = repo::posts::search_posts(db, keyword, page_size, page).await?;

    if dtos.is_empty() {
        return Ok((vec![], total));
    }

    // 2. 转换为 Post，并将 content 替换为高亮摘要
    let posts: Vec<Post> = dtos.into_iter().map(|dto| {
        let mut post: Post = dto.into();
        post.content = generate_search_excerpt(&post.content, keyword, 200);
        // summary 也高亮
        if let Some(ref summary) = post.summary {
            post.summary = Some(highlight_keyword(summary, keyword));
        }
        // title 也高亮
        post.title = highlight_keyword(&post.title, keyword);
        post
    }).collect();

    // 3. 批量查询关联数据（复用已有逻辑）
    let theme_ids: Vec<i64> = posts.iter().filter_map(|p| p.theme_id).collect();
    let post_ids: Vec<i64> = posts.iter().map(|p| p.id).collect();

    let themes = if !theme_ids.is_empty() {
        crate::service::themes::get_themes_by_ids(db, &theme_ids).await?
    } else {
        vec![]
    };
    let theme_map: std::collections::HashMap<i64, Theme> = themes
        .into_iter()
        .map(|t| (t.id, t))
        .collect();

    let tags_map = get_posts_tags_batch(db, &post_ids).await?;

    // 4. 组装
    let results = posts.into_iter().map(|post| {
        let theme = post.theme_id.and_then(|tid| theme_map.get(&tid).cloned());
        let tags = tags_map.get(&post.id).cloned().unwrap_or_default();
        PostWithRelations { post, theme, tags }
    }).collect();

    Ok((results, total))
}

/// 批量获取多篇文章的标签（辅助方法）
async fn get_posts_tags_batch(
    db: &DatabaseConnection,
    post_ids: &[i64],
) -> ServiceResult<std::collections::HashMap<i64, Vec<Tag>>> {
    if post_ids.is_empty() {
        return Ok(std::collections::HashMap::new());
    }
    
    // 使用 repo 层批量查询 post_tags 关联
    let post_tags = repo::post_tags::get_tags_by_post_ids(db, post_ids).await?;
    
    // 转换为 HashMap<post_id, Vec<Tag>>
    let mut map: std::collections::HashMap<i64, Vec<Tag>> = std::collections::HashMap::new();
    for (post_id, tag_dto) in post_tags {
        map.entry(post_id)
            .or_insert_with(Vec::new)
            .push(tag_dto.into());
    }
    Ok(map)
}

// ================================
// 辅助函数
// ================================

fn is_valid_slug(slug: &str) -> bool {
    !slug.is_empty()
        && slug
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

fn escape_html(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for ch in text.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            _ => out.push(ch),
        }
    }
    out
}

/// 生成搜索摘要：在 content 中找到关键词附近的文本，截取并高亮
///
/// 如果 content 中包含关键词，截取关键词前后各 max_len/2 字符作为摘要；
/// 如果不包含，截取开头 max_len 字符。关键词用 <mark> 包裹。
/// 文本会先做 HTML 转义，避免搜索结果被当成脚本执行。
fn generate_search_excerpt(content: &str, keyword: &str, max_len: usize) -> String {
    let content_lower = content.to_lowercase();
    let keyword_lower = keyword.to_lowercase();

    if let Some(pos) = content_lower.find(&keyword_lower) {
        let half = max_len / 2;
        let start = if pos > half { pos - half } else { 0 };
        let end = (pos + keyword_lower.len() + half).min(content.len());

        let start = content.floor_char_boundary(start);
        let end = content.ceil_char_boundary(end);
        let slice = &content[start..end];

        let mut excerpt = String::new();
        if start > 0 {
            excerpt.push_str("...");
        }
        excerpt.push_str(&highlight_keyword(slice, keyword));
        if end < content.len() {
            excerpt.push_str("...");
        }
        excerpt
    } else {
        let end = max_len.min(content.len());
        let end = content.ceil_char_boundary(end);
        let mut excerpt = escape_html(&content[..end]);
        if end < content.len() {
            excerpt.push_str("...");
        }
        excerpt
    }
}

/// 高亮关键词：先转义 HTML，再按字符窗口做大小写不敏感匹配。
fn highlight_keyword(text: &str, keyword: &str) -> String {
    if keyword.is_empty() {
        return escape_html(text);
    }

    let kw_lower: Vec<char> = keyword.to_lowercase().chars().collect();
    let text_chars: Vec<char> = text.chars().collect();
    let kw_len = kw_lower.len();
    let mut result = String::with_capacity(text.len() + keyword.len() * 2);
    let mut i = 0;

    while i < text_chars.len() {
        if kw_len > 0 && i + kw_len <= text_chars.len() {
            let window: String = text_chars[i..i + kw_len].iter().collect();
            if window.to_lowercase().chars().eq(kw_lower.iter().copied()) {
                result.push_str("<mark>");
                result.push_str(&escape_html(&window));
                result.push_str("</mark>");
                i += kw_len;
                continue;
            }
        }
        result.push_str(&escape_html(&text_chars[i].to_string()));
        i += 1;
    }

    result
}

#[cfg(test)]
mod highlight_tests {
    use super::{escape_html, highlight_keyword};

    #[test]
    fn highlight_escapes_html() {
        let out = highlight_keyword("<script>alert(1)</script>", "script");
        assert!(!out.contains("<script>"));
        assert!(out.contains("&lt;"));
        assert!(out.contains("<mark>script</mark>"));
    }

    #[test]
    fn highlight_handles_chinese() {
        let out = highlight_keyword("今天学了 Rust 的生命周期", "生命周期");
        assert_eq!(out, "今天学了 Rust 的<mark>生命周期</mark>");
    }

    #[test]
    fn escape_html_quotes() {
        assert_eq!(escape_html("a&b<c>\"'"), "a&amp;b&lt;c&gt;&quot;&#39;");
    }
}

// ================================
// 站点统计
// ================================

/// 站点统计数据
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SiteStats {
    /// 已发布文章总数
    pub total_posts: u64,
    /// 所有文章浏览量总和
    pub total_views: i64,
    /// 所有文章内容字符总长度
    pub total_words: i64,
}

/// 获取站点统计数据
///
/// 返回已发布文章的总数、总浏览量、总字数
pub async fn get_site_stats(db: &DatabaseConnection) -> ServiceResult<SiteStats> {
    let (total_posts, total_views, total_words) = repo::posts::get_site_stats(db).await?;
    
    Ok(SiteStats {
        total_posts,
        total_views,
        total_words,
    })
}
