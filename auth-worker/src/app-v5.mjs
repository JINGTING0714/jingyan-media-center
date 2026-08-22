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
  `<script src="/auth-ux-v5.js?v=20260820-auth-recovery-v7" defer></script>`;


const UPLOAD_STATUS_SCRIPT =
  `<script src="/upload-status-v2.js?v=20260822-member-ui-v1" defer></script>`;


/*
 * =========================================================
 * BASIC RESPONSES
 * =========================================================
 */


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


/*
 * =========================================================
 * REQUEST SAFETY
 * =========================================================
 */


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


/*
 * =========================================================
 * AUTHENTICATION
 * =========================================================
 */


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


/*
 * =========================================================
 * RECOVERY TTL
 * =========================================================
 */


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


/*
 * =========================================================
 * SELF BACKUP LOGIN CODE
 * =========================================================
 */


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


  /*
   * 用户自己的备用登录码：
   *
   * created_by_user_id = user_id
   *
   * 重新生成时只替换用户自己的备用登录码。
   * Owner 为该用户签发的紧急恢复码不会在这里被删除。
   */
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


/*
 * =========================================================
 * OWNER -> MEMBER EMERGENCY RECOVERY CODE
 * =========================================================
 */


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


  /*
   * Owner 自己的系统级紧急恢复走 /owner-recover。
   * 这里仅用于 Owner 给普通成员签发临时恢复码。
   */
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


  /*
   * Owner 给成员签发的紧急恢复码：
   *
   * created_by_user_id != user_id
   *
   * 只替换 Owner 之前为这个用户签发的未使用恢复码。
   * 用户自己保存的备用登录码必须保留。
   */
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


/*
 * =========================================================
 * RECOVERY PAGE V7
 *
 * IMPORTANT:
 *
 * /recover is generated by pages.mjs.
 *
 * pages.mjs uses a strict nonce CSP, so an additional external
 * script injected afterwards cannot reliably rewrite this page.
 *
 * V7 therefore performs the distinction here, on the server,
 * with HTMLRewriter.
 * =========================================================
 */


function isRecoverPath(
  pathname
) {

  return (
    pathname ===
      "/recover" ||
    pathname ===
      "/recover/"
  );

}


function getRecoveryMode(
  request
) {

  const url =
    new URL(
      request.url
    );


  return (
    url.searchParams.get(
      "mode"
    ) ===
      "owner"

      ? "owner"

      : "backup"
  );

}


