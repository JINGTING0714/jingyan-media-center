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
      .86
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

  --success:
    #197a55;

  --danger:
    #b13c56;

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
        .65
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
      960px,
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
    42px;
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
      .6
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
      64px
    );
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
      72px
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
    28px;
}

.button {
  border:
    0;

  border-radius:
    16px;

  padding:
    14px 20px;

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
    #f3eeff;

  border:
    1px solid
    rgba(
      103,
      65,
      219,
      .12
    );
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
    22px;

  min-height:
    26px;

  color:
    var(--muted);
}

.status.success {
  color:
    var(--success);
}

.status.error {
  color:
    var(--danger);
}

.divider {
  height:
    1px;

  background:
    var(--border);

  margin:
    32px 0;
}

.grid {
  display:
    grid;

  grid-template-columns:
    repeat(
      auto-fit,
      minmax(
        240px,
        1fr
      )
    );

  gap:
    16px;
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
    rgba(
      255,
      255,
      255,
      .62
    );
}

.section {
  padding:
    26px;

  margin-top:
    20px;
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
      .68
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
    1.6;
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

@media (
  max-width:
    640px
) {

  .wrap {
    width:
      min(
        100% - 20px,
        960px
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

            `script-src 'self' 'nonce-${nonce}'`,

            `style-src 'nonce-${nonce}'`,

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


export function renderOwnerLoginPage() {

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
          Owner Secure Sign-in
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
      Owner Access
    </div>


    <h1>
      使用 Passkey
      <br>
      安全登录。
    </h1>


    <p class="muted">

      使用 Windows Hello、Face ID、Touch ID、
      设备 PIN 或你保存的跨设备 Passkey。

      不需要用户名和密码。

    </p>


    <div class="actions">

      <button
      id="loginButton"
      class="button button-primary"
      type="button">
        使用 Passkey 登录
      </button>


      <a
      class="button button-secondary"
      href="/activate">
        受邀用户激活
      </a>

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
          新设备
        </strong>

        <p class="muted">
          已有账户的朋友可以使用设备配对。
        </p>

        <a href="/device">
          打开设备配对 →
        </a>

      </div>


      <div class="mini-card">

        <strong>
          恢复登录
        </strong>

        <p class="muted">
          Uploader 可使用 Owner 签发的恢复码。
        </p>

        <a href="/recover">
          打开恢复入口 →
        </a>

      </div>

    </div>

  </main>

</div>`;


  const script =
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

  statusElement.textContent =
    message ||
    "";

  statusElement.className =
    "status" +
    (
      type
        ? " " + type
        : ""
    );

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


async function readJson(
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


    throw error;

  }


  return data;

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
        await readJson(
          optionsResponse
        );


      const credentialResponse =
        await SimpleWebAuthnBrowser
          .startAuthentication({

            optionsJSON:
              payload.options

          });


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


      await readJson(
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
        "owner_passkey_not_configured"
      ) {

        setStatus(

          "Owner 还没有注册 Passkey。请先在已登录设备打开 /passkeys 完成首次注册。",

          "error"

        );

      } else if (
        error.name ===
        "NotAllowedError"
      ) {

        setStatus(
          "Passkey 操作已取消或超时。",
          "error"
        );

      } else {

        setStatus(
          "Passkey 登录失败，请重试。",
          "error"
        );

      }


      button.disabled =
        false;

    }

  }
);`;


  return shell(

    "Owner Passkey 登录 · Jingyan Media Center",

    body,

    script

  );

}


export function renderPasskeyManagerPage(
  user
) {

  const displayName =
    escapeHtml(
      user?.displayName ||
      "Owner"
    );


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
          Security Center
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
      Owner Security
    </div>


    <h1>
      Passkeys
    </h1>


    <p class="muted">

      ${displayName}，这里管理 Owner 的日常登录密钥。

      建议至少保留两把，
      分别放在不同设备或 Passkey 提供商中。

    </p>


    <div class="actions">

      <button
      id="addButton"
      class="button button-primary"
      type="button">
        添加登录密钥
      </button>


      <a
      class="button button-secondary"
      href="/owner-login">
        测试 Owner 登录
      </a>

    </div>


    <div
    id="status"
    class="status">
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
          Registered Keys
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

    <div class="notice">

      <strong>
        安全规则：
      </strong>

      私钥、指纹、Face ID、
      Windows Hello PIN 都不会上传到
      Jingyan Media Center。

      服务器只保存用于验证登录的公钥。

      系统也不会允许你删除最后一把有效 Passkey；
      要更换最后一把时，先添加新的。

    </div>

  </section>

</div>`;


  const script =
`
const addButton =
  document.getElementById(
    "addButton"
  );

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


function setStatus(
  message,
  type = ""
) {

  statusElement.textContent =
    message ||
    "";

  statusElement.className =
    "status" +
    (
      type
        ? " " + type
        : ""
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


async function api(
  url,
  options = {}
) {

  const response =
    await fetch(
      url,
      options
    );


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


    throw error;

  }


  return data;

}


function renderPasskeys(
  passkeys,
  recommendedMinimum
) {

  countPill.textContent =
    passkeys.length +
    " 把有效密钥";


  if (
    passkeys.length ===
    0
  ) {

    listElement.innerHTML =

      '<div class="notice">' +

      '还没有 Passkey。请先添加第一把；添加完成前不要退出当前 Owner Session。' +

      '</div>';


    return;

  }


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
            escapeHtmlClient(
              passkey.deviceType ||
              "Passkey"
            );


          const backup =
            passkey.backedUp

              ? "已备份/可同步"

              : "设备密钥";


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

                  deviceType +
                  ' · ' +
                  backup +
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


  if (
    passkeys.length <
    Number(
      recommendedMinimum ||
      2
    )
  ) {

    setStatus(

      "建议再添加一把备用 Passkey，避免单设备丢失后只能走紧急恢复。",

      ""

    );

  }

}


async function loadPasskeys() {

  const data =
    await api(
      "/api/passkeys"
    );


  renderPasskeys(

    data.passkeys ||
    [],

    data.recommendedMinimum ||
    2

  );

}


if (
  !window
    .SimpleWebAuthnBrowser
    ?.browserSupportsWebAuthn()
) {

  addButton.disabled =
    true;


  setStatus(
    "当前浏览器不支持 WebAuthn / Passkey。",
    "error"
  );

}


addButton.addEventListener(

  "click",

  async () => {

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


    addButton.disabled =
      true;


    setStatus(
      "正在调用系统 Passkey…"
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
              "{}"

          }

        );


      const registrationResponse =
        await SimpleWebAuthnBrowser
          .startRegistration({

            optionsJSON:
              optionsPayload.options

          });


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
        "Passkey 已添加。",
        "success"
      );


      await loadPasskeys();


    } catch (error) {

      console.error(
        error
      );


      if (
        error.name ===
        "NotAllowedError"
      ) {

        setStatus(
          "Passkey 注册已取消或超时。",
          "error"
        );

      } else if (
        error.code ===
        "passkey_already_registered"
      ) {

        setStatus(
          "这把 Passkey 已经注册过。",
          "error"
        );

      } else {

        setStatus(
          "Passkey 注册失败，请重试。",
          "error"
        );

      }

    } finally {

      addButton.disabled =
        false;

    }

  }

);


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
          "移除这把 Passkey？移除后这把密钥将不能再登录。"
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
          "last_passkey_cannot_be_removed"
        ) {

          setStatus(

            "不能删除最后一把有效 Passkey。请先添加新的备用密钥。",

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
  );`;


  return shell(

    "Passkeys · Jingyan Media Center",

    body,

    script

  );

}
