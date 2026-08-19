import {
  OWNER_PERMISSIONS,
  normalizePermissions,
  publicUser,
  getSessionTtlSeconds,
  getSessionRefreshSeconds
} from "./config.mjs";

import {
  nowSeconds,
  generateSessionToken,
  hashSecret,
  secureEqualText,
  getRequestFingerprint,
  createId
} from "./crypto.mjs";

import {
  generateInviteCode,
  generateRecoveryCode,
  generatePairingCode,
  normalizePublicCode,
  normalizePairingCode
} from "./codes.mjs";

import {
  HttpError,
  jsonResponse,
  readJson,
  getSessionTokenFromRequest,
  withSessionCookie,
  withClearedSessionCookie,
  requireSameOrigin,
  methodNotAllowed,
  notFound
} from "./http.mjs";

import {
  isBootstrapped,
  getSystemState,
  getUserById,
  getSessionByTokenHash,
  refreshSession,
  auditStatement,
  insertAudit
} from "./db.mjs";

import {
  verifyTurnstile
} from "./turnstile.mjs";

import {
  renderHome,
  renderSetupComplete,
  renderSetupPending,
  renderActivate,
  renderDevice,
  renderRecover,
  renderOwnerRecover,
  renderAccount,
  renderAdmin
} from "./pages.mjs";


function changes(
  result
) {

  return Number(
    result?.meta?.changes ||
    0
  );

}


function intSetting(
  env,
  key,
  fallback,
  min,
  max
) {

  const raw =
    Number(
      env[key]
    );


  const value =
    Number.isFinite(
      raw
    )

      ? Math.trunc(
          raw
        )

      : fallback;


  return Math.min(

    max,

    Math.max(
      min,
      value
    )

  );

}


function getInviteTtlSeconds(
  env
) {

  return (
    intSetting(
      env,
      "INVITE_DEFAULT_TTL_DAYS",
      30,
      1,
      365
    ) *
    86400
  );

}


function getPairingTtlSeconds(
  env
) {

  return (
    intSetting(
      env,
      "PAIRING_TTL_MINUTES",
      10,
      5,
      60
    ) *
    60
  );

}


function getRecoveryTtlSeconds(
  env
) {

  return (
    intSetting(
      env,
      "RECOVERY_TTL_MINUTES",
      30,
      5,
      240
    ) *
    60
  );

}


