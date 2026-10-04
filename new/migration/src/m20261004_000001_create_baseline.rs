use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

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

const UP_SQL: &str = r#"
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE FUNCTION yukilog_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TABLE admin_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username citext NOT NULL UNIQUE,
    password_hash text NOT NULL,
    display_name varchar(80) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    last_login_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT admin_accounts_username_length
        CHECK (char_length(btrim(username::text)) BETWEEN 3 AND 64),
    CONSTRAINT admin_accounts_password_hash_format
        CHECK (password_hash LIKE '$argon2id$%'),
    CONSTRAINT admin_accounts_display_name_length
        CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 80),
    CONSTRAINT admin_accounts_last_login_valid
        CHECK (last_login_at IS NULL OR last_login_at >= created_at)
);

CREATE TABLE admin_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
    token_hash bytea NOT NULL UNIQUE,
    csrf_token_hash bytea NOT NULL,
    expires_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT admin_sessions_token_hash_length
        CHECK (octet_length(token_hash) = 32),
    CONSTRAINT admin_sessions_csrf_hash_length
        CHECK (octet_length(csrf_token_hash) = 32),
    CONSTRAINT admin_sessions_expiry_valid
        CHECK (expires_at > created_at),
    CONSTRAINT admin_sessions_last_seen_valid
        CHECK (last_seen_at >= created_at AND last_seen_at <= expires_at)
);
CREATE INDEX admin_sessions_account_id_idx ON admin_sessions (account_id);
CREATE INDEX admin_sessions_expires_at_idx ON admin_sessions (expires_at);

CREATE TABLE categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name citext NOT NULL UNIQUE,
    slug citext NOT NULL UNIQUE,
    description varchar(300),
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT categories_name_length
        CHECK (char_length(btrim(name::text)) BETWEEN 1 AND 80),
    CONSTRAINT categories_slug_format
        CHECK (slug::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT categories_description_length
        CHECK (description IS NULL OR char_length(description) <= 300)
);
CREATE INDEX categories_sort_order_idx ON categories (sort_order, name);

CREATE TABLE tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name citext NOT NULL UNIQUE,
    slug citext NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tags_name_length
        CHECK (char_length(btrim(name::text)) BETWEEN 1 AND 50),
    CONSTRAINT tags_slug_format
        CHECK (slug::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE media_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_key text NOT NULL UNIQUE,
    original_name varchar(255) NOT NULL,
    media_type varchar(100) NOT NULL,
    byte_size bigint NOT NULL,
    sha256 bytea NOT NULL UNIQUE,
    width integer,
    height integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT media_assets_storage_key_format
        CHECK (storage_key ~ '^[a-zA-Z0-9][a-zA-Z0-9/_-]*\.[a-zA-Z0-9]+$'),
    CONSTRAINT media_assets_original_name_length
        CHECK (char_length(btrim(original_name)) BETWEEN 1 AND 255),
    CONSTRAINT media_assets_media_type_length
        CHECK (char_length(btrim(media_type)) BETWEEN 3 AND 100),
    CONSTRAINT media_assets_byte_size_positive
        CHECK (byte_size > 0),
    CONSTRAINT media_assets_sha256_length
        CHECK (octet_length(sha256) = 32),
    CONSTRAINT media_assets_dimensions_valid
        CHECK (
            (width IS NULL AND height IS NULL)
            OR (width > 0 AND height > 0)
        )
);

CREATE TABLE articles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    cover_media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
    title varchar(200) NOT NULL,
    slug citext NOT NULL UNIQUE,
    summary varchar(500),
    body_markdown text NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    allow_comments boolean NOT NULL DEFAULT true,
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT articles_title_length
        CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
    CONSTRAINT articles_slug_format
        CHECK (slug::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT articles_summary_length
        CHECK (summary IS NULL OR char_length(summary) <= 500),
    CONSTRAINT articles_body_not_blank
        CHECK (char_length(btrim(body_markdown)) > 0),
    CONSTRAINT articles_status_valid
        CHECK (status IN ('draft', 'published')),
    CONSTRAINT articles_publish_state_valid
        CHECK (
            (status = 'draft' AND published_at IS NULL)
            OR (status = 'published' AND published_at IS NOT NULL)
        )
);
CREATE INDEX articles_category_id_idx ON articles (category_id);
CREATE INDEX articles_published_at_idx
    ON articles (published_at DESC)
    WHERE status = 'published';

CREATE TABLE article_tags (
    article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE RESTRICT,
    PRIMARY KEY (article_id, tag_id)
);
CREATE INDEX article_tags_tag_id_idx ON article_tags (tag_id, article_id);

