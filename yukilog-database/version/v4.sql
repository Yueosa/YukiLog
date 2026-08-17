-- v4: 浏览量更新不再刷新 posts.updated_at
-- 原先任意 UPDATE（包括 view_count + 1）都会触发 update_modified_column，
-- 导致「最近更新」实际变成「最近被看过」，新文章很难排到前面。

CREATE OR REPLACE FUNCTION update_posts_modified_column()
RETURNS TRIGGER AS $$
BEGIN
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

DROP TRIGGER IF EXISTS update_posts_updated_at ON posts;
CREATE TRIGGER update_posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION update_posts_modified_column();
