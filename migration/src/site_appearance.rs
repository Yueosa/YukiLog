use sea_orm_migration::prelude::*;

const UP_SQL: &str = include_str!("../db/20261006_000002_site_appearance.up.sql");
const DOWN_SQL: &str = include_str!("../db/20261006_000002_site_appearance.down.sql");

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20261006_000002_site_appearance"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.get_connection().execute_unprepared(UP_SQL).await?;
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared(DOWN_SQL)
            .await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn up_sql_adds_appearance_columns_with_guards() {
        assert!(UP_SQL.contains("ALTER TABLE site_settings"));
        assert!(UP_SQL.contains("ADD COLUMN avatar_external_url text"));
        assert!(UP_SQL.contains(
            "ADD COLUMN masthead_media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL"
        ));
        assert!(UP_SQL.contains("char_length(avatar_external_url) <= 512"));
        assert!(UP_SQL.contains("avatar_external_url ~ '^https?://'"));
    }

    #[test]
    fn down_sql_drops_constraint_before_columns() {
        let constraint_drop = DOWN_SQL
            .find("DROP CONSTRAINT IF EXISTS site_settings_avatar_external_url_format")
            .unwrap();
        let masthead_drop = DOWN_SQL.find("DROP COLUMN IF EXISTS masthead_media_id").unwrap();
        let url_drop = DOWN_SQL
            .find("DROP COLUMN IF EXISTS avatar_external_url")
            .unwrap();
        assert!(constraint_drop < masthead_drop);
        assert!(masthead_drop < url_drop);
    }
}
