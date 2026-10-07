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
    notification_email citext,
    email_notifications_enabled boolean NOT NULL DEFAULT false,
    notify_on_comments boolean NOT NULL DEFAULT true,
    notify_on_friend_links boolean NOT NULL DEFAULT true,
    notify_on_likes boolean NOT NULL DEFAULT false,
    notification_frequency text NOT NULL DEFAULT 'hourly',
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
    CONSTRAINT admin_accounts_notification_email_shape
        CHECK (
            notification_email IS NULL
            OR (
                char_length(notification_email::text) BETWEEN 3 AND 254
                AND position('@' IN notification_email::text) > 1
            )
        ),
    CONSTRAINT admin_accounts_notification_frequency_valid
        CHECK (notification_frequency IN ('immediate', 'hourly', 'daily')),
    CONSTRAINT admin_accounts_notification_email_required
        CHECK (NOT email_notifications_enabled OR notification_email IS NOT NULL),
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
    origin text NOT NULL DEFAULT 'upload',
    source_url text,
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
    CONSTRAINT media_assets_origin_allowed
        CHECK (origin IN ('upload', 'fetched')),
    CONSTRAINT media_assets_source_url_length
        CHECK (source_url IS NULL OR char_length(source_url) <= 2048),
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
    featured_at timestamptz,
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
CREATE INDEX articles_featured_idx
    ON articles (featured_at DESC)
    WHERE status = 'published' AND featured_at IS NOT NULL;

CREATE TABLE article_tags (
    article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE RESTRICT,
    PRIMARY KEY (article_id, tag_id)
);
CREATE INDEX article_tags_tag_id_idx ON article_tags (tag_id, article_id);

CREATE TABLE dynamics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content_markdown text NOT NULL,
    mood varchar(40),
    status text NOT NULL DEFAULT 'draft',
    allow_comments boolean NOT NULL DEFAULT true,
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT dynamics_content_not_blank
        CHECK (char_length(btrim(content_markdown)) > 0),
    CONSTRAINT dynamics_mood_length
        CHECK (mood IS NULL OR char_length(btrim(mood)) BETWEEN 1 AND 40),
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

CREATE TABLE dynamic_media (
    dynamic_id uuid NOT NULL REFERENCES dynamics(id) ON DELETE CASCADE,
    media_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    position smallint NOT NULL,
    PRIMARY KEY (dynamic_id, media_id),
    CONSTRAINT dynamic_media_position_range
        CHECK (position BETWEEN 0 AND 8)
);
CREATE INDEX dynamic_media_dynamic_idx ON dynamic_media (dynamic_id, position);

CREATE TABLE comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id uuid REFERENCES articles(id) ON DELETE CASCADE,
    dynamic_id uuid REFERENCES dynamics(id) ON DELETE CASCADE,
    parent_id uuid REFERENCES comments(id) ON DELETE CASCADE,
    display_name varchar(80) NOT NULL,
    email citext,
    website text,
    content text NOT NULL,
    user_agent text,
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
            email IS NULL
            OR (
                char_length(email::text) BETWEEN 3 AND 254
                AND position('@' IN email::text) > 1
            )
        ),
    CONSTRAINT comments_website_length
        CHECK (website IS NULL OR char_length(website) <= 2048),
    CONSTRAINT comments_content_length
        CHECK (char_length(btrim(content)) BETWEEN 1 AND 5000),
    CONSTRAINT comments_user_agent_length
        CHECK (user_agent IS NULL OR char_length(user_agent) <= 512),
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

CREATE TABLE dynamic_metrics (
    dynamic_id uuid PRIMARY KEY REFERENCES dynamics(id) ON DELETE CASCADE,
    like_count bigint NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT dynamic_metrics_like_count_nonnegative
        CHECK (like_count >= 0)
);

CREATE TABLE dynamic_likes (
    dynamic_id uuid NOT NULL REFERENCES dynamics(id) ON DELETE CASCADE,
    visitor_token_hash bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (dynamic_id, visitor_token_hash),
    CONSTRAINT dynamic_likes_visitor_hash_length
        CHECK (octet_length(visitor_token_hash) = 32)
);

