use std::{env, io};

use sea_orm::{ActiveModelTrait, ActiveValue::NotSet, Set};
use yukilog_server::{
    auth::{hash_password, validate_password},
    database,
    entities::admin_accounts,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let (username, display_name) = parse_args()?;
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

fn parse_args() -> Result<(String, String), io::Error> {
    let mut args = env::args().skip(1);
    let command = args.next();
    let username = args.next();
    let display_name = args.next();
    if command.as_deref() != Some("create-admin")
        || username.as_deref().is_none_or(str::is_empty)
        || display_name.as_deref().is_none_or(str::is_empty)
        || args.next().is_some()
    {
        return Err(io::Error::other(
            "用法：yukilog-admin create-admin <username> <display-name>",
        ));
    }
    Ok((username.unwrap(), display_name.unwrap()))
}