function recoveryPageCopy(
  mode
) {

  if (
    mode ===
    "owner"
  ) {

    return {

      documentTitle:
        "Owner 恢复码",

      eyebrow:
        "OWNER RECOVERY",

      title:
        "使用 Owner 恢复码。",

      intro:
        "当 Passkey、你自己保存的备用登录码和其他已登录设备都不可用时，输入 Owner 为你的原账户临时签发的一次性恢复码。",

      inputLabel:
        "Owner 恢复码",

      modeLabel:
        "Owner 签发 · 紧急恢复",

      modeDescription:
        "这是 Owner 为你的原账户临时签发的紧急凭据。它不是你平时自己保存的备用登录码。",

      security:
        "Owner 恢复码只用于紧急登录。验证成功后系统只会为原账户建立新的 Session，不会重新注册，也不会创建第二个用户。",

      switchText:
        "手里的是你自己以前保存的备用登录码？",

      switchHref:
        "/recover?mode=backup",

      switchLabel:
        "改用我的备用登录码",

      sideTitle:
        "Owner 恢复码怎么用",

      sideItems: [
        [
          "01",
          "正常方式全部不可用",
          "Passkey、备用登录码和已登录设备全部不可用时再使用。"
        ],
        [
          "02",
          "联系 Owner",
          "Owner 在管理后台为你的原账户签发临时恢复码。"
        ],
        [
          "03",
          "一次性使用",
          "成功登录后这枚恢复码立即失效。"
        ]
      ],

      sideFooter:
        "Owner 恢复码属于紧急恢复凭据。成功后建议立即进入「账户与安全」重新准备 Passkey 或新的个人备用登录码。"

    };

  }


  return {

    documentTitle:
      "备用登录码",

    eyebrow:
      "BACKUP ACCESS",

    title:
      "使用你的备用登录码。",

    intro:
      "输入你本人以前在「账户与安全」生成并保存的备用登录码。它不依赖另一台已登录设备，也不需要联系 Owner。",

    inputLabel:
      "备用登录码",

    modeLabel:
      "个人备份 · 自己保存",

    modeDescription:
      "这是你自己提前生成并保存的个人灾备登录凭据，与 Owner 临时签发的紧急恢复码分开管理。",

    security:
      "备用登录码只验证你对原账户的访问权。成功后系统会为当前浏览器建立新的 Session，不会修改媒体、图库、歌单或影集。",

    switchText:
      "手里的是 Owner 刚刚为你签发的紧急恢复码？",

    switchHref:
      "/recover?mode=owner",

    switchLabel:
      "改用 Owner 恢复码",

    sideTitle:
      "备用登录码怎么用",

    sideItems: [
      [
        "01",
        "提前生成",
        "在正常登录时进入「账户与安全」生成自己的备用登录码。"
      ],
      [
        "02",
        "由你自己保存",
        "建议放进可信的密码管理器或其他安全位置。"
      ],
      [
        "03",
        "换设备直接登录",
        "没有其他已登录设备在身边时，也可以直接恢复自己的原账户。"
      ]
    ],

    sideFooter:
      "备用登录码是你的个人灾备方式。重新生成新的备用登录码后，旧的个人备用码会失效，但不会删除 Owner 单独签发的紧急恢复码。"

  };

}


function recoveryModeNoticeHtml(
  copy
) {

  return `
<div
class="security-note"
data-recovery-mode-notice="true">

<strong>
${copy.modeLabel}
</strong>

<br>

${copy.modeDescription}

</div>
`;

}


function recoverySwitchHtml(
  copy
) {

  return `
<div
class="fallback-actions"
data-recovery-mode-switch="true">

<a
href="${copy.switchHref}"
class="secondary-button primary-soft">
${copy.switchLabel}
</a>

<a
href="/login"
class="secondary-button">
返回登录
</a>

</div>

<p class="small-print">
${copy.switchText}
</p>
`;

}


function recoverySideHtml(
  copy
) {

  const items =
    copy.sideItems
      .map(
        item => `
<div class="side-item">

<span class="side-icon">
${item[0]}
</span>

<div>

<strong>
${item[1]}
</strong>

<span>
${item[2]}
</span>

</div>

</div>
`
      )
      .join(
        ""
      );


  return `
<div>

<div class="eyebrow">
GUIDE
</div>

<h2 class="side-title">
${copy.sideTitle}
</h2>

<div class="side-list">
${items}
</div>

</div>

<div class="side-footer">
${copy.sideFooter}
</div>
`;

}