CREATE FUNCTION yukilog_create_dynamic_metrics()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO dynamic_metrics (dynamic_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER dynamics_create_metrics
AFTER INSERT ON dynamics
FOR EACH ROW EXECUTE FUNCTION yukilog_create_dynamic_metrics();

CREATE FUNCTION yukilog_update_dynamic_like_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE dynamic_metrics
           SET like_count = like_count + 1,
               updated_at = now()
         WHERE dynamic_id = NEW.dynamic_id;
        RETURN NEW;
    END IF;

    UPDATE dynamic_metrics
       SET like_count = GREATEST(like_count - 1, 0),
           updated_at = now()
     WHERE dynamic_id = OLD.dynamic_id;
    RETURN OLD;
END;
$$;

CREATE TRIGGER dynamic_likes_update_count
AFTER INSERT OR DELETE ON dynamic_likes
FOR EACH ROW EXECUTE FUNCTION yukilog_update_dynamic_like_count();

CREATE TABLE friend_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    avatar_media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
    avatar_url text,
    name varchar(100) NOT NULL,
    url text NOT NULL UNIQUE,
    description varchar(300),
    application_email citext,
    is_visible boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT friend_links_name_length
        CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
    CONSTRAINT friend_links_url_length
        CHECK (char_length(url) BETWEEN 8 AND 2048),
    CONSTRAINT friend_links_avatar_url_shape
        CHECK (
            avatar_url IS NULL
            OR (
                char_length(avatar_url) BETWEEN 8 AND 2048
                AND (avatar_url LIKE 'http://%' OR avatar_url LIKE 'https://%')
            )
        ),
    CONSTRAINT friend_links_description_length
        CHECK (description IS NULL OR char_length(description) <= 300),
    CONSTRAINT friend_links_application_email_shape
        CHECK (
            application_email IS NULL
            OR (
                char_length(application_email::text) BETWEEN 3 AND 254
                AND position('@' IN application_email::text) > 1
            )
        )
);
CREATE INDEX friend_links_visible_order_idx
    ON friend_links (sort_order, name)
    WHERE is_visible;

CREATE TABLE admin_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
    kind text NOT NULL,
    article_id uuid REFERENCES articles(id) ON DELETE CASCADE,
    comment_id uuid REFERENCES comments(id) ON DELETE CASCADE,
    friend_link_id uuid REFERENCES friend_links(id) ON DELETE CASCADE,
    title varchar(200) NOT NULL,
    message varchar(500) NOT NULL,
    target_url varchar(500) NOT NULL,
    aggregation_key varchar(200),
    event_count integer NOT NULL DEFAULT 1,
    read_at timestamptz,
    email_status text NOT NULL DEFAULT 'suppressed',
    email_due_at timestamptz,
    email_attempt_count smallint NOT NULL DEFAULT 0,
    email_locked_at timestamptz,
    email_last_error varchar(2000),
    emailed_event_count integer NOT NULL DEFAULT 0,
    email_sent_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT admin_notifications_kind_valid
        CHECK (kind IN ('comment', 'friend_link_application', 'article_like')),
    CONSTRAINT admin_notifications_target_valid
        CHECK (
            (kind = 'comment' AND comment_id IS NOT NULL
                AND friend_link_id IS NULL)
            OR (kind = 'friend_link_application' AND friend_link_id IS NOT NULL
                AND article_id IS NULL AND comment_id IS NULL)
            OR (kind = 'article_like' AND article_id IS NOT NULL
                AND comment_id IS NULL AND friend_link_id IS NULL)
        ),
    CONSTRAINT admin_notifications_title_length
        CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
    CONSTRAINT admin_notifications_message_length
        CHECK (char_length(btrim(message)) BETWEEN 1 AND 500),
    CONSTRAINT admin_notifications_target_url_length
        CHECK (char_length(target_url) BETWEEN 1 AND 500),
    CONSTRAINT admin_notifications_aggregation_key_length
        CHECK (aggregation_key IS NULL OR char_length(aggregation_key) BETWEEN 1 AND 200),
    CONSTRAINT admin_notifications_event_count_positive
        CHECK (event_count > 0 AND emailed_event_count BETWEEN 0 AND event_count),
    CONSTRAINT admin_notifications_email_status_valid
        CHECK (
            email_status IN (
                'suppressed', 'pending', 'sending', 'sent',
                'failed', 'cancelled', 'uncertain'
            )
        ),
    CONSTRAINT admin_notifications_email_attempt_count_valid
        CHECK (email_attempt_count BETWEEN 0 AND 20),
    CONSTRAINT admin_notifications_email_state_valid
        CHECK (
            (email_status = 'sending' AND email_locked_at IS NOT NULL)
            OR (email_status <> 'sending' AND email_locked_at IS NULL)
        )
);
CREATE UNIQUE INDEX admin_notifications_unread_aggregation_uidx
    ON admin_notifications (account_id, aggregation_key)
    WHERE read_at IS NULL AND aggregation_key IS NOT NULL;