CREATE TABLE dynamics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content_markdown text NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    allow_comments boolean NOT NULL DEFAULT true,
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT dynamics_content_not_blank
        CHECK (char_length(btrim(content_markdown)) > 0),
    CONSTRAINT dynamics_status_valid
        CHECK (status IN ('draft', 'published')),
    CONSTRAINT dynamics_publish_state_valid
        CHECK (
            (status = 'draft' AND published_at IS NULL)
            OR (status = 'published' AND published_at IS NOT NULL)
        )
);
CREATE INDEX dynamics_published_at_idx
    ON dynamics (published_at DESC)
    WHERE status = 'published';

CREATE TABLE comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id uuid REFERENCES articles(id) ON DELETE CASCADE,
    dynamic_id uuid REFERENCES dynamics(id) ON DELETE CASCADE,
    parent_id uuid REFERENCES comments(id) ON DELETE CASCADE,
    display_name varchar(80) NOT NULL,
    email citext NOT NULL,
    website text,
    content text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT comments_one_target
        CHECK (num_nonnulls(article_id, dynamic_id) = 1),
    CONSTRAINT comments_parent_not_self
        CHECK (parent_id IS NULL OR parent_id <> id),
    CONSTRAINT comments_display_name_length
        CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 80),
    CONSTRAINT comments_email_shape
        CHECK (
            char_length(email::text) BETWEEN 3 AND 254
            AND position('@' IN email::text) > 1
        ),
    CONSTRAINT comments_website_length
        CHECK (website IS NULL OR char_length(website) <= 2048),
    CONSTRAINT comments_content_length
        CHECK (char_length(btrim(content)) BETWEEN 1 AND 5000),
    CONSTRAINT comments_status_valid
        CHECK (status IN ('pending', 'visible', 'hidden'))
);
CREATE INDEX comments_article_visible_idx
    ON comments (article_id, created_at)
    WHERE status = 'visible';
CREATE INDEX comments_dynamic_visible_idx
    ON comments (dynamic_id, created_at)
    WHERE status = 'visible';
CREATE INDEX comments_pending_idx
    ON comments (created_at)
    WHERE status = 'pending';
CREATE INDEX comments_parent_id_idx
    ON comments (parent_id)
    WHERE parent_id IS NOT NULL;

CREATE FUNCTION yukilog_validate_comment_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    parent_article_id uuid;
    parent_dynamic_id uuid;
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT article_id, dynamic_id
      INTO parent_article_id, parent_dynamic_id
      FROM comments
     WHERE id = NEW.parent_id
     FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'parent comment does not exist'
            USING ERRCODE = '23503';
    END IF;

    IF parent_article_id IS DISTINCT FROM NEW.article_id
       OR parent_dynamic_id IS DISTINCT FROM NEW.dynamic_id THEN
        RAISE EXCEPTION 'parent comment belongs to another target'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER comments_validate_parent
BEFORE INSERT OR UPDATE OF parent_id, article_id, dynamic_id ON comments
FOR EACH ROW EXECUTE FUNCTION yukilog_validate_comment_parent();

CREATE TABLE article_metrics (
    article_id uuid PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
    view_count bigint NOT NULL DEFAULT 0,
    like_count bigint NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT article_metrics_view_count_nonnegative
        CHECK (view_count >= 0),
    CONSTRAINT article_metrics_like_count_nonnegative
        CHECK (like_count >= 0)
);
CREATE INDEX article_metrics_popular_idx
    ON article_metrics (like_count DESC, view_count DESC);

CREATE TABLE article_likes (
    article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    visitor_token_hash bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (article_id, visitor_token_hash),
    CONSTRAINT article_likes_visitor_hash_length
        CHECK (octet_length(visitor_token_hash) = 32)
);

CREATE FUNCTION yukilog_create_article_metrics()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO article_metrics (article_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER articles_create_metrics
AFTER INSERT ON articles
FOR EACH ROW EXECUTE FUNCTION yukilog_create_article_metrics();

CREATE FUNCTION yukilog_update_article_like_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE article_metrics
           SET like_count = like_count + 1,
               updated_at = now()
         WHERE article_id = NEW.article_id;
        RETURN NEW;
    END IF;

    UPDATE article_metrics
       SET like_count = GREATEST(like_count - 1, 0),
           updated_at = now()
     WHERE article_id = OLD.article_id;
    RETURN OLD;
END;
$$;

CREATE TRIGGER article_likes_update_count
AFTER INSERT OR DELETE ON article_likes
FOR EACH ROW EXECUTE FUNCTION yukilog_update_article_like_count();

CREATE TABLE friend_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    avatar_media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
    name varchar(100) NOT NULL,
    url text NOT NULL UNIQUE,
    description varchar(300),
    is_visible boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT friend_links_name_length
        CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
    CONSTRAINT friend_links_url_length
        CHECK (char_length(url) BETWEEN 8 AND 2048),
    CONSTRAINT friend_links_description_length
        CHECK (description IS NULL OR char_length(description) <= 300)
);
CREATE INDEX friend_links_visible_order_idx
    ON friend_links (sort_order, name)
    WHERE is_visible;

