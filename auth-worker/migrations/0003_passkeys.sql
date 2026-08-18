PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS passkey_credentials (
    id TEXT PRIMARY KEY,

    user_id TEXT NOT NULL,

    credential_id TEXT NOT NULL UNIQUE,

    public_key_b64 TEXT NOT NULL,

    webauthn_user_id TEXT NOT NULL,

    counter INTEGER NOT NULL DEFAULT 0,

    device_type TEXT,

    backed_up INTEGER NOT NULL DEFAULT 0
        CHECK (backed_up IN (0, 1)),

    transports_json TEXT,

    aaguid TEXT,

    display_name TEXT NOT NULL,

    created_at INTEGER NOT NULL,

    last_used_at INTEGER,

    revoked_at INTEGER,

    created_by_session_id TEXT,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (created_by_session_id)
        REFERENCES sessions(id)
        ON DELETE SET NULL
);


CREATE INDEX IF NOT EXISTS idx_passkey_credentials_user_active
ON passkey_credentials(
    user_id,
    revoked_at,
    created_at
);


CREATE INDEX IF NOT EXISTS idx_passkey_credentials_last_used
ON passkey_credentials(
    last_used_at DESC
);


CREATE TABLE IF NOT EXISTS webauthn_challenges (
    id TEXT PRIMARY KEY,

    purpose TEXT NOT NULL
        CHECK (
            purpose IN (
                'registration',
                'authentication'
            )
        ),

    user_id TEXT,

    session_id TEXT,

    challenge TEXT NOT NULL UNIQUE,

    webauthn_user_id TEXT,

    created_at INTEGER NOT NULL,

    expires_at INTEGER NOT NULL,

    used_at INTEGER,

    ip_hash TEXT,

    user_agent_hash TEXT,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (session_id)
        REFERENCES sessions(id)
        ON DELETE CASCADE
);


CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expiry
ON webauthn_challenges(
    expires_at,
    used_at
);


CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_user
ON webauthn_challenges(
    user_id,
    purpose,
    expires_at
);
