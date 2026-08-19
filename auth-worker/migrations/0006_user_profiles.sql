PRAGMA foreign_keys = ON;


ALTER TABLE users
ADD COLUMN profile_bio TEXT;


ALTER TABLE users
ADD COLUMN avatar_mode TEXT
NOT NULL
DEFAULT 'initial'
CHECK (
    avatar_mode IN (
        'initial',
        'emoji',
        'media'
    )
);


ALTER TABLE users
ADD COLUMN avatar_value TEXT;