async function listUsers(
  env
) {

  const result =
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

        ORDER BY

          CASE role
            WHEN 'owner'
            THEN 0
            ELSE 1
          END,

          created_at ASC
        `
      )
      .all();


  return (
    result.results ||
    []
  );

}


async function listInvites(
  env
) {

  const result =
    await env.AUTH_DB
      .prepare(
        `
        SELECT

          id,
          display_name,
          role,
          permissions_json,
          status,
          max_uses,
          expires_at,
          created_at,
          created_by_user_id,
          used_at,
          used_by_user_id,
          revoked_at,
          note

        FROM invites

        ORDER BY
          created_at DESC

        LIMIT 200
        `
      )
      .all();


  return (
    result.results ||
    []
  );

}


async function listUserSessions(
  env,
  userId
) {

  const result =
    await env.AUTH_DB
      .prepare(
        `
        SELECT

          id,
          user_id,
          created_at,
          last_seen_at,
          expires_at,
          revoked_at,
          device_label

        FROM sessions

        WHERE
          user_id = ?

        ORDER BY
          created_at DESC

        LIMIT 100
        `
      )
      .bind(
        userId
      )
      .all();


  return (
    result.results ||
    []
  );

}


async function listAuditLogs(
  env,
  limit = 100
) {

  const safeLimit =
    Math.max(

      1,

      Math.min(

        200,

        Number(
          limit
        ) ||
        100

      )

    );


  const result =
    await env.AUTH_DB
      .prepare(
        `
        SELECT

          id,
          actor_user_id,
          actor_session_id,
          action,
          target_type,
          target_id,
          metadata_json,
          created_at

        FROM audit_logs

        ORDER BY
          created_at DESC

        LIMIT ?
        `
      )
      .bind(
        safeLimit
      )
      .all();


  return (
    result.results ||
    []
  );

}


function validateDisplayName(
  value
) {

  const text =
    String(
      value ||
      ""
    ).trim();


  if (
    text.length <
      1 ||

    text.length >
      80
  ) {

    throw new HttpError(
      400,
      "invalid_display_name"
    );

  }


  return text;

}


function validateNote(
  value
) {

  const text =
    String(
      value ||
      ""
    ).trim();


  if (
    text.length >
    200
  ) {

    throw new HttpError(
      400,
      "invalid_note"
    );

  }


  return (
    text ||
    null
  );

}


function unauthorized(
  clearSession = false
) {

  const error =
    new HttpError(
      401,
      "authentication_required"
    );


  error.clearSession =
    clearSession;


  return error;

}


function requirePermission(
  auth,
  permission
) {

  if (
    !auth?.user?.permissions?.[
      permission
    ]
  ) {

    throw new HttpError(
      403,
      "permission_denied"
    );

  }

}


async function authenticate(
  request,
  env
) {

  const rawToken =
    getSessionTokenFromRequest(
      request,
      env
    );


  if (!rawToken) {

    throw unauthorized(
      false
    );

  }


  const tokenHash =
    await hashSecret(
      env,
      "session",
      rawToken
    );


  const row =
    await getSessionByTokenHash(
      env,
      tokenHash
    );


  const now =
    nowSeconds();


  if (

    !row ||

    row.session_revoked_at !==
      null ||

    Number(
      row.session_expires_at
    ) <=
      now ||

    row.status !==
      "active"

  ) {

    throw unauthorized(
      true
    );

  }


  let refreshCookie =
    false;


  let expiresAt =
    Number(
      row.session_expires_at
    );


  let lastSeenAt =
    Number(
      row.session_last_seen_at
    );


  if (
    lastSeenAt <=
    now -
    getSessionRefreshSeconds(
      env
    )
  ) {

    lastSeenAt =
      now;


    expiresAt =
      now +
      getSessionTtlSeconds(
        env
      );


    await refreshSession(

      env,

      row.session_id,

      lastSeenAt,

      expiresAt

    );


    refreshCookie =
      true;

  }


  return {

    rawToken,

    user:
      publicUser(
        row
      ),

    session: {

      id:
        row.session_id,

      createdAt:
        row.session_created_at,

      lastSeenAt,

      expiresAt,

      deviceLabel:
        row.session_device_label

    },

    refreshCookie

  };

}


function withAuthRefresh(
  response,
  auth,
  env
) {

  return (
    auth?.refreshCookie

      ? withSessionCookie(
          response,
          auth.rawToken,
          env
        )

      : response
  );

}


async function auditContext(
  request,
  env,
  auth
) {

  const fingerprint =
    await getRequestFingerprint(
      request,
      env
    );


  return {

    actorUserId:
      auth.user.id,

    actorSessionId:
      auth.session.id,

    ipHash:
      fingerprint.ipHash

  };

}


async function enforcePublicRateLimit(
  request,
  env,
  scope,
  codeHash
) {

  if (
    !env.AUTH_RATE_LIMITER
      ?.limit
  ) {

    throw new Error(
      "AUTH_RATE_LIMITER binding missing"
    );

  }


  const fingerprint =
    await getRequestFingerprint(
      request,
      env
    );


  const keys = [

    `${scope}:ip:${fingerprint.ipHash}`,

    `${scope}:code:${codeHash}`

  ];


  for (
    const key
    of keys
  ) {

    const result =
      await env
        .AUTH_RATE_LIMITER
        .limit({
          key
        });


    if (
      !result.success
    ) {

      throw new HttpError(
        429,
        "rate_limited"
      );

    }

  }


  return fingerprint;

}


async function createSessionValues(
  request,
  env,
  deviceLabel
) {

  const now =
    nowSeconds();


  const sessionId =
    createId(
      "ses"
    );


  const rawToken =
    generateSessionToken();


  const tokenHash =
    await hashSecret(
      env,
      "session",
      rawToken
    );


  const fingerprint =
    await getRequestFingerprint(
      request,
      env
    );


  const expiresAt =
    now +
    getSessionTtlSeconds(
      env
    );


  return {

    now,

    sessionId,

    rawToken,

    tokenHash,

    fingerprint,

    expiresAt,

    deviceLabel

  };

}


async function handleHealth(
  env
) {

  return jsonResponse({

    ok:
      true,

    service:
      "jingyan-media-app",

    authVersion:
      "2.0",

    bootstrapped:
      await isBootstrapped(
        env
      )

  });

}


async function handleBootstrap(
  request,
  env
) {

  /*
   * Important:
   * once Owner exists, bootstrap stops here before
   * even looking for BOOTSTRAP_SECRET.
   *
   * This allows BOOTSTRAP_SECRET to remain deleted.
   */
  if (
    await isBootstrapped(
      env
    )
  ) {

    throw new HttpError(
      409,
      "already_bootstrapped"
    );

  }


  if (
    !env.AUTH_RATE_LIMITER
      ?.limit
  ) {

    throw new Error(
      "AUTH_RATE_LIMITER binding missing"
    );

  }


  const ip =
    request.headers.get(
      "CF-Connecting-IP"
    ) ||
    "unknown";


  const key =
    await hashSecret(
      env,
      "bootstrap-rate",
      ip
    );


  const rate =
    await env
      .AUTH_RATE_LIMITER
      .limit({
        key
      });


  if (
    !rate.success
  ) {

    throw new HttpError(
      429,
      "rate_limited"
    );

  }


  const configuredSecret =
    String(
      env.BOOTSTRAP_SECRET ||
      ""
    );


  if (
    !configuredSecret
  ) {

    throw new Error(
      "BOOTSTRAP_SECRET secret missing"
    );

  }


  const suppliedSecret =
    request.headers.get(
      "X-Bootstrap-Secret"
    ) ||
    "";


  if (
    !await secureEqualText(
      configuredSecret,
      suppliedSecret
    )
  ) {

    throw new HttpError(
      403,
      "bootstrap_rejected"
    );

  }


  const body =
    await readJson(
      request
    );


  const displayName =
    validateDisplayName(
      body.displayName
    );


  const session =
    await createSessionValues(
      request,
      env,
      "Owner bootstrap"
    );


  const userId =
    createId(
      "usr"
    );


  const permissionsJson =
    JSON.stringify(
      OWNER_PERMISSIONS
    );


  const results =
    await env.AUTH_DB
      .batch([

        env.AUTH_DB
          .prepare(
            `
            INSERT INTO users (

              id,
              display_name,
              role,
              permissions_json,
              status,
              created_at,
              updated_at,
              last_login_at,
              created_by_user_id

            )

            SELECT

              ?,
              ?,
              'owner',
              ?,
              'active',
              ?,
              ?,
              ?,
              NULL

            WHERE NOT EXISTS (

              SELECT 1
              FROM system_state
              WHERE key =
                'owner_user_id'

            )
            `
          )
          .bind(

            userId,

            displayName,

            permissionsJson,

            session.now,

            session.now,

            session.now

          ),


        env.AUTH_DB
          .prepare(
            `
            INSERT INTO system_state (

              key,
              value,
              updated_at

            )

            SELECT

              'owner_user_id',
              ?,
              ?

            WHERE EXISTS (

              SELECT 1
              FROM users
              WHERE id = ?

            )

            AND NOT EXISTS (

              SELECT 1
              FROM system_state
              WHERE key =
                'owner_user_id'

            )
            `
          )
          .bind(

            userId,

            session.now,

            userId

          ),


        env.AUTH_DB
          .prepare(
            `
            INSERT INTO sessions (

              id,
              user_id,
              token_hash,
              created_at,
              last_seen_at,
              expires_at,
              revoked_at,
              ip_hash,
              user_agent_hash,
              device_label

            )

            SELECT

              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              NULL,
              ?,
              ?,
              ?

            WHERE EXISTS (

              SELECT 1
              FROM system_state

              WHERE
                key =
                  'owner_user_id'

              AND
                value = ?

            )
            `
          )
          .bind(

            session.sessionId,

            userId,

            session.tokenHash,

            session.now,

            session.now,

            session.expiresAt,

            session
              .fingerprint
              .ipHash,

            session
              .fingerprint
              .userAgentHash,

            session.deviceLabel,

            userId

          )

      ]);


  if (

    changes(
      results[0]
    ) !==
      1 ||

    changes(
      results[1]
    ) !==
      1 ||

    changes(
      results[2]
    ) !==
      1

  ) {

    throw new HttpError(
      409,
      "already_bootstrapped"
    );

  }


  await insertAudit(

    env,

    {
      actorUserId:
        userId,

      actorSessionId:
        session.sessionId,

      action:
        "system.bootstrap",

      targetType:
        "user",

      targetId:
        userId,

      metadata: {
        role:
          "owner"
      },

      ipHash:
        session
          .fingerprint
          .ipHash,

      createdAt:
        session.now
    }

  );


  const user =
    await getUserById(
      env,
      userId
    );


  return withSessionCookie(

    jsonResponse(
      {
        ok:
          true,

        user:
          publicUser(
            user
          )
      },
      201
    ),

    session.rawToken,

    env

  );

}


async function handleMe(
  request,
  env
) {

  const auth =
    await authenticate(
      request,
      env
    );


  return withAuthRefresh(

    jsonResponse({

      authenticated:
        true,

      user:
        auth.user,

      session:
        auth.session

    }),

    auth,

    env

  );

}


async function handleLogout(
  request,
  env
) {

  requireSameOrigin(
    request
  );


  const auth =
    await authenticate(
      request,
      env
    );


  const now =
    nowSeconds();


  const context =
    await auditContext(
      request,
      env,
      auth
    );


  await env.AUTH_DB
    .batch([

      env.AUTH_DB
        .prepare(
          `
          UPDATE sessions

          SET
            revoked_at =
              COALESCE(
                revoked_at,
                ?
              )

          WHERE
            id = ?
          `
        )
        .bind(
          now,
          auth.session.id
        ),


      auditStatement(

        env,

        {
          ...context,

          action:
            "session.logout",

          targetType:
            "session",

          targetId:
            auth.session.id,

          createdAt:
            now
        }

      )

    ]);


  return withClearedSessionCookie(

    jsonResponse({
      ok:
        true
    }),

    env

  );

}


async function handleLogoutAll(
  request,
  env
) {

  requireSameOrigin(
    request
  );


  const auth =
    await authenticate(
      request,
      env
    );


  const now =
    nowSeconds();


  const context =
    await auditContext(
      request,
      env,
      auth
    );


  await env.AUTH_DB
    .batch([

      env.AUTH_DB
        .prepare(
          `
          UPDATE sessions

          SET
            revoked_at =
              COALESCE(
                revoked_at,
                ?
              )

          WHERE
            user_id = ?

          AND
            revoked_at IS NULL
          `
        )
        .bind(
          now,
          auth.user.id
        ),


      env.AUTH_DB
        .prepare(
          `
          DELETE FROM
            device_links

          WHERE
            user_id = ?

          AND
            used_at IS NULL
          `
        )
        .bind(
          auth.user.id
        ),


      auditStatement(

        env,

        {
          ...context,

          action:
            "session.logout_all",

          targetType:
            "user",

          targetId:
            auth.user.id,

          createdAt:
            now
        }

      )

    ]);


  return withClearedSessionCookie(

    jsonResponse({
      ok:
        true
    }),

    env

  );

}


async function handleCreateInvite(
  request,
  env
) {

  requireSameOrigin(
    request
  );


  const auth =
    await authenticate(
      request,
      env
    );


  requirePermission(
    auth,
    "manageInvites"
  );


  const body =
    await readJson(
      request
    );


  const displayName =
    validateDisplayName(
      body.displayName
    );


  const note =
    validateNote(
      body.note
    );


  const permissions =
    normalizePermissions(
      "uploader",
      body.permissions
    );


  const now =
    nowSeconds();


  let expiresAt;


  if (
    body.expiresInDays ===
    null
  ) {

    expiresAt =
      null;

  } else if (
    body.expiresInDays ===
    undefined
  ) {

    expiresAt =
      now +
      getInviteTtlSeconds(
        env
      );

  } else {

    const days =
      Number(
        body.expiresInDays
      );


    if (

      !Number.isInteger(
        days
      ) ||

      days <
        1 ||

      days >
        365

    ) {

      throw new HttpError(
        400,
        "invalid_invite_expiry"
      );

    }


    expiresAt =
      now +
      days *
      86400;

  }


  const inviteCode =
    generateInviteCode();


  const codeHash =
    await hashSecret(

      env,

      "invite",

      normalizePublicCode(
        inviteCode
      )

    );


  const inviteId =
    createId(
      "inv"
    );


  const context =
    await auditContext(
      request,
      env,
      auth
    );


  await env.AUTH_DB
    .batch([

      env.AUTH_DB
        .prepare(
          `
          INSERT INTO invites (

            id,
            code_hash,
            display_name,
            role,
            permissions_json,
            status,
            max_uses,
            expires_at,
            created_at,
            created_by_user_id,
            used_at,
            used_by_user_id,
            revoked_at,
            note

          )

          VALUES (

            ?,
            ?,
            ?,
            'uploader',
            ?,
            'active',
            1,
            ?,
            ?,
            ?,
            NULL,
            NULL,
            NULL,
            ?

          )
          `
        )
        .bind(

          inviteId,

          codeHash,

          displayName,

          JSON.stringify(
            permissions
          ),

          expiresAt,

          now,

          auth.user.id,

          note

        ),


      auditStatement(

        env,

        {
          ...context,

          action:
            "invite.create",

          targetType:
            "invite",

          targetId:
            inviteId,

          metadata: {

            displayName,

            expiresAt,

            permissions

          },

          createdAt:
            now
        }

      )

    ]);


  return withAuthRefresh(

    jsonResponse(
      {
        ok:
          true,

        inviteId,

        /*
         * This is the only API response
         * that ever returns the plaintext invite code.
         */
        inviteCode,

        displayName,

        permissions,

        expiresAt,

        note
      },
      201
    ),

    auth,

    env

  );

}


async function handleListInvites(
  request,
  env
) {

  const auth =
    await authenticate(
      request,
      env
    );


  requirePermission(
    auth,
    "manageInvites"
  );


  const rows =
    await listInvites(
      env
    );


  const invites =
    rows.map(
      row => ({

        id:
          row.id,

        displayName:
          row.display_name,

        role:
          row.role,

        permissions:
          normalizePermissions(

            row.role,

            JSON.parse(
              row.permissions_json ||
              "{}"
            )

          ),

        status:
          row.status,

        maxUses:
          row.max_uses,

        expiresAt:
          row.expires_at,

        createdAt:
          row.created_at,

        usedAt:
          row.used_at,

        usedByUserId:
          row.used_by_user_id,

        revokedAt:
          row.revoked_at,

        note:
          row.note

      })
    );


  return withAuthRefresh(

    jsonResponse({
      invites
    }),

    auth,

    env

  );

}


async function handleRevokeInvite(
  request,
  env,
  inviteId
) {

  requireSameOrigin(
    request
  );


  const auth =
    await authenticate(
      request,
      env
    );


  requirePermission(
    auth,
    "manageInvites"
  );


  const now =
    nowSeconds();


  const context =
    await auditContext(
      request,
      env,
      auth
    );


  const results =
    await env.AUTH_DB
      .batch([

        env.AUTH_DB
          .prepare(
            `
            UPDATE invites

            SET
              status =
                'revoked',

              revoked_at =
                ?

            WHERE
              id = ?

            AND
              status =
                'active'
            `
          )
          .bind(
            now,
            inviteId
          ),


        auditStatement(

          env,

          {
            ...context,

            action:
              "invite.revoke",

            targetType:
              "invite",

            targetId:
              inviteId,

            createdAt:
              now
          }

        )

      ]);


  if (
    changes(
      results[0]
    ) !==
    1
  ) {

    throw new HttpError(
      409,
      "invite_not_active"
    );

  }


  return withAuthRefresh(

    jsonResponse({
      ok:
        true
    }),

    auth,

    env

  );

}


async function handleRedeemInvite(
  request,
  env
) {

  requireSameOrigin(
    request
  );


  const body =
    await readJson(
      request
    );


  const code =
    normalizePublicCode(
      body.code
    );


  if (
    !/^JY-(?:[2-9A-HJ-NP-Z]{5}-){3}[2-9A-HJ-NP-Z]{5}$/
      .test(
        code
      )
  ) {

    throw new HttpError(
      400,
      "invalid_invite_code"
    );

  }


  const codeHash =
    await hashSecret(
      env,
      "invite",
      code
    );


  const fingerprint =
    await enforcePublicRateLimit(
      request,
      env,
      "invite",
      codeHash
    );


  await verifyTurnstile(

    request,

    env,

    body.turnstileToken,

    "invite-redeem"

  );


  const invite =
    await env.AUTH_DB
      .prepare(
        `
        SELECT

          id,
          display_name,
          role,
          permissions_json,
          status,
          expires_at

        FROM invites

        WHERE
          code_hash = ?

        LIMIT 1
        `
      )
      .bind(
        codeHash
      )
      .first();


  const now =
    nowSeconds();


  if (

    !invite ||

    invite.status !==
      "active" ||

    (
      invite.expires_at !==
        null &&

      Number(
        invite.expires_at
      ) <=
        now
    )

  ) {

    throw new HttpError(
      409,
      "invite_unavailable"
    );

  }


  const session =
    await createSessionValues(
      request,
      env,
      "Invite activation"
    );


  const userId =
    createId(
      "usr"
    );


  /*
   * invite.used_by_user_id points at users.id.
   *
   * The invite must be atomically claimed before the new user
   * can be considered activated, so we defer FK checking only
   * for this D1 transaction.
   *
   * At transaction end the user exists, therefore FK integrity
   * is fully restored.
   */
  const results =
    await env.AUTH_DB
      .batch([

        env.AUTH_DB
          .prepare(
            `PRAGMA defer_foreign_keys = ON`
          ),


        env.AUTH_DB
          .prepare(
            `
            UPDATE invites

            SET
              status =
                'consumed',

              used_at =
                ?,

              used_by_user_id =
                ?

            WHERE
              id = ?

            AND
              code_hash = ?

            AND
              status =
                'active'

            AND
              used_at IS NULL

            AND (

              expires_at IS NULL

              OR

              expires_at > ?

            )
            `
          )
          .bind(

            now,

            userId,

            invite.id,

            codeHash,

            now

          ),


        env.AUTH_DB
          .prepare(
            `
            INSERT INTO users (

              id,
              display_name,
              role,
              permissions_json,
              status,
              created_at,
              updated_at,
              last_login_at,
              created_by_user_id

            )

            SELECT

              ?,
              display_name,
              role,
              permissions_json,
              'active',
              ?,
              ?,
              ?,
              created_by_user_id

            FROM invites

            WHERE
              id = ?

            AND
              status =
                'consumed'

            AND
              used_by_user_id = ?
            `
          )
          .bind(

            userId,

            now,

            now,

            now,

            invite.id,

            userId

          ),


        env.AUTH_DB
          .prepare(
            `
            INSERT INTO sessions (

              id,
              user_id,
              token_hash,
              created_at,
              last_seen_at,
              expires_at,
              revoked_at,
              ip_hash,
              user_agent_hash,
              device_label

            )

            SELECT

              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              NULL,
              ?,
              ?,
              ?

            WHERE EXISTS (

              SELECT 1

              FROM users

              WHERE
                id = ?

              AND
                status =
                  'active'

            )
            `
          )
          .bind(

            session.sessionId,

            userId,

            session.tokenHash,

            now,

            now,

            session.expiresAt,

            session
              .fingerprint
              .ipHash,

            session
              .fingerprint
              .userAgentHash,

            session.deviceLabel,

            userId

          ),


        env.AUTH_DB
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

            SELECT

              ?,
              ?,
              ?,
              'invite.redeem',
              'invite',
              ?,
              ?,
              ?,
              ?

            WHERE EXISTS (

              SELECT 1

              FROM users

              WHERE
                id = ?

            )
            `
          )
          .bind(

            createId(
              "audit"
            ),

            userId,

            session.sessionId,

            invite.id,

            JSON.stringify({
              displayName:
                invite.display_name
            }),

            fingerprint.ipHash,

            now,

            userId

          ),


        env.AUTH_DB
          .prepare(
            `PRAGMA defer_foreign_keys = OFF`
          )

      ]);


  if (

    changes(
      results[1]
    ) !==
      1 ||

    changes(
      results[2]
    ) !==
      1 ||

    changes(
      results[3]
    ) !==
      1

  ) {

    throw new HttpError(
      409,
      "invite_unavailable"
    );

  }


  const user =
    await getUserById(
      env,
      userId
    );


  return withSessionCookie(

    jsonResponse(
      {
        ok:
          true,

        authenticated:
          true,

        user:
          publicUser(
            user
          )
      },
      201
    ),

    session.rawToken,

    env

  );

}


