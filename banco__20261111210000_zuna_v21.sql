-- ZUNA V21: banco nativo da Netlify. Banco novo, não migra automaticamente dados da V20.
CREATE TABLE IF NOT EXISTS z_users (
 id uuid PRIMARY KEY, username varchar(24) NOT NULL UNIQUE, display_name varchar(60) NOT NULL,
 password_hash text NOT NULL, recovery_hash char(64) NOT NULL,
 bio varchar(300) NOT NULL DEFAULT '', username_changed_at timestamptz, avatar_media_id uuid, private boolean NOT NULL DEFAULT true,
 verified boolean NOT NULL DEFAULT false, role varchar(10) NOT NULL DEFAULT 'user',
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT z_role_check CHECK(role IN ('user','admin'))
);
CREATE TABLE IF NOT EXISTS z_sessions (
 token_hash char(64) PRIMARY KEY, user_id uuid NOT NULL REFERENCES z_users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS z_session_user ON z_sessions(user_id);
CREATE TABLE IF NOT EXISTS z_login_attempts (
 key_hash char(64) PRIMARY KEY, count int NOT NULL DEFAULT 0, window_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS z_media (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES z_users(id) ON DELETE CASCADE,
 kind varchar(10) NOT NULL CHECK(kind IN ('video','image')),
 mime varchar(40) NOT NULL, filename varchar(120) NOT NULL,
 size_bytes bigint NOT NULL CHECK(size_bytes > 0 AND size_bytes <= 3221225472),
 chunk_bytes int NOT NULL DEFAULT 2097152, total_chunks int NOT NULL,
 status varchar(12) NOT NULL DEFAULT 'uploading' CHECK(status IN ('uploading','ready','deleted')),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE z_users ADD CONSTRAINT z_avatar_fk FOREIGN KEY (avatar_media_id) REFERENCES z_media(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS z_media_chunks (
 media_id uuid NOT NULL REFERENCES z_media(id) ON DELETE CASCADE, chunk_index int NOT NULL,
 byte_size int NOT NULL, PRIMARY KEY(media_id,chunk_index)
);
CREATE INDEX IF NOT EXISTS z_media_user ON z_media(user_id);
CREATE TABLE IF NOT EXISTS z_username_aliases (
 former_username varchar(24) PRIMARY KEY, user_id uuid NOT NULL REFERENCES z_users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS z_blocks (
 blocker uuid NOT NULL REFERENCES z_users(id) ON DELETE CASCADE, blocked uuid NOT NULL REFERENCES z_users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(blocker,blocked), CHECK(blocker<>blocked)
);
CREATE TABLE IF NOT EXISTS z_follows (
 follower uuid NOT NULL REFERENCES z_users(id) ON DELETE CASCADE,
 followed uuid NOT NULL REFERENCES z_users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(follower,followed), CHECK(follower<>followed)
);
CREATE TABLE IF NOT EXISTS z_posts (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES z_users(id) ON DELETE CASCADE,
 caption varchar(1200) NOT NULL DEFAULT '', kind varchar(10) NOT NULL CHECK(kind IN ('video','photo')),
 visibility varchar(10) NOT NULL DEFAULT 'private' CHECK(visibility IN ('public','followers','private')),
 allow_comments boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS z_posts_date ON z_posts(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS z_posts_owner ON z_posts(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS z_post_media (
 post_id uuid NOT NULL REFERENCES z_posts(id) ON DELETE CASCADE,
 media_id uuid NOT NULL REFERENCES z_media(id) ON DELETE RESTRICT,
 position smallint NOT NULL CHECK(position >=0 AND position<10),
 alt_text varchar(240) NOT NULL DEFAULT '', PRIMARY KEY(post_id,position), UNIQUE(post_id,media_id)
);
CREATE TABLE IF NOT EXISTS z_playlists (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES z_users(id) ON DELETE CASCADE,
 name varchar(70) NOT NULL, private boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS z_playlist_posts (
 playlist_id uuid NOT NULL REFERENCES z_playlists(id) ON DELETE CASCADE,
 post_id uuid NOT NULL REFERENCES z_posts(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(playlist_id,post_id)
);
CREATE INDEX IF NOT EXISTS z_playlists_user ON z_playlists(user_id);
CREATE TABLE IF NOT EXISTS z_likes (
 user_id uuid NOT NULL REFERENCES z_users(id) ON DELETE CASCADE,
 post_id uuid NOT NULL REFERENCES z_posts(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,post_id)
);
CREATE TABLE IF NOT EXISTS z_favorites (
 user_id uuid NOT NULL REFERENCES z_users(id) ON DELETE CASCADE,
 post_id uuid NOT NULL REFERENCES z_posts(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,post_id)
);
CREATE TABLE IF NOT EXISTS z_reposts (
 user_id uuid NOT NULL REFERENCES z_users(id) ON DELETE CASCADE,
 post_id uuid NOT NULL REFERENCES z_posts(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,post_id)
);
CREATE TABLE IF NOT EXISTS z_comments (
 id uuid PRIMARY KEY, post_id uuid NOT NULL REFERENCES z_posts(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES z_users(id) ON DELETE CASCADE,
 parent_id uuid REFERENCES z_comments(id) ON DELETE SET NULL,
 body varchar(500) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS z_comments_post ON z_comments(post_id,created_at);
CREATE TABLE IF NOT EXISTS z_messages (
 id uuid PRIMARY KEY, sender_id uuid NOT NULL REFERENCES z_users(id) ON DELETE CASCADE,
 recipient_id uuid NOT NULL REFERENCES z_users(id) ON DELETE CASCADE,
 body varchar(1000) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz, CHECK(sender_id<>recipient_id)
);
CREATE INDEX IF NOT EXISTS z_messages_recip ON z_messages(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS z_messages_sender ON z_messages(sender_id, created_at DESC);
CREATE TABLE IF NOT EXISTS z_streaks (
 low_id uuid NOT NULL REFERENCES z_users(id) ON DELETE CASCADE,
 high_id uuid NOT NULL REFERENCES z_users(id) ON DELETE CASCADE,
 days int NOT NULL DEFAULT 0, last_exchange date,
 PRIMARY KEY(low_id, high_id), CHECK(low_id<high_id)
);
CREATE TABLE IF NOT EXISTS z_streak_restores (
 user_id uuid NOT NULL REFERENCES z_users(id) ON DELETE CASCADE,
 partner_id uuid NOT NULL REFERENCES z_users(id) ON DELETE CASCADE,
 month char(7) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,month)
);
CREATE TABLE IF NOT EXISTS z_stories (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES z_users(id) ON DELETE CASCADE,
 media_id uuid NOT NULL REFERENCES z_media(id) ON DELETE RESTRICT,
 caption varchar(160) NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours'
);
CREATE INDEX IF NOT EXISTS z_stories_expire ON z_stories(expires_at);
CREATE TABLE IF NOT EXISTS z_notifications (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES z_users(id) ON DELETE CASCADE,
 actor_id uuid REFERENCES z_users(id) ON DELETE SET NULL,
 type varchar(20) NOT NULL, post_id uuid REFERENCES z_posts(id) ON DELETE SET NULL,
 body varchar(160) NOT NULL DEFAULT '', read_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS z_notice_user ON z_notifications(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS z_reports (
 id uuid PRIMARY KEY, reporter_id uuid NOT NULL REFERENCES z_users(id) ON DELETE CASCADE,
 target_type varchar(10) NOT NULL CHECK(target_type IN ('post','user','comment','story')),
 target_id uuid NOT NULL, reason varchar(200) NOT NULL,
 status varchar(10) NOT NULL DEFAULT 'open', reviewed_by uuid REFERENCES z_users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS z_audit (
 id uuid PRIMARY KEY, admin_id uuid REFERENCES z_users(id), action varchar(40) NOT NULL,
 target_id uuid, details jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS z_promotions (
 user_id uuid PRIMARY KEY REFERENCES z_users(id) ON DELETE CASCADE,
 promo_views bigint NOT NULL DEFAULT 0, promo_likes bigint NOT NULL DEFAULT 0,
 promo_followers bigint NOT NULL DEFAULT 0, label varchar(60) NOT NULL DEFAULT 'Divulgação',
 updated_at timestamptz NOT NULL DEFAULT now()
);
