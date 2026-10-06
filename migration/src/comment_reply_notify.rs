use sea_orm_migration::prelude::*;

const UP_SQL: &str = include_str!("../db/20261006_000004_comment_reply_notify.up.sql");
const DOWN_SQL: &str = include_str!("../db/20261006_000004_comment_reply_notify.down.sql");

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20261006_000004_comment_reply_notify"
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
    fn up_sql_supports_non_subscriber_recipient() {
        assert!(UP_SQL.contains("ADD COLUMN recipient_email citext"));
        assert!(UP_SQL.contains("ADD COLUMN comment_id uuid REFERENCES comments(id) ON DELETE CASCADE"));
        assert!(UP_SQL.contains("ALTER COLUMN subscriber_id DROP NOT NULL"));
        assert!(UP_SQL.contains("'comment_reply'"));
        assert!(UP_SQL.contains("email_deliveries_comment_reply_uidx"));
    }

    #[test]
    fn down_sql_deletes_reply_rows_before_restoring_not_null() {
        let delete = DOWN_SQL.find("DELETE FROM email_deliveries WHERE kind = 'comment_reply'").unwrap();
        let not_null = DOWN_SQL.find("ALTER COLUMN subscriber_id SET NOT NULL").unwrap();
        assert!(delete < not_null);
    }
}
