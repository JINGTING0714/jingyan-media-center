import {
  HttpError,
  jsonResponse,
  methodNotAllowed
} from "./http.mjs";


function requireOwner(auth) {

  if (
    !auth?.user ||
    auth.user.status !== "active" ||
    auth.user.role !== "owner" ||
    auth.user.permissions?.manageSystem !== true
  ) {

    throw new HttpError(
      403,
      "permission_denied"
    );
  }
}


function cleanError(error) {

  return String(
    error?.code ||
    error?.name ||
    "check_failed"
  )
    .replace(
      /[^A-Za-z0-9_.:-]/g,
      ""
    )
    .slice(
      0,
      80
    ) ||
    "check_failed";
}


async function check(task) {

  const started =
    Date.now();


  try {

    const value =
      await task();


    return {
      ok: true,

      latencyMs:
        Date.now() -
        started,

      value:
        value ?? null
    };

  } catch (error) {

    return {
      ok: false,

      latencyMs:
        Date.now() -
        started,

      error:
        cleanError(error)
    };
  }
}


async function manifestState(env) {

  const row =
    await env.MEDIA_DB
      .prepare(`
        SELECT value
        FROM sync_state
        WHERE key = 'manifest_state'
        LIMIT 1
      `)
      .first();


  if (!row?.value) {
    return null;
  }


  try {

    return JSON.parse(
      row.value
    );

  } catch {

    throw new Error(
      "invalid_manifest_state"
    );
  }
}