async function handleListUsers(
  request,
  env
) {

  const auth =
    await authenticate(
      request,
      env
    );


  requirePermission(
    auth,
    "manageUsers"
  );


  const users =
    (
      await listUsers(
        env
      )
    )
      .map(
        publicUser
      );


  return withAuthRefresh(

    jsonResponse({
      users
    }),

    auth,

    env

  );

}


async function handleUpdateUser(
  request,
  env,
  userId
) {

  requireSameOrigin(
    request
  );


  const auth =
    await authenticate(
      request,
      env
    );


  requirePermission(
    auth,
    "manageUsers"
  );


  const target =
    await getUserById(
      env,
      userId
    );


  if (!target) {

    throw new HttpError(
      404,
      "user_not_found"
    );

  }


  /*
   * Nobody can demote, disable or rewrite the single Owner
   * through the user-management API.
   */
  if (
    target.role ===
    "owner"
  ) {

    throw new HttpError(
      403,
      "owner_is_immutable"
    );

  }


  const body =
    await readJson(
      request
    );


  const now =
    nowSeconds();


  const newDisplayName =
    body.displayName ===
      undefined

      ? target.display_name

      : validateDisplayName(
          body.displayName
        );


  const newStatus =
    body.status ===
      undefined

      ? target.status

      : String(
          body.status
        );


  if (
    ![
      "active",
      "disabled"
    ].includes(
      newStatus
    )
  ) {

    throw new HttpError(
      400,
      "invalid_user_status"
    );

  }


  const newPermissions =
    body.permissions ===
      undefined

      ? normalizePermissions(

          "uploader",

          JSON.parse(
            target.permissions_json ||
            "{}"
          )

        )

      : normalizePermissions(
          "uploader",
          body.permissions
        );


  const context =
    await auditContext(
      request,
      env,
      auth
    );


  const statements = [

    env.AUTH_DB
      .prepare(
        `
        UPDATE users

        SET

          display_name =
            ?,

          permissions_json =
            ?,

          status =
            ?,

          updated_at =
            ?

        WHERE
          id = ?

        AND
          role =
            'uploader'
        `
      )
      .bind(

        newDisplayName,

        JSON.stringify(
          newPermissions
        ),

        newStatus,

        now,

        userId

      )

  ];


  /*
   * Disabling a user takes effect immediately:
   * every active session is revoked and pending device/recovery
   * codes disappear.
   */
  if (
    newStatus ===
    "disabled"
  ) {

    statements.push(

      env.AUTH_DB
        .prepare(
          `
          UPDATE sessions

          SET
            revoked_at =
              COALESCE(
                revoked_at,
                ?
              )

          WHERE
            user_id = ?

          AND
            revoked_at IS NULL
          `
        )
        .bind(
          now,
          userId
        ),


      env.AUTH_DB
        .prepare(
          `
          DELETE FROM
            device_links

          WHERE
            user_id = ?

          AND
            used_at IS NULL
          `
        )
        .bind(
          userId
        ),


      env.AUTH_DB
        .prepare(
          `
          DELETE FROM
            recovery_codes

          WHERE
            user_id = ?

          AND
            used_at IS NULL
          `
        )
        .bind(
          userId
        )

    );

  }


  statements.push(

    auditStatement(

      env,

      {
        ...context,

        action:
          "user.update",

        targetType:
          "user",

        targetId:
          userId,

        metadata: {

          displayName:
            newDisplayName,

          status:
            newStatus,

          permissions:
            newPermissions

        },

        createdAt:
          now
      }

    )

  );


  const results =
    await env.AUTH_DB
      .batch(
        statements
      );


  if (
    changes(
      results[0]
    ) !==
    1
  ) {

    throw new HttpError(
      409,
      "user_update_failed"
    );

  }


  const updated =
    await getUserById(
      env,
      userId
    );


  return withAuthRefresh(

    jsonResponse({

      ok:
        true,

      user:
        publicUser(
          updated
        )

    }),

    auth,

    env

  );

}


