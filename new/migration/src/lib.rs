pub use sea_orm_migration::prelude::*;

mod m20261004_000001_create_baseline;

pub struct Migrator;

impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![Box::new(m20261004_000001_create_baseline::Migration)]
    }
}
