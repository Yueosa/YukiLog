ALTER TABLE site_settings
    ADD COLUMN hero_background_media_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN hero_quote text,
    ADD CONSTRAINT site_settings_hero_background_media_ids_shape
        CHECK (
            jsonb_typeof(hero_background_media_ids) = 'array'
            AND jsonb_array_length(hero_background_media_ids) <= 12
        ),
    ADD CONSTRAINT site_settings_hero_quote_length
        CHECK (hero_quote IS NULL OR char_length(hero_quote) <= 120);
