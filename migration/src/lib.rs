pub use sea_orm_migration::prelude::*;

mod baseline;

pub struct Migrator;

impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![Box::new(baseline::Migration)]
    }
}
