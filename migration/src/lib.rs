pub use sea_orm_migration::prelude::*;

mod baseline;
mod site_appearance;

pub struct Migrator;

impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(baseline::Migration),
            Box::new(site_appearance::Migration),
        ]
    }
}