async function handleAdminRevokeAllSessions(
  request,
  env,
  userId
) {

  requireSameOrigin(
    request
  );


  const auth =
    await authenticate(
      request,
      env
    );


  requirePermission(
    auth,
    "manageUsers"
  );


  const target =
    await getUserById(
      env,
      userId
    );


  if (!target) {

    throw new HttpError(
      404,
      "user_not_found"
    );

  }


  if (
    target.role ===
    "owner"
  ) {

    throw new HttpError(
      403,
      "owner_is_immutable"
    );

  }


  const now =
    nowSeconds();


  const context =
    await auditContext(
      request,
      env,
      auth
    );


  await env.AUTH_DB
    .batch([

      env.AUTH_DB
        .prepare(
          `
          UPDATE sessions

          SET
            revoked_at =
              COALESCE(
                revoked_at,
                ?
              )

          WHERE
            user_id = ?

          AND
            revoked_at IS NULL
          `
        )
        .bind(
          now,
          userId
        ),


      env.AUTH_DB
        .prepare(
          `
          DELETE FROM
            device_links

          WHERE
            user_id = ?

          AND
            used_at IS NULL
          `
        )
        .bind(
          userId
        ),


      auditStatement(

        env,

        {
          ...context,

          action:
            "session.revoke_all_by_owner",

          targetType:
            "user",

          targetId:
            userId,

          createdAt:
            now
        }

      )

    ]);


  return withAuthRefresh(

    jsonResponse({
      ok:
        true
    }),

    auth,

    env

  );

}


