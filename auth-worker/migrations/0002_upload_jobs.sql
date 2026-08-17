PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS upload_jobs (

    id TEXT PRIMARY KEY,

    user_id TEXT NOT NULL,

    created_by_session_id TEXT,

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
                'failed'
            )
        ),

    kv_key TEXT NOT NULL UNIQUE,

    github_run_id INTEGER,

    github_run_url TEXT,

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

CREATE INDEX IF NOT EXISTS
idx_upload_jobs_user_created

ON upload_jobs(
    user_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
idx_upload_jobs_status

ON upload_jobs(
    status,
    updated_at
);

CREATE INDEX IF NOT EXISTS
idx_upload_jobs_github_run

ON upload_jobs(
    github_run_id
);
