import {
  createId
} from "./crypto.mjs";

export async function getSystemState(
  env,
  key
) {
  return (
    await env.AUTH_DB
      .prepare(
        `
        SELECT
          value,
          updated_at
        FROM system_state
        WHERE key = ?
        LIMIT 1
        `
      )
      .bind(key)
      .first()
  ) || null;
}

export async function isBootstrapped(
  env
) {
  return Boolean(
    await getSystemState(
      env,
      "owner_user_id"
    )
  );
}

export async function getUserById(
  env,
  userId
) {
  return (
    await env.AUTH_DB
      .prepare(
        `
        SELECT
          id,
          display_name,
          role,
          permissions_json,
          status,
          created_at,
          updated_at,
          last_login_at,
          created_by_user_id
        FROM users
        WHERE id = ?
        LIMIT 1
        `
      )
      .bind(userId)
      .first()
  ) || null;
}

export async function getSessionByTokenHash(
  env,
  tokenHash
) {
  return (
    await env.AUTH_DB
      .prepare(
        `
        SELECT
          s.id AS session_id,
          s.user_id AS user_id,
          u.id AS id,

          s.created_at
            AS session_created_at,

          s.last_seen_at
            AS session_last_seen_at,

          s.expires_at
            AS session_expires_at,

          s.revoked_at
            AS session_revoked_at,

          s.device_label
            AS session_device_label,

          u.display_name
            AS display_name,

          u.role
            AS role,

          u.permissions_json
            AS permissions_json,

          u.status
            AS status,

          u.created_at
            AS created_at,

          u.updated_at
            AS updated_at,

          u.last_login_at
            AS last_login_at

        FROM sessions s

        INNER JOIN users u
          ON u.id = s.user_id

        WHERE
          s.token_hash = ?

        LIMIT 1
        `
      )
      .bind(tokenHash)
      .first()
  ) || null;
}

export async function refreshSession(
  env,
  sessionId,
  lastSeenAt,
  expiresAt
) {
  return env.AUTH_DB
    .prepare(
      `
      UPDATE sessions

      SET
        last_seen_at = ?,
        expires_at = ?

      WHERE
        id = ?
        AND revoked_at IS NULL
      `
    )
    .bind(
      lastSeenAt,
      expiresAt,
      sessionId
    )
    .run();
}

export function auditStatement(
  env,
  {
    actorUserId = null,
    actorSessionId = null,
    action,
    targetType = null,
    targetId = null,
    metadata = null,
    ipHash = null,
    createdAt
  }
) {
  return env.AUTH_DB
    .prepare(
      `
      INSERT INTO audit_logs (
        id,
        actor_user_id,
        actor_session_id,
        action,
        target_type,
        target_id,
        metadata_json,
        ip_hash,
        created_at
      )

      VALUES (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?
      )
      `
    )
    .bind(
      createId("audit"),
      actorUserId,
      actorSessionId,
      action,
      targetType,
      targetId,

      metadata === null
        ? null
        : JSON.stringify(
            metadata
          ),

      ipHash,
      createdAt
    );
}

export async function insertAudit(
  env,
  data
) {
  return auditStatement(
    env,
    data
  ).run();
}