CREATE INDEX admin_notifications_inbox_idx
    ON admin_notifications (account_id, read_at, updated_at DESC);
CREATE INDEX admin_notifications_email_ready_idx
    ON admin_notifications (email_due_at, created_at)
    WHERE email_status IN ('pending', 'failed');

CREATE TABLE site_settings (
    singleton boolean PRIMARY KEY DEFAULT true,
    site_title varchar(120) NOT NULL,
    site_description varchar(300),
    owner_name varchar(80) NOT NULL,
    owner_bio text NOT NULL DEFAULT '',
    avatar_media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
    avatar_external_url text,
    masthead_media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
    hero_background_media_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
    hero_quote text,
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
        CHECK (jsonb_typeof(shell_layout) = 'object'),
    CONSTRAINT site_settings_avatar_external_url_format
        CHECK (
            avatar_external_url IS NULL
            OR (
                char_length(avatar_external_url) <= 512
                AND avatar_external_url ~ '^https?://'
            )
        ),
    CONSTRAINT site_settings_hero_background_media_ids_shape
        CHECK (
            jsonb_typeof(hero_background_media_ids) = 'array'
            AND jsonb_array_length(hero_background_media_ids) <= 12
        ),
    CONSTRAINT site_settings_hero_quote_length
        CHECK (hero_quote IS NULL OR char_length(hero_quote) <= 120)
);

CREATE TABLE subscribers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email citext NOT NULL UNIQUE,
    subscribe_articles boolean NOT NULL DEFAULT true,
    subscribe_dynamics boolean NOT NULL DEFAULT false,
    status text NOT NULL DEFAULT 'pending',
    token_nonce bytea NOT NULL,
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
    CONSTRAINT subscribers_token_nonce_length
        CHECK (octet_length(token_nonce) = 16),
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
    subscriber_id uuid REFERENCES subscribers(id) ON DELETE CASCADE,
    kind text NOT NULL,
    article_id uuid REFERENCES articles(id) ON DELETE CASCADE,
    dynamic_id uuid REFERENCES dynamics(id) ON DELETE CASCADE,
    recipient_email citext,
    comment_id uuid REFERENCES comments(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending',
    attempt_count smallint NOT NULL DEFAULT 0,
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    locked_at timestamptz,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,
    CONSTRAINT email_deliveries_kind_valid
        CHECK (
            kind IN (
                'confirm_subscription',
                'article_published',
                'dynamic_published',
                'comment_reply'
            )
        ),
    CONSTRAINT email_deliveries_target_valid
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
    CONSTRAINT email_deliveries_recipient_valid
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
        ),
    CONSTRAINT email_deliveries_status_valid
        CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled', 'uncertain')),
    CONSTRAINT email_deliveries_attempt_count_valid
        CHECK (attempt_count BETWEEN 0 AND 20),
    CONSTRAINT email_deliveries_last_error_length
        CHECK (last_error IS NULL OR char_length(last_error) <= 2000),
    CONSTRAINT email_deliveries_state_times_valid
        CHECK (
            (status = 'sending' AND locked_at IS NOT NULL AND sent_at IS NULL)
            OR (status = 'sent' AND sent_at IS NOT NULL)
            OR (status IN ('pending', 'failed', 'cancelled', 'uncertain') AND sent_at IS NULL)
        )
);
CREATE UNIQUE INDEX email_deliveries_subscriber_article_uidx
    ON email_deliveries (subscriber_id, article_id)
    WHERE article_id IS NOT NULL;
CREATE UNIQUE INDEX email_deliveries_subscriber_dynamic_uidx
    ON email_deliveries (subscriber_id, dynamic_id)
    WHERE dynamic_id IS NOT NULL;
CREATE UNIQUE INDEX email_deliveries_subscriber_confirmation_uidx
    ON email_deliveries (subscriber_id)
    WHERE kind = 'confirm_subscription';
