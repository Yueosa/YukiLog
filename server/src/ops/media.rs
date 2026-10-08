use std::{
    io::ErrorKind,
    net::IpAddr,
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};

use axum::{
    Json,
    extract::{Multipart, Path as AxumPath, State, multipart::Field},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use axum_extra::extract::cookie::CookieJar;
use rand::{RngCore, rngs::OsRng};
use sea_orm::{
    ActiveModelTrait, ActiveValue::NotSet, ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter,
    Set, prelude::Uuid,
};
use serde::Serialize;
use sha2::{Digest, Sha256};
use tokio::{
    fs::{self, OpenOptions},
    io::AsyncWriteExt,
};

use crate::{
    AppState, auth,
    entities::{articles, dynamic_media, dynamics, friend_links, media_assets, site_settings},
    error::AppError,
};

pub const MAX_UPLOAD_BYTES: usize = 200 * 1024 * 1024;
const MAX_IMAGE_BYTES: u64 = 20 * 1024 * 1024;
const MAX_IMAGE_EDGE: usize = 16_384;
const MAX_IMAGE_PIXELS: usize = 100_000_000;
const SNIFF_BYTES: usize = 16 * 1024;

#[derive(Clone)]
pub struct MediaStorage {
    public_dir: Arc<PathBuf>,
    staging_dir: Arc<PathBuf>,
}

impl MediaStorage {
    pub async fn new(root: PathBuf) -> Result<Self, AppError> {
        let public_dir = root.join("assets");
        let staging_dir = root.join("staging");
        fs::create_dir_all(&public_dir).await?;
        fs::create_dir_all(&staging_dir).await?;
        Ok(Self {
            public_dir: Arc::new(fs::canonicalize(public_dir).await?),
            staging_dir: Arc::new(fs::canonicalize(staging_dir).await?),
        })
    }

    pub fn public_dir(&self) -> &Path {
        self.public_dir.as_ref()
    }

    #[cfg(test)]
    pub(crate) fn for_test() -> Self {
        Self {
            public_dir: Arc::new(PathBuf::from("/nonexistent/yukilog-media/assets")),
            staging_dir: Arc::new(PathBuf::from("/nonexistent/yukilog-media/staging")),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct MediaResponse {
    id: sea_orm::prelude::Uuid,
    url: String,
    card_url: Option<String>,
    thumb_url: Option<String>,
    original_name: String,
    media_type: String,
    byte_size: i64,
    width: Option<i32>,
    height: Option<i32>,
    origin: String,
    source_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MediaReference {
    kind: &'static str,
    id: Option<Uuid>,
    label: String,
}

#[derive(Debug, Serialize)]
struct MediaDeleteConflict {
    code: &'static str,
    message: &'static str,
    references: Vec<MediaReference>,
}

pub async fn delete(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
) -> Result<Response, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let media = media_assets::Entity::find_by_id(id)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotFound)?;

    let mut references = Vec::new();
    let covering = articles::Entity::find()
        .filter(articles::Column::CoverMediaId.eq(id))
        .all(&state.database)
        .await?;
    references.extend(covering.into_iter().map(|article| MediaReference {
        kind: "article_cover",
        id: Some(article.id),
        label: article.title,
    }));
    let attachments = dynamic_media::Entity::find()
        .filter(dynamic_media::Column::MediaId.eq(id))
        .all(&state.database)
        .await?;
    if !attachments.is_empty() {
        let attached = dynamics::Entity::find()
            .filter(
                dynamics::Column::Id
                    .is_in(attachments.iter().map(|row| row.dynamic_id).collect::<Vec<_>>()),
            )
            .all(&state.database)
            .await?;
        references.extend(attached.into_iter().map(|dynamic| MediaReference {
            kind: "dynamic_media",
            id: Some(dynamic.id),
            label: dynamic.content_markdown.chars().take(40).collect(),
        }));
    }
    let settings = site_settings::Entity::find_by_id(true)
        .one(&state.database)
        .await?;
    if let Some(row) = settings {
        if row.avatar_media_id == Some(id) {
            references.push(MediaReference {
                kind: "site_avatar",
                id: None,
                label: "站点头像".to_owned(),
            });
        }
        if row.masthead_media_id == Some(id) {
            references.push(MediaReference {
                kind: "site_masthead",
                id: None,
                label: "刊头背景".to_owned(),
            });
        }
    }
    let linked = friend_links::Entity::find()
        .filter(friend_links::Column::AvatarMediaId.eq(id))
        .all(&state.database)
        .await?;
    references.extend(linked.into_iter().map(|friend| MediaReference {
        kind: "friend_link_avatar",
        id: Some(friend.id),
        label: friend.name,
    }));

    if !references.is_empty() {
        return Ok((
            StatusCode::CONFLICT,
            Json(MediaDeleteConflict {
                code: "media_in_use",
                message: "媒体仍被引用，无法删除",
                references,
            }),
        )
            .into_response());
    }

    media_assets::Entity::delete_by_id(id)
        .exec(&state.database)
        .await?;
    remove_media_file(&state.media.public_dir, &media.storage_key).await;
    // 变体文件与原图同目录，一并清理
    for key in [&media.card_key, &media.thumb_key].into_iter().flatten() {
        remove_media_file(&state.media.public_dir, key).await;
    }
    Ok(StatusCode::NO_CONTENT.into_response())
}

async fn remove_media_file(public_dir: &Path, storage_key: &str) {
    let path = public_dir.join(storage_key);
    match fs::remove_file(&path).await {
        Ok(()) => {}
        Err(error) if error.kind() == ErrorKind::NotFound => {}
        Err(error) => {
            tracing::warn!(path = %path.display(), %error, "failed to remove media file");
        }
    }
}

pub async fn upload(
    State(state): State<AppState>,
    headers: HeaderMap,
    jar: CookieJar,
    mut multipart: Multipart,
) -> Result<Json<MediaResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let field = multipart
        .next_field()
        .await
        .map_err(|_| AppError::InvalidRequest("multipart 数据无效"))?
        .ok_or(AppError::InvalidRequest("缺少 file 字段"))?;
    if field.name() != Some("file") {
        return Err(AppError::InvalidRequest("首个 multipart 字段必须是 file"));
    }

    let model = store_upload(&state, field).await?;
    Ok(Json(MediaResponse::from(model)))
}

async fn store_upload(
    state: &AppState,
    mut field: Field<'_>,
) -> Result<media_assets::Model, AppError> {
    let original_name = field
        .file_name()
        .map(str::to_owned)
        .ok_or(AppError::InvalidRequest("上传文件必须包含文件名"))?;
    if original_name.trim().is_empty() || original_name.len() > 255 {
        return Err(AppError::InvalidRequest("文件名长度必须为 1–255 字节"));
    }

    let staging_path = state
        .media
        .staging_dir
        .join(format!(".upload-{}", random_suffix()));
    let result = write_staging_file(&staging_path, &mut field).await;
    let (byte_size, sha256, sniffed) = match result {
        Ok(result) => result,
        Err(error) => {
            let _ = fs::remove_file(&staging_path).await;
            return Err(error);
        }
    };
    persist_staged(state, staging_path, byte_size, sha256, sniffed, original_name, "upload", None)
        .await
}

/// 把暂存文件落为媒体资产：魔数探测 → 尺寸 → 硬链接入正式目录 → 哈希去重 → 插行。
/// 失败时清理暂存与误建的正式文件。
#[allow(clippy::too_many_arguments)]
async fn persist_staged(
    state: &AppState,
    staging_path: PathBuf,
    byte_size: u64,
    sha256: [u8; 32],
    sniffed: Vec<u8>,
    original_name: String,
    origin: &'static str,
    source_url: Option<String>,
) -> Result<media_assets::Model, AppError> {

    let kind = match detect_media(&sniffed, byte_size) {
        Ok(kind) => kind,
        Err(error) => {
            let _ = fs::remove_file(&staging_path).await;
            return Err(error);
        }
    };
    let dimensions = if kind.image {
        match image_dimensions(&staging_path).await {
            Ok(dimensions) => Some(dimensions),
            Err(error) => {
                let _ = fs::remove_file(&staging_path).await;
                return Err(error);
            }
        }
    } else {
        None
    };

    let hash_hex = hex_lower(&sha256);
    let storage_key = format!("{}/{}.{}", &hash_hex[..2], hash_hex, kind.extension);
    let final_path = state.media.public_dir.join(&storage_key);
    let parent = final_path
        .parent()
        .ok_or(AppError::Internal("media path has no parent"))?;
    if let Err(error) = fs::create_dir_all(parent).await {
        let _ = fs::remove_file(&staging_path).await;
        return Err(error.into());
    }
    let created_file = match fs::hard_link(&staging_path, &final_path).await {
        Ok(()) => true,
        Err(error) if error.kind() == ErrorKind::AlreadyExists => false,
        Err(error) => {
            let _ = fs::remove_file(&staging_path).await;
            return Err(error.into());
        }
    };
    if let Err(error) = fs::remove_file(&staging_path).await {
        tracing::warn!(path = %staging_path.display(), %error, "failed to remove media staging file");
    }

    if let Some(existing) = media_assets::Entity::find()
        .filter(media_assets::Column::Sha256.eq(sha256.to_vec()))
        .one(&state.database)
        .await?
    {
        return Ok(existing);
    }

    // 生成 card/thumb 变体；失败不致命，变体列留 NULL，原图照常入库
    let (card_key, thumb_key) = if kind.image && supports_variants(kind.mime) {
        match generate_variants(&state.media, &sha256, &storage_key).await {
            Ok((card_key, thumb_key)) => (Some(card_key), Some(thumb_key)),
            Err(error) => {
                tracing::warn!(storage_key = %storage_key, %error, "failed to generate media variants");
                (None, None)
            }
        }
    } else {
        (None, None)
    };

    let (width, height) = dimensions
        .map(|(width, height)| (Some(width), Some(height)))
        .unwrap_or((None, None));
    let model = media_assets::ActiveModel {
        id: NotSet,
        storage_key: Set(storage_key),
        original_name: Set(original_name),
        media_type: Set(kind.mime.to_owned()),
        byte_size: Set(
            i64::try_from(byte_size).map_err(|_| AppError::Internal("media size overflow"))?
        ),
        sha256: Set(sha256.to_vec()),
        width: Set(width),
        height: Set(height),
        card_key: Set(card_key.clone()),
        thumb_key: Set(thumb_key.clone()),
        origin: Set(origin.to_owned()),
        source_url: Set(source_url),
        created_at: NotSet,
    }
    .insert(&state.database)
    .await;

    match model {
        Ok(model) => Ok(model),
        Err(error) => {
            if let Some(existing) = media_assets::Entity::find()
                .filter(media_assets::Column::Sha256.eq(sha256.to_vec()))
                .one(&state.database)
                .await?
            {
                return Ok(existing);
            }
            if created_file {
                let _ = fs::remove_file(final_path).await;
                // 插行失败时把刚生成的变体一并清掉，避免遗留孤儿文件
                for key in [&card_key, &thumb_key].into_iter().flatten() {
                    let _ = fs::remove_file(state.media.public_dir.join(key)).await;
                }
            }
            Err(error.into())
        }
    }
}

async fn write_staging_file(
    path: &Path,
    field: &mut Field<'_>,
) -> Result<(u64, [u8; 32], Vec<u8>), AppError> {
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(path)
        .await?;
    let mut byte_size = 0_u64;
    let mut hasher = Sha256::new();
    let mut sniffed = Vec::with_capacity(SNIFF_BYTES);

    while let Some(chunk) = field
        .chunk()
        .await
        .map_err(|_| AppError::InvalidRequest("上传数据中断"))?
    {
        byte_size = byte_size
            .checked_add(chunk.len() as u64)
            .ok_or(AppError::PayloadTooLarge)?;
        if byte_size > MAX_UPLOAD_BYTES as u64 {
            return Err(AppError::PayloadTooLarge);
        }
        let remaining = SNIFF_BYTES.saturating_sub(sniffed.len());
        sniffed.extend_from_slice(&chunk[..remaining.min(chunk.len())]);
        hasher.update(&chunk);
        file.write_all(&chunk).await?;
    }
    if byte_size == 0 {
        return Err(AppError::InvalidRequest("上传文件不能为空"));
    }
    file.sync_all().await?;
    Ok((byte_size, hasher.finalize().into(), sniffed))
}

#[derive(Copy, Clone)]
struct MediaKind {
    mime: &'static str,
    extension: &'static str,
    image: bool,
}

fn detect_media(bytes: &[u8], byte_size: u64) -> Result<MediaKind, AppError> {
    let mime = infer::get(bytes)
        .map(|kind| kind.mime_type())
        .ok_or(AppError::UnsupportedMedia)?;
    let kind = match mime {
        "image/jpeg" => MediaKind {
            mime,
            extension: "jpg",
            image: true,
        },
        "image/png" => MediaKind {
            mime,
            extension: "png",
            image: true,
        },
        "image/webp" => MediaKind {
            mime,
            extension: "webp",
            image: true,
        },
        "image/gif" => MediaKind {
            mime,
            extension: "gif",
            image: true,
        },
        "image/avif" => MediaKind {
            mime,
            extension: "avif",
            image: true,
        },
        "video/mp4" => MediaKind {
            mime,
            extension: "mp4",
            image: false,
        },
        "video/webm" => MediaKind {
            mime,
            extension: "webm",
            image: false,
        },
        _ => return Err(AppError::UnsupportedMedia),
    };
    if kind.image && byte_size > MAX_IMAGE_BYTES {
        return Err(AppError::PayloadTooLarge);
    }
    Ok(kind)
}

async fn image_dimensions(path: &Path) -> Result<(i32, i32), AppError> {
    let path = path.to_owned();
    let size = tokio::task::spawn_blocking(move || imagesize::size(path))
        .await
        .map_err(|_| AppError::Internal("image dimension task"))?
        .map_err(|_| AppError::UnsupportedMedia)?;
    if size.width == 0
        || size.height == 0
        || size.width > MAX_IMAGE_EDGE
        || size.height > MAX_IMAGE_EDGE
        || size.width.saturating_mul(size.height) > MAX_IMAGE_PIXELS
    {
        return Err(AppError::UnsupportedMedia);
    }
    Ok((
        i32::try_from(size.width).map_err(|_| AppError::UnsupportedMedia)?,
        i32::try_from(size.height).map_err(|_| AppError::UnsupportedMedia)?,
    ))
}

/* ---------- 图片变体（card / thumb） ---------- */

pub const VARIANT_CARD_EDGE: u32 = 1200;
pub const VARIANT_THUMB_EDGE: u32 = 360;

/// 变体仅面向可直接解码的位图格式；AVIF 与视频不生成变体。
pub fn supports_variants(media_type: &str) -> bool {
    matches!(
        media_type,
        "image/jpeg" | "image/png" | "image/webp" | "image/gif"
    )
}

/// 变体与原图同目录、同哈希前缀：`<hash>.card.webp` / `<hash>.thumb.webp`。
pub fn variant_keys(hash_hex: &str) -> (String, String) {
    (
        format!("{}/{}.card.webp", &hash_hex[..2], hash_hex),
        format!("{}/{}.thumb.webp", &hash_hex[..2], hash_hex),
    )
}

/// 异步入口：解码/缩放/编码全部放进阻塞线程池，不占 async runtime。
/// 上传管线与 `media-backfill-variants` 回填命令共用。
pub async fn generate_variants(
    media: &MediaStorage,
    sha256: &[u8],
    storage_key: &str,
) -> Result<(String, String), AppError> {
    let hash_hex = hex_lower(sha256);
    let public_dir = media.public_dir().to_owned();
    let source = public_dir.join(storage_key);
    tokio::task::spawn_blocking(move || render_variant_files(&public_dir, &source, &hash_hex))
        .await
        .map_err(|_| AppError::Internal("media variant task"))?
        .map_err(AppError::from)
}

/// 同步核心（可单测）：解码原图（GIF 取首帧）→ 最长边等比缩到目标边长（只缩
/// 不放）→ webp 编码写盘。注意 image-webp 目前只提供无损 VP8L 编码，没有纯
/// Rust 的有损实现；失败时清掉已写出的半成品，保证两档全有或全无。
fn render_variant_files(
    public_dir: &Path,
    source: &Path,
    hash_hex: &str,
) -> Result<(String, String), std::io::Error> {
    let image = image::ImageReader::open(source)?
        .with_guessed_format()?
        .decode()
        .map_err(std::io::Error::other)?;
    let (card_key, thumb_key) = variant_keys(hash_hex);
    for (key, max_edge) in [
        (&card_key, VARIANT_CARD_EDGE),
        (&thumb_key, VARIANT_THUMB_EDGE),
    ] {
        let result = write_variant(public_dir, key, &image, max_edge);
        if let Err(error) = result {
            for written in [&card_key, &thumb_key] {
                let _ = std::fs::remove_file(public_dir.join(written));
            }
            return Err(error);
        }
    }
    Ok((card_key, thumb_key))
}

fn write_variant(
    public_dir: &Path,
    key: &str,
    image: &image::DynamicImage,
    max_edge: u32,
) -> Result<(), std::io::Error> {
    // thumbnail 保持宽高比但会放大小图，这里手动保证只缩不放
    let variant = if image.width() > max_edge || image.height() > max_edge {
        image.thumbnail(max_edge, max_edge)
    } else {
        image.clone()
    };
    let mut bytes = Vec::new();
    variant
        .write_to(
            &mut std::io::Cursor::new(&mut bytes),
            image::ImageFormat::WebP,
        )
        .map_err(std::io::Error::other)?;
    let path = public_dir.join(key);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&path, &bytes)
}

fn random_suffix() -> String {
    let mut bytes = [0_u8; 16];
    OsRng.fill_bytes(&mut bytes);
    hex_lower(&bytes)
}

/// Resolve hero backgrounds to `(url, focal position, zoom size)` triples, keeping
/// list order and skipping entries whose media is missing or not an image.
pub(crate) async fn hero_background_urls<C: ConnectionTrait>(
    connection: &C,
    items: &[crate::content::settings::HeroBackground],
) -> Vec<(String, Option<String>, Option<String>)> {
    if items.is_empty() {
        return Vec::new();
    }
    let ids: Vec<Uuid> = items.iter().map(|item| item.media_id()).collect();
    let assets = media_assets::Entity::find()
        .filter(media_assets::Column::Id.is_in(ids.iter().copied()))
        .all(connection)
        .await
        .unwrap_or_default();
    items
        .iter()
        .filter_map(|item| {
            let media = assets
                .iter()
                .find(|media| media.id == item.media_id())
                .filter(|media| media.media_type.starts_with("image/"))?;
            Some((
                format!("/media/{}", media.storage_key),
                item.position().map(str::to_owned),
                item.size().map(str::to_owned),
            ))
        })
        .collect()
}

/// Resolve media ids to public `/media/{storage_key}` URLs, keeping id order and
/// skipping ids that are missing or not images.
pub(crate) async fn image_media_urls<C: ConnectionTrait>(
    connection: &C,
    ids: &[Uuid],
) -> Result<Vec<String>, AppError> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let assets = media_assets::Entity::find()
        .filter(media_assets::Column::Id.is_in(ids.iter().copied()))
        .all(connection)
        .await?;
    Ok(ids
        .iter()
        .filter_map(|id| assets.iter().find(|media| &media.id == id))
        .filter(|media| media.media_type.starts_with("image/"))
        .map(|media| format!("/media/{}", media.storage_key))
        .collect())
}

