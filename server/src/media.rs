use std::{
    io::ErrorKind,
    path::{Path, PathBuf},
    sync::Arc,
};

use axum::{
    Json,
    extract::{Multipart, State, multipart::Field},
    http::HeaderMap,
};
use axum_extra::extract::cookie::CookieJar;
use rand::{RngCore, rngs::OsRng};
use sea_orm::{ActiveModelTrait, ActiveValue::NotSet, ColumnTrait, EntityTrait, QueryFilter, Set};
use serde::Serialize;
use sha2::{Digest, Sha256};
use tokio::{
    fs::{self, OpenOptions},
    io::AsyncWriteExt,
};

use crate::{AppState, auth, entities::media_assets, error::AppError};

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
    original_name: String,
    media_type: String,
    byte_size: i64,
    width: Option<i32>,
    height: Option<i32>,
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

fn random_suffix() -> String {
    let mut bytes = [0_u8; 16];
    OsRng.fill_bytes(&mut bytes);
    hex_lower(&bytes)
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
            original_name: media.original_name,
            media_type: media.media_type,
            byte_size: media.byte_size,
            width: media.width,
            height: media.height,
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
