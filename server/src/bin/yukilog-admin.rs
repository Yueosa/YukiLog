use std::{env, io, path::PathBuf};

use sea_orm::{ActiveModelTrait, ActiveValue::NotSet, ColumnTrait, EntityTrait, QueryFilter, Set};
use yukilog_server::{
    auth::{hash_password, validate_password},
    database,
    entities::{admin_accounts, media_assets},
    ops::media::{self, MediaStorage},
};

enum Command {
    CreateAdmin {
        username: String,
        display_name: String,
    },
    BackfillVariants,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    match parse_args()? {
        Command::CreateAdmin {
            username,
            display_name,
        } => create_admin(username, display_name).await,
        Command::BackfillVariants => backfill_variants().await,
    }
}

async fn create_admin(
    username: String,
    display_name: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let database_url =
        env::var("DATABASE_URL").map_err(|_| io::Error::other("请先设置 DATABASE_URL"))?;

    let password = rpassword::prompt_password("密码: ")?;
    validate_password(&password)?;
    let confirmation = rpassword::prompt_password("再次输入密码: ")?;
    if password != confirmation {
        return Err(io::Error::other("两次输入的密码不一致").into());
    }
    let password_hash = tokio::task::spawn_blocking(move || hash_password(&password)).await??;

    let connection = database::connect(&database_url).await?;
    admin_accounts::ActiveModel {
        id: NotSet,
        username: Set(username),
        password_hash: Set(password_hash),
        display_name: Set(display_name),
        notification_email: Set(None),
        email_notifications_enabled: Set(false),
        notify_on_comments: Set(true),
        notify_on_friend_links: Set(true),
        notify_on_likes: Set(false),
        notification_frequency: Set("hourly".to_owned()),
        is_active: Set(true),
        last_login_at: Set(None),
        created_at: NotSet,
        updated_at: NotSet,
    }
    .insert(&connection)
    .await?;
    connection.close().await?;

    println!("管理员账号已创建");
    Ok(())
}

/// 扫描缺变体的图片资产，从 assets 读原图生成 card/thumb 并回写列。
async fn backfill_variants() -> Result<(), Box<dyn std::error::Error>> {
    let database_url =
        env::var("DATABASE_URL").map_err(|_| io::Error::other("请先设置 DATABASE_URL"))?;
    let media_dir = env::var("YUKILOG_MEDIA_DIR")
        .map_err(|_| io::Error::other("请先设置 YUKILOG_MEDIA_DIR"))?;
    let media = MediaStorage::new(PathBuf::from(media_dir)).await?;
    let connection = database::connect(&database_url).await?;

    let pending = media_assets::Entity::find()
        .filter(media_assets::Column::MediaType.is_in([
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
        ]))
        .filter(
            media_assets::Column::CardKey
                .is_null()
                .or(media_assets::Column::ThumbKey.is_null()),
        )
        .all(&connection)
        .await?;
    let total = pending.len();
    println!("待回填媒体：{total}");

    let mut succeeded = 0_usize;
    let mut failed = 0_usize;
    for (index, row) in pending.into_iter().enumerate() {
        let label = format!("{} ({})", row.storage_key, row.original_name);
        match media::generate_variants(&media, &row.sha256, &row.storage_key).await {
            Ok((card_key, thumb_key)) => {
                let mut active: media_assets::ActiveModel = row.into();
                active.card_key = Set(Some(card_key));
                active.thumb_key = Set(Some(thumb_key));
                active.update(&connection).await?;
                succeeded += 1;
                println!("[{}/{}] 完成 {label}", index + 1, total);
            }
            Err(error) => {
                failed += 1;
                eprintln!("[{}/{}] 失败 {label}：{error}", index + 1, total);
            }
        }
    }
    connection.close().await?;
    println!("回填完成：成功 {succeeded}，失败 {failed}，共 {total}");
    Ok(())
}

fn parse_args() -> Result<Command, io::Error> {
    let mut args = env::args().skip(1);
    let usage = "用法：yukilog-admin create-admin <username> <display-name>\n       yukilog-admin media-backfill-variants";
    match args.next().as_deref() {
        Some("create-admin") => {
            let username = args.next();
            let display_name = args.next();
            if username.as_deref().is_none_or(str::is_empty)
                || display_name.as_deref().is_none_or(str::is_empty)
                || args.next().is_some()
            {
                return Err(io::Error::other(usage));
            }
            Ok(Command::CreateAdmin {
                username: username.unwrap(),
                display_name: display_name.unwrap(),
            })
        }
        Some("media-backfill-variants") if args.next().is_none() => Ok(Command::BackfillVariants),
        _ => Err(io::Error::other(usage)),
    }
}