function enhanceRecoveryHtml(
  request,
  response
) {

  if (
    request.method
      .toUpperCase() !==
      "GET" ||
    response.status !==
      200
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


  const mode =
    getRecoveryMode(
      request
    );


  const copy =
    recoveryPageCopy(
      mode
    );


  return new HTMLRewriter()

    /*
     * 页面标题
     */
    .on(
      "title",
      {
        element(
          element
        ) {

          element.setInnerContent(
            `${copy.documentTitle} · Jingyan Media Center`
          );

        }
      }
    )


    /*
     * 主区域
     */
    .on(
      "main.auth-main",
      {
        element(
          element
        ) {

          element.setAttribute(
            "data-recovery-mode",
            mode
          );

        }
      }
    )


    .on(
      "main.auth-main .eyebrow",
      {
        element(
          element
        ) {

          element.setInnerContent(
            copy.eyebrow
          );

        }
      }
    )


    .on(
      "main.auth-main h1",
      {
        element(
          element
        ) {

          element.setInnerContent(
            copy.title
          );

        }
      }
    )


    .on(
      "main.auth-main .intro",
      {
        element(
          element
        ) {

          element.setInnerContent(
            copy.intro
          );

        }
      }
    )


    /*
     * 在表单前增加来源说明。
     */
    .on(
      "main.auth-main .flow-form",
      {
        element(
          element
        ) {

          element.before(
            recoveryModeNoticeHtml(
              copy
            ),
            {
              html:
                true
            }
          );

        }
      }
    )


    /*
     * 输入框
     */
    .on(
      'label[for="flowInput"]',
      {
        element(
          element
        ) {

          element.setInnerContent(
            copy.inputLabel
          );

        }
      }
    )


    .on(
      "#flowInput",
      {
        element(
          element
        ) {

          element.setAttribute(
            "aria-label",
            copy.inputLabel
          );


          element.setAttribute(
            "autocomplete",
            "one-time-code"
          );

        }
      }
    )


    /*
     * 原来的统一安全说明替换为当前模式说明。
     * 同时在下面增加切换入口。
     */
    .on(
      "main.auth-main .security-note",
      {
        element(
          element
        ) {

          /*
           * 我们自己新增的第一块 notice 不再重复修改。
           */
          const inserted =
            element.getAttribute(
              "data-recovery-mode-notice"
            );


          if (
            inserted ===
            "true"
          ) {

            return;
          }


          element.setInnerContent(
            copy.security
          );


          element.after(
            recoverySwitchHtml(
              copy
            ),
            {
              html:
                true
            }
          );

        }
      }
    )


    /*
     * 手机端位于主卡片之后的 GUIDE，
     * 电脑端位于右侧。
     */
    .on(
      "aside.auth-side",
      {
        element(
          element
        ) {

          element.setInnerContent(
            recoverySideHtml(
              copy
            ),
            {
              html:
                true
            }
          );

        }
      }
    )


    /*
     * app-v3 曾经为 recover 动态注入 login-v3.js。
     *
     * 该页面自身使用 nonce CSP，
     * 这里把不需要的外部补丁脚本删除，
     * 避免浏览器产生 CSP block。
     */
    .on(
      'script[src^="/login-v3.js"]',
      {
        element(
          element
        ) {

          element.remove();

        }
      }
    )


    .on(
      'script[src^="/auth-ux-v5.js"]',
      {
        element(
          element
        ) {

          element.remove();

        }
      }
    )


    .transform(
      response
    );

}


/*
 * =========================================================
 * GENERAL UI ENHANCEMENTS
 * =========================================================
 */


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


  /*
   * 注意：
   *
   * /recover 已经不在这里。
   *
   * Recover V7 完全使用服务器端 HTMLRewriter，
   * 不再依赖受 CSP 影响的外部脚本。
   */
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


/*
 * =========================================================
 * WORKER ENTRY
 * =========================================================
 */


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

      /*
       * -----------------------------------------------------
       * USER SELF BACKUP LOGIN CODE
       * -----------------------------------------------------
       */
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


      /*
       * -----------------------------------------------------
       * OWNER -> MEMBER EMERGENCY RECOVERY CODE
       * -----------------------------------------------------
       */
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


      /*
       * -----------------------------------------------------
       * STABLE APP
       * -----------------------------------------------------
       */
      let response =
        await appV4.fetch(
          request,
          env,
          ctx
        );


      /*
       * -----------------------------------------------------
       * RECOVERY V7
       *
       * 必须在普通 enhancementScript 之前。
       * 这一步完全是服务器端 HTML 重写。
       * -----------------------------------------------------
       */
      if (
        isRecoverPath(
          pathname
        )
      ) {

        response =
          enhanceRecoveryHtml(
            request,
            response
          );


        return response;

      }


      /*
       * -----------------------------------------------------
       * OTHER UI ENHANCEMENTS
       * -----------------------------------------------------
       */
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
