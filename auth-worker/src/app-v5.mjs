import appV4
from "./app-v4.mjs";


import {
  generateRecoveryCode,
  normalizePublicCode
} from "./codes.mjs";


import {
  nowSeconds,
  hashSecret,
  createId,
  getRequestFingerprint
} from "./crypto.mjs";


import {
  auditStatement
} from "./db.mjs";


const AUTH_UX_SCRIPT =
  `<script src="/auth-ux-v5.js?v=20260820-auth-recovery-ui-v6" defer></script>`;


const UPLOAD_STATUS_SCRIPT =
  `<script src="/upload-status-v2.js?v=20260820-upload-status-v2" defer></script>`;


function jsonResponse(
  data,
  status = 200
) {

  return new Response(
    JSON.stringify(
      data
    ),
    {
      status,

      headers: {
        "Content-Type":
          "application/json; charset=utf-8",

        "Cache-Control":
          "no-store, max-age=0",

        "Pragma":
          "no-cache"
      }
    }
  );

}


function methodNotAllowed(
  methods
) {

  return new Response(
    null,
    {
      status:
        405,

      headers: {
        Allow:
          methods.join(
            ", "
          ),

        "Cache-Control":
          "no-store, max-age=0"
      }
    }
  );

}


function cloneWithCookie(
  response,
  cookie
) {

  if (
    !cookie
  ) {

    return response;
  }


  const headers =
    new Headers(
      response.headers
    );


  headers.append(
    "Set-Cookie",
    cookie
  );


  return new Response(
    response.body,
    {
      status:
        response.status,

      statusText:
        response.statusText,

      headers
    }
  );

}


function sameOriginAllowed(
  request
) {

  const origin =
    request.headers.get(
      "Origin"
    );


  if (
    !origin
  ) {

    return true;
  }


  let expected;


  try {

    expected =
      new URL(
        request.url
      ).origin;

  } catch {

    return false;
  }


  return (
    origin ===
    expected
  );

}


async function authenticateThroughV4(
  request,
  env,
  ctx
) {

  const url =
    new URL(
      request.url
    );


  url.pathname =
    "/api/auth/me";


  url.search =
    "";


  const headers =
    new Headers(
      request.headers
    );


  headers.set(
    "Accept",
    "application/json"
  );


  headers.delete(
    "Content-Length"
  );


  const authRequest =
    new Request(
      url.toString(),
      {
        method:
          "GET",

        headers
      }
    );


  const response =
    await appV4.fetch(
      authRequest,
      env,
      ctx
    );


  const cookie =
    response.headers.get(
      "Set-Cookie"
    );


  if (
    !response.ok
  ) {

    return {
      ok:
        false,

      cookie
    };
  }


  const data =
    await response
      .json()
      .catch(
        () => ({})
      );


  if (
    !data?.authenticated ||
    !data?.user ||
    data.user.status !==
      "active"
  ) {

    return {
      ok:
        false,

      cookie
    };
  }


  return {
    ok:
      true,

    cookie,

    user:
      data.user,

    session:
      data.session ||
      null
  };

}


function canManageUsers(
  authentication
) {

  return Boolean(
    authentication?.user &&
    authentication.user.status ===
      "active" &&
    authentication.user.role ===
      "owner" &&
    authentication.user.permissions
      ?.manageUsers ===
      true
  );

}


function selfRecoveryTtlDays(
  env
) {

  const configured =
    Number(
      env.SELF_RECOVERY_TTL_DAYS
    );


  const days =
    Number.isFinite(
      configured
    )

      ? Math.trunc(
          configured
        )

      : 180;


  return Math.min(
    365,
    Math.max(
      7,
      days
    )
  );

}


function ownerRecoveryTtlSeconds(
  env
) {

  const configured =
    Number(
      env.RECOVERY_TTL_MINUTES
    );


  const minutes =
    Number.isFinite(
      configured
    )

      ? Math.trunc(
          configured
        )

      : 30;


  const safeMinutes =
    Math.min(
      240,
      Math.max(
        5,
        minutes
      )
    );


  return (
    safeMinutes *
    60
  );

}


