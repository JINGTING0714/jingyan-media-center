function escapeHtml(
  value
) {
  return String(
    value ||
    ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#39;"
    );
}


function randomNonce() {
  const bytes =
    new Uint8Array(
      18
    );

  crypto.getRandomValues(
    bytes
  );

  return Array.from(
    bytes,
    byte =>
      byte
        .toString(16)
        .padStart(
          2,
          "0"
        )
  ).join("");
}


function shell(
  title,
  body,
  script
) {
  const nonce =
    randomNonce();

  const html =
`<!doctype html>
<html lang="zh-CN">

<head>

<meta charset="utf-8">

<meta
name="viewport"
content="width=device-width,initial-scale=1">

<meta
name="color-scheme"
content="light dark">

<title>${escapeHtml(title)}</title>

<style nonce="${nonce}">

:root {
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;

  color:
    #2b1952;

  background:
    #f7f3ff;

  --surface:
    rgba(
      255,
      255,
      255,
      .88
    );

  --surface-soft:
    rgba(
      255,
      255,
      255,
      .62
    );

  --border:
    rgba(
      94,
      57,
      177,
      .16
    );

  --muted:
    #7c6da0;

  --accent:
    #7652e8;

  --accent-soft:
    #f1ebff;

  --success:
    #197a55;

  --danger:
    #b13c56;

  --warning:
    #9a6810;

  --shadow:
    0 24px 70px
    rgba(
      70,
      42,
      126,
      .12
    );
}

* {
  box-sizing:
    border-box;
}

html {
  min-height:
    100%;
}

body {
  margin:
    0;

  min-height:
    100vh;

  background:
    radial-gradient(
      circle at 15% 10%,
      rgba(
        176,
        139,
        255,
        .22
      ),
      transparent 28rem
    ),
    radial-gradient(
      circle at 90% 20%,
      rgba(
        227,
        211,
        255,
        .68
      ),
      transparent 30rem
    ),
    linear-gradient(
      180deg,
      #faf8ff 0%,
      #f3effc 100%
    );
}

a {
  color:
    inherit;

  text-decoration:
    none;
}

button,
input {
  font:
    inherit;
}

.wrap {
  width:
    min(
      980px,
      calc(
        100% - 32px
      )
    );

  margin:
    0 auto;

  padding:
    26px 0 56px;
}

.topbar {
  display:
    flex;

  align-items:
    center;

  justify-content:
    space-between;

  gap:
    18px;

  margin-bottom:
    38px;
}

.brand {
  display:
    flex;

  align-items:
    center;

  gap:
    14px;
}

.logo {
  width:
    54px;

  height:
    54px;

  border-radius:
    18px;

  display:
    grid;

  place-items:
    center;

  color:
    #fff;

  font-weight:
    800;

  font-size:
    24px;

  background:
    linear-gradient(
      145deg,
      #9a70ff,
      #6942df
    );

  box-shadow:
    0 14px 30px
    rgba(
      103,
      65,
      219,
      .24
    );
}

.brand-title {
  font-size:
    20px;

  font-weight:
    800;
}

.brand-subtitle,
.muted {
  color:
    var(--muted);
}

.navlink {
  padding:
    11px 16px;

  background:
    rgba(
      255,
      255,
      255,
      .65
    );

  border:
    1px solid
    var(--border);

  border-radius:
    999px;
}

.card {
  background:
    var(--surface);

  border:
    1px solid
    var(--border);

  border-radius:
    30px;

  box-shadow:
    var(--shadow);

  backdrop-filter:
    blur(
      18px
    );
}

.hero {
  padding:
    clamp(
      28px,
      6vw,
      60px
    );
}

.section {
  padding:
    26px;

  margin-top:
    20px;
}

.eyebrow {
  font-size:
    13px;

  letter-spacing:
    .18em;

  font-weight:
    800;

  color:
    var(--accent);

  text-transform:
    uppercase;
}

h1 {
  font-size:
    clamp(
      38px,
      8vw,
      70px
    );

  line-height:
    .98;

  letter-spacing:
    -.055em;

  margin:
    16px 0 18px;
}

h2 {
  margin:
    0;

  font-size:
    24px;
}

h3 {
  margin:
    0;

  font-size:
    18px;
}

p {
  line-height:
    1.7;
}

.actions {
  display:
    flex;

  gap:
    12px;

  flex-wrap:
    wrap;

  margin-top:
    26px;
}

.button {
  border:
    0;

  border-radius:
    16px;

  padding:
    13px 18px;

  cursor:
    pointer;

  font-weight:
    750;

  transition:
    transform .14s ease,
    opacity .14s ease,
    box-shadow .14s ease;
}

.button:hover {
  transform:
    translateY(
      -1px
    );
}

.button:disabled {
  cursor:
    wait;

  opacity:
    .55;

  transform:
    none;
}

.button-primary {
  color:
    #fff;

  background:
    linear-gradient(
      145deg,
      #8b62f6,
      #6841df
    );

  box-shadow:
    0 12px 28px
    rgba(
      103,
      65,
      219,
      .22
    );
}

.button-secondary {
  color:
    #392264;

  background:
    var(--accent-soft);

  border:
    1px solid
    rgba(
      103,
      65,
      219,
      .12
    );
}

.button-soft {
  color:
    #4b3d6b;

  background:
    rgba(
      255,
      255,
      255,
      .75
    );

  border:
    1px solid
    var(--border);
}

.button-danger {
  color:
    var(--danger);

  background:
    rgba(
      177,
      60,
      86,
      .08
    );

  border:
    1px solid
    rgba(
      177,
      60,
      86,
      .16
    );
}

.status {
  margin-top:
    20px;

  min-height:
    26px;

  color:
    var(--muted);

  line-height:
    1.6;
}

.status.success {
  color:
    var(--success);
}

.status.error {
  color:
    var(--danger);
}

.status.warning {
  color:
    var(--warning);
}

.divider {
  height:
    1px;

  background:
    var(--border);

  margin:
    30px 0;
}

.grid {
  display:
    grid;

  grid-template-columns:
    repeat(
      auto-fit,
      minmax(
        220px,
        1fr
      )
    );

  gap:
    14px;
}

.mini-card {
  border:
    1px solid
    var(--border);

  border-radius:
    20px;

  padding:
    18px;

  background:
    var(--surface-soft);
}

.mini-card p {
  margin-bottom:
    8px;
}

.passkey-list {
  display:
    grid;

  gap:
    14px;

  margin-top:
    18px;
}

.passkey-row {
  border:
    1px solid
    var(--border);

  border-radius:
    20px;

  padding:
    18px;

  background:
    rgba(
      255,
      255,
      255,
      .7
    );

  display:
    grid;

  gap:
    14px;

  grid-template-columns:
    minmax(
      0,
      1fr
    )
    auto;

  align-items:
    center;
}

.passkey-title {
  font-weight:
    800;

  font-size:
    17px;

  overflow-wrap:
    anywhere;
}

.passkey-meta {
  color:
    var(--muted);

  font-size:
    13px;

  margin-top:
    6px;

  line-height:
    1.65;
}

.row-actions {
  display:
    flex;

  gap:
    8px;

  flex-wrap:
    wrap;

  justify-content:
    flex-end;
}

.pill {
  display:
    inline-flex;

  align-items:
    center;

  gap:
    6px;

  border-radius:
    999px;

  padding:
    7px 10px;

  background:
    rgba(
      118,
      82,
      232,
      .09
    );

  color:
    #6541c9;

  font-size:
    12px;

  font-weight:
    750;
}

.notice {
  border-radius:
    18px;

  padding:
    16px 18px;

  color:
    #5f507f;

  background:
    rgba(
      118,
      82,
      232,
      .07
    );

  border:
    1px solid
    rgba(
      118,
      82,
      232,
      .12
    );

  line-height:
    1.7;
}

.security-actions {
  display:
    grid;

  grid-template-columns:
    repeat(
      auto-fit,
      minmax(
        200px,
        1fr
      )
    );

  gap:
    12px;

  margin-top:
    18px;
}

.security-action {
  border:
    1px solid
    var(--border);

  border-radius:
    20px;

  padding:
    18px;

  background:
    rgba(
      255,
      255,
      255,
      .62
    );
}

.security-action p {
  color:
    var(--muted);

  font-size:
    13px;

  margin:
    8px 0 14px;
}

@media (
  max-width:
    640px
) {
  .wrap {
    width:
      min(
        100% - 20px,
        980px
      );

    padding-top:
      14px;
  }

  .topbar {
    margin-bottom:
      22px;
  }

  .brand-subtitle {
    display:
      none;
  }

  .hero,
  .section {
    padding:
      22px;

    border-radius:
      24px;
  }

  .passkey-row {
    grid-template-columns:
      1fr;
  }

  .row-actions {
    justify-content:
      flex-start;
  }

  .button {
    min-height:
      46px;
  }
}

</style>

</head>

<body>

${body}

<script src="/vendor/simplewebauthn-browser.js"></script>

<script nonce="${nonce}">

${script}

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
          "no-store",

        "Referrer-Policy":
          "same-origin",

        "X-Content-Type-Options":
          "nosniff",

        "X-Frame-Options":
          "DENY",

        "Permissions-Policy":
          "publickey-credentials-get=(self), publickey-credentials-create=(self)",

        "Content-Security-Policy":
          [
            "default-src 'self'",
            \`script-src 'self' 'nonce-\${nonce}'\`,
            \`style-src 'nonce-\${nonce}'\`,
            "img-src 'self' data:",
            "connect-src 'self'",
            "object-src 'none'",
            "base-uri 'none'",
            "frame-ancestors 'none'",
            "form-action 'self'"
          ].join(
            "; "
          )
      }
    }
  );
}


function commonClientHelpers() {
  return `
function setStatusElement(
  element,
  message,
  type = ""
) {
  element.textContent =
    message ||
    "";

  element.className =
    "status" +
    (
      type
        ? " " + type
        : ""
    );
}


async function readApiJson(
  response
) {
  const data =
    await response
      .json()
      .catch(
        () => ({})
      );

  if (
    !response.ok
  ) {
    const error =
      new Error(
        data.error ||
        "request_failed"
      );

    error.code =
      data.error ||
      "request_failed";

    error.httpStatus =
      response.status;

    throw error;
  }

  return data;
}


function describeWebAuthnError(
  error,
  operation = "authentication"
) {
  const parts = [
    error?.name,
    error?.code,
    error?.message,
    error?.cause?.name,
    error?.cause?.code,
    error?.cause?.message
  ]
    .filter(Boolean)
    .map(
      value =>
        String(value)
    );

  const text =
    parts.join(
      " "
    );

  if (
    /InvalidStateError/i
      .test(
        text
      )
  ) {
    return {
      kind:
        "already-registered",

      message:
        "当前选择的 Passkey 提供商已经保存了这个账号的凭证，因此不会重复创建。请先使用“测试这台设备”确认它是否已经能登录；如果你确实想新增另一把，请改选其他设备、密码管理器或安全密钥。"
    };
  }

  if (
    /SecurityError/i
      .test(
        text
      )
  ) {
    return {
      kind:
        "security",

      message:
        "Passkey 被浏览器安全策略拒绝。请确认你正在正式 HTTPS 网站上操作，并重新打开页面后再试。"
    };
  }

  if (
    /NotAllowedError|ERROR_CEREMONY_ABORTED|ERROR_PASSTHROUGH|not.?allowed/i
      .test(
        text
      )
  ) {
    if (
      operation ===
      "registration"
    ) {
      return {
        kind:
          "cancelled",

        message:
          "Passkey 创建没有完成。可能是你取消了操作、系统超时，或者当前保存位置不允许再创建同一账号的凭证。可以改选另一种 Passkey 保存方式。"
      };
    }

    return {
      kind:
        "not-available",

      message:
        "这台设备当前没有找到可用的 Passkey，或者你取消了系统提示。新设备可以先使用设备配对；登录后再在 Passkey 安全中心测试或添加本机凭证。"
    };
  }

  return {
    kind:
      "unknown",

    message:
      operation ===
      "registration"
        ? "Passkey 创建失败。请重新打开页面后再试；如果仍失败，可以换一种 Passkey 保存位置。"
        : "Passkey 登录没有完成。请重试；如果这是新设备，可以改用设备配对或恢复码。"
  };
}


function getDeviceLabel() {
  const ua =
    navigator.userAgent ||
    "";

  let platform =
    navigator
      .userAgentData
      ?.platform ||
    navigator.platform ||
    "Device";

  let browser =
    "Browser";

  if (
    /Windows/i.test(
      ua
    )
  ) {
    platform =
      "Windows";

  } else if (
    /iPhone|iPad|iPod/i
      .test(
        ua
      )
  ) {
    platform =
      "iPhone/iPad";

  } else if (
    /Android/i.test(
      ua
    )
  ) {
    platform =
      "Android";

  } else if (
    /Macintosh|Mac OS X/i
      .test(
        ua
      )
  ) {
    platform =
      "Mac";

  } else if (
    /Linux/i.test(
      ua
    )
  ) {
    platform =
      "Linux";
  }

  if (
    /Edg\\//i.test(
      ua
    )
  ) {
    browser =
      "Edge";

  } else if (
    /Chrome\\//i.test(
      ua
    )
  ) {
    browser =
      "Chrome";

  } else if (
    /Firefox\\//i.test(
      ua
    )
  ) {
    browser =
      "Firefox";

  } else if (
    /Safari\\//i.test(
      ua
    )
  ) {
    browser =
      "Safari";
  }

  return (
    platform +
    " " +
    browser
  ).slice(
    0,
    60
  );
}
`;
}


export function renderLoginPage() {
  const body =
`
<div class="wrap">

  <header class="topbar">

    <a
    class="brand"
    href="/">

      <span class="logo">
        J
      </span>

      <span>

        <span class="brand-title">
          Jingyan Media Center
        </span>

        <br>

        <span class="brand-subtitle">
          Secure Sign-in
        </span>

      </span>

    </a>

    <a
    class="navlink"
    href="/">
      返回首页
    </a>

  </header>


  <main class="card hero">

    <div class="eyebrow">
      Secure Access
    </div>

    <h1>
      欢迎回来。
    </h1>

    <p class="muted">
      Owner 和已设置 Passkey 的受邀用户都可以直接使用系统凭证登录。
      新设备如果还没有 Passkey，可以使用设备配对。
    </p>

    <div class="actions">

      <button
      id="loginButton"
      class="button button-primary"
      type="button">
        使用 Passkey 登录
      </button>

    </div>

    <div
    id="status"
    class="status">
    </div>

    <div class="divider">
    </div>

    <div class="grid">

      <div class="mini-card">

        <strong>
          第一次加入
        </strong>

        <p class="muted">
          使用 Owner 给你的单次邀请码创建账号。
        </p>

        <a href="/activate">
          使用邀请码激活 →
        </a>

      </div>


      <div class="mini-card">

        <strong>
          新手机 / 新电脑
        </strong>

        <p class="muted">
          如果另一台设备还处于登录状态，可生成一次性配对码。
        </p>

        <a href="/device">
          打开设备配对 →
        </a>

      </div>


      <div class="mini-card">

        <strong>
          无法访问旧设备
        </strong>

        <p class="muted">
          受邀用户可使用 Owner 为原账号签发的恢复码。
        </p>

        <a href="/recover">
          使用恢复码 →
        </a>

      </div>


      <div class="mini-card">

        <strong>
          Owner 高级恢复
        </strong>

        <p class="muted">
          仅在所有正常登录方式都不可用时使用。
        </p>

        <a href="/owner-recover">
          打开高级恢复 →
        </a>

      </div>

    </div>

  </main>

