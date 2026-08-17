use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, EntityTrait, IntoActiveModel, PaginatorTrait,
    QueryFilter, QueryOrder, QuerySelect, Set,
};

use crate::{
    domain::status::PostStatus,
    entities::posts,
    repo::error::{RepoError, RepoResult},
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PostDto {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub summary: Option<String>,
    pub content: String,
    pub cover_image: Option<String>,
    pub status: Option<PostStatus>,
    pub is_featured: bool,
    pub theme_id: Option<i64>,
    pub view_count: Option<i64>,
    pub created_at: Option<chrono::DateTime<chrono::FixedOffset>>,
    pub updated_at: Option<chrono::DateTime<chrono::FixedOffset>>,
}

impl TryFrom<posts::Model> for PostDto {
    type Error = RepoError;

    fn try_from(model: posts::Model) -> Result<Self, Self::Error> {
        let status = match model.status.as_deref() {
            None => None,
            Some(s) => Some(PostStatus::try_from(s)?),
        };

        Ok(Self {
            id: model.id,
            title: model.title,
            slug: model.slug,
            summary: model.summary,
            content: model.content,
            cover_image: model.cover_image,
            status,
            is_featured: model.is_featured,
            theme_id: model.theme_id,
            view_count: model.view_count,
            created_at: model.created_at,
            updated_at: model.updated_at,
        })
    }
}

#[derive(Debug, Clone)]
pub struct CreatePost {
    pub title: String,
    pub slug: String,
    pub summary: Option<String>,
    pub content: String,
    pub cover_image: Option<String>,
    pub status: Option<String>,
    pub theme_id: Option<i64>,
    pub is_featured: bool,
}

#[derive(Debug, Default, Clone)]
pub struct UpdatePost {
    pub title: Option<String>,
    pub slug: Option<String>,
    pub summary: Option<Option<String>>,
    pub content: Option<String>,
    pub cover_image: Option<Option<String>>,
    pub status: Option<Option<PostStatus>>,
    pub theme_id: Option<Option<i64>>,
    pub is_featured: Option<bool>,
}

pub async fn create_post<C>(db: &C, input: CreatePost) -> RepoResult<PostDto>
where
    C: ConnectionTrait,
{
    let active = posts::ActiveModel {
        title: Set(input.title),
        slug: Set(input.slug),
        summary: Set(input.summary),
        content: Set(input.content),
        cover_image: Set(input.cover_image),
        status: Set(input.status),
        theme_id: Set(input.theme_id),
        is_featured: Set(input.is_featured),
        ..Default::default()
    };

    let model = active.insert(db).await?;
    PostDto::try_from(model)
}

#[allow(dead_code)]
pub async fn get_post_by_id<C>(db: &C, id: i64) -> RepoResult<PostDto>
where
    C: ConnectionTrait,
{
    let model = posts::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or(RepoError::NotFound)?;

    PostDto::try_from(model)
}

pub async fn get_posts_by_ids<C>(db: &C, ids: &[i64]) -> RepoResult<Vec<PostDto>>
where
    C: ConnectionTrait,
{
    if ids.is_empty() {
        return Ok(vec![]);
    }

    let models = posts::Entity::find()
        .filter(posts::Column::Id.is_in(ids.iter().copied()))
        .all(db)
        .await?;

    models
        .into_iter()
        .map(PostDto::try_from)
        .collect::<Result<Vec<_>, _>>()
}

pub async fn get_post_by_slug<C>(db: &C, slug: &str) -> RepoResult<PostDto>
where
    C: ConnectionTrait,
{
    let model = posts::Entity::find()
        .filter(posts::Column::Slug.eq(slug))
        .one(db)
        .await?
        .ok_or(RepoError::NotFound)?;

    PostDto::try_from(model)
}

#[allow(dead_code)]
pub async fn list_posts<C>(db: &C) -> RepoResult<Vec<PostDto>>
where
    C: ConnectionTrait,
{
    let models = posts::Entity::find().all(db).await?;

    models
        .into_iter()
        .map(PostDto::try_from)
        .collect::<Result<Vec<_>, _>>()
}

pub async fn update_post<C>(db: &C, id: i64, patch: UpdatePost) -> RepoResult<PostDto>
where
    C: ConnectionTrait,
{
    let model = posts::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or(RepoError::NotFound)?;

    let mut active = model.into_active_model();

    if let Some(v) = patch.title {
        active.title = Set(v);
    }
    if let Some(v) = patch.slug {
        active.slug = Set(v);
    }
    if let Some(v) = patch.summary {
        active.summary = Set(v);
    }
    if let Some(v) = patch.content {
        active.content = Set(v);
    }
    if let Some(v) = patch.cover_image {
        active.cover_image = Set(v);
    }
    if let Some(v) = patch.status {
        active.status = Set(v.map(|s| s.as_str().to_string()));
    }
    if let Some(v) = patch.theme_id {
        active.theme_id = Set(v);
    }
    if let Some(v) = patch.is_featured {
        active.is_featured = Set(v);
    }

    let updated = active.update(db).await?;
    PostDto::try_from(updated)
}

pub async fn delete_post<C>(db: &C, id: i64) -> RepoResult<()>
where
    C: ConnectionTrait,
{
    let res = posts::Entity::delete_by_id(id).exec(db).await?;
    if res.rows_affected == 0 {
        return Err(RepoError::NotFound);
    }
    Ok(())
}

/// 按条件统计文章数量（SELECT COUNT(*)）
pub async fn count_posts<C>(
    db: &C,
    theme_ids: Option<Vec<i64>>,
    post_ids: Option<Vec<i64>>,
    status: Option<&str>,
    is_featured: Option<bool>,
) -> RepoResult<u64>
where
    C: ConnectionTrait,
{
    let mut query = posts::Entity::find();

    if let Some(ids) = theme_ids {
        query = query.filter(posts::Column::ThemeId.is_in(ids));
    }
    if let Some(ids) = post_ids {
        query = query.filter(posts::Column::Id.is_in(ids));
    }
    if let Some(s) = status {
        query = query.filter(posts::Column::Status.eq(s));
    }
    if let Some(h) = is_featured {
        query = query.filter(posts::Column::IsFeatured.eq(h));
    }

    let count = query.count(db).await?;
    Ok(count)
}

pub async fn increment_view_count<C>(db: &C, id: i64) -> RepoResult<()>
where
    C: ConnectionTrait,
{
    use sea_orm::Statement;
    let sql = "UPDATE posts SET view_count = view_count + 1 WHERE id = $1";
    let stmt = Statement::from_sql_and_values(
        sea_orm::DatabaseBackend::Postgres,
        sql,
        vec![id.into()],
    );
    db.execute(stmt).await?;
    Ok(())
}

/// 按条件筛选文章列表（支持排序和分页）
pub async fn list_posts_filtered<C>(
    db: &C,
    theme_ids: Option<Vec<i64>>,
    post_ids: Option<Vec<i64>>,
    status: Option<&str>,
    is_featured: Option<bool>,
    sort_by: &str,
    count: Option<u64>,
    page: Option<u64>,
) -> RepoResult<Vec<PostDto>>
where
    C: ConnectionTrait,
{
    let mut query = posts::Entity::find();

    if let Some(ids) = theme_ids {
        query = query.filter(posts::Column::ThemeId.is_in(ids));
    }
    if let Some(ids) = post_ids {
        query = query.filter(posts::Column::Id.is_in(ids));
    }
    if let Some(s) = status {
        query = query.filter(posts::Column::Status.eq(s));
    }
    if let Some(h) = is_featured {
        query = query.filter(posts::Column::IsFeatured.eq(h));
    }

    let (column, order) = match sort_by {
        "updated_at" => (posts::Column::UpdatedAt, sea_orm::Order::Desc),
        "view_count" => (posts::Column::ViewCount, sea_orm::Order::Desc),
        _ => (posts::Column::CreatedAt, sea_orm::Order::Desc),
    };
    query = query.order_by(column, order);

    if let (Some(count), Some(page)) = (count, page) {
        let offset = (page - 1) * count;
        query = query.limit(count).offset(offset);
    }

    let models = query.all(db).await?;
    models
        .into_iter()
        .map(PostDto::try_from)
        .collect::<Result<Vec<_>, _>>()
}

/// 获取同时拥有所有指定标签的文章 ID（AND 逻辑）
pub async fn get_post_ids_with_all_tags<C>(
    db: &C,
    tag_ids: &[i64],
    required_count: i64,
) -> RepoResult<Vec<i64>>
where
    C: ConnectionTrait,
{
    use sea_orm::{FromQueryResult, Statement};

    #[derive(FromQueryResult)]
    struct PostIdResult {
        post_id: i64,
    }

    let placeholders: Vec<String> = (1..=tag_ids.len()).map(|i| format!("${}", i)).collect();
    let sql = format!(
        "SELECT post_id FROM post_tags WHERE tag_id IN ({}) GROUP BY post_id HAVING COUNT(DISTINCT tag_id) = ${}",
        placeholders.join(", "),
        tag_ids.len() + 1
    );

    let mut values: Vec<sea_orm::Value> = tag_ids.iter().map(|&id| id.into()).collect();
    values.push(required_count.into());

    let stmt = Statement::from_sql_and_values(
        sea_orm::DatabaseBackend::Postgres,
        &sql,
        values,
    );

    let results = PostIdResult::find_by_statement(stmt)
        .all(db)
        .await?;

    Ok(results.into_iter().map(|r| r.post_id).collect())
}

/// 全文搜索文章（ILIKE 模糊匹配 title + summary + content）
///
/// 仅搜索已发布的文章，按相关性排序：标题匹配 > 摘要匹配 > 内容匹配
pub async fn search_posts<C>(
    db: &C,
    keyword: &str,
    count: u64,
    page: u64,
) -> RepoResult<(Vec<PostDto>, u64)>
where
    C: ConnectionTrait,
{
    use sea_orm::{FromQueryResult, Statement};

    let pattern = format!("%{}%", escape_ilike_pattern(keyword));
    let offset = (page - 1) * count;

    // 统计总数
    let count_sql = r#"
        SELECT COUNT(*) as total FROM posts 
        WHERE status = 'published' 
          AND (title ILIKE $1 ESCAPE '\' OR summary ILIKE $1 ESCAPE '\' OR content ILIKE $1 ESCAPE '\')
    "#;
    
    #[derive(FromQueryResult)]
    struct CountResult {
        total: i64,
    }
    
    let count_stmt = Statement::from_sql_and_values(
        sea_orm::DatabaseBackend::Postgres,
        count_sql,
        vec![pattern.clone().into()],
    );
    let total = CountResult::find_by_statement(count_stmt)
        .one(db)
        .await?
        .map(|r| r.total as u64)
        .unwrap_or(0);

    if total == 0 {
        return Ok((vec![], 0));
    }

    // 查询结果，按相关性排序（标题匹配优先）
    let search_sql = r#"
        SELECT * FROM posts 
        WHERE status = 'published' 
          AND (title ILIKE $1 ESCAPE '\' OR summary ILIKE $1 ESCAPE '\' OR content ILIKE $1 ESCAPE '\')
        ORDER BY 
          CASE WHEN title ILIKE $1 ESCAPE '\' THEN 0 ELSE 1 END,
          CASE WHEN summary ILIKE $1 ESCAPE '\' THEN 0 ELSE 1 END,
          created_at DESC
        LIMIT $2 OFFSET $3
    "#;

    let search_stmt = Statement::from_sql_and_values(
        sea_orm::DatabaseBackend::Postgres,
        search_sql,
        vec![pattern.into(), (count as i64).into(), (offset as i64).into()],
    );

    let models = posts::Entity::find()
        .from_raw_sql(search_stmt)
        .all(db)
        .await?;

    let dtos = models
        .into_iter()
        .map(PostDto::try_from)
        .collect::<Result<Vec<_>, _>>()?;

    Ok((dtos, total))
}

fn escape_ilike_pattern(keyword: &str) -> String {
    keyword
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

/// 获取站点统计数据：文章总数、总浏览量、总字数
///
/// # 返回
///
/// - `total_posts`: 已发布文章总数
/// - `total_views`: 所有已发布文章浏览量总和
/// - `total_words`: 所有已发布文章内容字符总长度
pub async fn get_site_stats<C>(db: &C) -> RepoResult<(u64, i64, i64)>
where
    C: ConnectionTrait,
{
    use sea_orm::Statement;

    let sql = r#"
        SELECT 
            COUNT(*)::bigint as total_posts,
            COALESCE(SUM(view_count), 0)::bigint as total_views,
            COALESCE(SUM(LENGTH(content)), 0)::bigint as total_words
        FROM posts
        WHERE LOWER(status) = 'published'
    "#;

    let stmt = Statement::from_string(sea_orm::DatabaseBackend::Postgres, sql);
    
    let query_result = db.query_one(stmt).await?;
    
    if let Some(row) = query_result {
        let total_posts: i64 = row.try_get("", "total_posts")?;
        let total_views: i64 = row.try_get("", "total_views")?;
        let total_words: i64 = row.try_get("", "total_words")?;
        
        Ok((total_posts as u64, total_views, total_words))
    } else {
        Ok((0, 0, 0))
    }
}
