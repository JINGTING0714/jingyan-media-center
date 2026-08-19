import {
  htmlResponse
} from "./http.mjs";


function escapeHtml(
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


  return Array
    .from(
      bytes,
      byte =>
        byte
          .toString(
            16
          )
          .padStart(
            2,
            "0"
          )
    )
    .join(
      ""
    );

}


function csp(
  nonce,
  turnstile = false
) {

  const scriptSources =
    turnstile

      ? `'nonce-${nonce}' https://challenges.cloudflare.com`

      : `'nonce-${nonce}'`;


  const frameSources =
    turnstile

      ? "https://challenges.cloudflare.com"

      : "'none'";


  const connectSources =
    turnstile

      ? "'self' https://challenges.cloudflare.com"

      : "'self'";


  return [
    "default-src 'self'",
    `style-src 'nonce-${nonce}'`,
    `script-src ${scriptSources}`,
    `frame-src ${frameSources}`,
    `connect-src ${connectSources}`,
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "media-src 'self' https:",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'"
  ].join(
    "; "
  );

}


function shell(
  title,
  content,
  {
    script = "",
    turnstile = false
  } = {}
) {

  const nonce =
    randomNonce();


  const turnstileScript =
    turnstile

      ? `
<script
src="https://challenges.cloudflare.com/turnstile/v0/api.js"
async
defer>
</script>
`

      : "";


  const localScript =
    script

      ? `
<script nonce="${nonce}">
${script}
</script>
`

      : "";


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

<meta
name="theme-color"
content="#f8f5ff">

<title>
${escapeHtml(title)} · Jingyan Media Center
</title>

${turnstileScript}

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
    #291b49;

  background:
    #f7f4fd;

  --text:
    #291b49;

  --muted:
    #8b819c;

  --muted-strong:
    #695d7b;

  --purple:
    #7c50e9;

  --purple-deep:
    #6840dc;

  --purple-soft:
    #f1ebff;

  --purple-line:
    rgba(
      124,
      80,
      233,
      .16
    );

  --green:
    #2f9875;

  --green-soft:
    #eaf8f2;

  --blue:
    #478fc9;

  --blue-soft:
    #ebf6ff;

  --amber:
    #a77721;

  --amber-soft:
    #fff6df;

  --red:
    #b54c60;

  --red-soft:
    #fff0f3;

  --line:
    rgba(
      73,
      52,
      103,
      .11
    );

  --surface:
    rgba(
      255,
      255,
      255,
      .92
    );

  --surface-soft:
    rgba(
      255,
      255,
      255,
      .68
    );

  --shadow:
    0 28px 80px
    rgba(
      58,
      37,
      91,
      .09
    );
}


* {
  box-sizing:
    border-box;
}


html {
  min-height:
    100%;

  background:
    #f7f4fd;
}


body {
  min-height:
    100vh;

  min-height:
    100dvh;

  margin:
    0;

  color:
    var(--text);

  background:
    radial-gradient(
      circle at 12% 8%,
      rgba(
        171,
        130,
        255,
        .23
      ),
      transparent 30rem
    ),

    radial-gradient(
      circle at 92% 22%,
      rgba(
        135,
        205,
        244,
        .16
      ),
      transparent 29rem
    ),

    radial-gradient(
      circle at 75% 88%,
      rgba(
        119,
        211,
        171,
        .11
      ),
      transparent 28rem
    ),

    linear-gradient(
      180deg,
      #fbf9ff 0%,
      #f4f0fb 100%
    );
}


body::before {
  content:
    "";

  width:
    340px;

  height:
    340px;

  position:
    fixed;

  left:
    -190px;

  bottom:
    -180px;

  pointer-events:
    none;

  border-radius:
    999px;

  background:
    rgba(
      171,
      130,
      255,
      .09
    );

  filter:
    blur(
      10px
    );
}


a {
  color:
    inherit;

  text-decoration:
    none;
}


button,
input,
textarea,
select {
  font:
    inherit;
}


button {
  -webkit-tap-highlight-color:
    transparent;
}


button,
a,
input {
  outline:
    none;
}


button:focus-visible,
a:focus-visible,
input:focus-visible {
  outline:
    3px solid
    rgba(
      124,
      80,
      233,
      .18
    );

  outline-offset:
    3px;
}


.auth-page {
  width:
    min(
      1060px,
      calc(
        100% -
        36px
      )
    );

  margin:
    0 auto;

  padding:
    24px 0
    max(
      56px,
      env(
        safe-area-inset-bottom
      )
    );
}


.auth-topbar {
  min-height:
    62px;

  display:
    flex;

  align-items:
    center;

  justify-content:
    space-between;

  gap:
    18px;

  margin-bottom:
    40px;
}


.brand {
  min-width:
    0;

  display:
    flex;

  align-items:
    center;

  gap:
    13px;
}


.brand-mark {
  width:
    50px;

  height:
    50px;

  flex:
    0 0 auto;

  display:
    grid;

  place-items:
    center;

  border-radius:
    16px;

  color:
    #fff;

  background:
    linear-gradient(
      145deg,
      #9a70ff,
      #7043e1
    );

  box-shadow:
    0 14px 30px
    rgba(
      112,
      67,
      225,
      .22
    );

  font-size:
    21px;

  font-weight:
    900;
}