async function collectHealth(
  request,
  env
) {

  const authDb =
    await check(
      async () => {

        const row =
          await env.AUTH_DB
            .prepare(
              "SELECT 1 AS ok"
            )
            .first();


        if (
          Number(
            row?.ok
          ) !== 1
        ) {

          throw new Error(
            "auth_db_unhealthy"
          );
        }


        return true;
      }
    );


  const mediaDb =
    await check(
      async () => {

        const row =
          await env.MEDIA_DB
            .prepare(
              "SELECT 1 AS ok"
            )
            .first();


        if (
          Number(
            row?.ok
          ) !== 1
        ) {

          throw new Error(
            "media_db_unhealthy"
          );
        }


        return true;
      }
    );


  const assets =
    await check(
      async () => {

        const url =
          new URL(
            "/app-shell.css",
            request.url
          );


        const response =
          await env.ASSETS.fetch(
            new Request(
              url.toString(),
              {
                method:
                  "HEAD"
              }
            )
          );


        if (
          response.status >=
          500
        ) {

          throw new Error(
            "assets_unavailable"
          );
        }


        return {
          status:
            response.status
        };
      }
    );


  const staging =
    await check(
      async () => {

        await env.UPLOAD_STAGING
          .get(
            "__jingyan_healthcheck__"
          );


        return true;
      }
    );


  const incidents =
    await check(
      async () => {

        const row =
          await env.AUTH_DB
            .prepare(`
              SELECT
                COUNT(*) AS total,

                COALESCE(
                  SUM(
                    CASE
                      WHEN status = 'open'
                      THEN 1
                      ELSE 0
                    END
                  ),
                  0
                ) AS open,

                COALESCE(
                  SUM(
                    CASE
                      WHEN status = 'investigating'
                      THEN 1
                      ELSE 0
                    END
                  ),
                  0
                ) AS investigating

              FROM incidents
            `)
            .first();


        return {
          total:
            Number(
              row?.total || 0
            ),

          open:
            Number(
              row?.open || 0
            ),

          investigating:
            Number(
              row?.investigating || 0
            )
        };
      }
    );


  const media =
    await check(
      async () => {

        const row =
          await env.MEDIA_DB
            .prepare(`
              SELECT
                COUNT(*) AS total,

                COALESCE(
                  SUM(
                    CASE
                      WHEN status = 'published'
                      THEN 1
                      ELSE 0
                    END
                  ),
                  0
                ) AS published,

                COALESCE(
                  SUM(
                    CASE
                      WHEN status = 'trashed'
                      THEN 1
                      ELSE 0
                    END
                  ),
                  0
                ) AS trashed,

                COALESCE(
                  SUM(
                    CASE
                      WHEN status = 'missing'
                      THEN 1
                      ELSE 0
                    END
                  ),
                  0
                ) AS missing

              FROM media
            `)
            .first();


        return {
          total:
            Number(
              row?.total || 0
            ),

          published:
            Number(
              row?.published || 0
            ),

          trashed:
            Number(
              row?.trashed || 0
            ),

          missing:
            Number(
              row?.missing || 0
            )
        };
      }
    );


  const manifest =
    await check(
      () =>
        manifestState(
          env
        )
    );


  const bindings = {

    authDb:
      Boolean(
        env.AUTH_DB?.prepare
      ),

    mediaDb:
      Boolean(
        env.MEDIA_DB?.prepare
      ),

    assets:
      Boolean(
        env.ASSETS?.fetch
      ),

    uploadStaging:
      Boolean(
        env.UPLOAD_STAGING?.get
      ),

    rateLimiter:
      Boolean(
        env.AUTH_RATE_LIMITER
          ?.limit
      ),

    authPepper:
      Boolean(
        env.AUTH_PEPPER
      ),

    turnstile:
      Boolean(
        env.TURNSTILE_SECRET
      ),

    githubToken:
      Boolean(
        env.GITHUB_UPLOAD_TOKEN
      )
  };


  const config = {

    passkeyRpId:
      String(
        env.PASSKEY_RP_ID ||
        ""
      ),

    passkeyOrigin:
      String(
        env.PASSKEY_ORIGIN ||
        ""
      ),

    mediaCdn:
      String(
        env.MEDIA_CDN_BASE_URL ||
        ""
      ),

    githubRepo:
      (
        String(
          env.GITHUB_OWNER ||
          ""
        ) &&
        String(
          env.GITHUB_REPO ||
          ""
        )
      )
        ? (
            String(
              env.GITHUB_OWNER
            ) +
            "/" +
            String(
              env.GITHUB_REPO
            )
          )
        : "",

    uploadWorkflow:
      String(
        env.GITHUB_UPLOAD_WORKFLOW ||
        ""
      ),

    syncWorkflow:
      String(
        env.GITHUB_MEDIA_SYNC_WORKFLOW ||
        ""
      )
  };


  const requiredChecks = [
    authDb,
    mediaDb,
    assets,
    staging,
    incidents,
    media,
    manifest
  ];


  const requiredBindings = [
    bindings.authDb,
    bindings.mediaDb,
    bindings.assets,
    bindings.uploadStaging,
    bindings.rateLimiter,
    bindings.authPepper,
    bindings.githubToken
  ];


  if (
    String(
      env.TURNSTILE_REQUIRED ||
      "false"
    ) === "true"
  ) {

    requiredBindings.push(
      bindings.turnstile
    );
  }


  const requiredConfig =
    Object
      .values(
        config
      )
      .every(Boolean);


  const releaseReady =
    requiredChecks.every(
      item =>
        item.ok
    ) &&
    requiredBindings.every(
      Boolean
    ) &&
    requiredConfig;


  return {

    ok:
      releaseReady,

    releaseReady,

    generatedAt:
      Math.floor(
        Date.now() /
        1000
      ),

    checks: {

      authDb,
      mediaDb,
      assets,

      uploadStaging:
        staging,

      incidents,
      media,
      manifest
    },

    bindings,
    config
  };
}


export async function handleOwnerSystemHealthRequest(
  request,
  env,
  auth
) {

  requireOwner(
    auth
  );


  if (
    request.method
      .toUpperCase() !==
      "GET"
  ) {

    return methodNotAllowed([
      "GET"
    ]);
  }


  return jsonResponse(
    await collectHealth(
      request,
      env
    )
  );
}


function randomNonce() {

  const bytes =
    new Uint8Array(18);


  crypto.getRandomValues(
    bytes
  );


  return Array
    .from(
      bytes,
      byte =>
        byte
          .toString(16)
          .padStart(2, "0")
    )
    .join("");
}