CREATE TABLE site_settings (
    singleton boolean PRIMARY KEY DEFAULT true,
    site_title varchar(120) NOT NULL,
    site_description varchar(300),
    owner_name varchar(80) NOT NULL,
    owner_bio text NOT NULL DEFAULT '',
    avatar_media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
    social_links jsonb NOT NULL DEFAULT '[]'::jsonb,
    theme jsonb NOT NULL DEFAULT '{}'::jsonb,
    shell_layout jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT site_settings_single_row CHECK (singleton),
    CONSTRAINT site_settings_title_length
        CHECK (char_length(btrim(site_title)) BETWEEN 1 AND 120),
    CONSTRAINT site_settings_description_length
        CHECK (site_description IS NULL OR char_length(site_description) <= 300),
    CONSTRAINT site_settings_owner_name_length
        CHECK (char_length(btrim(owner_name)) BETWEEN 1 AND 80),
    CONSTRAINT site_settings_social_links_array
        CHECK (jsonb_typeof(social_links) = 'array'),
    CONSTRAINT site_settings_theme_object
        CHECK (jsonb_typeof(theme) = 'object'),
    CONSTRAINT site_settings_shell_layout_object
        CHECK (jsonb_typeof(shell_layout) = 'object')
);

CREATE TABLE page_layouts (
    page_key varchar(64) PRIMARY KEY,
    layout jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT page_layouts_key_format
        CHECK (page_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
    CONSTRAINT page_layouts_layout_object
        CHECK (jsonb_typeof(layout) = 'object')
);

CREATE TABLE subscribers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email citext NOT NULL UNIQUE,
    subscribe_articles boolean NOT NULL DEFAULT true,
    subscribe_dynamics boolean NOT NULL DEFAULT false,
    status text NOT NULL DEFAULT 'pending',
    confirmation_token_hash bytea UNIQUE,
    unsubscribe_token_hash bytea NOT NULL UNIQUE,
    confirmation_sent_at timestamptz,
    confirmed_at timestamptz,
    unsubscribed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT subscribers_email_shape
        CHECK (
            char_length(email::text) BETWEEN 3 AND 254
            AND position('@' IN email::text) > 1
        ),
    CONSTRAINT subscribers_some_content_selected
        CHECK (subscribe_articles OR subscribe_dynamics),
    CONSTRAINT subscribers_status_valid
        CHECK (status IN ('pending', 'active', 'unsubscribed')),
    CONSTRAINT subscribers_confirmation_hash_length
        CHECK (
            confirmation_token_hash IS NULL
            OR octet_length(confirmation_token_hash) = 32
        ),
    CONSTRAINT subscribers_unsubscribe_hash_length
        CHECK (octet_length(unsubscribe_token_hash) = 32),
    CONSTRAINT subscribers_state_times_valid
        CHECK (
            (status = 'pending' AND confirmed_at IS NULL AND unsubscribed_at IS NULL)
            OR (status = 'active' AND confirmed_at IS NOT NULL AND unsubscribed_at IS NULL)
            OR (status = 'unsubscribed' AND unsubscribed_at IS NOT NULL)
        )
);
CREATE INDEX subscribers_active_idx
    ON subscribers (id)
    WHERE status = 'active';