.brand-copy {
  min-width:
    0;
}


.brand-name {
  overflow:
    hidden;

  color:
    var(--text);

  font-size:
    18px;

  font-weight:
    850;

  letter-spacing:
    -.025em;

  text-overflow:
    ellipsis;

  white-space:
    nowrap;
}


.brand-subtitle {
  margin-top:
    2px;

  color:
    var(--muted);

  font-size:
    11px;
}


.top-action {
  min-height:
    42px;

  padding:
    0 15px;

  display:
    inline-flex;

  align-items:
    center;

  justify-content:
    center;

  flex:
    0 0 auto;

  border:
    1px solid
    var(--line);

  border-radius:
    999px;

  color:
    var(--muted-strong);

  background:
    rgba(
      255,
      255,
      255,
      .74
    );

  backdrop-filter:
    blur(
      14px
    );

  font-size:
    12px;

  font-weight:
    720;
}


.auth-layout {
  display:
    grid;

  grid-template-columns:
    minmax(
      0,
      1.16fr
    )
    minmax(
      300px,
      .84fr
    );

  gap:
    22px;

  align-items:
    stretch;
}


.auth-card {
  min-width:
    0;

  overflow:
    hidden;

  border:
    1px solid
    rgba(
      255,
      255,
      255,
      .94
    );

  border-radius:
    30px;

  background:
    var(--surface);

  box-shadow:
    var(--shadow);

  backdrop-filter:
    blur(
      20px
    );
}


.auth-main {
  padding:
    clamp(
      30px,
      6vw,
      58px
    );
}


.auth-side {
  padding:
    29px;

  display:
    flex;

  flex-direction:
    column;

  justify-content:
    space-between;

  background:
    linear-gradient(
      155deg,
      rgba(
        246,
        240,
        255,
        .94
      ),
      rgba(
        239,
        248,
        255,
        .9
      )
    );
}


.eyebrow {
  color:
    var(--purple);

  font-size:
    11px;

  font-weight:
    900;

  letter-spacing:
    .18em;

  text-transform:
    uppercase;
}


h1 {
  max-width:
    760px;

  margin:
    14px 0
    17px;

  color:
    var(--text);

  font-size:
    clamp(
      42px,
      7vw,
      68px
    );

  line-height:
    .98;

  letter-spacing:
    -.055em;
}


.intro {
  max-width:
    620px;

  margin:
    0;

  color:
    var(--muted);

  font-size:
    14px;

  line-height:
    1.78;
}


.flow-form {
  margin-top:
    34px;
}


.field-label {
  display:
    block;

  margin-bottom:
    9px;

  color:
    var(--muted-strong);

  font-size:
    12px;

  font-weight:
    760;
}


.code-input {
  width:
    100%;

  min-height:
    58px;

  padding:
    0 17px;

  border:
    1px solid
    rgba(
      91,
      65,
      127,
      .13
    );

  border-radius:
    17px;

  color:
    var(--text);

  background:
    rgba(
      249,
      247,
      252,
      .92
    );

  box-shadow:
    inset 0 1px 0
    rgba(
      255,
      255,
      255,
      .74
    );

  font-size:
    16px;

  letter-spacing:
    .02em;

  transition:
    border-color .15s ease,
    box-shadow .15s ease,
    background .15s ease;
}


.code-input::placeholder {
  color:
    #b5adbf;
}


.code-input:focus {
  border-color:
    rgba(
      124,
      80,
      233,
      .42
    );

  background:
    #fff;

  box-shadow:
    0 0 0 4px
    rgba(
      124,
      80,
      233,
      .08
    );
}


.turnstile-wrap {
  min-height:
    68px;

  margin-top:
    18px;

  overflow-x:
    auto;

  overflow-y:
    hidden;
}


.primary-button {
  width:
    100%;

  min-height:
    56px;

  margin-top:
    18px;

  border:
    0;

  border-radius:
    17px;

  color:
    #fff;

  background:
    linear-gradient(
      145deg,
      #8e62f3,
      #7044df
    );

  box-shadow:
    0 15px 30px
    rgba(
      112,
      68,
      223,
      .2
    );

  cursor:
    pointer;

  font-size:
    14px;

  font-weight:
    850;

  transition:
    transform .13s ease,
    opacity .13s ease,
    box-shadow .13s ease;
}


.primary-button:hover {
  transform:
    translateY(
      -1px
    );

  box-shadow:
    0 18px 36px
    rgba(
      112,
      68,
      223,
      .24
    );
}


.primary-button:active {
  transform:
    translateY(
      0
    );
}


.primary-button:disabled {
  cursor:
    wait;

  opacity:
    .55;

  transform:
    none;
}


.flow-status {
  min-height:
    22px;

  margin-top:
    14px;

  color:
    var(--muted);

  font-size:
    12px;

  line-height:
    1.6;

  overflow-wrap:
    anywhere;
}


.flow-status.success {
  padding:
    12px 14px;

  border:
    1px solid
    rgba(
      47,
      152,
      117,
      .14
    );

  border-radius:
    13px;

  color:
    var(--green);

  background:
    var(--green-soft);
}


