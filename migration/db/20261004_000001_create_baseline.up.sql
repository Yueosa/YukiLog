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
    'YukiLog 渲染测试',
    'yukilog-markdown',
    '这一篇用于预览 YukiLog 的文章样式。',
    $yukilog_seed$
## 1️⃣ 标题测试

```md
# 一级标题

## 二级标题

### 三级标题

#### 四级标题

##### 五级标题

###### 六级标题
```

# 一级标题

## 二级标题

### 三级标题

#### 四级标题

##### 五级标题

###### 六级标题

---

## 2️⃣ 文本效果测试

```md
**文本加粗**

*文本斜体*

***加粗斜体***

~~删除线~~

`行内代码`

HTML 下划线
```

**文本加粗**

*文本斜体*

***加粗斜体***

~~删除线~~

`行内代码`

HTML 下划线

---

## 3️⃣ 列表测试

```md
* 无序列表一
* 无序列表二
  * 子列表一
  * 子列表二
* 无序列表三

1. 有序列表1
2. 有序列表2
3. 有序列表3
```

* 无序列表一
* 无序列表二
  * 子列表一
  * 子列表二
* 无序列表三

1. 有序列表1
2. 有序列表2
3. 有序列表3

---

## 4️⃣ 引用测试

```md
> 连续引用第一行
> 连续引用第二行

> 引用块
>
> 这是第二行引用

> 嵌套引用第一层
>> 嵌套引用第二层
>>> 嵌套引用第三层

```

> 连续引用第一行
> 连续引用第二行

> 引用块
>
> 这是第二行引用

> 嵌套引用第一层
>
>> 嵌套引用第二层
>>
>>> 嵌套引用第三层
>>>
>>

---

## 5️⃣ 代码块测试

````md
```md
这是一个 `console.log("lian love")` 示例
```
````

```md
这是一个 `console.log("lian love")` 示例
```

````md
```
function lian() {
    return "lian love";
}
```
````

```
function lian() {
    return "lian love";
}
```

````md
```rust
fn main() {
    println!("lian love");
}
```
````

```rust
fn main() {
    println!("lian love");
}
```

````md
```yaml
boolean: 
    - TRUE
    - FALSE
float:
    - 3.14
    - 6.8523015e+5
int:
    - 123
    - 0b1010_0111_0100_1010_1110
null:
    nodeName: 'node'
    parent: ~
string:
    - 哈哈
    - 'Lian Love'
    - newline
      newline2
date:
    - 2018-02-17
datetime: 
    -  2018-02-17T15:02:31+08:00
```
````

```yaml
boolean: 
    - TRUE
    - FALSE
float:
    - 3.14
    - 6.8523015e+5
int:
    - 123
    - 0b1010_0111_0100_1010_1110
null:
    nodeName: 'node'
    parent: ~
string:
    - 哈哈
    - 'Lian Love'
    - newline
      newline2
date:
    - 2018-02-17
datetime: 
    -  2018-02-17T15:02:31+08:00
```

````md
```mermaid
graph LR
    subgraph 本地["本地计算机"]
        A[MySQL 客户端] --> B[localhost:3307]
        B --> C[SSH 客户端]
    end
  
    C -- "SSH 隧道 (加密)" --> D[远程服务器公网IP:22]
  
    subgraph 远程["远程服务器 (内网)"]
        D --> E[MySQL127.0.0.1:3306]
    end

    style B fill:#c8e6c9
    style E fill:#ffcdd2
```
````

```mermaid
graph LR
    subgraph 本地["本地计算机"]
        A[MySQL 客户端] --> B[localhost:3307]
        B --> C[SSH 客户端]
    end
  
    C -- "SSH 隧道 (加密)" --> D[远程服务器公网IP:22]
  
    subgraph 远程["远程服务器 (内网)"]
        D --> E[MySQL127.0.0.1:3306]
    end

    style B fill:#c8e6c9
    style E fill:#ffcdd2
```

---

## 6️⃣ 链接/图片测试

```md
[链接 YukiKoi](https://yeastar.xin)
```

[链接 YukiKoi](https://yeastar.xin)



---

## 7️⃣ 表格测试

```md
| 表格 | 类型 | 说明 |
|-|-|-|
| `恋` | **人类** | 博主 |
| `Arch` | **系统** | 折腾 |
```


| 表格   | 类型     | 说明 |
| ------ | -------- | ---- |
| `恋`   | **人类** | 博主 |
| `Arch` | **系统** | 折腾 |

---

## 8️⃣ 任务清单测试

```md
- [x] 任务列表
- [ ] 未完成

```

- [X]  任务列表
- [ ]  未完成

---

## 9️⃣ 脚注测试

```md
这是一个脚注[^1]

[^1]: 这是脚注内容
```

这是一个脚注[^1]

---

## 1️⃣0️⃣ 数学公式测试

```md
行内公式: $E = mc^2$

块级公式:

$$
\int_0^1 x^2 dx
$$
```

行内公式: $E = mc^2$

块级公式:

$$
\int_0^1 x^2 dx
$$

---

## 1️⃣1️⃣ HTML 测试

```md

    这是一个HTML容器

```


    这是一个HTML容器


```md


这是元素 **居中测试**, 标签为 ``


```



这是元素 **居中测试**, 标签为 ``



---

## 1️⃣2️⃣ 正文测试

## ✨ 设计理念

这个博客不是企业官网，也不是炫技舞台。

它更像一本安静的笔记本。

我在这里记录：

- 技术
- 思考
- 情绪
- 抱怨
- 生活碎片
- 以及那些突然想明白的瞬间

它不追求锋利，不制造压迫感。
它希望给人一种：

**舒缓、柔软、真实的存在感。**

---

## 🎨 视觉语言

### 核心色调

```css
--lian-blue:  #7EB6D9;
--lian-pink:  #E8A4B4;
--lian-white: #FAFAFA;
--lian-bg:    #F6F7F9;
```

* 蓝色代表逻辑与秩序
* 粉色代表感受与表达
* 白色代表留白与呼吸

整体配色偏低饱和，像彩铅画在纸上。

[^1]: 这是脚注内容
$yukilog_seed$,
    'published',
    true,
    now(),
    now()
FROM categories
WHERE slug = 'nightflight-notes';