fn hex_lower(bytes: &[u8]) -> String {
    use std::fmt::Write;

    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        write!(&mut output, "{byte:02x}").expect("writing to String cannot fail");
    }
    output
}

impl From<media_assets::Model> for MediaResponse {
    fn from(media: media_assets::Model) -> Self {
        Self {
            id: media.id,
            url: format!("/media/{}", media.storage_key),
            card_url: media.card_key.map(|key| format!("/media/{key}")),
            thumb_url: media.thumb_key.map(|key| format!("/media/{key}")),
            original_name: media.original_name,
            media_type: media.media_type,
            byte_size: media.byte_size,
            width: media.width,
            height: media.height,
            origin: media.origin,
            source_url: media.source_url,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_png_and_enforces_image_limit() {
        let png = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR";
        let kind = detect_media(png, 1024).unwrap();
        assert_eq!(kind.mime, "image/png");
        assert!(detect_media(png, MAX_IMAGE_BYTES + 1).is_err());
    }

    #[test]
    fn rejects_unknown_data() {
        assert!(detect_media(b"not media", 9).is_err());
    }

    #[test]
    fn content_hash_key_parts_are_lowercase_hex() {
        let hash = [0xab_u8; 32];
        let encoded = hex_lower(&hash);
        assert_eq!(&encoded[..2], "ab");
        assert_eq!(encoded.len(), 64);
    }
}

#[cfg(test)]
mod variant_tests {
    use super::*;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("yukilog-variant-test-{tag}-{}", random_suffix()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn test_hash() -> String {
        format!("ab{}", "cd".repeat(31))
    }

    /// 生成渐变图，避免纯色把编码结果压成玩具尺寸
    fn gradient_rgb(width: u32, height: u32) -> image::RgbImage {
        let mut image = image::RgbImage::new(width, height);
        for (x, y, pixel) in image.enumerate_pixels_mut() {
            *pixel = image::Rgb([(x % 251) as u8, (y % 241) as u8, ((x * y) % 233) as u8]);
        }
        image
    }

    fn decode_dimensions(path: &Path) -> (u32, u32) {
        let reader = image::ImageReader::open(path)
            .unwrap()
            .with_guessed_format()
            .unwrap();
        assert_eq!(reader.format(), Some(image::ImageFormat::WebP));
        let image = reader.decode().unwrap();
        (image.width(), image.height())
    }

    #[test]
    fn variants_shrink_large_png() {
        let dir = temp_dir("png");
        let source = dir.join("source.png");
        gradient_rgb(2400, 1800).save(&source).unwrap();

        let hash = test_hash();
        let (card_key, thumb_key) = render_variant_files(&dir, &source, &hash).unwrap();
        assert_eq!(card_key, format!("ab/{hash}.card.webp"));
        assert_eq!(thumb_key, format!("ab/{hash}.thumb.webp"));
        assert_eq!(decode_dimensions(&dir.join(&card_key)), (1200, 900));
        assert_eq!(decode_dimensions(&dir.join(&thumb_key)), (360, 270));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn variants_never_enlarge_small_images() {
        let dir = temp_dir("small");
        let source = dir.join("source.png");
        gradient_rgb(200, 100).save(&source).unwrap();

        let hash = test_hash();
        let (card_key, thumb_key) = render_variant_files(&dir, &source, &hash).unwrap();
        assert_eq!(decode_dimensions(&dir.join(&card_key)), (200, 100));
        assert_eq!(decode_dimensions(&dir.join(&thumb_key)), (200, 100));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn gif_variants_use_first_frame() {
        use image::codecs::gif::GifEncoder;

        let dir = temp_dir("gif");
        let source = dir.join("source.gif");
        // 两帧尺寸一致但内容不同，解码应只取首帧
        let first =
            image::RgbaImage::from_fn(500, 400, |x, _| image::Rgba([(x % 256) as u8, 0, 0, 255]));
        let second = image::RgbaImage::from_fn(500, 400, |_, _| image::Rgba([0, 0, 255, 255]));
        {
            let file = std::fs::File::create(&source).unwrap();
            let mut encoder = GifEncoder::new(file);
            encoder
                .encode_frames(vec![image::Frame::new(first), image::Frame::new(second)])
                .unwrap();
        }

        let hash = test_hash();
        let (card_key, thumb_key) = render_variant_files(&dir, &source, &hash).unwrap();
        assert_eq!(decode_dimensions(&dir.join(&card_key)), (500, 400));
        assert_eq!(decode_dimensions(&dir.join(&thumb_key)), (360, 288));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn avif_and_video_skip_variants() {
        assert!(supports_variants("image/jpeg"));
        assert!(supports_variants("image/png"));
        assert!(supports_variants("image/webp"));
        assert!(supports_variants("image/gif"));
        assert!(!supports_variants("image/avif"));
        assert!(!supports_variants("video/mp4"));
        assert!(!supports_variants("video/webm"));
    }
}

/* ---------- 从 URL 拉取媒体入库 ---------- */

const MAX_FETCH_BYTES: usize = 15 * 1024 * 1024;
const MAX_FETCH_REDIRECTS: usize = 3;

#[derive(Debug, serde::Deserialize)]
pub struct FetchUrlInput {
    url: String,
}

/// 管理端输入外链 URL，服务端下载并按上传同一管线入库（origin='fetched'）。
/// SSRF 防护：仅 http(s)、禁止凭据、域名解析后逐 IP 拒绝内网/保留地址、
/// 手动跟随重定向（每跳重新校验）、15MB 上限、魔数与上传同一探测。
pub async fn fetch_url(
    State(state): State<AppState>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(input): Json<FetchUrlInput>,
) -> Result<Json<MediaResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let (bytes, final_url) = download_remote(&input.url).await?;
    let original_name = remote_file_name(&final_url);
    let staging_path = state
        .media
        .staging_dir
        .join(format!(".fetch-{}", random_suffix()));
    let staged = write_staging_bytes(&staging_path, &bytes).await;
    let (byte_size, sha256, sniffed) = match staged {
        Ok(result) => result,
        Err(error) => {
            let _ = fs::remove_file(&staging_path).await;
            return Err(error);
        }
    };
    let model = persist_staged(
        &state,
        staging_path,
        byte_size,
        sha256,
        sniffed,
        original_name,
        "fetched",
        Some(final_url),
    )
    .await?;
    Ok(Json(MediaResponse::from(model)))
}

async fn write_staging_bytes(
    path: &Path,
    bytes: &[u8],
) -> Result<(u64, [u8; 32], Vec<u8>), AppError> {
    if bytes.is_empty() {
        return Err(AppError::InvalidRequest("下载内容为空"));
    }
    if bytes.len() > MAX_FETCH_BYTES {
        return Err(AppError::PayloadTooLarge);
    }
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let sniffed = bytes[..SNIFF_BYTES.min(bytes.len())].to_vec();
    fs::write(path, bytes).await?;
    Ok((bytes.len() as u64, hasher.finalize().into(), sniffed))
}

async fn download_remote(input: &str) -> Result<(Vec<u8>, String), AppError> {
    let mut url = validate_fetch_url(input)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent("YukiLog-MediaFetcher/1.0")
        .build()
        .map_err(|_| AppError::Internal("http client init failed"))?;
    for _ in 0..=MAX_FETCH_REDIRECTS {
        assert_public_url(&url).await?;
        let response = client
            .get(url.as_str())
            .send()
            .await
            .map_err(|_| AppError::InvalidRequest("下载失败：无法连接目标"))?;
        let status = response.status();
        if status.is_redirection() {
            let location = response
                .headers()
                .get(axum::http::header::LOCATION)
                .and_then(|value| value.to_str().ok())
                .ok_or(AppError::InvalidRequest("重定向缺少 Location"))?;
            url = validate_fetch_url(&location.to_owned())?;
            continue;
        }
        if !status.is_success() {
            return Err(AppError::InvalidRequest("下载失败：目标返回错误状态"));
        }
        if let Some(length) = response.content_length() {
            if length > MAX_FETCH_BYTES as u64 {
                return Err(AppError::PayloadTooLarge);
            }
        }
        let bytes = response
            .bytes()
            .await
            .map_err(|_| AppError::InvalidRequest("下载失败：读取内容出错"))?
            .to_vec();
        if bytes.len() > MAX_FETCH_BYTES {
            return Err(AppError::PayloadTooLarge);
        }
        return Ok((bytes, url.to_string()));
    }
    Err(AppError::InvalidRequest("重定向次数过多"))
}

fn validate_fetch_url(input: &str) -> Result<reqwest::Url, AppError> {
    if input.len() > 2048 {
        return Err(AppError::InvalidRequest("URL 过长"));
    }
    let url = reqwest::Url::parse(input.trim()).map_err(|_| AppError::InvalidRequest("URL 无效"))?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err(AppError::InvalidRequest("仅支持 http(s) URL"));
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(AppError::InvalidRequest("URL 不允许携带凭据"));
    }
    if url.host_str().is_none() {
        return Err(AppError::InvalidRequest("URL 缺少主机"));
    }
    Ok(url)
}

/// 域名解析后逐 IP 检查：任何一条落在内网/保留地址都拒绝（防 DNS 分拆应答）。
async fn assert_public_url(url: &reqwest::Url) -> Result<(), AppError> {
    let host = url
        .host_str()
        .ok_or(AppError::InvalidRequest("URL 缺少主机"))?;
    let port = url.port_or_known_default().unwrap_or(80);
    let addresses: Vec<std::net::SocketAddr> = tokio::net::lookup_host((host, port))
        .await
        .map_err(|_| AppError::InvalidRequest("域名解析失败"))?
        .collect();
    if addresses.is_empty() {
        return Err(AppError::InvalidRequest("域名解析失败"));
    }
    for address in addresses {
        if !is_public_ip(&address.ip()) {
            return Err(AppError::InvalidRequest("目标地址不允许访问（内网或保留地址）"));
        }
    }
    Ok(())
}

fn is_public_ip(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            let octets = v4.octets();
            !(v4.is_private()
                || v4.is_loopback()
                || v4.is_link_local()
                || v4.is_unspecified()
                || v4.is_broadcast()
                || v4.is_multicast()
                || v4.is_documentation()
                || octets[0] == 0
                || (octets[0] == 100 && (octets[1] & 0xC0) == 64))
        }
        IpAddr::V6(v6) => {
            let segments = v6.segments();
            !(v6.is_loopback()
                || v6.is_unspecified()
                || (segments[0] & 0xfe00) == 0xfc00
                || (segments[0] & 0xffc0) == 0xfe80)
        }
    }
}

fn remote_file_name(url: &str) -> String {
    let name = reqwest::Url::parse(url)
        .ok()
        .and_then(|parsed| {
            parsed
                .path_segments()
                .and_then(|segments| segments.last().map(str::to_owned))
        })
        .filter(|name| !name.trim().is_empty() && name.len() <= 255)
        .unwrap_or_else(|| "remote-image".to_owned());
    name.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | '(' | ')' | ' ') {
                c
            } else {
                '_'
            }
        })
        .collect()
}

