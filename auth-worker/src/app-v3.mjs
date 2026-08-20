import appV2
from "./app-v2.mjs";


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


const HOME_HEAD =
  `<script src="/upload-convenience.js?v=20260820-history-v2" defer></script>`;


const AUTH_HEAD =
  `<script src="/login-v3.js?v=20260820-login-v4" defer></script>`;


const ACCOUNT_HEAD =
  `<script src="/account-access.js?v=20260820-account-access-v1" defer></script>`;


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


function enhancementForPath(
  pathname
) {

  if (
    pathname ===
      "/" ||
    pathname ===
      "/index.html"
  ) {

    return HOME_HEAD;
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
      "/device/"
  ) {

    return AUTH_HEAD;
  }


  if (
    pathname ===
      "/account" ||
    pathname ===
      "/account/"
  ) {

    return ACCOUNT_HEAD;
  }


  return null;
}


function canEnhance(
  request,
  response,
  enhancement
) {

  if (
    !enhancement
  ) {

    return false;
  }


  if (
    request.method
      .toUpperCase() !==
    "GET"
  ) {

    return false;
  }


  if (
    response.status !==
    200
  ) {

    return false;
  }


  const contentType =
    response.headers.get(
      "Content-Type"
    ) || "";


  return contentType
    .toLowerCase()
    .includes(
      "text/html"
    );
}


function injectHead(
  response,
  html
) {

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


function sameOriginAllowed(
  request
) {

  const suppliedOrigin =
    request.headers.get(
      "Origin"
    );


  if (
    !suppliedOrigin
  ) {

    return true;
  }


  const expectedOrigin =
    new URL(
      request.url
    ).origin;


  return suppliedOrigin ===
    expectedOrigin;
}


async function authenticateThroughV2(
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
    await appV2.fetch(
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


function recoveryTtlDays(
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

    return new Response(
      null,
      {
        status:
          405,

        headers: {
          Allow:
            "POST"
        }
      }
    );
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
    await authenticateThroughV2(
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
    recoveryTtlDays(
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

      /*
       * 一个用户同时只保留一个未使用的备用 / 恢复码。
       *
       * 用户重新生成时：
       * 旧的未使用代码立即失效。
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


  const response =
    jsonResponse(
      {

        ok:
          true,

        recoveryCode:
          code,

        expiresAt,

        expiresInDays:
          ttlDays

      },
      201
    );


  return cloneWithCookie(
    response,
    authentication.cookie
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


    /*
     * ------------------------------------------------
     * AUTH V3
     * SELF-SERVICE BACKUP LOGIN CODE
     * ------------------------------------------------
     */

    if (
      pathname ===
        "/api/account/recovery-code"
    ) {

      try {

        return await handleCreateSelfRecovery(
          request,
          env,
          ctx
        );

      } catch (
        error
      ) {

        console.error(
          "Self recovery code error:",
          error
        );


        return jsonResponse(
          {
            error:
              "recovery_code_create_failed"
          },
          500
        );
      }
    }


    /*
     * ------------------------------------------------
     * EXISTING APPLICATION
     * ------------------------------------------------
     */

    const response =
      await appV2.fetch(
        request,
        env,
        ctx
      );


    const enhancement =
      enhancementForPath(
        pathname
      );


    if (
      !canEnhance(
        request,
        response,
        enhancement
      )
    ) {

      return response;
    }


    return injectHead(
      response,
      enhancement
    );
  }

};