CREATE TABLE email_deliveries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id uuid NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
    kind text NOT NULL,
    article_id uuid REFERENCES articles(id) ON DELETE CASCADE,
    dynamic_id uuid REFERENCES dynamics(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending',
    attempt_count smallint NOT NULL DEFAULT 0,
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    locked_at timestamptz,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,
    CONSTRAINT email_deliveries_kind_valid
        CHECK (kind IN ('confirm_subscription', 'article_published', 'dynamic_published')),
    CONSTRAINT email_deliveries_target_valid
        CHECK (
            (kind = 'confirm_subscription' AND article_id IS NULL AND dynamic_id IS NULL)
            OR (kind = 'article_published' AND article_id IS NOT NULL AND dynamic_id IS NULL)
            OR (kind = 'dynamic_published' AND article_id IS NULL AND dynamic_id IS NOT NULL)
        ),
    CONSTRAINT email_deliveries_status_valid
        CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
    CONSTRAINT email_deliveries_attempt_count_valid
        CHECK (attempt_count BETWEEN 0 AND 20),
    CONSTRAINT email_deliveries_last_error_length
        CHECK (last_error IS NULL OR char_length(last_error) <= 2000),
    CONSTRAINT email_deliveries_state_times_valid
        CHECK (
            (status = 'sending' AND locked_at IS NOT NULL AND sent_at IS NULL)
            OR (status = 'sent' AND sent_at IS NOT NULL)
            OR (status IN ('pending', 'failed', 'cancelled') AND sent_at IS NULL)
        )
);
CREATE UNIQUE INDEX email_deliveries_subscriber_article_uidx
    ON email_deliveries (subscriber_id, article_id)
    WHERE article_id IS NOT NULL;
CREATE UNIQUE INDEX email_deliveries_subscriber_dynamic_uidx
    ON email_deliveries (subscriber_id, dynamic_id)
    WHERE dynamic_id IS NOT NULL;
CREATE INDEX email_deliveries_ready_idx
    ON email_deliveries (next_attempt_at, created_at)
    WHERE status IN ('pending', 'failed');

CREATE TRIGGER admin_accounts_set_updated_at
BEFORE UPDATE ON admin_accounts
FOR EACH ROW EXECUTE FUNCTION yukilog_set_updated_at();

CREATE TRIGGER categories_set_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION yukilog_set_updated_at();

CREATE TRIGGER articles_set_updated_at
BEFORE UPDATE ON articles
FOR EACH ROW EXECUTE FUNCTION yukilog_set_updated_at();

CREATE TRIGGER dynamics_set_updated_at
BEFORE UPDATE ON dynamics
FOR EACH ROW EXECUTE FUNCTION yukilog_set_updated_at();

CREATE TRIGGER friend_links_set_updated_at
BEFORE UPDATE ON friend_links
FOR EACH ROW EXECUTE FUNCTION yukilog_set_updated_at();

CREATE TRIGGER site_settings_set_updated_at
BEFORE UPDATE ON site_settings
FOR EACH ROW EXECUTE FUNCTION yukilog_set_updated_at();

CREATE TRIGGER page_layouts_set_updated_at
BEFORE UPDATE ON page_layouts
FOR EACH ROW EXECUTE FUNCTION yukilog_set_updated_at();

CREATE TRIGGER subscribers_set_updated_at
BEFORE UPDATE ON subscribers
FOR EACH ROW EXECUTE FUNCTION yukilog_set_updated_at();
"#;

const DOWN_SQL: &str = r#"
DROP TRIGGER IF EXISTS subscribers_set_updated_at ON subscribers;
DROP TRIGGER IF EXISTS page_layouts_set_updated_at ON page_layouts;
DROP TRIGGER IF EXISTS site_settings_set_updated_at ON site_settings;
DROP TRIGGER IF EXISTS friend_links_set_updated_at ON friend_links;
DROP TRIGGER IF EXISTS dynamics_set_updated_at ON dynamics;
DROP TRIGGER IF EXISTS articles_set_updated_at ON articles;
DROP TRIGGER IF EXISTS categories_set_updated_at ON categories;
DROP TRIGGER IF EXISTS admin_accounts_set_updated_at ON admin_accounts;

DROP TABLE IF EXISTS email_deliveries;
DROP TABLE IF EXISTS subscribers;
DROP TABLE IF EXISTS page_layouts;
DROP TABLE IF EXISTS site_settings;
DROP TABLE IF EXISTS friend_links;
DROP TRIGGER IF EXISTS article_likes_update_count ON article_likes;
DROP FUNCTION IF EXISTS yukilog_update_article_like_count();
DROP TABLE IF EXISTS article_likes;
DROP TRIGGER IF EXISTS articles_create_metrics ON articles;
DROP FUNCTION IF EXISTS yukilog_create_article_metrics();
DROP TABLE IF EXISTS article_metrics;
DROP TRIGGER IF EXISTS comments_validate_parent ON comments;
DROP FUNCTION IF EXISTS yukilog_validate_comment_parent();
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS dynamics;
DROP TABLE IF EXISTS article_tags;
DROP TABLE IF EXISTS articles;
DROP TABLE IF EXISTS media_assets;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS admin_sessions;
DROP TABLE IF EXISTS admin_accounts;
DROP FUNCTION IF EXISTS yukilog_set_updated_at();
"#;