.flow-status.error {
  padding:
    12px 14px;

  border:
    1px solid
    rgba(
      181,
      76,
      96,
      .13
    );

  border-radius:
    13px;

  color:
    var(--red);

  background:
    var(--red-soft);
}


.flow-status.warning {
  padding:
    12px 14px;

  border:
    1px solid
    rgba(
      167,
      119,
      33,
      .14
    );

  border-radius:
    13px;

  color:
    var(--amber);

  background:
    var(--amber-soft);
}


.flow-status:empty {
  min-height:
    0;

  margin-top:
    0;

  padding:
    0;

  border:
    0;
}


.side-title {
  margin:
    0 0
    16px;

  color:
    var(--text);

  font-size:
    23px;

  letter-spacing:
    -.035em;
}


.side-list {
  display:
    grid;

  gap:
    12px;
}


.side-item {
  padding:
    15px;

  display:
    grid;

  grid-template-columns:
    38px
    minmax(
      0,
      1fr
    );

  align-items:
    center;

  gap:
    12px;

  border:
    1px solid
    rgba(
      93,
      69,
      126,
      .09
    );

  border-radius:
    16px;

  background:
    rgba(
      255,
      255,
      255,
      .62
    );
}


.side-icon {
  width:
    38px;

  height:
    38px;

  display:
    grid;

  place-items:
    center;

  border-radius:
    12px;

  color:
    var(--purple);

  background:
    var(--purple-soft);

  font-size:
    16px;

  font-weight:
    850;
}


.side-item:nth-child(2) .side-icon {
  color:
    var(--green);

  background:
    var(--green-soft);
}


.side-item:nth-child(3) .side-icon {
  color:
    var(--blue);

  background:
    var(--blue-soft);
}


.side-item strong {
  display:
    block;

  color:
    var(--text);

  font-size:
    12px;
}


.side-item span {
  display:
    block;

  margin-top:
    3px;

  color:
    var(--muted);

  font-size:
    10px;

  line-height:
    1.45;
}


.side-footer {
  margin-top:
    26px;

  padding-top:
    20px;

  border-top:
    1px solid
    var(--line);

  color:
    var(--muted);

  font-size:
    10px;

  line-height:
    1.65;
}


.link-grid {
  display:
    grid;

  grid-template-columns:
    repeat(
      2,
      minmax(
        0,
        1fr
      )
    );

  gap:
    10px;

  margin-top:
    28px;
}


.link-card {
  min-height:
    92px;

  padding:
    16px;

  display:
    flex;

  flex-direction:
    column;

  justify-content:
    space-between;

  border:
    1px solid
    var(--line);

  border-radius:
    17px;

  background:
    rgba(
      255,
      255,
      255,
      .66
    );

  transition:
    transform .13s ease,
    border-color .13s ease,
    background .13s ease;
}


.link-card:hover {
  transform:
    translateY(
      -1px
    );

  border-color:
    var(--purple-line);

  background:
    #fff;
}


.link-card strong {
  color:
    var(--text);

  font-size:
    13px;
}


.link-card small {
  color:
    var(--muted);

  font-size:
    10px;

  line-height:
    1.4;
}


.security-note {
  margin-top:
    25px;

  padding:
    15px;

  border:
    1px solid
    rgba(
      47,
      152,
      117,
      .12
    );

  border-radius:
    16px;

  color:
    #527268;

  background:
    linear-gradient(
      145deg,
      rgba(
        234,
        248,
        242,
        .88
      ),
      rgba(
        235,
        246,
        255,
        .72
      )
    );

  font-size:
    11px;

  line-height:
    1.7;
}


.fallback-actions {
  margin-top:
    27px;

  display:
    flex;

  flex-wrap:
    wrap;

  gap:
    9px;
}


.secondary-button {
  min-height:
    44px;

  padding:
    0 15px;

  display:
    inline-flex;

  align-items:
    center;

  justify-content:
    center;

  border:
    1px solid
    var(--line);

  border-radius:
    13px;

  color:
    var(--muted-strong);

  background:
    rgba(
      255,
      255,
      255,
      .72
    );

  cursor:
    pointer;

  font-size:
    12px;

  font-weight:
    730;
}


.secondary-button.primary-soft {
  color:
    var(--purple);

  border-color:
    var(--purple-line);

  background:
    var(--purple-soft);
}


.setup-grid {
  display:
    grid;

  gap:
    17px;

  margin-top:
    28px;
}


.small-print {
  margin-top:
    16px;

  color:
    var(--muted);

  font-size:
    10px;

  line-height:
    1.7;
}


.auth-footer {
  margin-top:
    24px;

  display:
    flex;

  align-items:
    center;

  justify-content:
    space-between;

  gap:
    16px;

  color:
    #a196ae;

  font-size:
    10px;
}


.hidden {
  display:
    none
    !important;
}


