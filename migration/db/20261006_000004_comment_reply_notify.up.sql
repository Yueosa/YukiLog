-- 评论回复邮件通知：email_deliveries 支持非订阅者收件人（comment_reply 类型）。
ALTER TABLE email_deliveries
    ADD COLUMN recipient_email citext,
    ADD COLUMN comment_id uuid REFERENCES comments(id) ON DELETE CASCADE,
    ALTER COLUMN subscriber_id DROP NOT NULL,
    DROP CONSTRAINT email_deliveries_kind_valid,
    DROP CONSTRAINT email_deliveries_target_valid,
    ADD CONSTRAINT email_deliveries_kind_valid
        CHECK (
            kind IN (
                'confirm_subscription',
                'article_published',
                'dynamic_published',
                'comment_reply'
            )
        ),
    ADD CONSTRAINT email_deliveries_target_valid
        CHECK (
            (kind = 'confirm_subscription' AND article_id IS NULL AND dynamic_id IS NULL AND comment_id IS NULL)
            OR (kind = 'article_published' AND article_id IS NOT NULL AND dynamic_id IS NULL AND comment_id IS NULL)
            OR (kind = 'dynamic_published' AND article_id IS NULL AND dynamic_id IS NOT NULL AND comment_id IS NULL)
            OR (
                kind = 'comment_reply'
                AND comment_id IS NOT NULL
                AND (article_id IS NOT NULL) <> (dynamic_id IS NOT NULL)
            )
        ),
    ADD CONSTRAINT email_deliveries_recipient_valid
        CHECK (
            (
                kind = 'comment_reply'
                AND subscriber_id IS NULL
                AND recipient_email IS NOT NULL
                AND char_length(recipient_email::text) BETWEEN 3 AND 254
                AND position('@' IN recipient_email::text) > 1
            )
            OR (
                kind <> 'comment_reply'
                AND subscriber_id IS NOT NULL
                AND recipient_email IS NULL
            )
        );

-- 一条回复评论只发一封通知（审核反复切换不重复发）
CREATE UNIQUE INDEX email_deliveries_comment_reply_uidx
    ON email_deliveries (comment_id)
    WHERE kind = 'comment_reply';
