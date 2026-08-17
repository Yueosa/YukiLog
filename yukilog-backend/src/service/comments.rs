use chrono::{DateTime, FixedOffset};
use sea_orm::DatabaseConnection;
use serde::{Deserialize, Serialize};
use woothee::parser::Parser;

use crate::domain::status::CommentStatus;
use crate::repo;
use crate::repo::comments::{
    CreateComment as RepoCreateComment, UpdateComment as RepoUpdateComment,
};
use crate::service::error::{ServiceError, ServiceResult};
use crate::service::posts;

// ================================
// DTO 定义
// ================================

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Comment {
    pub id: i64,
    pub post_id: i64,
    pub content: String,
    pub guest_nick: String,
    pub guest_email: Option<String>,
    pub guest_website: Option<String>,
    pub parent_id: Option<i64>,
    pub root_id: Option<i64>,
    pub status: CommentStatus,
    pub ip: Option<String>,
    pub ua: Option<String>,
    pub visitor_info: Option<String>, // 解析后的访客信息（如 "Desktop Chrome 136.0 · macOS 15"）
    pub created_at: DateTime<FixedOffset>,
    /// 所属文章标题（管理列表填充）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub post_title: Option<String>,
    /// 所属文章 slug（管理列表填充）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub post_slug: Option<String>,
}

