use sea_orm_migration::prelude::*;

const UP_SQL: &str = include_str!("../db/20261006_000003_hero_rotation.up.sql");
const DOWN_SQL: &str = include_str!("../db/20261006_000003_hero_rotation.down.sql");

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20261006_000003_hero_rotation"
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
    fn up_sql_adds_hero_columns_with_guards() {
        assert!(UP_SQL.contains("ALTER TABLE site_settings"));
        assert!(UP_SQL.contains("ADD COLUMN hero_background_media_ids jsonb NOT NULL DEFAULT '[]'::jsonb"));
        assert!(UP_SQL.contains("ADD COLUMN hero_quote text"));
        assert!(UP_SQL.contains("jsonb_typeof(hero_background_media_ids) = 'array'"));
        assert!(UP_SQL.contains("jsonb_array_length(hero_background_media_ids) <= 12"));
        assert!(UP_SQL.contains("char_length(hero_quote) <= 120"));
    }

    #[test]
    fn down_sql_drops_constraints_before_columns() {
        let shape_drop = DOWN_SQL
            .find("DROP CONSTRAINT IF EXISTS site_settings_hero_background_media_ids_shape")
            .unwrap();
        let quote_constraint_drop = DOWN_SQL
            .find("DROP CONSTRAINT IF EXISTS site_settings_hero_quote_length")
            .unwrap();
        let quote_drop = DOWN_SQL.find("DROP COLUMN IF EXISTS hero_quote").unwrap();
        let ids_drop = DOWN_SQL
            .find("DROP COLUMN IF EXISTS hero_background_media_ids")
            .unwrap();
        assert!(shape_drop < quote_drop);
        assert!(quote_constraint_drop < quote_drop);
        assert!(quote_drop < ids_drop);
    }
}