async function handleCreateSelfRecovery(
  request,
  env,
  ctx
) {

  if (
    request.method
      .toUpperCase() !==
    "POST"
  ) {

    return methodNotAllowed([
      "POST"
    ]);
  }


  if (
    !sameOriginAllowed(
      request
    )
  ) {

    return jsonResponse(
      {
        error:
          "cross_origin_request"
      },
      403
    );
  }


  const authentication =
    await authenticateThroughV4(
      request,
      env,
      ctx
    );


  if (
    !authentication.ok
  ) {

    return cloneWithCookie(
      jsonResponse(
        {
          error:
            "authentication_required"
        },
        401
      ),
      authentication.cookie
    );
  }


  const user =
    authentication.user;


  const code =
    generateRecoveryCode();


  const normalized =
    normalizePublicCode(
      code
    );


  const codeHash =
    await hashSecret(
      env,
      "recovery",
      normalized
    );


  const now =
    nowSeconds();


  const ttlDays =
    selfRecoveryTtlDays(
      env
    );


  const expiresAt =
    now +
    ttlDays *
    86400;


  const recoveryId =
    createId(
      "rec"
    );


  const fingerprint =
    await getRequestFingerprint(
      request,
      env
    );


  await env.AUTH_DB
    .batch([

      env.AUTH_DB
        .prepare(
          `
          DELETE FROM
            recovery_codes

          WHERE
            user_id = ?

          AND
            used_at IS NULL

          AND
            created_by_user_id =
            user_id
          `
        )
        .bind(
          user.id
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

          user.id,

          codeHash,

          user.id,

          now,

          expiresAt

        ),


      auditStatement(
        env,
        {
          actorUserId:
            user.id,

          actorSessionId:
            authentication
              .session
              ?.id ||
            null,

          action:
            "recovery.create_self",

          targetType:
            "user",

          targetId:
            user.id,

          metadata: {

            recoveryId,

            expiresAt,

            ttlDays,

            kind:
              "backup_login_code",

            mode:
              "self_service"

          },

          ipHash:
            fingerprint.ipHash,

          createdAt:
            now
        }
      )

    ]);


  return cloneWithCookie(
    jsonResponse(
      {
        ok:
          true,

        recoveryCode:
          code,

        expiresAt,

        expiresInDays:
          ttlDays,

        kind:
          "backup_login_code"
      },
      201
    ),
    authentication.cookie
  );

}


