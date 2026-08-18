PRAGMA foreign_keys = ON;


CREATE TABLE IF NOT EXISTS user_deletions (

    user_id TEXT PRIMARY KEY,

    snapshot_display_name TEXT NOT NULL,

    snapshot_permissions_json TEXT NOT NULL,

    original_status TEXT NOT NULL
        CHECK (
            original_status IN (
                'active',
                'disabled'
            )
        ),

    deleted_at INTEGER NOT NULL,

    purge_after INTEGER NOT NULL,

    deleted_by_user_id TEXT NOT NULL,

    restored_at INTEGER,

    restored_by_user_id TEXT,

    FOREIGN KEY (
        user_id
    )
    REFERENCES users (
        id
    )
    ON DELETE CASCADE,

    FOREIGN KEY (
        deleted_by_user_id
    )
    REFERENCES users (
        id
    )
    ON DELETE RESTRICT,

    FOREIGN KEY (
        restored_by_user_id
    )
    REFERENCES users (
        id
    )
    ON DELETE SET NULL
);


CREATE INDEX IF NOT EXISTS
idx_user_deletions_active

ON user_deletions (
    restored_at,
    deleted_at DESC
);


CREATE INDEX IF NOT EXISTS
idx_user_deletions_purge

ON user_deletions (
    restored_at,
    purge_after
);