export function renderSystemHealthPage() {

  const nonce =
    randomNonce();


  const html =
`<!doctype html>
<html lang="zh-CN">

<head>

<meta charset="utf-8">

<meta
name="viewport"
content="width=device-width,initial-scale=1,viewport-fit=cover">

<meta
name="color-scheme"
content="light">

<title>
系统状态 · Jingyan Media Center
</title>

<link
rel="stylesheet"
href="/app-shell.css?v=20260819-shell-v2">

<script
src="/app-shell.js?v=20260819-shell-v2"
defer>
</script>

<style nonce="${nonce}">

:root {
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    sans-serif;

  color:
    #2e214d;

  background:
    #f8f7fc;

  --purple:
    #7851ea;

  --purple-soft:
    #f1ebff;

  --green:
    #2f9875;

  --green-soft:
    #eaf8f2;

  --red:
    #bf5264;

  --red-soft:
    #fff0f3;

  --text:
    #6d6380;

  --muted:
    #988fa8;

  --line:
    rgba(72,49,108,.10);
}


* {
  box-sizing:
    border-box;
}


body {
  margin:
    0;

  background:
    #f8f7fc;
}


.health-page {
  width:
    min(
      1160px,
      calc(100% - 48px)
    );

  margin:
    0 auto;

  padding:
    58px 0 120px;
}


.hero {
  display:
    flex;

  align-items:
    flex-end;

  justify-content:
    space-between;

  gap:
    24px;

  margin-bottom:
    26px;
}


.eyebrow {
  color:
    var(--purple);

  font-size:
    12px;

  font-weight:
    850;

  letter-spacing:
    .16em;
}


h1 {
  margin:
    12px 0 15px;

  font-size:
    clamp(
      44px,
      6vw,
      70px
    );

  line-height:
    .98;

  letter-spacing:
    -.055em;
}


.hero p {
  max-width:
    720px;

  margin:
    0;

  color:
    var(--text);

  line-height:
    1.75;
}


.refresh {
  min-height:
    46px;

  padding:
    0 18px;

  border:
    0;

  border-radius:
    15px;

  color:
    var(--purple);

  background:
    var(--purple-soft);

  cursor:
    pointer;

  font-weight:
    780;
}


.release,
.section,
.card {
  border:
    1px solid
    rgba(255,255,255,.94);

  background:
    rgba(255,255,255,.94);

  box-shadow:
    0 18px 56px
    rgba(55,36,85,.07);
}


.release {
  margin-bottom:
    16px;

  padding:
    18px 20px;

  display:
    flex;

  align-items:
    center;

  justify-content:
    space-between;

  border-radius:
    22px;
}


.pill {
  padding:
    7px 11px;

  border-radius:
    999px;

  font-size:
    12px;

  font-weight:
    800;
}


.pill.ok {
  color:
    var(--green);

  background:
    var(--green-soft);
}


.pill.bad {
  color:
    var(--red);

  background:
    var(--red-soft);
}


.grid {
  display:
    grid;

  grid-template-columns:
    repeat(
      4,
      minmax(0,1fr)
    );

  gap:
    12px;
}


.card {
  padding:
    20px;

  border-radius:
    21px;
}


.card span {
  color:
    var(--muted);

  font-size:
    12px;
}


.card strong {
  display:
    block;

  margin-top:
    8px;

  font-size:
    25px;
}


.section {
  margin-top:
    17px;

  padding:
    21px;

  border-radius:
    25px;
}


.section h2 {
  margin:
    0 0 14px;

  font-size:
    19px;
}


.rows {
  overflow:
    hidden;

  border:
    1px solid
    var(--line);

  border-radius:
    16px;
}


.row {
  padding:
    13px 14px;

  display:
    grid;

  grid-template-columns:
    minmax(150px,.8fr)
    minmax(0,1.2fr)
    auto;

  gap:
    12px;

  align-items:
    center;

  border-bottom:
    1px solid
    var(--line);

  background:
    #fff;
}


.row:last-child {
  border-bottom:
    0;
}


.detail {
  overflow:
    hidden;

  color:
    var(--text);

  font-size:
    12px;

  text-overflow:
    ellipsis;

  white-space:
    nowrap;
}


.dot {
  width:
    9px;

  height:
    9px;

  border-radius:
    50%;
}


.dot.ok {
  background:
    var(--green);
}


.dot.bad {
  background:
    var(--red);
}


@media (
  max-width:
  900px
) {

  .health-page {
    width:
      calc(100% - 28px);

    padding-top:
      38px;
  }


  .hero {
    align-items:
      flex-start;

    flex-direction:
      column;
  }


  .grid {
    grid-template-columns:
      repeat(
        2,
        minmax(0,1fr)
      );
  }

}


@media (
  max-width:
  520px
) {

  h1 {
    font-size:
      46px;
  }


  .row {
    grid-template-columns:
      1fr auto;
  }


  .detail {
    grid-column:
      1 / -1;

    white-space:
      normal;
  }

}

</style>

</head>


<body>

<main class="health-page">

<section class="hero">

<div>

<div class="eyebrow">
SYSTEM HEALTH
</div>

<h1>
系统状态。
</h1>

<p>
发布前快速检查认证、媒体数据库、静态资源、上传暂存、
反馈系统与关键配置。这里不会显示任何 Secret 的实际内容。
</p>

</div>


<button
class="refresh"
id="refresh"
type="button">
重新检查
</button>

</section>


<section class="release">

<div>

<div>
FIRST VERSION READINESS
</div>

<strong id="releaseText">
正在检查…
</strong>

</div>

<span
class="pill"
id="releasePill">
—
</span>

</section>


<section class="grid">

<article class="card">
<span>认证数据库</span>
<strong id="authValue">—</strong>
</article>

<article class="card">
<span>媒体数据库</span>
<strong id="mediaValue">—</strong>
</article>

<article class="card">
<span>已发布媒体</span>
<strong id="publishedValue">—</strong>
</article>

<article class="card">
<span>待处理反馈</span>
<strong id="incidentValue">—</strong>
</article>

</section>


<section class="section">

<h2>
核心检查
</h2>

<div
class="rows"
id="checkRows">
</div>

</section>


<section class="section">

<h2>
绑定与配置
</h2>

<div
class="rows"
id="configRows">
</div>

</section>

</main>


<script nonce="${nonce}">

(() => {

  "use strict";


  const $ =
    id =>
      document.getElementById(
        id
      );


  function escapeHtml(value) {

    return String(
      value ?? ""
    )
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function row(
    name,
    detail,
    ok
  ) {

    return (
      '<div class="row">' +
      '<strong>' +
      escapeHtml(name) +
      '</strong>' +
      '<span class="detail">' +
      escapeHtml(detail) +
      '</span>' +
      '<span class="dot ' +
      (
        ok
          ? "ok"
          : "bad"
      ) +
      '"></span>' +
      '</div>'
    );
  }


  async function load() {

    $("refresh").disabled =
      true;


    try {

      const response =
        await fetch(
          "/api/admin/health",
          {
            credentials:
              "same-origin",

            cache:
              "no-store",

            headers: {
              Accept:
                "application/json"
            }
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.error ||
          "health_failed"
        );
      }


      $("releaseText").textContent =
        data.releaseReady

          ? "第一版核心依赖通过"

          : "存在发布前异常";


      $("releasePill").textContent =
        data.releaseReady

          ? "可发布"

          : "需检查";


      $("releasePill").className =
        "pill " +
        (
          data.releaseReady
            ? "ok"
            : "bad"
        );


      $("authValue").textContent =
        data.checks.authDb.ok

          ? "正常"

          : "异常";


      $("mediaValue").textContent =
        data.checks.mediaDb.ok

          ? "正常"

          : "异常";


      $("publishedValue").textContent =
        String(
          data.checks.media
            ?.value
            ?.published ??
          "—"
        );


      $("incidentValue").textContent =
        String(
          data.checks.incidents
            ?.value
            ?.open ??
          "—"
        );


      const checks = [

        [
          "AUTH_DB",
          data.checks.authDb
        ],

        [
          "MEDIA_DB",
          data.checks.mediaDb
        ],

        [
          "Static Assets",
          data.checks.assets
        ],

        [
          "Upload Staging KV",
          data.checks.uploadStaging
        ],

        [
          "Feedback / Incidents",
          data.checks.incidents
        ],

        [
          "Media Index",
          data.checks.media
        ],

        [
          "Manifest State",
          data.checks.manifest
        ]

      ];


      $("checkRows").innerHTML =
        checks
          .map(
            ([name, item]) =>
              row(
                name,

                item.ok
                  ? (
                      "正常 · " +
                      Number(
                        item.latencyMs || 0
                      ) +
                      " ms"
                    )
                  : (
                      "失败 · " +
                      (
                        item.error ||
                        "unknown"
                      )
                    ),

                item.ok
              )
          )
          .join("");


      const b =
        data.bindings;


      const c =
        data.config;


      const configs = [

        [
          "AUTH_DB binding",
          b.authDb
            ? "已配置"
            : "缺失",
          b.authDb
        ],

        [
          "MEDIA_DB binding",
          b.mediaDb
            ? "已配置"
            : "缺失",
          b.mediaDb
        ],

        [
          "ASSETS binding",
          b.assets
            ? "已配置"
            : "缺失",
          b.assets
        ],

        [
          "UPLOAD_STAGING",
          b.uploadStaging
            ? "已配置"
            : "缺失",
          b.uploadStaging
        ],

        [
          "Rate Limiter",
          b.rateLimiter
            ? "已配置"
            : "缺失",
          b.rateLimiter
        ],

        [
          "AUTH_PEPPER",
          b.authPepper
            ? "已配置"
            : "缺失",
          b.authPepper
        ],

        [
          "Turnstile Secret",
          b.turnstile
            ? "已配置"
            : "缺失",
          b.turnstile
        ],

        [
          "GitHub Upload Token",
          b.githubToken
            ? "已配置"
            : "缺失",
          b.githubToken
        ],

        [
          "Passkey RP ID",
          c.passkeyRpId ||
          "缺失",
          Boolean(
            c.passkeyRpId
          )
        ],

        [
          "Passkey Origin",
          c.passkeyOrigin ||
          "缺失",
          Boolean(
            c.passkeyOrigin
          )
        ],

        [
          "Media CDN",
          c.mediaCdn ||
          "缺失",
          Boolean(
            c.mediaCdn
          )
        ],

        [
          "GitHub Repository",
          c.githubRepo ||
          "缺失",
          Boolean(
            c.githubRepo
          )
        ],

        [
          "Upload Workflow",
          c.uploadWorkflow ||
          "缺失",
          Boolean(
            c.uploadWorkflow
          )
        ],

        [
          "Sync Workflow",
          c.syncWorkflow ||
          "缺失",
          Boolean(
            c.syncWorkflow
          )
        ]

      ];


      $("configRows").innerHTML =
        configs
          .map(
            item =>
              row(
                item[0],
                item[1],
                item[2]
              )
          )
          .join("");


    } catch (error) {

      console.error(
        error
      );


      $("releaseText").textContent =
        "系统状态读取失败";


      $("releasePill").textContent =
        "异常";


      $("releasePill").className =
        "pill bad";


      $("checkRows").innerHTML =
        row(
          "Health API",
          error.message ||
          "request_failed",
          false
        );

    } finally {

      $("refresh").disabled =
        false;
    }
  }


  $("refresh")
    .addEventListener(
      "click",
      load
    );


  load();

})();

</script>

</body>

</html>`;


  return new Response(
    html,
    {

      status:
        200,

      headers: {

        "Content-Type":
          "text/html; charset=utf-8",

        "Cache-Control":
          "no-store, max-age=0",

        Pragma:
          "no-cache",

        "Referrer-Policy":
          "same-origin",

        "X-Content-Type-Options":
          "nosniff",

        "X-Frame-Options":
          "DENY",

        "Content-Security-Policy":
          [
            "default-src 'self'",

            "script-src 'self' 'nonce-" +
            nonce +
            "'",

            "style-src 'self' 'nonce-" +
            nonce +
            "'",

            "img-src 'self' data: blob: https:",

            "connect-src 'self'",

            "object-src 'none'",

            "base-uri 'none'",

            "frame-ancestors 'none'",

            "form-action 'self'"
          ].join("; ")
      }
    }
  );
}