</div>`;

  const script =
commonClientHelpers() +
`
const button =
  document.getElementById(
    "loginButton"
  );

const statusElement =
  document.getElementById(
    "status"
  );


function setStatus(
  message,
  type = ""
) {
  setStatusElement(
    statusElement,
    message,
    type
  );
}


if (
  !window
    .SimpleWebAuthnBrowser
    ?.browserSupportsWebAuthn()
) {
  button.disabled =
    true;

  setStatus(
    "当前浏览器不支持 WebAuthn / Passkey。请使用最新版 Edge、Chrome、Safari 或 Firefox。",
    "error"
  );
}


button.addEventListener(
  "click",
  async () => {
    button.disabled =
      true;

    setStatus(
      "正在请求 Passkey…"
    );

    try {
      const optionsResponse =
        await fetch(
          "/api/passkeys/authentication/options",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              "{}"
          }
        );

      const payload =
        await readApiJson(
          optionsResponse
        );

      let credentialResponse;

      try {
        credentialResponse =
          await SimpleWebAuthnBrowser
            .startAuthentication({
              optionsJSON:
                payload.options
            });

      } catch (error) {
        const info =
          describeWebAuthnError(
            error,
            "authentication"
          );

        setStatus(
          info.message,
          "error"
        );

        return;
      }

      const verifyResponse =
        await fetch(
          "/api/passkeys/authentication/verify",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                ceremonyId:
                  payload.ceremonyId,

                response:
                  credentialResponse,

                deviceLabel:
                  getDeviceLabel()
              })
          }
        );

      const verified =
        await readApiJson(
          verifyResponse
        );

      setStatus(
        "登录成功，正在进入媒体中心…",
        "success"
      );

      window.location.assign(
        "/"
      );

    } catch (error) {
      console.error(
        error
      );

      if (
        error.code ===
        "rate_limited"
      ) {
        setStatus(
          "Passkey 尝试过于频繁。请等待约 1 分钟后再试。",
          "warning"
        );

      } else if (
        error.code ===
        "passkey_authentication_failed"
      ) {
        setStatus(
          "Passkey 已由设备返回，但服务器验证没有通过。请重新尝试；若只在某一台设备失败，请先用设备配对登录，再到 Passkey 安全中心测试该设备。",
          "error"
        );

      } else {
        setStatus(
          "登录请求失败。可以重试，或使用设备配对 / 恢复码。",
          "error"
        );
      }

    } finally {
      button.disabled =
        false;
    }
  }
);`;

  return shell(
    "登录 · Jingyan Media Center",
    body,
    script
  );
}


/*
 * 保留旧导出名，避免其他模块或旧链接失效。
 */
export function renderOwnerLoginPage() {
  return renderLoginPage();
}


export function renderPasskeyManagerPage(
  user
) {
  const displayName =
    escapeHtml(
      user?.displayName ||
      "User"
    );

  const role =
    user?.role ===
    "owner"
      ? "Owner"
      : "Uploader";

  const body =
`
<div class="wrap">

  <header class="topbar">

    <a
    class="brand"
    href="/">

      <span class="logo">
        J
      </span>

      <span>

        <span class="brand-title">
          Jingyan Media Center
        </span>

        <br>

        <span class="brand-subtitle">
          Account Security
        </span>

      </span>

    </a>

    <a
    class="navlink"
    href="/account">
      账户
    </a>

  </header>


  <section class="card hero">

    <div class="eyebrow">
      Account Security
    </div>

    <h1>
      Passkeys
    </h1>

    <p class="muted">
      ${displayName} · ${role}
    </p>

    <p class="muted">
      Passkey 是登录凭证，不等于单独的一台设备。
      如果凭证由系统密码管理器同步，同一个 Passkey 可能可以在多台设备上使用。
    </p>

    <div class="actions">

      <button
      id="testButton"
      class="button button-primary"
      type="button">
        测试这台设备
      </button>

      <a
      class="button button-secondary"
      href="/login">
        打开登录页
      </a>

    </div>

    <div
    id="status"
    class="status">
    </div>

  </section>


  <section class="card section">

    <div class="eyebrow">
      Add Passkey
    </div>

    <h2>
      添加新的登录方式
    </h2>

    <p class="muted">
      如果“测试这台设备”已经成功，就不需要为了手机或电脑再强行复制一条相同凭证。
      想要真正增加独立备份时，应选择不同的 authenticator、密码管理器、另一台设备或安全密钥。
    </p>

    <div class="security-actions">

      <div class="security-action">

        <h3>
          当前设备
        </h3>

        <p>
          优先使用当前手机、电脑的系统 Passkey，例如 Windows Hello、Android 或 Apple 平台认证器。
        </p>

        <button
        class="button button-secondary addButton"
        data-preferred="localDevice"
        type="button">
          添加当前设备 Passkey
        </button>

      </div>


      <div class="security-action">

        <h3>
          另一台设备
        </h3>

        <p>
          浏览器可引导你使用另一台手机、平板或混合认证方式。
        </p>

        <button
        class="button button-soft addButton"
        data-preferred="remoteDevice"
        type="button">
          添加其他设备 Passkey
        </button>

      </div>


      <div class="security-action">

        <h3>
          安全密钥
        </h3>

        <p>
          如果以后准备硬件 FIDO2 安全密钥，可以作为独立备份登录方式。
        </p>

        <button
        class="button button-soft addButton"
        data-preferred="securityKey"
        type="button">
          添加安全密钥
        </button>

      </div>

    </div>

  </section>


  <section class="card section">

    <div
    style="
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      flex-wrap:wrap
    ">

      <div>

        <div class="eyebrow">
          Registered Credentials
        </div>

        <h2>
          已注册 Passkey
        </h2>

      </div>

      <span
      id="countPill"
      class="pill">
        读取中…
      </span>

    </div>

    <div
    id="passkeyList"
    class="passkey-list">
    </div>

  </section>


  <section class="card section">

    <div
    id="securityNotice"
    class="notice">

      私钥、指纹、Face ID、
      Windows Hello PIN 都不会上传到服务器。

      Jingyan Media Center 只保存用于验证登录的 credential ID、公钥和必要的认证状态。

    </div>

  </section>

