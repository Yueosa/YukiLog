-- 覆盖更新
DROP TABLE IF EXISTS
    post_tags,
    comments,
    posts,
    tags,
    themes,
    links,
    notes
CASCADE;

-- ============================== 
-- YukiLog 数据库核心表设计
-- ==============================

-- 1. 主题表 themes
CREATE TABLE IF NOT EXISTS themes (
    id BIGSERIAL PRIMARY KEY,               -- ID 号
    name VARCHAR(50) NOT NULL UNIQUE,       -- 名称
    slug VARCHAR(50) NOT NULL UNIQUE,       -- slug
    description TEXT,                       -- 描述
    post_count INT DEFAULT 0,               -- 文章数
    view_count BIGINT DEFAULT 0,            -- 浏览量
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. 标签表 tags
CREATE TABLE IF NOT EXISTS tags (
    id BIGSERIAL PRIMARY KEY,               -- ID 号
    name VARCHAR(50) NOT NULL UNIQUE,       -- 名称
    slug VARCHAR(50) NOT NULL UNIQUE,       -- slug
    post_count INT DEFAULT 0,               -- 文章数
    view_count BIGINT DEFAULT 0,            -- 浏览量
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. 文章表 posts
CREATE TABLE IF NOT EXISTS posts (
    id BIGSERIAL PRIMARY KEY,               -- ID 号
    title VARCHAR(255) NOT NULL,            -- 标题
    slug VARCHAR(255) NOT NULL UNIQUE,      -- slug
    summary TEXT,                           -- 摘要
    content TEXT NOT NULL,                  -- 内容
    cover_image VARCHAR(255),               -- 封面 (file:// 或 https://)
    status VARCHAR(20) DEFAULT 'draft',     -- 状态 (draft 或 published)
    is_featured BOOLEAN NOT NULL DEFAULT FALSE, -- 是否精选（在首页展示）

    theme_id BIGINT REFERENCES themes(id) ON DELETE SET NULL,

    view_count BIGINT DEFAULT 0,            -- 浏览量
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. 文章-标签关联表 post_tags
CREATE TABLE IF NOT EXISTS post_tags (
    post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
    tag_id BIGINT REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

-- 5. 评论表 comments
CREATE TABLE IF NOT EXISTS comments (
    id BIGSERIAL PRIMARY KEY,               -- ID 号
    post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
    
    content TEXT NOT NULL,                  -- 内容
    
    guest_nick VARCHAR(50) NOT NULL,        -- 昵称
    guest_email VARCHAR(100),               -- 邮箱
    guest_website VARCHAR(200),             -- 个人网站
    
    parent_id BIGINT REFERENCES comments(id) ON DELETE CASCADE,
    root_id BIGINT REFERENCES comments(id) ON DELETE CASCADE,
    
    status VARCHAR(20) DEFAULT 'pending',   -- approved, pending, spam
    
    ip VARCHAR(45),                         -- IPv4/IPv6
    ua VARCHAR(255),                        -- User-Agent
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. 友链表 links
CREATE TABLE IF NOT EXISTS links (
    id BIGSERIAL PRIMARY KEY,               -- ID 号
    title VARCHAR(100) NOT NULL,            -- 站点标题
    url VARCHAR(255) NOT NULL UNIQUE,       -- 站点 URL
    avatar VARCHAR(255),                    -- 站点头像
    description TEXT,                       -- 站点描述
    
    status VARCHAR(20) DEFAULT 'pending',   -- active, pending, broken
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. 随记表 notes
CREATE TABLE IF NOT EXISTS notes (
    id          BIGSERIAL PRIMARY KEY,               -- ID 号
    content     TEXT NOT NULL,                        -- Markdown 内容
    mood        VARCHAR(20),                          -- 心情标记（可选）
    status      VARCHAR(20) DEFAULT 'published',      -- published / draft / private
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===============================
-- YukiLog 数据库索引
-- ===============================
-- themes
CREATE INDEX IF NOT EXISTS idx_themes_cteated_at ON themes (created_at DESC);
-- tags
CREATE INDEX IF NOT EXISTS idx_tags_created_at ON tags (created_at DESC);
-- posts
CREATE INDEX IF NOT EXISTS idx_posts_status_created_at ON posts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_theme_id ON posts (theme_id);
CREATE INDEX IF NOT EXISTS idx_posts_updated_at ON posts (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_view_count ON posts (view_count DESC);
CREATE INDEX IF NOT EXISTS idx_posts_is_featured ON posts (is_featured);
-- post_tags
CREATE INDEX IF NOT EXISTS idx_post_tags_tag_id ON post_tags (tag_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_post_id ON post_tags (post_id);
-- comments
CREATE INDEX IF NOT EXISTS idx_comments_post_id_created_at ON comments (post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments (status);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments (parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_root_id ON comments (root_id);
CREATE INDEX IF NOT EXISTS idx_comments_ip ON comments (ip);
-- links
CREATE INDEX IF NOT EXISTS idx_links_status ON links (status);
CREATE INDEX IF NOT EXISTS idx_links_created_at ON links (created_at DESC);

-- notes
CREATE INDEX IF NOT EXISTS idx_notes_status_created_at ON notes (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes (created_at DESC);

-- ===============================
-- YukiLog 数据库触发器
-- ===============================
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_posts_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    -- 仅浏览量变化时保持 updated_at，避免「最近更新」被阅读刷新带偏
    IF (NEW.view_count IS DISTINCT FROM OLD.view_count)
       AND (NEW.title, NEW.slug, NEW.summary, NEW.content, NEW.cover_image,
            NEW.status, NEW.is_featured, NEW.theme_id)
           IS NOT DISTINCT FROM
           (OLD.title, OLD.slug, OLD.summary, OLD.content, OLD.cover_image,
            OLD.status, OLD.is_featured, OLD.theme_id)
    THEN
        NEW.updated_at = OLD.updated_at;
    ELSE
        NEW.updated_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION update_posts_modified_column();

CREATE TRIGGER update_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