@media (
  max-width:
    820px
) {

  .auth-page {
    width:
      min(
        100%,
        calc(
          100% -
          26px
        )
      );

    padding-top:
      14px;
  }


  .auth-topbar {
    min-height:
      68px;

    margin-bottom:
      26px;
  }


  .brand-mark {
    width:
      48px;

    height:
      48px;
  }


  .brand-name {
    font-size:
      17px;
  }


  .brand-subtitle {
    display:
      none;
  }


  .auth-layout {
    grid-template-columns:
      1fr;
  }


  .auth-side {
    order:
      2;
  }


  .auth-main {
    padding:
      28px 24px;
  }


  h1 {
    font-size:
      clamp(
        43px,
        12vw,
        60px
      );
  }


  .intro {
    font-size:
      14px;

    line-height:
      1.78;
  }

}


@media (
  max-width:
    520px
) {

  .auth-page {
    width:
      calc(
        100% -
        22px
      );

    padding-bottom:
      max(
        38px,
        env(
          safe-area-inset-bottom
        )
      );
  }


  .auth-topbar {
    margin-bottom:
      18px;
  }


  .brand {
    gap:
      10px;
  }


  .brand-mark {
    width:
      46px;

    height:
      46px;

    border-radius:
      15px;
  }


  .brand-name {
    max-width:
      190px;

    font-size:
      16px;
  }


  .top-action {
    min-height:
      40px;

    padding:
      0 12px;

    font-size:
      11px;
  }


  .auth-card {
    border-radius:
      25px;
  }


  .auth-main {
    padding:
      25px 20px
      27px;
  }


  .auth-side {
    padding:
      21px;

    border-radius:
      25px;
  }


  .eyebrow {
    font-size:
      10px;
  }


  h1 {
    margin-top:
      12px;

    font-size:
      clamp(
        39px,
        12.6vw,
        54px
      );
  }


  .flow-form {
    margin-top:
      27px;
  }


  .code-input {
    min-height:
      56px;

    font-size:
      15px;
  }


  .primary-button {
    min-height:
      55px;
  }


  .link-grid {
    grid-template-columns:
      1fr;
  }


  .auth-footer {
    align-items:
      flex-start;

    flex-direction:
      column;

    gap:
      4px;
  }

}


@media (
  prefers-reduced-motion:
    reduce
) {

  *,
  *::before,
  *::after {
    scroll-behavior:
      auto
      !important;

    transition:
      none
      !important;
  }

}

</style>

</head>


<body>

<div class="auth-page">

<header class="auth-topbar">

<a
href="/"
class="brand">

<span class="brand-mark">
J
</span>

<span class="brand-copy">

<span class="brand-name">
Jingyan Media Center
</span>

<span class="brand-subtitle">
私人媒体中心
</span>

</span>

</a>


<a
href="/login"
class="top-action">
登录
</a>

</header>


${content}


<footer class="auth-footer">

<span>
Jingyan Media Center
</span>

<span>
Private · Secure · Mobile First
</span>

</footer>

</div>


${localScript}

</body>

</html>`;


  return htmlResponse(
    html,
    200,
    {
      "Content-Security-Policy":
        csp(
          nonce,
          turnstile
        ),

      "Cache-Control":
        "no-store, max-age=0",

      "Pragma":
        "no-cache"
    }
  );

}


function errorMessage(
  error
) {

  const map = {

    invalid_invite_code:
      "邀请码无效，请检查后重新输入。",

    invite_not_found:
      "没有找到这个邀请码。",

    invite_expired:
      "这个邀请码已经过期，请联系 Owner。",

    invite_consumed:
      "这个邀请码已经使用过。",

    invalid_pairing_code:
      "配对码格式不正确。",

    device_link_not_found:
      "没有找到这个设备配对请求。",

    device_link_expired:
      "配对码已经过期，请在已登录设备重新生成。",

    recovery_not_found:
      "没有找到这个恢复码。",

    recovery_expired:
      "恢复码已经过期，请联系 Owner 重新生成。",

    recovery_consumed:
      "恢复码已经使用过。",

    owner_recovery_rejected:
      "Owner Recovery Secret 不正确。",

    rate_limited:
      "尝试次数过多，请稍后再试。",

    turnstile_required:
      "请先完成人机验证。",

    turnstile_failed:
      "人机验证失败，请刷新后重试。",

    request_failed:
      "请求失败，请稍后重试。"

  };


  return (
    map[
      String(
        error ||
        ""
      )
    ] ||
    "操作没有完成，请检查输入后重试。"
  );

}


function flowSide(
  kind
) {

  const configs = {

    activate: {

      title:
        "第一次进入？",

      items: [
        [
          "01",
          "使用邀请码",
          "邀请码只需要使用一次。"
        ],

        [
          "02",
          "自动建立账户",
          "激活后浏览器会获得登录 Session。"
        ],

        [
          "03",
          "之后使用 Passkey",
          "后续设备可通过 Passkey 或设备配对进入。"
        ]
      ],

      footer:
        "邀请码由 Owner 创建。普通成员不需要理解 GitHub、D1、KV 或 CDN。"

    },


    device: {

      title:
        "给新设备登录",

      items: [
        [
          "01",
          "旧设备生成",
          "在已经登录的设备中生成 6 位配对码。"
        ],

        [
          "02",
          "新设备输入",
          "在这里输入一次即可完成设备登录。"
        ],

        [
          "03",
          "短时有效",
          "配对码只在短时间内有效，过期后重新生成。"
        ]
      ],

      footer:
        "设备配对不会修改你的用户角色、Collection 或媒体数据。"

    },


    recover: {

      title:
        "恢复既有账户",

      items: [
        [
          "01",
          "不是注册",
          "恢复码只恢复已有用户，不会创建第二个账户。"
        ],

        [
          "02",
          "一次使用",
          "成功使用后恢复码会立即失效。"
        ],

        [
          "03",
          "恢复后检查安全",
          "进入账户页确认设备，并建议添加 Passkey。"
        ]
      ],

      footer:
        "如果你没有恢复码，请让 Owner 在管理后台为你的原账户生成。"

    },


    owner: {

      title:
        "Owner 紧急通道",

      items: [
        [
          "01",
          "仅限紧急情况",
          "只有 Owner 所有正常 Session 都丢失时才使用。"
        ],

        [
          "02",
          "临时 Secret",
          "恢复前临时设置 OWNER_RECOVERY_SECRET。"
        ],

        [
          "03",
          "完成后删除",
          "恢复成功后立即从 Worker Secrets 中删除临时 Secret。"
        ]
      ],

      footer:
        "这不是日常登录入口。正常情况下优先使用 Passkey、Session 或设备配对。"

    }

  };


  const config =
    configs[kind] ||
    configs.activate;


  return `
