import {
  OWNER_PERMISSIONS,
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
  HttpError,
  jsonResponse,
  htmlResponse,
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
  getUserById,
  getSessionByTokenHash,
  refreshSession,
  auditStatement,
  insertAudit
} from "./db.mjs";


function changes(result) {
  return Number(
    result?.meta?.changes ||
    0
  );
}


function validateDisplayName(
  value
) {
  const text =
    String(
      value || ""
    ).trim();

  if (
    text.length < 1 ||
    text.length > 80
  ) {
    throw new HttpError(
      400,
      "invalid_display_name"
    );
  }

  return text;
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


async function enforceBootstrapRateLimit(
  request,
  env
) {
  if (
    !env.AUTH_RATE_LIMITER?.limit
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

  const result =
    await env.AUTH_RATE_LIMITER
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
    ) <= now ||
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
      publicUser(row),

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
  return auth?.refreshCookie
    ? withSessionCookie(
        response,
        auth.rawToken,
        env
      )
    : response;
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


async function handleHealth(
  env
) {
  return jsonResponse({
    ok: true,

    service:
      "jingyan-media-app",

    authVersion:
      "1.0",

    bootstrapped:
      await isBootstrapped(
        env
      )
  });
}


async function handleSetupPage(
  env
) {
  if (
    await isBootstrapped(
      env
    )
  ) {
    return htmlResponse(
      `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Jingyan Media Auth</title>

<body style="font-family:system-ui;max-width:720px;margin:48px auto;padding:0 20px">

<h1>认证系统已初始化</h1>

<p>Owner 已创建。此入口不会再次创建 Owner。</p>

<p>
<a href="/api/auth/me">
检查当前登录状态
</a>
</p>

</body>`,

      200,

      {
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'"
      }
    );
  }

  return htmlResponse(
    `<!doctype html>
<html lang="zh-CN">

<meta charset="utf-8">

<meta name="viewport"
content="width=device-width,initial-scale=1">

<title>
初始化 Jingyan Media Owner
</title>

<body style="font-family:system-ui;max-width:720px;margin:48px auto;padding:0 20px">

<h1>
初始化 Owner
</h1>

<p>
此页面只在系统尚未初始化时有效。
</p>

<form id="form">

<label>
显示名称

<input
id="name"
required
maxlength="80"
value="JINGTING0714"
style="display:block;width:100%;box-sizing:border-box;padding:10px;margin:8px 0 18px">
</label>

<label>
Bootstrap Secret

<input
id="secret"
type="password"
required
autocomplete="off"
style="display:block;width:100%;box-sizing:border-box;padding:10px;margin:8px 0 18px">
</label>

<button
type="submit"
style="padding:10px 18px">

创建 Owner

</button>

</form>

<pre
id="result"
style="white-space:pre-wrap;margin-top:24px">
</pre>

<script>

const form =
  document.getElementById(
    "form"
  );

const result =
  document.getElementById(
    "result"
  );

form.addEventListener(
  "submit",

  async event => {

    event.preventDefault();

    result.textContent =
      "处理中…";

    const response =
      await fetch(
        "/api/bootstrap",

        {
          method:
            "POST",

          credentials:
            "same-origin",

          headers: {
            "Content-Type":
              "application/json",

            "X-Bootstrap-Secret":
              document
                .getElementById(
                  "secret"
                )
                .value
          },

          body:
            JSON.stringify({
              displayName:
                document
                  .getElementById(
                    "name"
                  )
                  .value
            })
        }
      );

    const data =
      await response.json();

    result.textContent =
      JSON.stringify(
        data,
        null,
        2
      );

    if (
      response.ok
    ) {
      setTimeout(
        () => {
          location.href =
            "/api/auth/me";
        },
        800
      );
    }
  }
);

</script>

</body>`,

    200,

    {
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
    }
  );
}


async function handleBootstrap(
  request,
  env
) {
  await enforceBootstrapRateLimit(
    request,
    env
  );

  const configuredSecret =
    String(
      env.BOOTSTRAP_SECRET ||
      ""
    );

  if (!configuredSecret) {
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

  const now =
    nowSeconds();

  const userId =
    createId(
      "usr"
    );

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

  const permissionsJson =
    JSON.stringify(
      OWNER_PERMISSIONS
    );

  const results =
    await env.AUTH_DB.batch([
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
            WHERE
              key = 'owner_user_id'
          )
          `
        )
        .bind(
          userId,
          displayName,
          permissionsJson,
          now,
          now,
          now
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

          WHERE
            EXISTS (
              SELECT 1
              FROM users
              WHERE id = ?
            )

            AND NOT EXISTS (
              SELECT 1
              FROM system_state
              WHERE
                key = 'owner_user_id'
            )
          `
        )
        .bind(
          userId,
          now,
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
            'Owner bootstrap'

          WHERE EXISTS (
            SELECT 1
            FROM system_state

            WHERE
              key =
                'owner_user_id'

              AND value = ?
          )
          `
        )
        .bind(
          sessionId,
          userId,
          tokenHash,
          now,
          now,
          expiresAt,
          fingerprint.ipHash,
          fingerprint.userAgentHash,
          userId
        )
    ]);

  if (
    changes(
      results[0]
    ) !== 1 ||

    changes(
      results[1]
    ) !== 1 ||

    changes(
      results[2]
    ) !== 1
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
        sessionId,

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
        fingerprint.ipHash,

      createdAt:
        now
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
        ok: true,

        user:
          publicUser(user)
      },
      201
    ),

    rawToken,

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

  await env.AUTH_DB.batch([
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
      ok: true
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

  await env.AUTH_DB.batch([
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

          AND revoked_at
            IS NULL
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

          AND used_at
            IS NULL
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
      ok: true
    }),

    env
  );
}


async function route(
  request,
  env
) {
  const {
    pathname
  } =
    new URL(
      request.url
    );

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

    return jsonResponse({
      service:
        "jingyan-media-app",

      health:
        "/api/health",

      setup:
        "/setup"
    });
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

    return handleSetupPage(
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