CREATE UNIQUE INDEX email_deliveries_comment_reply_uidx
    ON email_deliveries (comment_id)
    WHERE kind = 'comment_reply';
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

CREATE TRIGGER admin_notifications_set_updated_at
BEFORE UPDATE ON admin_notifications
FOR EACH ROW EXECUTE FUNCTION yukilog_set_updated_at();

CREATE TRIGGER site_settings_set_updated_at
BEFORE UPDATE ON site_settings
FOR EACH ROW EXECUTE FUNCTION yukilog_set_updated_at();

CREATE TRIGGER subscribers_set_updated_at
BEFORE UPDATE ON subscribers
FOR EACH ROW EXECUTE FUNCTION yukilog_set_updated_at();

INSERT INTO site_settings (
    singleton, site_title, site_description, owner_name, owner_bio,
    social_links, theme, shell_layout
)
VALUES (
    true,
    'YukiLog',
    '这里分享她所热爱的技术、思考，以及情绪、挣扎',
    '恋',
    '我能走到这里，是因为你没有放弃',
    '[]'::jsonb,
    '{"schemaVersion":1,"colors":{"background":"#f7f8f7","surface":"#ffffff","surfaceMuted":"#eef2f5","text":"#1c2733","textMuted":"#6d7f90","primary":"#7eb6d9","secondary":"#e8a4b4","border":"#dde5ec"},"typography":{"body":"system","display":"serif","scale":1.0},"shape":{"radius":14,"borderedCards":true},"motion":"subtle"}'::jsonb,
    '{"schemaVersion":1,"navigation":"topbar","brandPosition":"start","showSearch":true,"translucent":true,"maxWidth":"wide"}'::jsonb
);


INSERT INTO categories (name, slug, description, sort_order)
VALUES ('夜航手记', 'nightflight-notes', '长文、随笔与手记。', 0);

INSERT INTO articles (
    category_id, title, slug, summary, body_markdown,
    status, allow_comments, published_at, featured_at
)
SELECT
    id,
    'LianMarkup 语法漫游',
    'hello-lianmarkup',
    '博客的母语 LianMarkup：一篇用 .ly 写成的语法漫游。',
    $yukilog_seed$

# LianMarkup 语法漫游

@toc depth=3

欢迎来到 YukiLog! 这是博客的第一篇文章, 用来介绍这个博客的"母语" —— **LianMarkup**, 一门我为写博客设计的标记语言[^文件后缀是 .ly 或 .lian, 受 Markdown 启发, 但砍掉了冗余, 加了些博客真正需要的东西]。

这篇文章本身就是用 LianMarkup 写的, 你看到的每一个效果, 我都会附上对应的写法。

>i 小提示
>文中所有 "写法" 示例都包在原样块里, 原样块内的内容不会被解析, 所以你看到的是语法本身。

## 基础排版

先来点熟悉的。LianMarkup 保留了 Markdown 里好用的部分:

~~~
**加粗**、*斜体*、~~删除线~~、==高亮==、`行内代码`
~~~

实际效果: **加粗**、*斜体*、~~删除线~~、==高亮==、`行内代码`

标题用 `#` 开头, 一共六级, 注意 `#` 后面**必须有空格**, 否则就是普通文本:

~~~
## 这是二级标题
#这只是一行普通的话
~~~

>x 反例
>`#没有空格` 不会被解析成标题, 这是故意的 —— 排版规则越严格, 意外越少。

引用块也很简单:

~~~
> 凡是不能杀死我的符号, 都会变成正文。
~~~

> 凡是不能杀死我的符号, 都会变成正文。