</div>`;

  const script =
commonClientHelpers() +
`
const statusElement =
  document.getElementById(
    "status"
  );

const listElement =
  document.getElementById(
    "passkeyList"
  );

const countPill =
  document.getElementById(
    "countPill"
  );

const testButton =
  document.getElementById(
    "testButton"
  );

const securityNotice =
  document.getElementById(
    "securityNotice"
  );

const addButtons =
  Array.from(
    document.querySelectorAll(
      ".addButton"
    )
  );


function setStatus(
  message,
  type = ""
) {
  setStatusElement(
    statusElement,
    message,
    type
  );
}


function escapeHtmlClient(
  value
) {
  return String(
    value ??
    ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /\\"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#39;"
    );
}


function formatTime(
  value
) {
  if (!value) {
    return "从未使用";
  }

  return new Date(
    Number(
      value
    ) *
    1000
  )
    .toLocaleString(
      "zh-CN",
      {
        hour12:
          false
      }
    );
}


async function api(
  url,
  options = {}
) {
  const response =
    await fetch(
      url,
      options
    );

  return readApiJson(
    response
  );
}


function renderPasskeys(
  data
) {
  const passkeys =
    data.passkeys ||
    [];

  countPill.textContent =
    passkeys.length +
    " 把有效凭证";

  if (
    passkeys.length ===
    0
  ) {
    listElement.innerHTML =
      '<div class="notice">' +
      '当前账号还没有 Passkey。你仍然保持当前 Session 登录，请先添加一把再测试。' +
      '</div>';

  } else {
    listElement.innerHTML =
      passkeys
        .map(
          passkey => {
            const id =
              escapeHtmlClient(
                passkey.id
              );

            const name =
              escapeHtmlClient(
                passkey.displayName
              );

            const deviceType =
              passkey.deviceType ===
              "multiDevice"
                ? "同步型 / 多设备"
                : passkey.deviceType ===
                  "singleDevice"
                  ? "单设备"
                  : "Passkey";

            const backup =
              passkey.backedUp
                ? "已备份 / 可同步"
                : "未标记为已备份";

            const created =
              escapeHtmlClient(
                formatTime(
                  passkey.createdAt
                )
              );

            const lastUsed =
              escapeHtmlClient(
                formatTime(
                  passkey.lastUsedAt
                )
              );

            return (
              '<article class="passkey-row" data-passkey-id="' +
              id +
              '">' +

                '<div>' +

                  '<div class="passkey-title">' +
                  name +
                  '</div>' +

                  '<div class="passkey-meta">' +

                    escapeHtmlClient(
                      deviceType
                    ) +
                    ' · ' +
                    escapeHtmlClient(
                      backup
                    ) +
                    '<br>' +

                    '创建：' +
                    created +
                    '<br>' +

                    '最后使用：' +
                    lastUsed +

                  '</div>' +

                '</div>' +

                '<div class="row-actions">' +

                  '<button class="button button-secondary renameButton" type="button">' +
                  '重命名' +
                  '</button>' +

                  '<button class="button button-danger revokeButton" type="button">' +
                  '移除' +
                  '</button>' +

                '</div>' +

              '</article>'
            );
          }
        )
        .join("");
  }

  if (
    data.role ===
    "owner"
  ) {
    if (
      data.hasBackedUpPasskey
    ) {
      securityNotice.textContent =
        "Owner 当前至少有一把已备份/同步型 Passkey。它可能已经能在多台兼容设备上使用，所以数据库里只有一条 credential 不等于只有一台设备可登录。仍建议保留另一条独立恢复路线，例如另一密码管理器、硬件安全密钥或已登录备用设备。";

    } else if (
      passkeys.length <
      2
    ) {
      securityNotice.textContent =
        "Owner 当前只有一把未标记为已备份的 Passkey。请保留手机或另一台电脑的已登录 Session，并考虑添加真正独立的第二种凭证。系统不会允许删除最后一把 Owner Passkey。";

    } else {
      securityNotice.textContent =
        "Owner 已有多把独立 Passkey。请继续保留至少两条彼此独立的恢复路线。";
    }

  } else {
    securityNotice.textContent =
      "Passkey 只是你的登录方式，不会改变上传、编辑、删除或管理权限。你的权限仍由 Owner 在服务器端控制。";
  }
}


