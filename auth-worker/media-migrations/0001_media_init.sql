PRAGMA foreign_keys = ON;


CREATE TABLE IF NOT EXISTS media (

    id TEXT PRIMARY KEY,

    type TEXT NOT NULL
        CHECK (
            type IN (
                'image',
                'audio',
                'video'
            )
        ),

    filename TEXT NOT NULL,

    original_name TEXT,

    display_title TEXT,

    public_path TEXT NOT NULL UNIQUE,

    cdn_url TEXT NOT NULL,

    cdn_shard TEXT NOT NULL,

    cloudflare_hash TEXT,

    sha256 TEXT NOT NULL,

    size_bytes INTEGER NOT NULL DEFAULT 0
        CHECK (
            size_bytes >= 0
        ),

    source_repository TEXT NOT NULL,

    source_branch TEXT NOT NULL DEFAULT 'main',

    source_path TEXT NOT NULL,

    uploader_user_id TEXT,

    first_upload_job_id TEXT,

    status TEXT NOT NULL DEFAULT 'published'
        CHECK (
            status IN (
                'published',
                'missing',
                'trashed',
                'deleted'
            )
        ),

    is_protected INTEGER NOT NULL DEFAULT 0
        CHECK (
            is_protected IN (
                0,
                1
            )
        ),

    added_at INTEGER,

    published_at INTEGER,

    trashed_at INTEGER,

    trash_expires_at INTEGER,

    deleted_at INTEGER,

    created_at INTEGER NOT NULL,

    updated_at INTEGER NOT NULL,

    last_sync_id TEXT
);


CREATE INDEX IF NOT EXISTS idx_media_status_type_added
ON media (
    status,
    type,
    added_at DESC
);


CREATE INDEX IF NOT EXISTS idx_media_sha256
ON media (
    sha256
);


CREATE INDEX IF NOT EXISTS idx_media_repository
ON media (
    source_repository
);


CREATE INDEX IF NOT EXISTS idx_media_uploader
ON media (
    uploader_user_id,
    added_at DESC
);


CREATE INDEX IF NOT EXISTS idx_media_sync
ON media (
    last_sync_id
);


CREATE TABLE IF NOT EXISTS media_tags (

    media_id TEXT NOT NULL,

    tag TEXT NOT NULL,

    created_by_user_id TEXT,

    created_at INTEGER NOT NULL,

    PRIMARY KEY (
        media_id,
        tag
    ),

    FOREIGN KEY (
        media_id
    )
    REFERENCES media (
        id
    )
    ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS media_favorites (

    user_id TEXT NOT NULL,

    media_id TEXT NOT NULL,

    created_at INTEGER NOT NULL,

    PRIMARY KEY (
        user_id,
        media_id
    ),

    FOREIGN KEY (
        media_id
    )
    REFERENCES media (
        id
    )
    ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS media_events (

    id TEXT PRIMARY KEY,

    media_id TEXT,

    actor_user_id TEXT,

    action TEXT NOT NULL,

    metadata_json TEXT,

    created_at INTEGER NOT NULL,

    FOREIGN KEY (
        media_id
    )
    REFERENCES media (
        id
    )
    ON DELETE SET NULL
);


CREATE INDEX IF NOT EXISTS idx_media_events_media
ON media_events (
    media_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS idx_media_events_created
ON media_events (
    created_at DESC
);


CREATE TABLE IF NOT EXISTS sync_state (

    key TEXT PRIMARY KEY,

    value TEXT NOT NULL,

    updated_at INTEGER NOT NULL
);
