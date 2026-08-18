function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


function randomNonce() {
  const bytes =
    new Uint8Array(18);

  crypto.getRandomValues(bytes);

  return Array.from(
    bytes,
    byte =>
      byte
        .toString(16)
        .padStart(2, "0")
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
content="width=device-width,initial-scale=1,viewport-fit=cover">

<meta
name="color-scheme"
content="light">

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
    "PingFang SC",
    "Microsoft YaHei",
    sans-serif;

  color:
    #2b1952;

  background:
    #f6f2ff;

  --surface:
    rgba(255, 255, 255, .9);

  --surface-soft:
    rgba(255, 255, 255, .67);

  --border:
    rgba(94, 57, 177, .15);

  --muted:
    #786a99;

  --accent:
    #7652e8;

  --accent-dark:
    #5f39d6;

  --accent-soft:
    #f0eaff;

  --success:
    #177452;

  --success-soft:
    #ebf8f2;

  --danger:
    #b13c56;

  --danger-soft:
    #fff0f3;

  --warning:
    #93620b;

  --warning-soft:
    #fff8e7;

  --shadow:
    0 24px 70px
    rgba(70, 42, 126, .12);
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

  min-height:
    100dvh;

  background:
    radial-gradient(
      circle at 10% 5%,
      rgba(176, 139, 255, .24),
      transparent 28rem
    ),
    radial-gradient(
      circle at 92% 18%,
      rgba(227, 211, 255, .72),
      transparent 31rem
    ),
    linear-gradient(
      180deg,
      #fbf9ff 0%,
      #f2edfc 100%
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


button {
  -webkit-tap-highlight-color:
    transparent;
}


.wrap {
  width:
    min(
      980px,
      calc(100% - 32px)
    );

  margin:
    0 auto;

  padding:
    24px 0
    max(
      54px,
      env(safe-area-inset-bottom)
    );
}


.topbar {
  display:
    flex;

  align-items:
    center;

  justify-content:
    space-between;

  gap:
    16px;

  margin-bottom:
    34px;
}


.brand {
  display:
    flex;

  align-items:
    center;

  gap:
    13px;

  min-width:
    0;
}


.logo {
  width:
    52px;

  height:
    52px;

  flex:
    0 0 auto;

  border-radius:
    17px;

  display:
    grid;

  place-items:
    center;

  color:
    #fff;

  font-weight:
    850;

  font-size:
    23px;

  background:
    linear-gradient(
      145deg,
      #9a70ff,
      #6740de
    );

  box-shadow:
    0 14px 28px
    rgba(103, 65, 219, .23);
}


.brand-title {
  display:
    block;

  font-size:
    20px;

  line-height:
    1.15;

  font-weight:
    820;

  overflow:
    hidden;

  text-overflow:
    ellipsis;

  white-space:
    nowrap;
}


.brand-subtitle {
  display:
    block;

  margin-top:
    3px;

  color:
    var(--muted);

  font-size:
    13px;
}


.navlink {
  flex:
    0 0 auto;

  padding:
    10px 15px;

  background:
    rgba(255, 255, 255, .7);

  border:
    1px solid
    var(--border);

  border-radius:
    999px;

  font-size:
    14px;
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
    blur(18px);
}


.hero {
  padding:
    clamp(
      27px,
      6vw,
      58px
    );
}


.section {
  padding:
    26px;

  margin-top:
    20px;
}


.eyebrow {
  color:
    var(--accent);

  font-size:
    12px;

  font-weight:
    850;

  letter-spacing:
    .17em;

  text-transform:
    uppercase;
}


h1 {
  margin:
    14px 0 18px;

  font-size:
    clamp(
      38px,
      8vw,
      68px
    );

  line-height:
    .99;

  letter-spacing:
    -.052em;
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
    17px;
}


p {
  line-height:
    1.72;
}


.muted {
  color:
    var(--muted);
}


.actions {
  display:
    flex;

  gap:
    11px;

  flex-wrap:
    wrap;

  margin-top:
    25px;
}


.button {
  border:
    0;

  border-radius:
    16px;

  min-height:
    46px;

  padding:
    12px 18px;

  display:
    inline-flex;

  align-items:
    center;

  justify-content:
    center;

  gap:
    8px;

  cursor:
    pointer;

  font-weight:
    780;

  line-height:
    1.25;

  transition:
    transform .13s ease,
    opacity .13s ease,
    box-shadow .13s ease;
}


.button:hover {
  transform:
    translateY(-1px);
}


.button:active {
  transform:
    translateY(0);
}


.button:disabled {
  cursor:
    wait;

  opacity:
    .52;

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
    rgba(103, 65, 219, .22);
}


.button-secondary {
  color:
    #392264;

  background:
    var(--accent-soft);

  border:
    1px solid
    rgba(103, 65, 219, .11);
}


.button-soft {
  color:
    #4b3d6b;

  background:
    rgba(255, 255, 255, .78);

  border:
    1px solid
    var(--border);
}


.button-danger {
  color:
    var(--danger);

  background:
    var(--danger-soft);

  border:
    1px solid
    rgba(177, 60, 86, .14);
}


.button-large {
  min-height:
    54px;

  padding:
    15px 23px;

  font-size:
    16px;
}


.status {
  margin-top:
    19px;

  min-height:
    25px;

  color:
    var(--muted);

  line-height:
    1.62;

  overflow-wrap:
    anywhere;
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


.status-box {
  margin-top:
    18px;

  padding:
    15px 17px;

  border:
    1px solid
    var(--border);

  border-radius:
    17px;

  background:
    rgba(255, 255, 255, .68);

  line-height:
    1.62;
}


.status-box.success {
  color:
    var(--success);

  border-color:
    rgba(23, 116, 82, .16);

  background:
    var(--success-soft);
}


.status-box.warning {
  color:
    var(--warning);

  border-color:
    rgba(147, 98, 11, .15);

  background:
    var(--warning-soft);
}


.status-box.error {
  color:
    var(--danger);

  border-color:
    rgba(177, 60, 86, .15);

  background:
    var(--danger-soft);
}


.diagnostic {
  display:
    block;

  margin-top:
    8px;

  opacity:
    .75;

  font-family:
    ui-monospace,
    SFMono-Regular,
    Consolas,
    monospace;

  font-size:
    11px;

  overflow-wrap:
    anywhere;
}


.divider {
  height:
    1px;

  margin:
    29px 0;

  background:
    var(--border);
}


.grid {
  display:
    grid;

  grid-template-columns:
    repeat(
      auto-fit,
      minmax(
        210px,
        1fr
      )
    );

  gap:
    13px;
}


.mini-card,
.security-action {
  padding:
    18px;

  border:
    1px solid
    var(--border);

  border-radius:
    20px;

  background:
    var(--surface-soft);
}


.mini-card p,
.security-action p {
  margin:
    8px 0 13px;

  color:
    var(--muted);

  font-size:
    13px;
}


.recommended {
  position:
    relative;

  padding:
    22px;

  margin-top:
    18px;

  border:
    1px solid
    rgba(118, 82, 232, .22);

  border-radius:
    22px;

  background:
    linear-gradient(
      145deg,
      rgba(244, 239, 255, .94),
      rgba(255, 255, 255, .84)
    );
}


.recommended-badge {
  display:
    inline-flex;

  margin-bottom:
    11px;

  padding:
    6px 9px;

  color:
    #6240c6;

  background:
    rgba(118, 82, 232, .1);

  border-radius:
    999px;

  font-size:
    11px;

  font-weight:
    850;
}


.recommended p {
  margin:
    8px 0 17px;

  color:
    var(--muted);

  font-size:
    13px;
}


.security-actions {
  display:
    grid;

  grid-template-columns:
    repeat(
      auto-fit,
      minmax(
        190px,
        1fr
      )
    );

  gap:
    12px;

  margin-top:
    14px;
}


details {
  margin-top:
    16px;
}


summary {
  cursor:
    pointer;

  color:
    #5b477f;

  font-size:
    14px;

  font-weight:
    750;

  user-select:
    none;
}


.passkey-list {
  display:
    grid;

  gap:
    13px;

  margin-top:
    18px;
}


.passkey-row {
  padding:
    18px;

  display:
    grid;

  grid-template-columns:
    minmax(0, 1fr)
    auto;

  align-items:
    center;

  gap:
    14px;

  border:
    1px solid
    var(--border);

  border-radius:
    20px;

  background:
    rgba(255, 255, 255, .72);
}


.passkey-title {
  font-size:
    17px;

  font-weight:
    820;

  overflow-wrap:
    anywhere;
}


.passkey-meta {
  margin-top:
    6px;

  color:
    var(--muted);

  font-size:
    13px;

  line-height:
    1.62;
}


.row-actions {
  display:
    flex;

  justify-content:
    flex-end;

  flex-wrap:
    wrap;

  gap:
    8px;
}


.pill {
  display:
    inline-flex;

  align-items:
    center;

  gap:
    6px;

  padding:
    7px 10px;

  color:
    #6541c9;

  background:
    rgba(118, 82, 232, .09);

  border-radius:
    999px;

  font-size:
    12px;

  font-weight:
    780;
}


.notice {
  padding:
    16px 18px;

  color:
    #5f507f;

  background:
    rgba(118, 82, 232, .07);

  border:
    1px solid
    rgba(118, 82, 232, .12);

  border-radius:
    18px;

  line-height:
    1.7;
}


.mobile-flow {
  display:
    grid;

  gap:
    10px;

  margin-top:
    17px;
}


.flow-row {
  display:
    grid;

  grid-template-columns:
    29px
    1fr;

  gap:
    10px;

  align-items:
    start;
}


.flow-number {
  width:
    29px;

  height:
    29px;

  display:
    grid;

  place-items:
    center;

  border-radius:
    50%;

  color:
    #6643cc;

  background:
    var(--accent-soft);

  font-size:
    12px;

  font-weight:
    850;
}


.flow-row strong {
  display:
    block;

  margin-bottom:
    3px;
}


.flow-row span {
  color:
    var(--muted);

  font-size:
    13px;

  line-height:
    1.55;
}


@media (
  max-width:
    640px
) {

  .wrap {
    width:
      min(
        100% - 18px,
        980px
      );

    padding-top:
      max(
        12px,
        env(safe-area-inset-top)
      );
  }


  .topbar {
    margin-bottom:
      19px;
  }


  .logo {
    width:
      46px;

    height:
      46px;

    border-radius:
      15px;

    font-size:
      21px;
  }


  .brand-title {
    max-width:
      210px;

    font-size:
      17px;
  }


  .brand-subtitle {
    display:
      none;
  }


  .navlink {
    padding:
      9px 12px;

    font-size:
      13px;
  }


  .hero,
  .section {
    padding:
      21px;

    border-radius:
      24px;
  }


  h1 {
    font-size:
      clamp(
        39px,
        12vw,
        58px
      );
  }


  .actions {
    display:
      grid;

    grid-template-columns:
      1fr;
  }


  .actions .button {
    width:
      100%;
  }


  .recommended .button {
    width:
      100%;
  }


  .passkey-row {
    grid-template-columns:
      1fr;
  }


  .row-actions {
    justify-content:
      stretch;
  }


  .row-actions .button {
    flex:
      1 1 auto;
  }


  .security-actions {
    grid-template-columns:
      1fr;
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

            "script-src 'self' 'nonce-" +
              nonce +
              "'",

            "style-src 'nonce-" +
              nonce +
              "'",

            "img-src 'self' data:",

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


function commonClientHelpers() {
  return `
function setStatusElement(
  element,
  message,
  type
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


function setStatusBox(
  element,
  message,
  type,
  diagnostic
) {
  element.className =
    "status-box" +
    (
      type
        ? " " + type
        : ""
    );

  element.textContent =
    message ||
    "";

  if (
    diagnostic
  ) {
    var code =
      document.createElement(
        "span"
      );

    code.className =
      "diagnostic";

    code.textContent =
      "诊断：" +
      diagnostic;

    element.appendChild(
      code
    );
  }
}


async function readApiJson(
  response
) {
  var data =
    await response
      .json()
      .catch(
        function () {
          return {};
        }
      );

  if (
    !response.ok
  ) {
    var error =
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


function getSafeDiagnostic(
  error
) {
  var names =
    [
      error &&
      error.name,

      error &&
      error.code,

      error &&
      error.cause &&
      error.cause.name,

      error &&
      error.cause &&
      error.cause.code
    ]
      .filter(Boolean)
      .map(
        function (
          value
        ) {
          return String(value)
            .replace(
              /[^A-Za-z0-9_.:-]/g,
              ""
            )
            .slice(
              0,
              80
            );
        }
      );

  if (
    names.length ===
    0
  ) {
    return "UNKNOWN";
  }

  return names.join(
    " / "
  );
}


function getErrorText(
  error
) {
  return [
    error &&
    error.name,

    error &&
    error.code,

    error &&
    error.message,

    error &&
    error.cause &&
    error.cause.name,

    error &&
    error.cause &&
    error.cause.code,

    error &&
    error.cause &&
    error.cause.message
  ]
    .filter(Boolean)
    .map(
      function (
        value
      ) {
        return String(
          value
        );
      }
    )
    .join(
      " "
    );
}


function describeWebAuthnError(
  error,
  operation
) {
  var text =
    getErrorText(
      error
    );

  var diagnostic =
    getSafeDiagnostic(
      error
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

      diagnostic:
        diagnostic,

      message:
        "这个 Passkey 保存位置已经存在当前账号的凭证，不需要重复创建。先使用“测试这台设备”；如果要增加真正独立的备用凭证，请换另一个密码管理器、另一台设备或安全密钥。"
    };
  }


  if (
    /ConstraintError/i
      .test(
        text
      )
  ) {
    return {
      kind:
        "unsupported-authenticator",

      diagnostic:
        diagnostic,

      message:
        "当前选择的 Passkey 保存方式无法满足本站的安全要求。请返回后使用“系统推荐方式”，让手机或浏览器自动选择兼容的 Passkey Provider。"
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

      diagnostic:
        diagnostic,

      message:
        "浏览器因 WebAuthn 安全策略拒绝了这次操作。请确认地址仍是 Jingyan Media Center 的正式 HTTPS 页面，然后重新加载再试。"
    };
  }


  if (
    /AbortError|ERROR_CEREMONY_ABORTED/i
      .test(
        text
      )
  ) {
    return {
      kind:
        "cancelled",

      diagnostic:
        diagnostic,

      message:
        "Passkey 操作被取消。没有产生任何账号变化，可以直接重新尝试。"
    };
  }


  if (
    /NotAllowedError|ERROR_PASSTHROUGH|not.?allowed/i
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
          "not-allowed",

        diagnostic:
          diagnostic,

        message:
          "手机没有完成 Passkey 创建。请优先使用“系统推荐方式”；如果仍失败，请检查手机是否已启用系统密码管理器 / Passkey，并确认屏幕锁、指纹或面容验证可正常使用。"
      };
    }

    return {
      kind:
        "not-available",

      diagnostic:
        diagnostic,

      message:
        "这台设备目前没有找到能用于当前账号的 Passkey，或者系统提示被取消。新设备可以先使用设备配对，不需要找 Owner 重新注册账号。"
    };
  }


  return {
    kind:
      "unknown",

    diagnostic:
      diagnostic,

    message:
      operation ===
      "registration"
        ? "Passkey 创建没有完成。请先用“系统推荐方式”再试一次；如果仍失败，把下面的诊断码发给管理员即可。"
        : "Passkey 登录没有完成。可以重新尝试；如果这是新设备，可以直接使用设备配对。"
  };
}


function getDeviceLabel() {
  var ua =
    navigator.userAgent ||
    "";

  var platform =
    (
      navigator.userAgentData &&
      navigator.userAgentData.platform
    ) ||
    navigator.platform ||
    "Device";

  var browser =
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
    /EdgA?\\//i.test(
      ua
    )
  ) {
    browser =
      "Edge";

  } else if (
    /CriOS|Chrome\\//i
      .test(
        ua
      )
  ) {
    browser =
      "Chrome";

  } else if (
    /Firefox|FxiOS/i
      .test(
        ua
      )
  ) {
    browser =
      "Firefox";

  } else if (
    /Safari\\//i
      .test(
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

        <span class="brand-subtitle">
          Secure Sign-in
        </span>

      </span>

    </a>


    <a
    class="navlink"
    href="/">
      首页
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

      已经设置 Passkey 的 Owner 和朋友，可以直接用手机、
      指纹、面容、设备 PIN 或密码管理器登录。

    </p>


    <div class="actions">

      <button
      id="loginButton"
      class="button button-primary button-large"
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

        <p>
          只在第一次创建账号时使用 Owner 给你的单次邀请码。
        </p>

        <a href="/activate">
          使用邀请码 →
        </a>

      </div>


      <div class="mini-card">

        <strong>
          换新手机 / 新电脑
        </strong>

        <p>
          如果旧设备还登录着，直接生成一次性配对码，不需要找 Owner。
        </p>

        <a href="/device">
          新设备配对 →
        </a>

      </div>


      <div class="mini-card">

        <strong>
          所有旧设备都丢了
        </strong>

        <p>
          朋友使用 Owner 为原账号签发的恢复码，不会创建重复账号。
        </p>

        <a href="/recover">
          使用恢复码 →
        </a>

      </div>


      <div class="mini-card">

        <strong>
          Owner 最后保险
        </strong>

        <p>
          仅在 Owner 的 Passkey、设备和正常恢复方式全部不可用时使用。
        </p>

        <a href="/owner-recover">
          高级恢复 →
        </a>

      </div>

    </div>

  </main>

</div>`;


  const script =
    commonClientHelpers() +
`
var button =
  document.getElementById(
    "loginButton"
  );


var statusElement =
  document.getElementById(
    "status"
  );


function setStatus(
  message,
  type
) {
  setStatusElement(
    statusElement,
    message,
    type ||
    ""
  );
}


if (
  !window.SimpleWebAuthnBrowser ||
  !window
    .SimpleWebAuthnBrowser
    .browserSupportsWebAuthn()
) {
  button.disabled =
    true;

  setStatus(
    "当前浏览器不支持 Passkey。可以继续使用设备配对或恢复码。",
    "error"
  );
}


button.addEventListener(
  "click",

  async function () {
    button.disabled =
      true;

    setStatus(
      "正在打开系统 Passkey…",
      ""
    );


    try {
      var optionsResponse =
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


      var payload =
        await readApiJson(
          optionsResponse
        );


      var credentialResponse;


      try {
        credentialResponse =
          await SimpleWebAuthnBrowser
            .startAuthentication({
              optionsJSON:
                payload.options
            });

      } catch (
        error
      ) {
        var info =
          describeWebAuthnError(
            error,
            "authentication"
          );

        setStatus(
          info.message +
          " [" +
          info.diagnostic +
          "]",
          "error"
        );

        return;
      }


      var verifyResponse =
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


    } catch (
      error
    ) {
      console.error(
        error
      );


      if (
        error.code ===
        "rate_limited"
      ) {
        setStatus(
          "尝试过于频繁，请等待约 1 分钟后再试。",
          "warning"
        );

      } else if (
        error.code ===
        "passkey_authentication_failed"
      ) {
        setStatus(
          "设备已经返回 Passkey，但服务器没有通过验证。请重新打开页面再试；如果只是新手机，先用设备配对登录即可。",
          "error"
        );

      } else {
        setStatus(
          "登录请求没有完成。可以直接重试，或者使用新设备配对。",
          "error"
        );
      }


    } finally {
      button.disabled =
        false;
    }
  }
);
`;


  return shell(
    "登录 · Jingyan Media Center",
    body,
    script
  );
}


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

        <span class="brand-subtitle">
          Login & Security
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
      Login & Security
    </div>


    <h1>
      登录与安全
    </h1>


    <p class="muted">
      ${displayName} · ${role}
    </p>


    <p class="muted">

      Passkey 是你的快捷登录凭证。

      如果系统密码管理器支持同步，
      同一把 Passkey 可能直接跟着你到新手机，
      不需要每台设备都重新注册。

    </p>


    <div class="actions">

      <button
      id="testButton"
      class="button button-secondary"
      type="button">

        测试这台设备

      </button>


      <a
      class="button button-soft"
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
      添加 Passkey
    </h2>


    <div class="recommended">

      <span class="recommended-badge">
        推荐 · 手机优先
      </span>


      <h3>
        让系统自动选择
      </h3>


      <p>

        推荐电脑和手机都使用这个入口。

        不强制 Windows Hello、手机本机密钥、
        Microsoft、Google、Apple 或其他密码管理器，
        让浏览器显示当前设备真正可用的保存方式。

      </p>


      <button
      id="recommendedAddButton"
      class="button button-primary button-large"
      type="button">

        添加 Passkey

      </button>

    </div>


    <details>

      <summary>
        高级：手动选择 Passkey 类型
      </summary>


      <div class="security-actions">

        <div class="security-action">

          <h3>
            当前设备
          </h3>

          <p>
            明确倾向当前手机或电脑的平台认证器。
          </p>

          <button
          class="button button-secondary advancedAddButton"
          data-preferred="localDevice"
          type="button">

            使用当前设备

          </button>

        </div>


        <div class="security-action">

          <h3>
            其他设备
          </h3>

          <p>
            倾向另一台手机、平板或跨设备 QR / Hybrid 流程。
          </p>

          <button
          class="button button-soft advancedAddButton"
          data-preferred="remoteDevice"
          type="button">

            使用其他设备

          </button>

        </div>


        <div class="security-action">

          <h3>
            安全密钥
          </h3>

          <p>
            USB、NFC 等 FIDO2 硬件安全密钥。
          </p>

          <button
          class="button button-soft advancedAddButton"
          data-preferred="securityKey"
          type="button">

            添加安全密钥

          </button>

        </div>

      </div>

    </details>


    <div
    id="registrationResult"
    class="status-box"
    hidden>
    </div>

  </section>


  <section class="card section">

    <div class="eyebrow">
      New Device
    </div>


    <h2>
      换设备时怎么办？
    </h2>


    <div class="mobile-flow">

      <div class="flow-row">

        <span class="flow-number">
          1
        </span>

        <div>

          <strong>
            先直接试 Passkey
          </strong>

          <span>
            如果你的密码管理器同步了 Passkey，新手机可以直接登录。
          </span>

        </div>

      </div>


      <div class="flow-row">

        <span class="flow-number">
          2
        </span>

        <div>

          <strong>
            没有 Passkey就用设备配对
          </strong>

          <span>
            只要任何旧设备仍登录，就能自己生成一次性配对码，不需要找 Owner。
          </span>

        </div>

      </div>


      <div class="flow-row">

        <span class="flow-number">
          3
        </span>

        <div>

          <strong>
            全部设备都丢失才恢复
          </strong>

          <span>
            普通用户才需要让 Owner 给原账号生成恢复码；账号、媒体和权限都不会重建。
          </span>

        </div>

      </div>

    </div>


    <div class="actions">

      <a
      class="button button-secondary"
      href="/device">

        新设备配对

      </a>

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

      私钥、指纹、Face ID、Windows Hello PIN
      都不会上传到 Jingyan Media Center。

      服务器只保存 WebAuthn 验证所需的公钥和凭证信息。

    </div>

  </section>

</div>`;


  const script =
    commonClientHelpers() +
`
var statusElement =
  document.getElementById(
    "status"
  );


var registrationResult =
  document.getElementById(
    "registrationResult"
  );


var listElement =
  document.getElementById(
    "passkeyList"
  );


var countPill =
  document.getElementById(
    "countPill"
  );


var testButton =
  document.getElementById(
    "testButton"
  );


var recommendedAddButton =
  document.getElementById(
    "recommendedAddButton"
  );


var advancedAddButtons =
  Array.from(
    document.querySelectorAll(
      ".advancedAddButton"
    )
  );


var securityNotice =
  document.getElementById(
    "securityNotice"
  );


function setStatus(
  message,
  type
) {
  setStatusElement(
    statusElement,
    message,
    type ||
    ""
  );
}


function showRegistrationResult(
  message,
  type,
  diagnostic
) {
  registrationResult.hidden =
    false;

  setStatusBox(
    registrationResult,
    message,
    type,
    diagnostic
  );
}


function clearRegistrationResult() {
  registrationResult.hidden =
    true;

  registrationResult.textContent =
    "";

  registrationResult.className =
    "status-box";
}


function escapeHtmlClient(
  value
) {
  return String(
    value == null
      ? ""
      : value
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
    Number(value) *
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
  options
) {
  var response =
    await fetch(
      url,
      options ||
      {}
    );

  return readApiJson(
    response
  );
}


function setAddButtonsDisabled(
  disabled
) {
  recommendedAddButton.disabled =
    disabled;

  advancedAddButtons
    .forEach(
      function (
        button
      ) {
        button.disabled =
          disabled;
      }
    );
}


function renderPasskeys(
  data
) {
  var passkeys =
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
      '当前账号还没有 Passkey。你现在仍通过 Session 登录，可以直接使用上面的“添加 Passkey”。' +
      '</div>';

  } else {
    listElement.innerHTML =
      passkeys
        .map(
          function (
            passkey
          ) {
            var id =
              escapeHtmlClient(
                passkey.id
              );


            var name =
              escapeHtmlClient(
                passkey.displayName
              );


            var deviceType =
              "Passkey";


            if (
              passkey.deviceType ===
              "multiDevice"
            ) {
              deviceType =
                "同步型 / 多设备";

            } else if (
              passkey.deviceType ===
              "singleDevice"
            ) {
              deviceType =
                "单设备";
            }


            var backup =
              passkey.backedUp
                ? "已备份 / 可同步"
                : "未标记为已备份";


            var created =
              escapeHtmlClient(
                formatTime(
                  passkey.createdAt
                )
              );


            var lastUsed =
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
        "Owner 至少有一把已备份/同步型 Passkey。它可能可以随密码管理器在多台设备使用。仍建议保留另一条独立恢复路径，例如另一台已登录设备或不同的 Passkey Provider。";

    } else if (
      passkeys.length <
      2
    ) {
      securityNotice.textContent =
        "Owner 当前只有一把未标记为已备份的 Passkey。请保留手机或另一台电脑的登录 Session。系统不会允许删除最后一把 Owner Passkey。";

    } else {
      securityNotice.textContent =
        "Owner 已有多把 Passkey。继续保留至少两条彼此独立的恢复路径即可。";
    }

  } else {
    securityNotice.textContent =
      "Passkey 只负责登录，不会改变你的媒体权限。上传图片、音频、视频以及管理权限仍由 Owner 在服务器端控制。";
  }
}


async function loadPasskeys() {
  var data =
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
    "正在检查这台设备能否使用现有 Passkey…",
    ""
  );


  try {
    var payload =
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


    var credentialResponse;


    try {
      credentialResponse =
        await SimpleWebAuthnBrowser
          .startAuthentication({
            optionsJSON:
              payload.options
          });

    } catch (
      error
    ) {
      var info =
        describeWebAuthnError(
          error,
          "authentication"
        );

      setStatus(
        "这台设备目前不能使用账号已有 Passkey。 " +
        info.message +
        " [" +
        info.diagnostic +
        "]",
        "warning"
      );

      return;
    }


    var verified =
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
      "测试成功：这台设备现在可以使用「" +
      (
        verified.passkey &&
        verified.passkey.displayName
          ? verified.passkey.displayName
          : "Passkey"
      ) +
      "」直接登录。",
      "success"
    );


    await loadPasskeys();


  } catch (
    error
  ) {
    console.error(
      error
    );


    if (
      error.code ===
      "passkey_not_configured_for_user"
    ) {
      setStatus(
        "当前账号还没有 Passkey。请直接点击“添加 Passkey”。",
        "warning"
      );

    } else if (
      error.code ===
      "passkey_wrong_account"
    ) {
      setStatus(
        "浏览器返回的是另一个账号的 Passkey。请重新选择当前账号。",
        "error"
      );

    } else if (
      error.code ===
      "passkey_authentication_failed"
    ) {
      setStatus(
        "设备返回了凭证，但服务器验证失败。请重新加载页面再试。",
        "error"
      );

    } else {
      setStatus(
        "Passkey 测试没有完成。",
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
  var suggested =
    getDeviceLabel();


  var displayName =
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


  clearRegistrationResult();

  setAddButtonsDisabled(
    true
  );


  setStatus(
    preferredAuthenticatorType
      ? "正在打开指定的 Passkey 保存方式…"
      : "正在让系统选择最适合这台设备的 Passkey 保存方式…",
    ""
  );


  try {
    var requestBody =
      {};


    if (
      preferredAuthenticatorType
    ) {
      requestBody.preferredAuthenticatorType =
        preferredAuthenticatorType;
    }


    var optionsPayload =
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
            JSON.stringify(
              requestBody
            )
        }
      );


    var registrationResponse;


    try {
      registrationResponse =
        await SimpleWebAuthnBrowser
          .startRegistration({
            optionsJSON:
              optionsPayload.options
          });

    } catch (
      error
    ) {
      var info =
        describeWebAuthnError(
          error,
          "registration"
        );


      showRegistrationResult(
        info.message,
        info.kind ===
        "already-registered"
          ? "warning"
          : "error",
        info.diagnostic
      );


      setStatus(
        "",
        ""
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

            displayName:
              displayName
          })
      }
    );


    showRegistrationResult(
      "Passkey 创建成功。以后这台设备可以直接从登录页使用 Passkey；如果该 Passkey Provider 支持同步，新设备也可能自动可用。",
      "success",
      ""
    );


    setStatus(
      "Passkey 已添加。",
      "success"
    );


    await loadPasskeys();


  } catch (
    error
  ) {
    console.error(
      error
    );


    if (
      error.code ===
      "passkey_already_registered"
    ) {
      showRegistrationResult(
        "服务器确认这把 Passkey 已经登记在你的账号下，无需重复创建。请使用“测试这台设备”。",
        "warning",
        error.code
      );

    } else if (
      error.code ===
      "passkey_credential_conflict"
    ) {
      showRegistrationResult(
        "这个凭证已经属于另一个账号，服务器已安全拒绝复用。请换一个 Passkey 保存位置。",
        "error",
        error.code
      );

    } else if (
      error.code ===
      "passkey_registration_failed"
    ) {
      showRegistrationResult(
        "手机已经生成了认证响应，但服务器验证没有通过。请把这个诊断码发给管理员，不要删除现有 Passkey。",
        "error",
        error.code
      );

    } else if (
      error.code ===
      "passkey_ceremony_expired"
    ) {
      showRegistrationResult(
        "这次 Passkey 操作已经超时。重新点击“添加 Passkey”即可。",
        "warning",
        error.code
      );

    } else {
      showRegistrationResult(
        "Passkey 创建请求没有完成。可以重新尝试系统推荐方式。",
        "error",
        error.code ||
        "request_failed"
      );
    }


    setStatus(
      "",
      ""
    );


  } finally {
    setAddButtonsDisabled(
      false
    );
  }
}


if (
  !window.SimpleWebAuthnBrowser ||
  !window
    .SimpleWebAuthnBrowser
    .browserSupportsWebAuthn()
) {
  testButton.disabled =
    true;

  setAddButtonsDisabled(
    true
  );

  setStatus(
    "当前浏览器不支持 WebAuthn / Passkey。你仍可以使用设备配对和恢复码。",
    "error"
  );
}


testButton.addEventListener(
  "click",
  testCurrentDevice
);


recommendedAddButton.addEventListener(
  "click",
  function () {
    addPasskey(
      ""
    );
  }
);


advancedAddButtons
  .forEach(
    function (
      button
    ) {
      button.addEventListener(
        "click",
        function () {
          addPasskey(
            button.dataset
              .preferred ||
            ""
          );
        }
      );
    }
  );


listElement.addEventListener(
  "click",

  async function (
    event
  ) {
    var row =
      event.target.closest(
        "[data-passkey-id]"
      );


    if (!row) {
      return;
    }


    var passkeyId =
      row.dataset.passkeyId;


    if (
      event.target.closest(
        ".renameButton"
      )
    ) {
      var titleElement =
        row.querySelector(
          ".passkey-title"
        );


      var currentName =
        titleElement
          ? titleElement.textContent
          : "Passkey";


      var displayName =
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
                displayName:
                  displayName
              })
          }
        );


        setStatus(
          "Passkey 名称已更新。",
          "success"
        );


        await loadPasskeys();


      } catch (
        error
      ) {
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
          "移除这把 Passkey？移除后服务器将不再接受它登录。"
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


      } catch (
        error
      ) {
        console.error(
          error
        );


        if (
          error.code ===
          "last_owner_passkey_cannot_be_removed"
        ) {
          setStatus(
            "这是 Owner 当前最后一把有效 Passkey，系统禁止删除。请先增加另一条可靠登录方式。",
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
    function (
      error
    ) {
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
    "登录与安全 · Jingyan Media Center",
    body,
    script
  );
}