async function handleAdminUserSessions(
  request,
  env,
  userId
) {

  const auth =
    await authenticate(
      request,
      env
    );


  requirePermission(
    auth,
    "manageUsers"
  );


  const target =
    await getUserById(
      env,
      userId
    );


  if (!target) {

    throw new HttpError(
      404,
      "user_not_found"
    );

  }


  if (
    target.role ===
    "owner"
  ) {

    throw new HttpError(
      403,
      "owner_is_immutable"
    );

  }


  const rows =
    await listUserSessions(
      env,
      userId
    );


  const sessions =
    rows.map(
      row => ({

        id:
          row.id,

        createdAt:
          row.created_at,

        lastSeenAt:
          row.last_seen_at,

        expiresAt:
          row.expires_at,

        revokedAt:
          row.revoked_at,

        deviceLabel:
          row.device_label

      })
    );


  return withAuthRefresh(

    jsonResponse({
      sessions
    }),

    auth,

    env

  );

}


async function handleAdminRevokeSession(
  request,
  env,
  sessionId
) {

  requireSameOrigin(
    request
  );


  const auth =
    await authenticate(
      request,
      env
    );


  requirePermission(
    auth,
    "manageUsers"
  );


  const row =
    await env.AUTH_DB
      .prepare(
        `
        SELECT

          s.id,
          s.user_id,
          u.role

        FROM sessions s

        INNER JOIN users u
          ON u.id =
             s.user_id

        WHERE
          s.id = ?

        LIMIT 1
        `
      )
      .bind(
        sessionId
      )
      .first();


  if (!row) {

    throw new HttpError(
      404,
      "session_not_found"
    );

  }


  if (
    row.role ===
    "owner"
  ) {

    throw new HttpError(
      403,
      "owner_is_immutable"
    );

  }


  const now =
    nowSeconds();


  const context =
    await auditContext(
      request,
      env,
      auth
    );


  const results =
    await env.AUTH_DB
      .batch([

        env.AUTH_DB
          .prepare(
            `
            UPDATE sessions

            SET
              revoked_at =
                COALESCE(
                  revoked_at,
                  ?
                )

            WHERE
              id = ?

            AND
              revoked_at IS NULL
            `
          )
          .bind(
            now,
            sessionId
          ),


        auditStatement(

          env,

          {
            ...context,

            action:
              "session.revoke_by_owner",

            targetType:
              "session",

            targetId:
              sessionId,

            metadata: {
              userId:
                row.user_id
            },

            createdAt:
              now
          }

        )

      ]);


  if (
    changes(
      results[0]
    ) !==
    1
  ) {

    throw new HttpError(
      409,
      "session_already_revoked"
    );

  }


  return withAuthRefresh(

    jsonResponse({
      ok:
        true
    }),

    auth,

    env

  );

}


async function handleCreateRecovery(
  request,
  env,
  userId
) {

  requireSameOrigin(
    request
  );


  const auth =
    await authenticate(
      request,
      env
    );


  requirePermission(
    auth,
    "manageUsers"
  );


  const target =
    await getUserById(
      env,
      userId
    );


  if (!target) {

    throw new HttpError(
      404,
      "user_not_found"
    );

  }


  if (
    target.role ===
    "owner"
  ) {

    throw new HttpError(
      403,
      "owner_recovery_not_supported_here"
    );

  }


  if (
    target.status !==
    "active"
  ) {

    throw new HttpError(
      409,
      "user_not_active"
    );

  }


  const code =
    generateRecoveryCode();


  const codeHash =
    await hashSecret(

      env,

      "recovery",

      normalizePublicCode(
        code
      )

    );


  const now =
    nowSeconds();


  const expiresAt =
    now +
    getRecoveryTtlSeconds(
      env
    );


  const recoveryId =
    createId(
      "rec"
    );


  const context =
    await auditContext(
      request,
      env,
      auth
    );


  await env.AUTH_DB
    .batch([

      /*
       * Only the newest unconsumed recovery code remains valid.
       */
      env.AUTH_DB
        .prepare(
          `
          DELETE FROM
            recovery_codes

          WHERE
            user_id = ?

          AND
            used_at IS NULL
          `
        )
        .bind(
          userId
        ),


      env.AUTH_DB
        .prepare(
          `
          INSERT INTO recovery_codes (

            id,
            user_id,
            code_hash,
            created_by_user_id,
            created_at,
            expires_at,
            used_at,
            used_by_session_id

          )

          VALUES (

            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            NULL,
            NULL

          )
          `
        )
        .bind(

          recoveryId,

          userId,

          codeHash,

          auth.user.id,

          now,

          expiresAt

        ),


      auditStatement(

        env,

        {
          ...context,

          action:
            "recovery.create",

          targetType:
            "user",

          targetId:
            userId,

          metadata: {

            recoveryId,

            expiresAt

          },

          createdAt:
            now
        }

      )

    ]);


  return withAuthRefresh(

    jsonResponse(
      {
        ok:
          true,

        /*
         * Plaintext is returned exactly here and is never stored.
         */
        recoveryCode:
          code,

        expiresAt
      },
      201
    ),

    auth,

    env

  );

}