/* ---------- 正文外链图片扫描 ---------- */

#[derive(Debug, Serialize)]
pub struct ExternalRefUsage {
    kind: &'static str,
    id: sea_orm::prelude::Uuid,
    label: String,
}

#[derive(Debug, Serialize)]
pub struct ExternalRefResponse {
    url: String,
    usages: Vec<ExternalRefUsage>,
}

/// 媒体页「外链」标签页的数据：实时从文章/动态正文扫描 `![alt](http...)` 图片引用，
/// 按 URL 归组并列出使用位置。不落表——正文本身就是数据源，永不漂移。
pub async fn external_media_refs(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Vec<ExternalRefResponse>>, AppError> {
    auth::authorize_read(&state, &jar).await?;
    let mut refs: Vec<ExternalRefResponse> = Vec::new();
    let article_rows = articles::Entity::find()
        .all(&state.database)
        .await?;
    for article in article_rows {
        for url in scan_external_images(&article.body_markdown) {
            push_external_ref(
                &mut refs,
                url,
                ExternalRefUsage {
                    kind: "article",
                    id: article.id,
                    label: article.title.clone(),
                },
            );
        }
    }
    let dynamic_rows = dynamics::Entity::find().all(&state.database).await?;
    for dynamic in dynamic_rows {
        let label: String = dynamic.content_markdown.chars().take(24).collect();
        for url in scan_external_images(&dynamic.content_markdown) {
            push_external_ref(
                &mut refs,
                url,
                ExternalRefUsage {
                    kind: "dynamic",
                    id: dynamic.id,
                    label: label.clone(),
                },
            );
        }
    }
    refs.sort_by(|a, b| a.url.cmp(&b.url));
    Ok(Json(refs))
}

fn push_external_ref(refs: &mut Vec<ExternalRefResponse>, url: String, usage: ExternalRefUsage) {
    if let Some(existing) = refs.iter_mut().find(|item| item.url == url) {
        existing.usages.push(usage);
    } else {
        refs.push(ExternalRefResponse {
            url,
            usages: vec![usage],
        });
    }
}

/// 手扫 `![alt](http...)`（与解析器同规则：URL 到第一个 `)` 为止）。
fn scan_external_images(markdown: &str) -> Vec<String> {
    let mut urls = Vec::new();
    let mut rest = markdown;
    while let Some(pos) = rest.find("![") {
        rest = &rest[pos + 2..];
        let Some(alt_end) = rest.find(']') else { break };
        let after_alt = &rest[alt_end + 1..];
        if !after_alt.starts_with('(') {
            continue;
        }
        let target = &after_alt[1..];
        let Some(url_end) = target.find(')') else { break };
        let url = &target[..url_end];
        if url.starts_with("http://") || url.starts_with("https://") {
            urls.push(url.to_owned());
        }
        rest = target;
    }
    urls
}

#[cfg(test)]
mod fetch_tests {
    use super::*;

    #[test]
    fn fetch_url_validation_rejects_non_http_and_credentials() {
        assert!(validate_fetch_url("ftp://example.com/a.jpg").is_err());
        assert!(validate_fetch_url("https://user:pass@example.com/a.jpg").is_err());
        assert!(validate_fetch_url("not-a-url").is_err());
        assert!(validate_fetch_url("https://example.com/a.jpg").is_ok());
    }

    #[test]
    fn public_ip_blocks_private_and_reserved() {
        let private = [
            "127.0.0.1", "10.0.0.5", "172.16.3.4", "192.168.1.1", "169.254.1.1", "100.64.0.1",
            "0.0.0.0", "224.0.0.1",
        ];
        for ip in private {
            assert!(!is_public_ip(&ip.parse().unwrap()), "{ip} 应被拒绝");
        }
        let public = ["8.8.8.8", "1.1.1.1", "43.163.241.49"];
        for ip in public {
            assert!(is_public_ip(&ip.parse().unwrap()), "{ip} 应放行");
        }
        assert!(!is_public_ip(&"::1".parse().unwrap()));
        assert!(!is_public_ip(&"fc00::1".parse().unwrap()));
        assert!(!is_public_ip(&"fe80::1".parse().unwrap()));
        assert!(is_public_ip(&"2606:4700:4700::1111".parse().unwrap()));
    }

    #[test]
    fn scan_finds_only_external_image_urls() {
        let source = "![外链](https://a.com/x.jpg) 和 ![本地](/media/ab/cd.png) 和 [链接](https://a.com) 和 ![尾部](https://b.com/y.webp){width=40%}";
        let urls = scan_external_images(source);
        assert_eq!(urls, vec![
            "https://a.com/x.jpg".to_owned(),
            "https://b.com/y.webp".to_owned(),
        ]);
    }

    #[test]
    fn remote_file_name_sanitizes() {
        assert_eq!(remote_file_name("https://a.com/pic/x.jpg"), "x.jpg");
        assert_eq!(remote_file_name("https://a.com/"), "remote-image");
        assert_eq!(remote_file_name("https://a.com/dir/photo(1).png"), "photo(1).png");
        // 特殊字符替成下划线，不注入路径分隔或控制符
        assert_eq!(remote_file_name("https://a.com/%E4%B8%AD%E6%96%87.png"), "_E4_B8_AD_E6_96_87.png");
        // path_segments 不做百分号解码，特殊字符一律替成下划线
        assert_eq!(remote_file_name("https://a.com/a/b/c%20d.png"), "c_20d.png");
    }
}
