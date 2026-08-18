PRAGMA foreign_keys = ON;


CREATE TABLE IF NOT EXISTS collections (

    id TEXT PRIMARY KEY,

    owner_user_id TEXT NOT NULL,

    type TEXT NOT NULL
        CHECK (
            type IN (
                'image',
                'audio',
                'video'
            )
        ),

    name TEXT NOT NULL,

    description TEXT,

    cover_media_id TEXT,

    visibility TEXT NOT NULL
        DEFAULT 'members'
        CHECK (
            visibility IN (
                'private',
                'members'
            )
        ),

    sort_order INTEGER NOT NULL
        DEFAULT 0,

    is_pinned INTEGER NOT NULL
        DEFAULT 0
        CHECK (
            is_pinned IN (
                0,
                1
            )
        ),

    pinned_order INTEGER NOT NULL
        DEFAULT 0,

    created_at INTEGER NOT NULL,

    updated_at INTEGER NOT NULL,

    FOREIGN KEY (
        cover_media_id
    )
        REFERENCES media(id)
        ON DELETE SET NULL
);


CREATE UNIQUE INDEX IF NOT EXISTS
idx_collections_owner_type_name

ON collections (
    owner_user_id,
    type,
    name COLLATE NOCASE
);


CREATE INDEX IF NOT EXISTS
idx_collections_owner_type

ON collections (
    owner_user_id,
    type,
    is_pinned DESC,
    pinned_order ASC,
    sort_order ASC,
    updated_at DESC
);


CREATE INDEX IF NOT EXISTS
idx_collections_visibility

ON collections (
    visibility,
    type,
    updated_at DESC
);


CREATE INDEX IF NOT EXISTS
idx_collections_cover

ON collections (
    cover_media_id
);


CREATE TABLE IF NOT EXISTS collection_items (

    collection_id TEXT NOT NULL,

    media_id TEXT NOT NULL,

    added_by_user_id TEXT,

    sort_order INTEGER NOT NULL
        DEFAULT 0,

    created_at INTEGER NOT NULL,

    updated_at INTEGER NOT NULL,

    PRIMARY KEY (
        collection_id,
        media_id
    ),

    FOREIGN KEY (
        collection_id
    )
        REFERENCES collections(id)
        ON DELETE CASCADE,

    FOREIGN KEY (
        media_id
    )
        REFERENCES media(id)
        ON DELETE CASCADE
);


CREATE INDEX IF NOT EXISTS
idx_collection_items_collection_order

ON collection_items (
    collection_id,
    sort_order ASC,
    created_at ASC
);


CREATE INDEX IF NOT EXISTS
idx_collection_items_media

ON collection_items (
    media_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
idx_collection_items_added_by

ON collection_items (
    added_by_user_id,
    created_at DESC
);