<aside class="auth-card auth-side">

<div>

<div class="eyebrow">
GUIDE
</div>

<h2 class="side-title">
${escapeHtml(config.title)}
</h2>


<div class="side-list">

${config.items.map(
  item => `
<div class="side-item">

<span class="side-icon">
${escapeHtml(item[0])}
</span>

<div>

<strong>
${escapeHtml(item[1])}
</strong>

<span>
${escapeHtml(item[2])}
</span>

</div>

</div>
`
).join("")}

</div>

</div>


<div class="side-footer">
${escapeHtml(config.footer)}
</div>

</aside>
`;

}


function flowPage(
  env,
  {
    title,
    eyebrow,
    intro,
    endpoint,
    action,
    fieldName = "code",
    inputLabel,
    placeholder,
    kind,
    inputType = "text",
    inputMode = "text",
    autocomplete = "one-time-code",
    redirectTo = "/account/"
  }
) {

  const siteKey =
    escapeHtml(
      String(
        env.TURNSTILE_SITE_KEY ||
        ""
      )
    );


  const script =
`
const form =
  document.getElementById(
    "flowForm"
  );

const input =
  document.getElementById(
    "flowInput"
  );

const button =
  document.getElementById(
    "flowButton"
  );

const status =
  document.getElementById(
    "flowStatus"
  );


function setStatus(
  text,
  type = ""
) {

  status.textContent =
    text;

  status.className =
    "flow-status" +
    (
      type
        ? " " + type
        : ""
    );

}


function friendlyError(
  code
) {

  const map = {

    invalid_invite_code:
      "邀请码无效，请检查后重新输入。",

    invite_not_found:
      "没有找到这个邀请码。",

    invite_expired:
      "这个邀请码已经过期，请联系 Owner。",

    invite_consumed:
      "这个邀请码已经使用过。",

    invalid_pairing_code:
      "配对码格式不正确。",

    device_link_not_found:
      "没有找到这个设备配对请求。",

    device_link_expired:
      "配对码已经过期，请在已登录设备重新生成。",

    recovery_not_found:
      "没有找到这个恢复码。",

    recovery_expired:
      "恢复码已经过期，请联系 Owner 重新生成。",

    recovery_consumed:
      "恢复码已经使用过。",

    owner_recovery_rejected:
      "Owner Recovery Secret 不正确。",

    rate_limited:
      "尝试次数过多，请稍后再试。",

    turnstile_required:
      "请先完成人机验证。",

    turnstile_failed:
      "人机验证失败，请刷新后重试。"

  };


  return (
    map[
      String(
        code ||
        ""
      )
    ] ||
    "操作没有完成，请检查输入后重试。"
  );

}


form.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const value =
      input.value.trim();


    if (
      !value
    ) {

      setStatus(
        "请先填写内容。",
        "warning"
      );

      input.focus();

      return;

    }


    const turnstileToken =
      document.querySelector(
        '[name="cf-turnstile-response"]'
      )?.value ||
      "";


    if (
      !turnstileToken
    ) {

      setStatus(
        "请先完成人机验证。",
        "warning"
      );

      return;

    }


    button.disabled =
      true;

    button.textContent =
      "处理中…";

    setStatus(
      "正在验证，请稍候…"
    );


    try {

      const response =
        await fetch(
          ${JSON.stringify(endpoint)},
          {
            method:
              "POST",

            credentials:
              "same-origin",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                ${JSON.stringify(fieldName)}:
                  value,

                turnstileToken
              })
          }
        );


      let data = {};


      try {

        data =
          await response.json();

      } catch {

        data = {};

      }


      if (
        !response.ok
      ) {

        throw new Error(
          data.error ||
          "request_failed"
        );

      }


      setStatus(
        "验证成功，正在进入 Jingyan Media Center…",
        "success"
      );


      button.textContent =
        "验证成功";


      setTimeout(
        () => {

          location.replace(
            ${JSON.stringify(redirectTo)}
          );

        },
        500
      );

    } catch (
      error
    ) {

      console.error(
        "Auth flow failed:",
        error
      );


      setStatus(
        friendlyError(
          error?.message
        ),
        "error"
      );


      button.disabled =
        false;

      button.textContent =
        "继续";


      if (
        window.turnstile
      ) {

        try {

          window.turnstile.reset();

        } catch {

          // Ignore Turnstile reset errors.

        }

      }

    }

  }
);
`;


  const content =
`
<div class="auth-layout">


