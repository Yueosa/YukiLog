ALTER TABLE site_settings
    ADD COLUMN avatar_external_url text,
    ADD COLUMN masthead_media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
    ADD CONSTRAINT site_settings_avatar_external_url_format
        CHECK (
            avatar_external_url IS NULL
            OR (
                char_length(avatar_external_url) <= 512
                AND avatar_external_url ~ '^https?://'
            )
        );
