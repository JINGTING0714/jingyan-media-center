PRAGMA foreign_keys = ON;


CREATE TABLE IF NOT EXISTS upload_batches (

    id TEXT PRIMARY KEY,

    user_id TEXT NOT NULL,

    created_by_session_id TEXT,

    status TEXT NOT NULL
        CHECK (
            status IN (
                'created',
                'staging',
                'ready',
                'queued',
                'processing',
                'partial',
                'complete',
                'failed',
                'cancelled'
            )
        ),

    total_count INTEGER NOT NULL
        CHECK (
            total_count >= 2
            AND
            total_count <= 20
        ),

    staged_count INTEGER NOT NULL
        DEFAULT 0
        CHECK (
            staged_count >= 0
        ),

    completed_count INTEGER NOT NULL
        DEFAULT 0
        CHECK (
            completed_count >= 0
        ),

    failed_count INTEGER NOT NULL
        DEFAULT 0
        CHECK (
            failed_count >= 0
        ),

    review_count INTEGER NOT NULL
        DEFAULT 0
        CHECK (
            review_count >= 0
        ),

    total_bytes INTEGER NOT NULL
        CHECK (
            total_bytes > 0
        ),

    github_run_id INTEGER,

    github_run_url TEXT,

    error_message TEXT,

    created_at INTEGER NOT NULL,

    updated_at INTEGER NOT NULL,

    started_at INTEGER,

    completed_at INTEGER,

    FOREIGN KEY (
        user_id
    )
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (
        created_by_session_id
    )
        REFERENCES sessions(id)
        ON DELETE SET NULL
);


CREATE TABLE IF NOT EXISTS upload_batch_items (

    id TEXT PRIMARY KEY,

    batch_id TEXT NOT NULL,

    position INTEGER NOT NULL
        CHECK (
            position >= 0
        ),

    original_name TEXT NOT NULL,

    media_type TEXT NOT NULL
        CHECK (
            media_type IN (
                'image',
                'audio',
                'video'
            )
        ),

    size_bytes INTEGER NOT NULL
        CHECK (
            size_bytes > 0
        ),

    content_type TEXT,

    status TEXT NOT NULL
        CHECK (
            status IN (
                'created',
                'staged',
                'queued',
                'processing',
                'complete',
                'failed',
                'review',
                'cancelled'
            )
        ),

    kv_key TEXT NOT NULL UNIQUE,

    media_id TEXT,

    final_filename TEXT,

    source_repository TEXT,

    sha256 TEXT,

    cdn_url TEXT,

    error_message TEXT,

    result_json TEXT,

    created_at INTEGER NOT NULL,

    updated_at INTEGER NOT NULL,

    completed_at INTEGER,

    FOREIGN KEY (
        batch_id
    )
        REFERENCES upload_batches(id)
        ON DELETE CASCADE,

    UNIQUE (
        batch_id,
        position
    )
);


CREATE INDEX IF NOT EXISTS
idx_upload_batches_user_created

ON upload_batches(
    user_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
idx_upload_batches_status

ON upload_batches(
    status,
    updated_at
);


CREATE INDEX IF NOT EXISTS
idx_upload_batches_github_run

ON upload_batches(
    github_run_id
);


CREATE INDEX IF NOT EXISTS
idx_upload_batch_items_batch_position

ON upload_batch_items(
    batch_id,
    position
);


CREATE INDEX IF NOT EXISTS
idx_upload_batch_items_status

ON upload_batch_items(
    status,
    updated_at
);
