ALTER TABLE site_settings
    DROP CONSTRAINT IF EXISTS site_settings_hero_background_media_ids_shape,
    DROP CONSTRAINT IF EXISTS site_settings_hero_quote_length,
    DROP COLUMN IF EXISTS hero_quote,
    DROP COLUMN IF EXISTS hero_background_media_ids;