impl From<repo::comments::CommentDto> for Comment {
    fn from(dto: repo::comments::CommentDto) -> Self {
        let visitor_info = parse_visitor_info(dto.ua.as_deref());

        Self {
            id: dto.id,
            post_id: dto.post_id.unwrap_or(0),
            content: dto.content,
            guest_nick: dto.guest_nick,
            guest_email: dto.guest_email,
            guest_website: dto.guest_website,
            parent_id: dto.parent_id,
            root_id: dto.root_id,
            status: dto.status.unwrap_or(CommentStatus::Pending),
            ip: dto.ip,
            ua: dto.ua,
            post_title: None,
            post_slug: None,
            visitor_info,
            created_at: dto.created_at.unwrap_or_else(|| chrono::Utc::now().into()),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CommentNode {
    pub comment: Comment,
    pub children: Vec<CommentNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCommentInput {
    pub content: String,
    pub guest_nick: String,
    pub guest_email: Option<String>,
    pub guest_website: Option<String>,
    pub parent_id: Option<i64>,
    pub ip: Option<String>,
    pub ua: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UpdateCommentInput {
    pub content: Option<String>,
    pub guest_nick: Option<String>,
    pub guest_email: Option<Option<String>>,
    pub guest_website: Option<Option<String>>,
}

#[derive(Debug, Clone, Default)]
pub struct CommentFilter {
    pub status: Option<CommentStatus>,
    pub sort_by: Option<CommentSortBy>,
}

#[derive(Debug, Clone, Default)]
pub struct AdminCommentFilter {
    pub post_id: Option<i64>,
    pub status: Option<CommentStatus>,
    pub sort_by: Option<CommentSortBy>,
    pub count: Option<u64>,
    pub page: Option<u64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CommentSortBy {
    CreatedAtAsc,  // 时间正序（评论常用）
    CreatedAtDesc, // 时间倒序
}

// ================================
// 业务逻辑
// ================================

/// 1. 创建评论（前台）
///
/// 逻辑：
/// - 通过 post_slug 查询 post_id
/// - 验证文章存在且已发布（draft 不允许评论）
/// - 如果有 parent_id，验证父评论存在且属于同一文章
/// - 计算 root_id：无 parent_id -> None，有 parent_id -> parent.root_id ?? parent_id
/// - status 由 DB 默认为 pending
pub async fn create_comment(
    db: &DatabaseConnection,
    post_slug: &str,
    input: CreateCommentInput,
) -> ServiceResult<Comment> {
    // 1. 获取文章，验证存在且已发布
    let post = posts::get_published_post_by_slug(db, post_slug).await?;

    // 2. 如果是回复，验证父评论存在且属于同一文章
    let (parent_id, root_id) = if let Some(pid) = input.parent_id {
        let parent = repo::comments::get_comment_by_id(db, pid).await?;

        // 验证父评论属于同一文章
        if parent.post_id != Some(post.id) {
            return Err(ServiceError::InvalidInput(
                "parent comment does not belong to this post".to_string(),
            ));
        }

        // 计算 root_id：继承父评论的 root_id，如果没有则父评论本身是根
        let root = parent.root_id.or(Some(pid));
        (Some(pid), root)
    } else {
        (None, None)
    };

    // 3. 创建评论
    let create_input = RepoCreateComment {
        post_id: Some(post.id),
        content: input.content,
        guest_nick: input.guest_nick,
        guest_email: input.guest_email,
        guest_website: input.guest_website,
        parent_id,
        root_id,
        ip: input.ip,
        ua: input.ua,
    };

    let comment_dto = repo::comments::create_comment(db, create_input).await?;
    Ok(comment_dto.into())
}

/// 2. 获取文章评论列表（前台，扁平，仅已审核）
pub async fn list_post_comments(
    db: &DatabaseConnection,
    post_slug: &str,
    filter: CommentFilter,
) -> ServiceResult<Vec<Comment>> {
    // 获取文章 ID
    let post = posts::get_published_post_by_slug(db, post_slug).await?;

    // 状态（前台默认只显示 Approved）
    let status = filter.status.unwrap_or(CommentStatus::Approved);
    let sort_asc = match filter.sort_by.unwrap_or(CommentSortBy::CreatedAtAsc) {
        CommentSortBy::CreatedAtAsc => true,
        CommentSortBy::CreatedAtDesc => false,
    };

    let dtos = repo::comments::list_comments_filtered(
        db,
        Some(post.id),
        Some(status.as_str()),
        sort_asc,
        None,
        None,
    )
    .await?;
    Ok(dtos.into_iter().map(Into::into).collect())
}

/// 3. 获取文章评论树（前台，树形，仅已审核）
pub async fn get_post_comment_tree(
    db: &DatabaseConnection,
    post_slug: &str,
) -> ServiceResult<Vec<CommentNode>> {
    let filter = CommentFilter {
        status: Some(CommentStatus::Approved),
        sort_by: Some(CommentSortBy::CreatedAtAsc),
    };
    let comments = list_post_comments(db, post_slug, filter).await?;
    Ok(build_comment_tree(comments))
}

#[allow(dead_code)]
/// 4. 获取评论详情
pub async fn get_comment_by_id(db: &DatabaseConnection, id: i64) -> ServiceResult<Comment> {
    let dto = repo::comments::get_comment_by_id(db, id).await?;
    Ok(dto.into())
}

/// 5. 列出所有评论（后台，支持筛选和分页）
pub async fn list_all_comments(
    db: &DatabaseConnection,
    filter: AdminCommentFilter,
) -> ServiceResult<Vec<Comment>> {
    let status_str = filter.status.as_ref().map(|s| s.as_str());
    let sort_asc = match filter.sort_by.unwrap_or(CommentSortBy::CreatedAtDesc) {
        CommentSortBy::CreatedAtAsc => true,
        CommentSortBy::CreatedAtDesc => false,
    };

    let dtos = repo::comments::list_comments_filtered(
        db,
        filter.post_id,
        status_str,
        sort_asc,
        filter.count,
        filter.page,
    )
    .await?;

    let mut comments: Vec<Comment> = dtos.into_iter().map(Into::into).collect();
    attach_post_meta(db, &mut comments).await?;
    Ok(comments)
}

async fn attach_post_meta(
    db: &DatabaseConnection,
    comments: &mut [Comment],
) -> ServiceResult<()> {
    let mut post_ids: Vec<i64> = comments
        .iter()
        .map(|c| c.post_id)
        .filter(|id| *id > 0)
        .collect();
    post_ids.sort_unstable();
    post_ids.dedup();

    if post_ids.is_empty() {
        return Ok(());
    }

    let posts = repo::posts::get_posts_by_ids(db, &post_ids).await?;
    let post_map: std::collections::HashMap<i64, (String, String)> = posts
        .into_iter()
        .map(|p| (p.id, (p.title, p.slug)))
        .collect();

    for comment in comments.iter_mut() {
        if let Some((title, slug)) = post_map.get(&comment.post_id) {
            comment.post_title = Some(title.clone());
            comment.post_slug = Some(slug.clone());
        }
    }

    Ok(())
}

/// 6. 审核评论：通过
pub async fn approve_comment(db: &DatabaseConnection, id: i64) -> ServiceResult<Comment> {
    let update_input = RepoUpdateComment {
        status: Some(Some(CommentStatus::Approved)),
        ..Default::default()
    };
    let updated = repo::comments::update_comment(db, id, update_input).await?;
    Ok(updated.into())
}

/// 7. 审核评论：拒绝（标记为垃圾）
pub async fn reject_comment(db: &DatabaseConnection, id: i64) -> ServiceResult<Comment> {
    let update_input = RepoUpdateComment {
        status: Some(Some(CommentStatus::Spam)),
        ..Default::default()
    };
    let updated = repo::comments::update_comment(db, id, update_input).await?;
    Ok(updated.into())
}

/// 8. 更新评论内容（后台）
pub async fn update_comment(
    db: &DatabaseConnection,
    id: i64,
    input: UpdateCommentInput,
) -> ServiceResult<Comment> {
    let update_input = RepoUpdateComment {
        content: input.content,
        guest_nick: input.guest_nick,
        guest_email: input.guest_email,
        guest_website: input.guest_website,
        ..Default::default()
    };
    let updated = repo::comments::update_comment(db, id, update_input).await?;
    Ok(updated.into())
}

/// 9. 删除评论（后台）
///
/// 子评论会被 DB CASCADE 删除
pub async fn delete_comment(db: &DatabaseConnection, id: i64) -> ServiceResult<()> {
    repo::comments::delete_comment(db, id).await?;
    Ok(())
}

/// 10. 获取评论的回复列表（用于懒加载）
pub async fn list_comment_replies(
    db: &DatabaseConnection,
    parent_id: i64,
) -> ServiceResult<Vec<Comment>> {
    let dtos =
        repo::comments::list_comment_replies(db, parent_id, CommentStatus::Approved.as_str())
            .await?;
    Ok(dtos.into_iter().map(Into::into).collect())
}

/// 11. 统计评论数量（SELECT COUNT(*)）
///
/// 使用与 list_all_comments 相同的筛选条件，但不执行排序和分页，
/// 通过 repo::comments::count_comments 执行 SELECT COUNT(*) 查询。
pub async fn count_all_comments(
    db: &DatabaseConnection,
    filter: AdminCommentFilter,
) -> ServiceResult<u64> {
    let status_str = filter.status.as_ref().map(|s| s.as_str());
    let count = repo::comments::count_comments(db, filter.post_id, status_str).await?;
    Ok(count)
}

// ================================
// 辅助函数
// ================================

/// 构建评论树（递归算法）
fn build_comment_tree(comments: Vec<Comment>) -> Vec<CommentNode> {
    use std::collections::HashMap;

    // 按 parent_id 分组
    let mut children_map: HashMap<Option<i64>, Vec<Comment>> = HashMap::new();
    for comment in comments {
        children_map
            .entry(comment.parent_id)
            .or_insert_with(Vec::new)
            .push(comment);
    }

    // 递归构建树
    fn build_nodes(
        parent_id: Option<i64>,
        children_map: &HashMap<Option<i64>, Vec<Comment>>,
    ) -> Vec<CommentNode> {
        if let Some(children) = children_map.get(&parent_id) {
            children
                .iter()
                .map(|comment| {
                    let child_nodes = build_nodes(Some(comment.id), children_map);
                    CommentNode {
                        comment: comment.clone(),
                        children: child_nodes,
                    }
                })
                .collect()
        } else {
            Vec::new()
        }
    }

    build_nodes(None, &children_map)
}

/// 解析 User-Agent 为可读的访客信息
///
/// # 参数
///
/// * `ua` - User-Agent 字符串
///
/// # 返回
///
/// * `Some(String)` - 解析成功，返回如 "Desktop Chrome 136.0 · macOS 15"
/// * `None` - UA 为空或解析失败
///
/// # 示例
///
/// ```rust
/// let ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...";
/// let info = parse_visitor_info(Some(ua));
/// // Some("Desktop Chrome 136.0 · macOS 15")
/// ```
fn parse_visitor_info(ua: Option<&str>) -> Option<String> {
    let ua_str = ua?;

    let parser = Parser::new();
    let result = parser.parse(ua_str)?;

    // 设备类型
    let device_type = match result.category {
        "pc" => "Desktop",
        "smartphone" => "Mobile",
        "mobilephone" => "Mobile",
        "appliance" => "Mobile",
        "crawler" => "Bot",
        _ => "Unknown",
    };

    // 浏览器
    let browser = if result.name.is_empty() {
        "Unknown".to_string()
    } else {
        format!("{} {}", result.name, result.version)
    };

    // 操作系统
    let os = if result.os.is_empty() {
        "Unknown OS".to_string()
    } else if result.os_version.is_empty() {
        result.os.to_string()
    } else {
        format!("{} {}", result.os, result.os_version)
    };

    Some(format!("{} {} · {}", device_type, browser, os))
}