大多数时候你连转义符都不需要: 不配对的符号会自动回退为文本。真要写语法符号本身时, 用 `\`:

~~~
2*3=6 不需要转义, 但 \*\*这才是加粗符号本身\*\*
~~~

2*3=6 不需要转义, 但 \*\*这才是加粗符号本身\*\*

## 链接和图片

~~~
[访问 YukiLog 的仓库](https://github.com/Yueosa/YukiLog)
![一张竖图](cover.jpg){width=60% group=示例}
~~~

图片后面的 `{}` 是可选属性: `width` 控制显示宽度(对竖屏图很友好), `group` 相同的图片可以在灯箱里左右切换。

## 列表

~~~
- 无序列表项
	- TAB 缩进一级就是嵌套
- 第二项

1. 有序列表项
2. 会自动编号

- [ ] 待办事项
- [x] 已完成
~~~

实际效果:

- 无序列表项
	- TAB 缩进一级就是嵌套
- 第二项

1. 有序列表项
2. 会自动编号

- [ ] 待办事项
- [x] 已完成

## Callout 高级块

这是我最喜欢的家族语法, 首行是标题, 空行结束:

~~~
>? 什么是疑问块?
>就是你正在看的这个蓝框。

>! 重要警告
>生产环境不要开 debug。

>+ 小技巧
>callout 里还能嵌套 **行内语法**。
~~~

>? 什么是疑问块?
>就是你正在看的这个框。

>! 重要警告
>生产环境不要开 debug。

>+ 小技巧
>callout 里还能嵌套 **行内语法**。

## 折叠块

长篇推导、剧透、补充材料, 都可以收进折叠块。它有两种写法: TAB 缩进表示归属, 或者用 `<<<` 显式配对结束:

~~~
>>> 点我展开: 为什么要自研标记语言?
	因为 Markdown 的方言太多了。
	因为我想让目录和旁注成为一等公民。
	因为造轮子很快乐。
<<< 这行只是文本: 缩进模式下 <<< 不是结束符
~~~

>>> 点我展开: 为什么要自研标记语言?
	因为 Markdown 的方言太多了。
	因为我想让目录和旁注成为一等公民。
	因为造轮子很快乐。

显式配对模式里, 内容不用缩进, 行首的 `<<<` 才是结束符。把 `>>>` 换成 `>>>+`, 折叠块默认就是展开的:

>>>+ 我默认就是展开的
	两种模式可以随意搭配。

## 旁注

看到正文里偶尔出现的上标编号了吗[^就像这个], 那是**旁注**。备注内容就地书写, 不用像 Markdown 脚注那样跑到文末维护定义:

~~~
看到正文里的上标编号了吗[^就像这个], 那是旁注。
~~~

桌面端它会显示在正文右侧, 移动端点上标展开。

## 代码与原样块

围栏代码块支持语言标记:

~~~
```rust
fn main() {
    println!("你好, LianMarkup!");
}
```
~~~

实际效果(高亮由服务端 syntect 完成, RSS 里也能看):

```rust
fn main() {
    println!("你好, LianMarkup!");
}
```

而三个波浪号 `~~~` 是**原样块**, 里面的一切都不会被解析 —— 这篇文章里所有的语法示例都是靠它显示的。

## 图表

围栏块的语言标记填 `mermaid`, 就能直接画图 —— 流程图、时序图、甘特图都支持, 在浏览器端渲染成 SVG, 点击可以放大查看:

~~~
```mermaid
graph LR
    A[写下 .ly] --> B{服务端解析}
    B --> C[结构化 HTML]
    C --> D[浏览器渲染]
    D --> E{好看吗?}
    E -->|好看| F[发布]
    E -->|不好看| A
```
~~~

```mermaid
graph LR
    A[写下 .ly] --> B{服务端解析}
    B --> C[结构化 HTML]
    C --> D[浏览器渲染]
    D --> E{好看吗?}
    E -->|好看| F[发布]
    E -->|不好看| A
```

## 小玩具们

剧透: 凶手其实是||管家||, 点击就能看到。

公式: 质能方程 $E=mc^2$, 块级的长这样:

$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

注音: {漢字|かんじ} 和 {汉字|hàn zì}, 多语言写作的时候很好用。

## 表格

| 语法 | 用途 |
|-|-|
| `@toc` | 声明目录 |
| `[^...]` | 旁注 |
| `>>>` | 折叠块 |

## 目录 {#toc}

你可能已经注意到左边(或移动端顶部)的目录了 —— 它来自文章开头的 `@toc depth=3` 这一行, 编译期自动收集所有标题生成, 不用手写。

顺便, 这个标题后面跟着 `{#toc}`, 它把自动分配的锚点覆盖成了固定值, 从站外链接指到这个小节时不怕标题顺序变动。

---

上面那条横线是分割线, 写法就是三个减号 `---`。

这就是 LianMarkup 的全貌了。语法规范的完整版在 [仓库](https://github.com/Yueosa/LianMarkup) 的 `docs/语法规范.md`, 欢迎围观。
$yukilog_seed$,
    'published',
    true,
    now(),
    now()
FROM categories
WHERE slug = 'nightflight-notes';
