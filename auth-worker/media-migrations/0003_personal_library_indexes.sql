PRAGMA foreign_keys = ON;


CREATE INDEX IF NOT EXISTS
idx_media_owner_status_type_time

ON media (
    uploader_user_id,
    status,
    type,
    added_at DESC
);


CREATE INDEX IF NOT EXISTS
idx_media_owner_trash_time

ON media (
    uploader_user_id,
    status,
    trashed_at DESC
);
