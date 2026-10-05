use sea_orm_migration::prelude::*;

const UP_SQL: &str = include_str!("../db/20261004_000001_create_baseline.up.sql");
const DOWN_SQL: &str = include_str!("../db/20261004_000001_create_baseline.down.sql");

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20261004_000001_create_baseline"
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
    fn up_sql_creates_dynamic_media_with_cascade() {
        assert!(UP_SQL.contains("CREATE TABLE dynamic_media ("));
        assert!(UP_SQL
            .contains("dynamic_id uuid NOT NULL REFERENCES dynamics(id) ON DELETE CASCADE"));
        assert!(UP_SQL
            .contains("media_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE"));
        assert!(UP_SQL.contains("PRIMARY KEY (dynamic_id, media_id)"));
        assert!(UP_SQL.contains("CHECK (position BETWEEN 0 AND 8)"));
        assert!(UP_SQL
            .contains("CREATE INDEX dynamic_media_dynamic_idx ON dynamic_media (dynamic_id, position)"));
    }

    #[test]
    fn up_sql_dynamics_has_optional_mood() {
        assert!(UP_SQL.contains("mood varchar(40),"));
        assert!(UP_SQL.contains(
            "CHECK (mood IS NULL OR char_length(btrim(mood)) BETWEEN 1 AND 40)"
        ));
    }

    #[test]
    fn down_sql_drops_dynamic_media_before_parents() {
        let media_drop = DOWN_SQL.find("DROP TABLE IF EXISTS dynamic_media;").unwrap();
        let dynamics_drop = DOWN_SQL.find("DROP TABLE IF EXISTS dynamics;").unwrap();
        let assets_drop = DOWN_SQL.find("DROP TABLE IF EXISTS media_assets;").unwrap();
        assert!(media_drop < dynamics_drop);
        assert!(media_drop < assets_drop);
    }
}