async function loadPasskeys() {
  const data =
    await api(
      "/api/passkeys"
    );

  renderPasskeys(
    data
  );

  return data;
}


async function testCurrentDevice() {
  testButton.disabled =
    true;

  setStatus(
    "正在检查这台设备是否能使用账号现有 Passkey…"
  );

  try {
    const payload =
      await api(
        "/api/passkeys/test/options",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            "{}"
        }
      );

    let credentialResponse;

    try {
      credentialResponse =
        await SimpleWebAuthnBrowser
          .startAuthentication({
            optionsJSON:
              payload.options
          });

    } catch (error) {
      const info =
        describeWebAuthnError(
          error,
          "authentication"
        );

      setStatus(
        "这台设备目前不能使用账号已有 Passkey。" +
        " " +
        info.message,
        "warning"
      );

      return;
    }

    const verified =
      await api(
        "/api/passkeys/test/verify",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              ceremonyId:
                payload.ceremonyId,

              response:
                credentialResponse
            })
        }
      );

    setStatus(
      "测试成功：这台设备可以使用「" +
      (
        verified.passkey
          ?.displayName ||
        "Passkey"
      ) +
      "」直接登录。",
      "success"
    );

    await loadPasskeys();

  } catch (error) {
    console.error(
      error
    );

    if (
      error.code ===
      "passkey_not_configured_for_user"
    ) {
      setStatus(
        "当前账号还没有 Passkey。请先添加一把。",
        "warning"
      );

    } else if (
      error.code ===
      "passkey_wrong_account"
    ) {
      setStatus(
        "浏览器返回的是另一个账号的 Passkey。请重新选择当前账号的凭证。",
        "error"
      );

    } else if (
      error.code ===
      "passkey_authentication_failed"
    ) {
      setStatus(
        "设备返回了 Passkey，但服务器验证失败。请重新加载页面后再试；如果只在某一台设备发生，建议为该设备创建新的本机 Passkey。",
        "error"
      );

    } else {
      setStatus(
        "Passkey 测试失败。",
        "error"
      );
    }

  } finally {
    testButton.disabled =
      false;
  }
}


