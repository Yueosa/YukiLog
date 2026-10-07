//! SeaORM models mirror the baseline schema. PostgreSQL constraints remain the
//! source of truth; these structs intentionally contain no duplicate validation.

pub mod admin_accounts {
    use sea_orm::entity::prelude::*;

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "admin_accounts")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub username: String,
        pub password_hash: String,
        pub display_name: String,
        pub notification_email: Option<String>,
        pub email_notifications_enabled: bool,
        pub notify_on_comments: bool,
        pub notify_on_friend_links: bool,
        pub notify_on_likes: bool,
        pub notification_frequency: String,
        pub is_active: bool,
        pub last_login_at: Option<DateTimeWithTimeZone>,
        pub created_at: DateTimeWithTimeZone,
        pub updated_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod admin_sessions {
    use sea_orm::entity::prelude::*;

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "admin_sessions")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub account_id: Uuid,
        pub token_hash: Vec<u8>,
        pub csrf_token_hash: Vec<u8>,
        pub expires_at: DateTimeWithTimeZone,
        pub last_seen_at: DateTimeWithTimeZone,
        pub created_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod categories {
    use sea_orm::entity::prelude::*;

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "categories")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub name: String,
        pub slug: String,
        pub description: Option<String>,
        pub sort_order: i32,
        pub created_at: DateTimeWithTimeZone,
        pub updated_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod tags {
    use sea_orm::entity::prelude::*;

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "tags")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub name: String,
        pub slug: String,
        pub created_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod media_assets {
    use sea_orm::entity::prelude::*;

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "media_assets")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub storage_key: String,
        pub original_name: String,
        pub media_type: String,
        pub byte_size: i64,
        pub sha256: Vec<u8>,
        pub width: Option<i32>,
        pub height: Option<i32>,
        pub origin: String,
        pub source_url: Option<String>,
        pub created_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod articles {
    use sea_orm::entity::prelude::*;

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "articles")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub category_id: Uuid,
        pub cover_media_id: Option<Uuid>,
        pub title: String,
        pub slug: String,
        pub summary: Option<String>,
        pub body_markdown: String,
        pub status: String,
        pub allow_comments: bool,
        pub published_at: Option<DateTimeWithTimeZone>,
        pub featured_at: Option<DateTimeWithTimeZone>,
        pub created_at: DateTimeWithTimeZone,
        pub updated_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {
        #[sea_orm(has_one = "super::article_metrics::Entity")]
        ArticleMetrics,
    }

    impl Related<super::article_metrics::Entity> for Entity {
        fn to() -> RelationDef {
            Relation::ArticleMetrics.def()
        }
    }

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod article_tags {
    use sea_orm::entity::prelude::*;

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "article_tags")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub article_id: Uuid,
        #[sea_orm(primary_key, auto_increment = false)]
        pub tag_id: Uuid,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod dynamics {
    use sea_orm::entity::prelude::*;

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "dynamics")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub content_markdown: String,
        pub mood: Option<String>,
        pub status: String,
        pub allow_comments: bool,
        pub published_at: Option<DateTimeWithTimeZone>,
        pub created_at: DateTimeWithTimeZone,
        pub updated_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod dynamic_media {
    use sea_orm::entity::prelude::*;

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "dynamic_media")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub dynamic_id: Uuid,
        #[sea_orm(primary_key, auto_increment = false)]
        pub media_id: Uuid,
        pub position: i16,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {
        #[sea_orm(
            belongs_to = "super::dynamics::Entity",
            from = "Column::DynamicId",
            to = "super::dynamics::Column::Id"
        )]
        Dynamics,
        #[sea_orm(
            belongs_to = "super::media_assets::Entity",
            from = "Column::MediaId",
            to = "super::media_assets::Column::Id"
        )]
        MediaAssets,
    }

    impl Related<super::dynamics::Entity> for Entity {
        fn to() -> RelationDef {
            Relation::Dynamics.def()
        }
    }

    impl Related<super::media_assets::Entity> for Entity {
        fn to() -> RelationDef {
            Relation::MediaAssets.def()
        }
    }

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod dynamic_metrics {
    use sea_orm::entity::prelude::*;

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "dynamic_metrics")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub dynamic_id: Uuid,
        pub like_count: i64,
        pub updated_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod dynamic_likes {
    use sea_orm::entity::prelude::*;

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "dynamic_likes")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub dynamic_id: Uuid,
        #[sea_orm(primary_key, auto_increment = false)]
        pub visitor_token_hash: Vec<u8>,
        pub created_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod comments {
    use sea_orm::entity::prelude::*;

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "comments")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub article_id: Option<Uuid>,
        pub dynamic_id: Option<Uuid>,
        pub parent_id: Option<Uuid>,
        pub display_name: String,
        pub email: Option<String>,
        pub website: Option<String>,
        pub content: String,
        pub user_agent: Option<String>,
        pub status: String,
        pub created_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod article_metrics {
    use sea_orm::entity::prelude::*;

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "article_metrics")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub article_id: Uuid,
        pub view_count: i64,
        pub like_count: i64,
        pub updated_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {
        #[sea_orm(
            belongs_to = "super::articles::Entity",
            from = "Column::ArticleId",
            to = "super::articles::Column::Id"
        )]
        Articles,
    }

    impl Related<super::articles::Entity> for Entity {
        fn to() -> RelationDef {
            Relation::Articles.def()
        }
    }

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod article_likes {
    use sea_orm::entity::prelude::*;

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "article_likes")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub article_id: Uuid,
        #[sea_orm(primary_key, auto_increment = false)]
        pub visitor_token_hash: Vec<u8>,
        pub created_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod friend_links {
    use sea_orm::entity::prelude::*;

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "friend_links")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub avatar_media_id: Option<Uuid>,
        pub avatar_url: Option<String>,
        pub name: String,
        pub url: String,
        pub description: Option<String>,
        pub application_email: Option<String>,
        pub is_visible: bool,
        pub sort_order: i32,
        pub created_at: DateTimeWithTimeZone,
        pub updated_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod admin_notifications {
    use sea_orm::entity::prelude::*;

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "admin_notifications")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub account_id: Uuid,
        pub kind: String,
        pub article_id: Option<Uuid>,
        pub comment_id: Option<Uuid>,
        pub friend_link_id: Option<Uuid>,
        pub title: String,
        pub message: String,
        pub target_url: String,
        pub aggregation_key: Option<String>,
        pub event_count: i32,
        pub read_at: Option<DateTimeWithTimeZone>,
        pub email_status: String,
        pub email_due_at: Option<DateTimeWithTimeZone>,
        pub email_attempt_count: i16,
        pub email_locked_at: Option<DateTimeWithTimeZone>,
        pub email_last_error: Option<String>,
        pub emailed_event_count: i32,
        pub email_sent_at: Option<DateTimeWithTimeZone>,
        pub created_at: DateTimeWithTimeZone,
        pub updated_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod site_settings {
    use sea_orm::entity::prelude::*;

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "site_settings")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub singleton: bool,
        pub site_title: String,
        pub site_description: Option<String>,
        pub owner_name: String,
        pub owner_bio: String,
        pub avatar_media_id: Option<Uuid>,
        pub avatar_external_url: Option<String>,
        pub masthead_media_id: Option<Uuid>,
        pub hero_background_media_ids: Json,
        pub hero_quote: Option<String>,
        pub social_links: Json,
        pub theme: Json,
        pub shell_layout: Json,
        pub updated_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}



