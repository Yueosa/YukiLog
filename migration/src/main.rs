use sea_orm_migration::prelude::*;
use yukilog_migration::Migrator;

#[tokio::main]
async fn main() {
    cli::run_cli(Migrator).await;
}