async function handleRedeemRecovery(
  request,
  env
) {

  requireSameOrigin(
    request
  );


  const body =
    await readJson(
      request
    );


  const code =
    normalizePublicCode(
      body.code
    );


  if (
    !/^JYR-(?:[2-9A-HJ-NP-Z]{4}-){3}[2-9A-HJ-NP-Z]{4}$/
      .test(
        code
      )
  ) {

    throw new HttpError(
      400,
      "invalid_recovery_code"
    );

  }


  const codeHash =
    await hashSecret(
      env,
      "recovery",
      code
    );


  await enforcePublicRateLimit(
    request,
    env,
    "recovery",
    codeHash
  );


  await verifyTurnstile(

    request,

    env,

    body.turnstileToken,

    "recovery-redeem"

  );


  const row =
    await env.AUTH_DB
      .prepare(
        `
        SELECT

          r.id,
          r.user_id,
          r.expires_at,
          r.used_at,
          u.status

        FROM recovery_codes r

        INNER JOIN users u
          ON u.id =
             r.user_id

        WHERE
          r.code_hash = ?

        LIMIT 1
        `
      )
      .bind(
        codeHash
      )
      .first();


  const now =
    nowSeconds();


  if (

    !row ||

    row.used_at !==
      null ||

    Number(
      row.expires_at
    ) <=
      now ||

    row.status !==
      "active"

  ) {

    throw new HttpError(
      409,
      "recovery_unavailable"
    );

  }


  const session =
  await createSessionValues(
    request,
    env,
    "Account recovery"
  );


  /*
   * recovery_codes.used_by_session_id references sessions.id.
   * Defer FK validation until the new Session has been inserted.
   */
  const results =
    await env.AUTH_DB
      .batch([

        env.AUTH_DB
          .prepare(
            `PRAGMA defer_foreign_keys = ON`
          ),


        env.AUTH_DB
          .prepare(
            `
            UPDATE recovery_codes

            SET
              used_at =
                ?,

              used_by_session_id =
                ?

            WHERE
              id = ?

            AND
              used_at IS NULL

            AND
              expires_at > ?

            AND EXISTS (

              SELECT 1

              FROM users

              WHERE
                id = ?

              AND
                status =
                  'active'

            )
            `
          )
          .bind(

            now,

            session.sessionId,

            row.id,

            now,

            row.user_id

          ),


        env.AUTH_DB
          .prepare(
            `
            INSERT INTO sessions (

              id,
              user_id,
              token_hash,
              created_at,
              last_seen_at,
              expires_at,
              revoked_at,
              ip_hash,
              user_agent_hash,
              device_label

            )

            SELECT

              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              NULL,
              ?,
              ?,
              ?

            WHERE EXISTS (

              SELECT 1

              FROM recovery_codes

              WHERE
                id = ?

              AND
                used_by_session_id = ?

              AND
                used_at = ?

            )
            `
          )
          .bind(

            session.sessionId,

            row.user_id,

            session.tokenHash,

            now,

            now,

            session.expiresAt,

            session
              .fingerprint
              .ipHash,

            session
              .fingerprint
              .userAgentHash,

            session.deviceLabel,

            row.id,

            session.sessionId,

            now

          ),


        env.AUTH_DB
          .prepare(
            `
            UPDATE users

            SET

              last_login_at =
                ?,

              updated_at =
                ?

            WHERE
              id = ?
            `
          )
          .bind(

            now,

            now,

            row.user_id

          ),


        env.AUTH_DB
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

            SELECT

              ?,
              ?,
              ?,
              'recovery.redeem',
              'recovery',
              ?,
              NULL,
              ?,
              ?

            WHERE EXISTS (

              SELECT 1

              FROM sessions

              WHERE
                id = ?

            )
            `
          )
          .bind(

            createId(
              "audit"
            ),

            row.user_id,

            session.sessionId,

            row.id,

            session
              .fingerprint
              .ipHash,

            now,

            session.sessionId

          ),


        env.AUTH_DB
          .prepare(
            `PRAGMA defer_foreign_keys = OFF`
          )

      ]);


  if (

    changes(
      results[1]
    ) !==
      1 ||

    changes(
      results[2]
    ) !==
      1

  ) {

    throw new HttpError(
      409,
      "recovery_unavailable"
    );

  }


  const user =
    await getUserById(
      env,
      row.user_id
    );


  return withSessionCookie(

    jsonResponse({

      ok:
        true,

      authenticated:
        true,

      user:
        publicUser(
          user
        )

    }),

    session.rawToken,

    env

  );

}


async function handleOwnerRecovery(
  request,
  env
) {

  /*
   * Emergency Owner recovery is intentionally disabled by default.
   *
   * If every Owner Session is lost:
   * 1. temporarily add OWNER_RECOVERY_SECRET in Cloudflare
   * 2. use /owner-recover
   * 3. immediately delete OWNER_RECOVERY_SECRET again
   */
  requireSameOrigin(
    request
  );


  const body =
    await readJson(
      request
    );


  const supplied =
    String(
      body.recoverySecret ||
      ""
    );


  const configured =
    String(
      env.OWNER_RECOVERY_SECRET ||
      ""
    );


  if (
    !configured
  ) {

    throw new HttpError(
      503,
      "owner_recovery_disabled"
    );

  }


  const attemptHash =
    await hashSecret(
      env,
      "owner-recovery-attempt",
      supplied
    );


  await enforcePublicRateLimit(
    request,
    env,
    "owner-recovery",
    attemptHash
  );


  await verifyTurnstile(

    request,

    env,

    body.turnstileToken,

    "owner-recovery"

  );


  if (
    !await secureEqualText(
      configured,
      supplied
    )
  ) {

    throw new HttpError(
      403,
      "owner_recovery_rejected"
    );

  }


  const ownerState =
    await getSystemState(
      env,
      "owner_user_id"
    );


  if (
    !ownerState?.value
  ) {

    throw new HttpError(
      409,
      "owner_not_initialized"
    );

  }


  const owner =
    await getUserById(
      env,
      ownerState.value
    );


  if (

    !owner ||

    owner.role !==
      "owner" ||

    owner.status !==
      "active"

  ) {

    throw new HttpError(
      409,
      "owner_not_active"
    );

  }


  const session =
    await createSessionValues(
      request,
      env,
      "Owner emergency recovery"
    );


  await env.AUTH_DB
    .batch([

      env.AUTH_DB
        .prepare(
          `
          INSERT INTO sessions (

            id,
            user_id,
            token_hash,
            created_at,
            last_seen_at,
            expires_at,
            revoked_at,
            ip_hash,
            user_agent_hash,
            device_label

          )

          VALUES (

            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            NULL,
            ?,
            ?,
            ?

          )
          `
        )
        .bind(

          session.sessionId,

          owner.id,

          session.tokenHash,

          session.now,

          session.now,

          session.expiresAt,

          session
            .fingerprint
            .ipHash,

          session
            .fingerprint
            .userAgentHash,

          session.deviceLabel

        ),


      env.AUTH_DB
        .prepare(
          `
          UPDATE users

          SET

            last_login_at =
              ?,

            updated_at =
              ?

          WHERE
            id = ?
          `
        )
        .bind(

          session.now,

          session.now,

          owner.id

        ),


      env.AUTH_DB
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
            'owner.recovery',
            'user',
            ?,
            NULL,
            ?,
            ?

          )
          `
        )
        .bind(

          createId(
            "audit"
          ),

          owner.id,

          session.sessionId,

          owner.id,

          session
            .fingerprint
            .ipHash,

          session.now

        )

    ]);


  return withSessionCookie(

    jsonResponse({

      ok:
        true,

      authenticated:
        true,

      user:
        publicUser(
          owner
        )

    }),

    session.rawToken,

    env

  );

}


async function handleCreateDeviceLink(
  request,
  env
) {

  requireSameOrigin(
    request
  );


  const auth =
    await authenticate(
      request,
      env
    );


  const code =
    generatePairingCode();


  const codeHash =
    await hashSecret(
      env,
      "device",
      code
    );


  const now =
    nowSeconds();


  const expiresAt =
    now +
    getPairingTtlSeconds(
      env
    );


  const linkId =
    createId(
      "dev"
    );


  const context =
    await auditContext(
      request,
      env,
      auth
    );


  await env.AUTH_DB
    .batch([

      /*
       * Only one unconsumed pairing code per user.
       */
      env.AUTH_DB
        .prepare(
          `
          DELETE FROM
            device_links

          WHERE
            user_id = ?

          AND
            used_at IS NULL
          `
        )
        .bind(
          auth.user.id
        ),


      env.AUTH_DB
        .prepare(
          `
          INSERT INTO device_links (

            id,
            user_id,
            code_hash,
            created_by_session_id,
            created_at,
            expires_at,
            used_at,
            used_by_session_id

          )

          VALUES (

            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            NULL,
            NULL

          )
          `
        )
        .bind(

          linkId,

          auth.user.id,

          codeHash,

          auth.session.id,

          now,

          expiresAt

        ),


      auditStatement(

        env,

        {
          ...context,

          action:
            "device_link.create",

          targetType:
            "device_link",

          targetId:
            linkId,

          metadata: {
            expiresAt
          },

          createdAt:
            now
        }

      )

    ]);


  return withAuthRefresh(

    jsonResponse(
      {
        ok:
          true,

        code,

        expiresAt
      },
      201
    ),

    auth,

    env

  );

}


