PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS system_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'uploader')),
    permissions_json TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_login_at INTEGER,
    created_by_user_id TEXT,
    FOREIGN KEY (created_by_user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_single_owner
ON users(role)
WHERE role = 'owner';

CREATE INDEX IF NOT EXISTS idx_users_status
ON users(status);

CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role = 'uploader'),
    permissions_json TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'consumed', 'revoked')),
    max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses = 1),
    expires_at INTEGER,
    created_at INTEGER NOT NULL,
    created_by_user_id TEXT NOT NULL,
    used_at INTEGER,
    used_by_user_id TEXT,
    revoked_at INTEGER,
    note TEXT,
    FOREIGN KEY (created_by_user_id)
        REFERENCES users(id)
        ON DELETE RESTRICT,
    FOREIGN KEY (used_by_user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_invites_status_expires
ON invites(status, expires_at);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER,
    ip_hash TEXT,
    user_agent_hash TEXT,
    device_label TEXT,
    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_active
ON sessions(user_id, revoked_at, expires_at);

CREATE INDEX IF NOT EXISTS idx_sessions_expires
ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS device_links (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    code_hash TEXT NOT NULL UNIQUE,
    created_by_session_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    used_by_session_id TEXT,
    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    FOREIGN KEY (created_by_session_id)
        REFERENCES sessions(id)
        ON DELETE CASCADE,
    FOREIGN KEY (used_by_session_id)
        REFERENCES sessions(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_device_links_user
ON device_links(user_id, used_at, expires_at);

CREATE TABLE IF NOT EXISTS recovery_codes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    code_hash TEXT NOT NULL UNIQUE,
    created_by_user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    used_by_session_id TEXT,
    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id)
        REFERENCES users(id)
        ON DELETE RESTRICT,
    FOREIGN KEY (used_by_session_id)
        REFERENCES sessions(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_recovery_codes_user
ON recovery_codes(user_id, used_at, expires_at);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_user_id TEXT,
    actor_session_id TEXT,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    metadata_json TEXT,
    ip_hash TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (actor_user_id)
        REFERENCES users(id)
        ON DELETE SET NULL,
    FOREIGN KEY (actor_session_id)
        REFERENCES sessions(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created
ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
ON audit_logs(actor_user_id, created_at DESC);