<main class="auth-card auth-main">

<div class="eyebrow">
${escapeHtml(eyebrow)}
</div>

<h1>
${escapeHtml(title)}
</h1>

<p class="intro">
${escapeHtml(intro)}
</p>


<form
id="flowForm"
class="flow-form"
novalidate>

<label
for="flowInput"
class="field-label">
${escapeHtml(inputLabel)}
</label>


<input
id="flowInput"
class="code-input"
name="credential"
type="${escapeHtml(inputType)}"
inputmode="${escapeHtml(inputMode)}"
autocomplete="${escapeHtml(autocomplete)}"
placeholder="${escapeHtml(placeholder)}"
required>


<div class="turnstile-wrap">

<div
class="cf-turnstile"
data-sitekey="${siteKey}"
data-action="${escapeHtml(action)}"
data-theme="light">
</div>

</div>


<button
type="submit"
class="primary-button"
id="flowButton">
继续
</button>


<div
class="flow-status"
id="flowStatus"
role="status"
aria-live="polite">
</div>

</form>


<div class="security-note">
验证信息只用于当前登录流程。成功后系统会建立新的登录 Session，不会修改你的媒体、图库、歌单或影集。
</div>

</main>


${flowSide(kind)}


</div>
`;


  return shell(
    title,
    content,
    {
      script,
      turnstile:
        true
    }
  );

}


export function renderHome() {

  const content =
`
<div class="auth-layout">


<main class="auth-card auth-main">

<div class="eyebrow">
JINGYAN MEDIA SYSTEM
</div>

<h1>
私人媒体中心。
</h1>

<p class="intro">
上传、整理、预览图片、音乐与视频。登录与恢复入口集中在这里，普通使用不需要接触底层 GitHub、数据库或 CDN 配置。
</p>


<div class="link-grid">

<a
href="/login"
class="link-card">

<strong>
Passkey 登录
</strong>

<small>
日常登录首选
</small>

</a>


<a
href="/activate"
class="link-card">

<strong>
邀请码激活
</strong>

<small>
第一次加入系统
</small>

</a>


<a
href="/device"
class="link-card">

<strong>
新设备配对
</strong>

<small>
使用 6 位配对码
</small>

</a>


<a
href="/recover"
class="link-card">

<strong>
恢复登录
</strong>

<small>
恢复已有账户
</small>

</a>

</div>


<div class="fallback-actions">

<a
href="/account/"
class="secondary-button primary-soft">
账户与安全
</a>

<a
href="/owner-recover"
class="secondary-button">
Owner 紧急恢复
</a>

</div>

</main>


<aside class="auth-card auth-side">

<div>

<div class="eyebrow">
PRIVATE
</div>

<h2 class="side-title">
为小型私人空间设计
</h2>


<div class="side-list">

<div class="side-item">

<span class="side-icon">
✓
</span>

<div>

<strong>
约 25 人
</strong>

<span>
邀请制成员系统，不做公开注册。
</span>

</div>

</div>


<div class="side-item">

<span class="side-icon">
⌘
</span>

<div>

<strong>
Passkey 优先
</strong>

<span>
减少密码和重复登录的管理负担。
</span>

</div>

</div>


<div class="side-item">

<span class="side-icon">
↗
</span>

<div>

<strong>
移动端优先
</strong>

<span>
登录、配对与恢复均针对手机操作优化。
</span>

</div>

</div>

</div>

</div>


<div class="side-footer">
Jingyan Media Center 的认证层与媒体数据分离。登录设备失效不会删除任何媒体。
</div>

</aside>


</div>
`;


  return shell(
    "Jingyan Media Center",
    content
  );

}


export function renderSetupComplete() {

  const content =
`
<div class="auth-layout">


<main class="auth-card auth-main">

<div class="eyebrow">
SYSTEM READY
</div>

<h1>
初始化已经完成。
</h1>

<p class="intro">
Owner 已经存在。Bootstrap 入口不会再次创建第二个 Owner，日常使用请直接进入账户或登录页面。
</p>


<div class="fallback-actions">

<a
href="/account/"
class="secondary-button primary-soft">
进入账户
</a>

<a
href="/login"
class="secondary-button">
打开登录页
</a>

</div>

</main>


<aside class="auth-card auth-side">

<div>

<div class="eyebrow">
STATUS
</div>

<h2 class="side-title">
认证系统已就绪
</h2>


<div class="side-list">

<div class="side-item">

<span class="side-icon">
01
</span>

<div>

<strong>
Owner 已建立
</strong>

<span>
系统不会重复执行初始化。
</span>