async function handleRedeemDeviceLink(
  request,
  env
) {

  requireSameOrigin(
    request
  );


  const body =
    await readJson(
      request
    );


  const code =
    normalizePairingCode(
      body.code
    );


  if (
    !/^\d{6}$/
      .test(
        code
      )
  ) {

    throw new HttpError(
      400,
      "invalid_pairing_code"
    );

  }


  const codeHash =
    await hashSecret(
      env,
      "device",
      code
    );


  await enforcePublicRateLimit(
    request,
    env,
    "device",
    codeHash
  );


  await verifyTurnstile(

    request,

    env,

    body.turnstileToken,

    "device-redeem"

  );


  const row =
    await env.AUTH_DB
      .prepare(
        `
        SELECT

          d.id,
          d.user_id,
          d.expires_at,
          d.used_at,
          u.status

        FROM device_links d

        INNER JOIN users u
          ON u.id =
             d.user_id

        WHERE
          d.code_hash = ?

        LIMIT 1
        `
      )
      .bind(
        codeHash
      )
      .first();


  const now =
    nowSeconds();


  if (

    !row ||

    row.used_at !==
      null ||

    Number(
      row.expires_at
    ) <=
      now ||

    row.status !==
      "active"

  ) {

    throw new HttpError(
      409,
      "pairing_unavailable"
    );

  }


  const session =
    await createSessionValues(
      request,
      env,
      "Paired device"
    );


  /*
   * device_links.used_by_session_id references sessions.id,
   * so FK validation is deferred until the Session exists.
   */
  const results =
    await env.AUTH_DB
      .batch([

        env.AUTH_DB
          .prepare(
            `PRAGMA defer_foreign_keys = ON`
          ),


        env.AUTH_DB
          .prepare(
            `
            UPDATE device_links

            SET
              used_at =
                ?,

              used_by_session_id =
                ?

            WHERE
              id = ?

            AND
              used_at IS NULL

            AND
              expires_at > ?

            AND EXISTS (

              SELECT 1

              FROM users

              WHERE
                id = ?

              AND
                status =
                  'active'

            )
            `
          )
          .bind(

            now,

            session.sessionId,

            row.id,

            now,

            row.user_id

          ),


        env.AUTH_DB
          .prepare(
            `
            INSERT INTO sessions (

              id,
              user_id,
              token_hash,
              created_at,
              last_seen_at,
              expires_at,
              revoked_at,
              ip_hash,
              user_agent_hash,
              device_label

            )

            SELECT

              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              NULL,
              ?,
              ?,
              ?

            WHERE EXISTS (

              SELECT 1

              FROM device_links

              WHERE
                id = ?

              AND
                used_by_session_id = ?

              AND
                used_at = ?

            )
            `
          )
          .bind(

            session.sessionId,

            row.user_id,

            session.tokenHash,

            now,

            now,

            session.expiresAt,

            session
              .fingerprint
              .ipHash,

            session
              .fingerprint
              .userAgentHash,

            session.deviceLabel,

            row.id,

            session.sessionId,

            now

          ),


        env.AUTH_DB
          .prepare(
            `
            UPDATE users

            SET

              last_login_at =
                ?,

              updated_at =
                ?

            WHERE
              id = ?
            `
          )
          .bind(

            now,

            now,

            row.user_id

          ),


        env.AUTH_DB
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

            SELECT

              ?,
              ?,
              ?,
              'device_link.redeem',
              'device_link',
              ?,
              NULL,
              ?,
              ?

            WHERE EXISTS (

              SELECT 1

              FROM sessions

              WHERE
                id = ?

            )
            `
          )
          .bind(

            createId(
              "audit"
            ),

            row.user_id,

            session.sessionId,

            row.id,

            session
              .fingerprint
              .ipHash,

            now,

            session.sessionId

          ),


        env.AUTH_DB
          .prepare(
            `PRAGMA defer_foreign_keys = OFF`
          )

      ]);


  if (

    changes(
      results[1]
    ) !==
      1 ||

    changes(
      results[2]
    ) !==
      1

  ) {

    throw new HttpError(
      409,
      "pairing_unavailable"
    );

  }


  const user =
    await getUserById(
      env,
      row.user_id
    );


  return withSessionCookie(

    jsonResponse({

      ok:
        true,

      authenticated:
        true,

      user:
        publicUser(
          user
        )

    }),

    session.rawToken,

    env

  );

}


async function handleAccountSessions(
  request,
  env
) {

  const auth =
    await authenticate(
      request,
      env
    );


  const rows =
    await listUserSessions(
      env,
      auth.user.id
    );


  const sessions =
    rows.map(
      row => ({

        id:
          row.id,

        createdAt:
          row.created_at,

        lastSeenAt:
          row.last_seen_at,

        expiresAt:
          row.expires_at,

        revokedAt:
          row.revoked_at,

        deviceLabel:
          row.device_label,

        current:
          row.id ===
          auth.session.id

      })
    );


  return withAuthRefresh(

    jsonResponse({
      sessions
    }),

    auth,

    env

  );

}


async function handleRevokeOwnSession(
  request,
  env,
  sessionId
) {

  requireSameOrigin(
    request
  );


  const auth =
    await authenticate(
      request,
      env
    );


  const now =
    nowSeconds();


  const context =
    await auditContext(
      request,
      env,
      auth
    );


  const results =
    await env.AUTH_DB
      .batch([

        env.AUTH_DB
          .prepare(
            `
            UPDATE sessions

            SET
              revoked_at =
                COALESCE(
                  revoked_at,
                  ?
                )

            WHERE
              id = ?

            AND
              user_id = ?

            AND
              revoked_at IS NULL
            `
          )
          .bind(

            now,

            sessionId,

            auth.user.id

          ),


        auditStatement(

          env,

          {
            ...context,

            action:
              "session.revoke_own",

            targetType:
              "session",

            targetId:
              sessionId,

            createdAt:
              now
          }

        )

      ]);


  if (
    changes(
      results[0]
    ) !==
    1
  ) {

    throw new HttpError(
      404,
      "session_not_found"
    );

  }


  const response =
    jsonResponse({
      ok:
        true
    });


  return (
    sessionId ===
      auth.session.id

      ? withClearedSessionCookie(
          response,
          env
        )

      : withAuthRefresh(
          response,
          auth,
          env
        )
  );

}


async function handleAudit(
  request,
  env
) {

  const auth =
    await authenticate(
      request,
      env
    );


  requirePermission(
    auth,
    "manageSystem"
  );


  const rows =
    await listAuditLogs(
      env,
      100
    );


  const logs =
    rows.map(
      row => {

        let metadata =
          null;


        if (
          row.metadata_json
        ) {

          try {

            metadata =
              JSON.parse(
                row.metadata_json
              );

          } catch {

            metadata =
              null;

          }

        }


        return {

          id:
            row.id,

          actorUserId:
            row.actor_user_id,

          actorSessionId:
            row.actor_session_id,

          action:
            row.action,

          targetType:
            row.target_type,

          targetId:
            row.target_id,

          metadata,

          createdAt:
            row.created_at

        };

      }
    );


  return withAuthRefresh(

    jsonResponse({
      logs
    }),

    auth,

    env

  );

}


async function route(
  request,
  env
) {

  const url =
    new URL(
      request.url
    );


  const pathname =
    url.pathname;


  const method =
    request.method
      .toUpperCase();


  if (
    pathname ===
    "/"
  ) {

    if (
      method !==
      "GET"
    ) {

      return methodNotAllowed([
        "GET"
      ]);

    }


    return renderHome();

  }


  if (
    pathname ===
    "/setup"
  ) {

    if (
      method !==
      "GET"
    ) {

      return methodNotAllowed([
        "GET"
      ]);

    }


    return (
      await isBootstrapped(
        env
      )

        ? renderSetupComplete()

        : renderSetupPending()
    );

  }


  if (
    pathname ===
    "/activate"
  ) {

    if (
      method !==
      "GET"
    ) {

      return methodNotAllowed([
        "GET"
      ]);

    }


    return renderActivate(
      env
    );

  }


  if (
    pathname ===
    "/device"
  ) {

    if (
      method !==
      "GET"
    ) {

      return methodNotAllowed([
        "GET"
      ]);

    }


    return renderDevice(
      env
    );

  }


  if (
    pathname ===
    "/recover"
  ) {

    if (
      method !==
      "GET"
    ) {

      return methodNotAllowed([
        "GET"
      ]);

    }


    return renderRecover(
      env
    );

  }


  if (
    pathname ===
    "/owner-recover"
  ) {

    if (
      method !==
      "GET"
    ) {

      return methodNotAllowed([
        "GET"
      ]);

    }


    return renderOwnerRecover(
      env
    );

  }


  if (
    pathname ===
    "/account"
  ) {

    if (
      method !==
      "GET"
    ) {

      return methodNotAllowed([
        "GET"
      ]);

    }


    const auth =
      await authenticate(
        request,
        env
      );


    return withAuthRefresh(

      renderAccount(
        auth.user
      ),

      auth,

      env

    );

  }


  if (
    pathname ===
    "/admin"
  ) {

    if (
      method !==
      "GET"
    ) {

      return methodNotAllowed([
        "GET"
      ]);

    }


    const auth =
      await authenticate(
        request,
        env
      );


    requirePermission(
      auth,
      "manageUsers"
    );


    requirePermission(
      auth,
      "manageInvites"
    );


    return withAuthRefresh(

      renderAdmin(
        auth.user
      ),

      auth,

      env

    );

  }


  if (
    pathname ===
    "/api/health"
  ) {

    if (
      method !==
      "GET"
    ) {

      return methodNotAllowed([
        "GET"
      ]);

    }


    return handleHealth(
      env
    );

  }


  if (
    pathname ===
    "/api/bootstrap"
  ) {

    if (
      method !==
      "POST"
    ) {

      return methodNotAllowed([
        "POST"
      ]);

    }


    return handleBootstrap(
      request,
      env
    );

  }


  if (
    pathname ===
    "/api/auth/me"
  ) {

    if (
      method !==
      "GET"
    ) {

      return methodNotAllowed([
        "GET"
      ]);

    }


    return handleMe(
      request,
      env
    );

  }


  if (
    pathname ===
    "/api/auth/logout"
  ) {

    if (
      method !==
      "POST"
    ) {

      return methodNotAllowed([
        "POST"
      ]);

    }


    return handleLogout(
      request,
      env
    );

  }


  if (
    pathname ===
    "/api/auth/logout-all"
  ) {

    if (
      method !==
      "POST"
    ) {

      return methodNotAllowed([
        "POST"
      ]);

    }


    return handleLogoutAll(
      request,
      env
    );

  }


  if (
    pathname ===
    "/api/invites/redeem"
  ) {

    if (
      method !==
      "POST"
    ) {

      return methodNotAllowed([
        "POST"
      ]);

    }


    return handleRedeemInvite(
      request,
      env
    );

  }


  if (
    pathname ===
    "/api/device-links"
  ) {

    if (
      method !==
      "POST"
    ) {

      return methodNotAllowed([
        "POST"
      ]);

    }


    return handleCreateDeviceLink(
      request,
      env
    );

  }


  if (
    pathname ===
    "/api/device-links/redeem"
  ) {

    if (
      method !==
      "POST"
    ) {

      return methodNotAllowed([
        "POST"
      ]);

    }


    return handleRedeemDeviceLink(
      request,
      env
    );

  }


  if (
    pathname ===
    "/api/recovery/redeem"
  ) {

    if (
      method !==
      "POST"
    ) {

      return methodNotAllowed([
        "POST"
      ]);

    }


    return handleRedeemRecovery(
      request,
      env
    );

  }


  if (
    pathname ===
    "/api/owner/recover"
  ) {

    if (
      method !==
      "POST"
    ) {

      return methodNotAllowed([
        "POST"
      ]);

    }


    return handleOwnerRecovery(
      request,
      env
    );

  }


  if (
    pathname ===
    "/api/account/sessions"
  ) {

    if (
      method !==
      "GET"
    ) {

      return methodNotAllowed([
        "GET"
      ]);

    }


    return handleAccountSessions(
      request,
      env
    );

  }


  const ownSessionMatch =
    pathname.match(
      /^\/api\/account\/sessions\/([^/]+)\/revoke$/
    );


  if (
    ownSessionMatch
  ) {

    if (
      method !==
      "POST"
    ) {

      return methodNotAllowed([
        "POST"
      ]);

    }


    return handleRevokeOwnSession(

      request,

      env,

      decodeURIComponent(
        ownSessionMatch[1]
      )

    );

  }


  if (
    pathname ===
    "/api/admin/invites"
  ) {

    if (
      method ===
      "GET"
    ) {

      return handleListInvites(
        request,
        env
      );

    }


    if (
      method ===
      "POST"
    ) {

      return handleCreateInvite(
        request,
        env
      );

    }


    return methodNotAllowed([
      "GET",
      "POST"
    ]);

  }


  const inviteRevokeMatch =
    pathname.match(
      /^\/api\/admin\/invites\/([^/]+)\/revoke$/
    );


  if (
    inviteRevokeMatch
  ) {

    if (
      method !==
      "POST"
    ) {

      return methodNotAllowed([
        "POST"
      ]);

    }


    return handleRevokeInvite(

      request,

      env,

      decodeURIComponent(
        inviteRevokeMatch[1]
      )

    );

  }


  if (
    pathname ===
    "/api/admin/users"
  ) {

    if (
      method !==
      "GET"
    ) {

      return methodNotAllowed([
        "GET"
      ]);

    }


    return handleListUsers(
      request,
      env
    );

  }


  const userUpdateMatch =
    pathname.match(
      /^\/api\/admin\/users\/([^/]+)$/
    );


  if (
    userUpdateMatch
  ) {

    if (
      method !==
      "PATCH"
    ) {

      return methodNotAllowed([
        "PATCH"
      ]);

    }


    return handleUpdateUser(

      request,

      env,

      decodeURIComponent(
        userUpdateMatch[1]
      )

    );

  }


  const userSessionsMatch =
    pathname.match(
      /^\/api\/admin\/users\/([^/]+)\/sessions$/
    );


  if (
    userSessionsMatch
  ) {

    if (
      method !==
      "GET"
    ) {

      return methodNotAllowed([
        "GET"
      ]);

    }


    return handleAdminUserSessions(

      request,

      env,

      decodeURIComponent(
        userSessionsMatch[1]
      )

    );

  }


  const adminSessionRevokeMatch =
    pathname.match(
      /^\/api\/admin\/sessions\/([^/]+)\/revoke$/
    );


  if (
    adminSessionRevokeMatch
  ) {

    if (
      method !==
      "POST"
    ) {

      return methodNotAllowed([
        "POST"
      ]);

    }


    return handleAdminRevokeSession(

      request,

      env,

      decodeURIComponent(
        adminSessionRevokeMatch[1]
      )

    );

  }


  const userRecoveryMatch =
    pathname.match(
      /^\/api\/admin\/users\/([^/]+)\/recovery$/
    );


  if (
    userRecoveryMatch
  ) {

    if (
      method !==
      "POST"
    ) {

      return methodNotAllowed([
        "POST"
      ]);

    }


    return handleCreateRecovery(

      request,

      env,

      decodeURIComponent(
        userRecoveryMatch[1]
      )

    );

  }


  const userRevokeAllMatch =
    pathname.match(
      /^\/api\/admin\/users\/([^/]+)\/sessions\/revoke-all$/
    );


  if (
    userRevokeAllMatch
  ) {

    if (
      method !==
      "POST"
    ) {

      return methodNotAllowed([
        "POST"
      ]);

    }


    return handleAdminRevokeAllSessions(

      request,

      env,

      decodeURIComponent(
        userRevokeAllMatch[1]
      )

    );

  }


  if (
    pathname ===
    "/api/admin/audit"
  ) {

    if (
      method !==
      "GET"
    ) {

      return methodNotAllowed([
        "GET"
      ]);

    }


    return handleAudit(
      request,
      env
    );

  }


  return notFound();

}


export default {

  async fetch(
    request,
    env
  ) {

    try {

      return await route(
        request,
        env
      );

    } catch (error) {

      if (
        error instanceof
        HttpError
      ) {

        let response =
          jsonResponse(
            {
              error:
                error.code
            },
            error.status
          );


        if (
          error.clearSession
        ) {

          response =
            withClearedSessionCookie(
              response,
              env
            );

        }


        return response;

      }


      console.error(
        "Unhandled auth error:",
        error
      );


      return jsonResponse(
        {
          error:
            "internal_error"
        },
        500
      );

    }

  }

};