pub mod subscribers {
    use sea_orm::entity::prelude::*;

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "subscribers")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub email: String,
        pub subscribe_articles: bool,
        pub subscribe_dynamics: bool,
        pub status: String,
        pub token_nonce: Vec<u8>,
        pub confirmation_sent_at: Option<DateTimeWithTimeZone>,
        pub confirmed_at: Option<DateTimeWithTimeZone>,
        pub unsubscribed_at: Option<DateTimeWithTimeZone>,
        pub created_at: DateTimeWithTimeZone,
        pub updated_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod email_deliveries {
    use sea_orm::entity::prelude::*;

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "email_deliveries")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        /// 订阅者收件人（comment_reply 类型为 NULL，走 recipient_email）
        pub subscriber_id: Option<Uuid>,
        pub kind: String,
        pub article_id: Option<Uuid>,
        pub dynamic_id: Option<Uuid>,
        /// comment_reply：被回复的评论（内容在投递时加载）
        pub comment_id: Option<Uuid>,
        /// comment_reply：非订阅者收件人邮箱
        pub recipient_email: Option<String>,
        pub status: String,
        pub attempt_count: i16,
        pub next_attempt_at: DateTimeWithTimeZone,
        pub locked_at: Option<DateTimeWithTimeZone>,
        pub last_error: Option<String>,
        pub created_at: DateTimeWithTimeZone,
        pub sent_at: Option<DateTimeWithTimeZone>,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}
