ALTER TABLE site_settings
    DROP CONSTRAINT IF EXISTS site_settings_avatar_external_url_format,
    DROP COLUMN IF EXISTS masthead_media_id,
    DROP COLUMN IF EXISTS avatar_external_url;
