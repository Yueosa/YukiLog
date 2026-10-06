DROP INDEX IF EXISTS email_deliveries_comment_reply_uidx;
DELETE FROM email_deliveries WHERE kind = 'comment_reply';
ALTER TABLE email_deliveries
    DROP CONSTRAINT IF EXISTS email_deliveries_recipient_valid,
    DROP CONSTRAINT email_deliveries_kind_valid,
    DROP CONSTRAINT email_deliveries_target_valid,
    ADD CONSTRAINT email_deliveries_kind_valid
        CHECK (kind IN ('confirm_subscription', 'article_published', 'dynamic_published')),
    ADD CONSTRAINT email_deliveries_target_valid
        CHECK (
            (kind = 'confirm_subscription' AND article_id IS NULL AND dynamic_id IS NULL)
            OR (kind = 'article_published' AND article_id IS NOT NULL AND dynamic_id IS NULL)
            OR (kind = 'dynamic_published' AND article_id IS NULL AND dynamic_id IS NOT NULL)
        ),
    ALTER COLUMN subscriber_id SET NOT NULL,
    DROP COLUMN comment_id,
    DROP COLUMN recipient_email;