async function addPasskey(
  preferredAuthenticatorType
) {
  const suggested =
    getDeviceLabel();

  const displayName =
    window.prompt(
      "给这把 Passkey 起一个容易识别的名字：",
      suggested
    );

  if (
    displayName ===
    null
  ) {
    return;
  }

  for (
    const button
    of addButtons
  ) {
    button.disabled =
      true;
  }

  setStatus(
    "正在创建新的 Passkey…"
  );

  try {
    const optionsPayload =
      await api(
        "/api/passkeys/registration/options",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              preferredAuthenticatorType
            })
        }
      );

    let registrationResponse;

    try {
      registrationResponse =
        await SimpleWebAuthnBrowser
          .startRegistration({
            optionsJSON:
              optionsPayload.options
          });

    } catch (error) {
      const info =
        describeWebAuthnError(
          error,
          "registration"
        );

      setStatus(
        info.message,
        info.kind ===
        "already-registered"
          ? "warning"
          : "error"
      );

      return;
    }

    await api(
      "/api/passkeys/registration/verify",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            ceremonyId:
              optionsPayload.ceremonyId,

            response:
              registrationResponse,

            displayName
          })
      }
    );

    setStatus(
      "Passkey 已添加。现在可以使用“测试这台设备”确认它是否可用。",
      "success"
    );

    await loadPasskeys();

  } catch (error) {
    console.error(
      error
    );

    if (
      error.code ===
      "passkey_already_registered"
    ) {
      setStatus(
        "这把 Passkey 已经登记在你的账号下，无需重复添加。请直接使用“测试这台设备”。",
        "warning"
      );

    } else if (
      error.code ===
      "passkey_credential_conflict"
    ) {
      setStatus(
        "这把 credential 已经属于另一个账号，系统拒绝复用。请换一把 Passkey。",
        "error"
      );

    } else {
      setStatus(
        "Passkey 创建没有完成。请尝试另一种保存位置或重新打开页面。",
        "error"
      );
    }

  } finally {
    for (
      const button
      of addButtons
    ) {
      button.disabled =
        false;
    }
  }
}