</div>

</div>


<div class="side-item">

<span class="side-icon">
02
</span>

<div>

<strong>
使用 Session
</strong>

<span>
日常登录设备拥有独立有效期。
</span>

</div>

</div>


<div class="side-item">

<span class="side-icon">
03
</span>

<div>

<strong>
Owner 权限永久
</strong>

<span>
Session 到期不等于 Owner 权限到期。
</span>

</div>

</div>

</div>

</div>

</aside>


</div>
`;


  return shell(
    "认证系统已初始化",
    content
  );

}


export function renderSetupPending() {

  const script =
`
const form =
  document.getElementById(
    "setupForm"
  );

const nameInput =
  document.getElementById(
    "setupName"
  );

const secretInput =
  document.getElementById(
    "setupSecret"
  );

const button =
  document.getElementById(
    "setupButton"
  );

const status =
  document.getElementById(
    "setupStatus"
  );


function setStatus(
  text,
  type = ""
) {

  status.textContent =
    text;

  status.className =
    "flow-status" +
    (
      type
        ? " " + type
        : ""
    );

}


form.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const displayName =
      nameInput.value.trim();

    const secret =
      secretInput.value;


    if (
      !displayName ||
      !secret
    ) {

      setStatus(
        "请完整填写显示名称和 Bootstrap Secret。",
        "warning"
      );

      return;

    }


    button.disabled =
      true;

    button.textContent =
      "正在初始化…";

    setStatus(
      "正在创建 Owner…"
    );


    try {

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
                secret
            },

            body:
              JSON.stringify({
                displayName
              })
          }
        );


      let data = {};


      try {

        data =
          await response.json();

      } catch {

        data = {};

      }


      if (
        !response.ok
      ) {

        throw new Error(
          data.error ||
          "bootstrap_failed"
        );

      }


      setStatus(
        "Owner 创建成功，正在进入账户页…",
        "success"
      );


      setTimeout(
        () => {

          location.replace(
            "/account/"
          );

        },
        500
      );

    } catch (
      error
    ) {

      console.error(
        "Bootstrap failed:",
        error
      );


      const message =
        error?.message ===
        "already_bootstrapped"

          ? "系统已经初始化，不需要再次创建 Owner。"

          : (
              error?.message ===
              "bootstrap_rejected"

                ? "Bootstrap Secret 不正确。"

                : "初始化没有完成，请检查配置后重试。"
            );


      setStatus(
        message,
        "error"
      );


      button.disabled =
        false;

      button.textContent =
        "创建 Owner";

    }

  }
);
`;


  const content =
`
<div class="auth-layout">


<main class="auth-card auth-main">

<div class="eyebrow">
FIRST SETUP
</div>

<h1>
初始化 Owner。
</h1>

<p class="intro">
这个页面只在 Jingyan Media Center 第一次部署时使用。Owner 创建完成后，Bootstrap Secret 应继续保持关闭或删除。
</p>


<form
id="setupForm"
class="setup-grid">


<div>

<label
for="setupName"
class="field-label">
显示名称
</label>

<input
id="setupName"
class="code-input"
maxlength="80"
autocomplete="name"
value="JINGTING0714"
required>

</div>


<div>

<label
for="setupSecret"
class="field-label">
Bootstrap Secret
</label>

<input
id="setupSecret"
class="code-input"
type="password"
autocomplete="off"
required>

</div>


<button
type="submit"
class="primary-button"
id="setupButton">
创建 Owner
</button>


<div
class="flow-status"
id="setupStatus"
role="status"
aria-live="polite">
</div>

</form>

</main>


<aside class="auth-card auth-side">

<div>

<div class="eyebrow">
OWNER
</div>

<h2 class="side-title">
只执行一次
</h2>


<div class="side-list">

<div class="side-item">

<span class="side-icon">
01
</span>

<div>

<strong>
创建不可变 User ID
</strong>

<span>
以后显示名称可以修改，内部身份不会变化。
</span>

</div>

</div>


<div class="side-item">

<span class="side-icon">
02
</span>

<div>

<strong>
授予 Owner 权限
</strong>

<span>
Owner 角色不会因为登录 Session 到期而失效。
</span>

</div>

</div>


<div class="side-item">

<span class="side-icon">
03
</span>

<div>

<strong>
关闭 Bootstrap
</strong>

<span>
初始化完成后不再使用这个入口。
</span>

</div>

</div>

</div>

</div>

</aside>


