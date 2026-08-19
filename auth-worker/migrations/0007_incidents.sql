PRAGMA foreign_keys = ON;


CREATE TABLE IF NOT EXISTS incidents (

    id TEXT PRIMARY KEY,

    fingerprint TEXT NOT NULL UNIQUE,

    category TEXT NOT NULL
        CHECK (
            category IN (
                'upload',
                'media',
                'playback',
                'collection',
                'account',
                'ui',
                'other'
            )
        ),

    title TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'open'
        CHECK (
            status IN (
                'open',
                'investigating',
                'resolved',
                'muted'
            )
        ),

    severity TEXT NOT NULL DEFAULT 'normal'
        CHECK (
            severity IN (
                'low',
                'normal',
                'high',
                'critical'
            )
        ),

    report_count INTEGER NOT NULL DEFAULT 0,

    first_seen_at INTEGER NOT NULL,

    last_seen_at INTEGER NOT NULL,

    owner_note TEXT,

    resolved_at INTEGER,

    resolved_by_user_id TEXT,

    created_by_user_id TEXT,

    FOREIGN KEY (resolved_by_user_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    FOREIGN KEY (created_by_user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);


CREATE INDEX IF NOT EXISTS idx_incidents_status_last_seen
ON incidents(
    status,
    last_seen_at DESC
);


CREATE INDEX IF NOT EXISTS idx_incidents_category_last_seen
ON incidents(
    category,
    last_seen_at DESC
);


CREATE TABLE IF NOT EXISTS incident_reports (

    id TEXT PRIMARY KEY,

    incident_id TEXT NOT NULL,

    reporter_user_id TEXT,

    reporter_session_id TEXT,

    message TEXT,

    page_path TEXT,

    api_path TEXT,

    http_status INTEGER,

    error_code TEXT,

    context_json TEXT,

    created_at INTEGER NOT NULL,

    FOREIGN KEY (incident_id)
        REFERENCES incidents(id)
        ON DELETE CASCADE,

    FOREIGN KEY (reporter_user_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    FOREIGN KEY (reporter_session_id)
        REFERENCES sessions(id)
        ON DELETE SET NULL
);


CREATE INDEX IF NOT EXISTS idx_incident_reports_incident
ON incident_reports(
    incident_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS idx_incident_reports_reporter
ON incident_reports(
    reporter_user_id,
    created_at DESC
);