if (
  !window
    .SimpleWebAuthnBrowser
    ?.browserSupportsWebAuthn()
) {
  testButton.disabled =
    true;

  for (
    const button
    of addButtons
  ) {
    button.disabled =
      true;
  }

  setStatus(
    "当前浏览器不支持 WebAuthn / Passkey。",
    "error"
  );
}


testButton.addEventListener(
  "click",
  testCurrentDevice
);


for (
  const button
  of addButtons
) {
  button.addEventListener(
    "click",
    () =>
      addPasskey(
        button.dataset
          .preferred ||
        ""
      )
  );
}


listElement.addEventListener(
  "click",
  async event => {
    const row =
      event.target.closest(
        "[data-passkey-id]"
      );

    if (!row) {
      return;
    }

    const passkeyId =
      row.dataset.passkeyId;

    if (
      event.target.closest(
        ".renameButton"
      )
    ) {
      const currentName =
        row
          .querySelector(
            ".passkey-title"
          )
          ?.textContent ||
        "Passkey";

      const displayName =
        window.prompt(
          "新的名称：",
          currentName
        );

      if (
        displayName ===
        null
      ) {
        return;
      }

      try {
        await api(
          "/api/passkeys/" +
          encodeURIComponent(
            passkeyId
          ),
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                displayName
              })
          }
        );

        setStatus(
          "Passkey 名称已更新。",
          "success"
        );

        await loadPasskeys();

      } catch (error) {
        console.error(
          error
        );

        setStatus(
          "重命名失败。",
          "error"
        );
      }
    }

    if (
      event.target.closest(
        ".revokeButton"
      )
    ) {
      if (
        !window.confirm(
          "移除这把 Passkey？移除后服务器将不再接受这把凭证登录。"
        )
      ) {
        return;
      }

      try {
        await api(
          "/api/passkeys/" +
          encodeURIComponent(
            passkeyId
          ),
          {
            method:
              "DELETE",

            headers: {
              "Content-Type":
                "application/json"
            }
          }
        );

        setStatus(
          "Passkey 已移除。",
          "success"
        );

        await loadPasskeys();

      } catch (error) {
        console.error(
          error
        );

        if (
          error.code ===
          "last_owner_passkey_cannot_be_removed"
        ) {
          setStatus(
            "这是 Owner 当前最后一把有效 Passkey，系统禁止删除。请先添加另一把独立凭证。",
            "error"
          );

        } else {
          setStatus(
            "移除失败。",
            "error"
          );
        }
      }
    }
  }
);


loadPasskeys()
  .catch(
    error => {
      console.error(
        error
      );

      setStatus(
        "无法读取 Passkey 列表。",
        "error"
      );
    }
  );
`;

  return shell(
    "Passkeys · Jingyan Media Center",
    body,
    script
  );
}