async function handleCreateOwnerRecovery(
  request,
  env,
  ctx,
  userId
) {

  if (
    request.method
      .toUpperCase() !==
    "POST"
  ) {

    return methodNotAllowed([
      "POST"
    ]);
  }


  if (
    !sameOriginAllowed(
      request
    )
  ) {

    return jsonResponse(
      {
        error:
          "cross_origin_request"
      },
      403
    );
  }


  const authentication =
    await authenticateThroughV4(
      request,
      env,
      ctx
    );


  if (
    !authentication.ok
  ) {

    return cloneWithCookie(
      jsonResponse(
        {
          error:
            "authentication_required"
        },
        401
      ),
      authentication.cookie
    );
  }


  if (
    !canManageUsers(
      authentication
    )
  ) {

    return cloneWithCookie(
      jsonResponse(
        {
          error:
            "permission_denied"
        },
        403
      ),
      authentication.cookie
    );
  }


  const target =
    await env.AUTH_DB
      .prepare(
        `
        SELECT

          id,
          role,
          status

        FROM users

        WHERE
          id = ?

        LIMIT 1
        `
      )
      .bind(
        userId
      )
      .first();


  if (
    !target
  ) {

    return cloneWithCookie(
      jsonResponse(
        {
          error:
            "user_not_found"
        },
        404
      ),
      authentication.cookie
    );
  }


  if (
    target.role ===
    "owner"
  ) {

    return cloneWithCookie(
      jsonResponse(
        {
          error:
            "owner_recovery_not_supported_here"
        },
        403
      ),
      authentication.cookie
    );
  }


  if (
    target.status !==
    "active"
  ) {

    return cloneWithCookie(
      jsonResponse(
        {
          error:
            "user_not_active"
        },
        409
      ),
      authentication.cookie
    );
  }


  const code =
    generateRecoveryCode();


  const normalized =
    normalizePublicCode(
      code
    );


  const codeHash =
    await hashSecret(
      env,
      "recovery",
      normalized
    );


  const now =
    nowSeconds();


  const expiresAt =
    now +
    ownerRecoveryTtlSeconds(
      env
    );


  const recoveryId =
    createId(
      "rec"
    );


  const fingerprint =
    await getRequestFingerprint(
      request,
      env
    );


  await env.AUTH_DB
    .batch([

      env.AUTH_DB
        .prepare(
          `
          DELETE FROM
            recovery_codes

          WHERE
            user_id = ?

          AND
            used_at IS NULL

          AND
            created_by_user_id <>
            user_id
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

          authentication.user.id,

          now,

          expiresAt

        ),


      auditStatement(
        env,
        {
          actorUserId:
            authentication.user.id,

          actorSessionId:
            authentication
              .session
              ?.id ||
            null,

          action:
            "recovery.create",

          targetType:
            "user",

          targetId:
            userId,

          metadata: {

            recoveryId,

            expiresAt,

            kind:
              "owner_recovery_code",

            mode:
              "owner_emergency"

          },

          ipHash:
            fingerprint.ipHash,

          createdAt:
            now
        }
      )

    ]);


  return cloneWithCookie(
    jsonResponse(
      {
        ok:
          true,

        recoveryCode:
          code,

        expiresAt,

        kind:
          "owner_recovery_code"
      },
      201
    ),
    authentication.cookie
  );

}


function enhancementScripts(
  pathname
) {

  const scripts =
    [];


  if (
    pathname ===
      "/" ||
    pathname ===
      "/index.html"
  ) {

    scripts.push(
      AUTH_UX_SCRIPT,
      UPLOAD_STATUS_SCRIPT
    );
  }


  if (
    pathname ===
      "/login" ||
    pathname ===
      "/login/" ||
    pathname ===
      "/owner-login" ||
    pathname ===
      "/owner-login/" ||
    pathname ===
      "/recover" ||
    pathname ===
      "/recover/" ||
    pathname ===
      "/device" ||
    pathname ===
      "/device/" ||
    pathname ===
      "/owner-recover" ||
    pathname ===
      "/owner-recover/" ||
    pathname ===
      "/account" ||
    pathname ===
      "/account/"
  ) {

    scripts.push(
      AUTH_UX_SCRIPT
    );
  }


  return [
    ...new Set(
      scripts
    )
  ];

}


function enhanceHtml(
  request,
  response,
  scripts
) {

  if (
    request.method
      .toUpperCase() !==
      "GET" ||
    response.status !==
      200 ||
    scripts.length ===
      0
  ) {

    return response;
  }


  const contentType =
    response.headers.get(
      "Content-Type"
    ) ||
    "";


  if (
    !contentType
      .toLowerCase()
      .includes(
        "text/html"
      )
  ) {

    return response;
  }


  const html =
    scripts.join(
      "\n"
    );


  return new HTMLRewriter()

    .on(
      "head",
      {
        element(
          element
        ) {

          element.append(
            html,
            {
              html:
                true
            }
          );

        }
      }
    )

    .transform(
      response
    );

}


export default {

  async fetch(
    request,
    env,
    ctx
  ) {

    const url =
      new URL(
        request.url
      );


    const pathname =
      url.pathname;


    try {

      if (
        pathname ===
          "/api/account/recovery-code"
      ) {

        return await handleCreateSelfRecovery(
          request,
          env,
          ctx
        );

      }


      const ownerRecoveryMatch =
        pathname.match(
          /^\/api\/admin\/users\/([^/]+)\/recovery$/
        );


      if (
        ownerRecoveryMatch
      ) {

        return await handleCreateOwnerRecovery(
          request,
          env,
          ctx,
          decodeURIComponent(
            ownerRecoveryMatch[1]
          )
        );

      }


      let response =
        await appV4.fetch(
          request,
          env,
          ctx
        );


      const scripts =
        enhancementScripts(
          pathname
        );


      response =
        enhanceHtml(
          request,
          response,
          scripts
        );


      return response;

    } catch (
      error
    ) {

      console.error(
        "Jingyan app-v5 error:",
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