</div>
`;


  return shell(
    "初始化 Owner",
    content,
    {
      script
    }
  );

}


export function renderActivate(
  env
) {

  return flowPage(
    env,
    {
      title:
        "使用邀请码加入。",

      eyebrow:
        "INVITATION",

      intro:
        "输入 Owner 发给你的邀请码。邀请码只使用一次，成功后这个浏览器会建立你的登录 Session。",

      endpoint:
        "/api/invites/redeem",

      action:
        "invite-redeem",

      fieldName:
        "code",

      inputLabel:
        "邀请码",

      placeholder:
        "JY-XXXXX-XXXXX-XXXXX-XXXXX",

      kind:
        "activate"
    }
  );

}


export function renderDevice(
  env
) {

  return flowPage(
    env,
    {
      title:
        "登录这台新设备。",

      eyebrow:
        "DEVICE PAIRING",

      intro:
        "先在一台已经登录的设备中生成 6 位配对码，然后在这里输入。无需重新创建账户。",

      endpoint:
        "/api/device-links/redeem",

      action:
        "device-redeem",

      fieldName:
        "code",

      inputLabel:
        "6 位设备配对码",

      placeholder:
        "123456",

      kind:
        "device",

      inputMode:
        "numeric",

      autocomplete:
        "one-time-code"
    }
  );

}


export function renderRecover(
  env
) {

  return flowPage(
    env,
    {
      title:
        "恢复你的账户。",

      eyebrow:
        "ACCOUNT RECOVERY",

      intro:
        "输入 Owner 为你的原账户生成的一次性恢复码。恢复只重新建立登录，不会创建第二个用户。",

      endpoint:
        "/api/recovery/redeem",

      action:
        "recovery-redeem",

      fieldName:
        "code",

      inputLabel:
        "恢复码",

      placeholder:
        "JYR-XXXX-XXXX-XXXX-XXXX",

      kind:
        "recover"
    }
  );

}


export function renderOwnerRecover(
  env
) {

  return flowPage(
    env,
    {
      title:
        "Owner 紧急恢复。",

      eyebrow:
        "EMERGENCY ACCESS",

      intro:
        "仅当 Owner 的正常登录设备全部不可用时使用。恢复前临时设置 OWNER_RECOVERY_SECRET，完成后立即删除。",

      endpoint:
        "/api/owner/recover",

      action:
        "owner-recovery",

      fieldName:
        "recoverySecret",

      inputLabel:
        "临时 Owner Recovery Secret",

      placeholder:
        "输入临时高强度 Secret",

      kind:
        "owner",

      inputType:
        "password",

      inputMode:
        "text",

      autocomplete:
        "off"
    }
  );

}


export function renderAccount(
  user = {}
) {

  const displayName =
    escapeHtml(
      user.displayName ||
      user.display_name ||
      "当前用户"
    );


  const role =
    escapeHtml(
      user.role ||
      "member"
    );


  const content =
`
<div class="auth-layout">


<main class="auth-card auth-main">

<div class="eyebrow">
ACCOUNT
</div>

<h1>
账户与安全。
</h1>

<p class="intro">
${displayName} · ${role}
</p>


<div class="security-note">
新版账户中心已经启用。设备、Passkey、配对与退出操作都集中在账户与安全页面。
</div>


<div class="fallback-actions">

<a
href="/account/"
class="secondary-button primary-soft">
进入账户中心
</a>

<a
href="/profile/"
class="secondary-button">
我的主页
</a>

<a
href="/passkeys"
class="secondary-button">
Passkey
</a>

</div>

</main>


<aside class="auth-card auth-side">

<div>

<div class="eyebrow">
SECURITY
</div>

<h2 class="side-title">
登录不等于权限
</h2>


<div class="side-list">

<div class="side-item">

<span class="side-icon">
01
</span>

<div>

<strong>
Session 有有效期
</strong>

<span>
设备登录状态会定期刷新和过期。
</span>

</div>

</div>


<div class="side-item">

<span class="side-icon">
02
</span>

<div>

<strong>
角色独立保存
</strong>

<span>
Owner / Member 角色保存在用户记录中。
</span>

</div>

</div>


<div class="side-item">

<span class="side-icon">
03
</span>

<div>

<strong>
媒体不受影响
</strong>

<span>
设备退出不会删除媒体和 Collection。
</span>

</div>

</div>

</div>

</div>

</aside>


</div>
`;


  return shell(
    "账户与安全",
    content
  );

}


export function renderAdmin() {

  const content =
`
<div class="auth-layout">


<main class="auth-card auth-main">

<div class="eyebrow">
OWNER CONTROL
</div>

<h1>
Owner 管理后台。
</h1>

<p class="intro">
新版 Owner 控制台已经启用。用户、邀请码、权限、安全审计和系统管理均在独立后台完成。
</p>


<div class="fallback-actions">

<a
href="/admin/"
class="secondary-button primary-soft">
进入管理后台
</a>

<a
href="/account/"
class="secondary-button">
账户与安全
</a>

</div>

</main>


<aside class="auth-card auth-side">

<div>

<div class="eyebrow">
OWNER
</div>

<h2 class="side-title">
管理层与用户层分离
</h2>


<div class="side-list">

<div class="side-item">

<span class="side-icon">
01
</span>

<div>

<strong>
成员体验保持简单
</strong>

<span>
普通用户不会看到系统管理操作。
</span>

</div>

</div>


<div class="side-item">

<span class="side-icon">
02
</span>

<div>

<strong>
Owner 控制集中
</strong>

<span>
高风险操作只存在于管理后台。
</span>

</div>

</div>


<div class="side-item">

<span class="side-icon">
03
</span>

<div>

<strong>
安全操作可审计
</strong>

<span>
重要管理行为继续进入 Audit。
</span>

</div>

</div>

</div>

</div>

</aside>


</div>
`;


  return shell(
    "Owner 管理后台",
    content
  );

}
