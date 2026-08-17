import {
  PERMISSION_KEYS
} from "./config.mjs";

import {
  htmlResponse
} from "./http.mjs";


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


function pageShell(
  title,
  body,
  {
    turnstile = false
  } = {}
) {

  const turnstileScript =
    turnstile

      ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>'

      : "";


  return `<!doctype html>
<html lang="zh-CN">

<head>

<meta charset="utf-8">

<meta
name="viewport"
content="width=device-width,initial-scale=1">

<title>${escapeHtml(title)}</title>

${turnstileScript}

<style>

:root {
  font-family:
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;

  color-scheme:
    light dark;
}

body {
  max-width:
    1000px;

  margin:
    36px auto;

  padding:
    0 18px;

  line-height:
    1.5;
}

a {
  color:
    inherit;
}

button,
input,
textarea,
select {
  font:
    inherit;

  padding:
    9px;
}

button {
  cursor:
    pointer;
}

.card {
  border:
    1px solid #8886;

  border-radius:
    12px;

  padding:
    16px;

  margin:
    14px 0;
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
    10px;
}

.muted {
  opacity:
    .7;
}

.code {
  font-family:
    ui-monospace,
    monospace;

  font-size:
    1.1rem;

  word-break:
    break-all;

  padding:
    12px;

  border:
    1px dashed #888;

  border-radius:
    8px;
}

.ok {
  color:
    #138a36;
}

.bad {
  color:
    #c0352b;
}

.permissions {
  display:
    grid;

  grid-template-columns:
    repeat(
      auto-fit,
      minmax(
        180px,
        1fr
      )
    );

  gap:
    7px;
}

.toolbar {
  display:
    flex;

  gap:
    10px;

  flex-wrap:
    wrap;

  align-items:
    center;
}

.wide {
  width:
    100%;

  box-sizing:
    border-box;
}

.small {
  font-size:
    .9rem;
}

.hidden {
  display:
    none;
}

</style>

</head>

<body>

${body}

</body>

</html>`;

}


function csp(
  turnstile = false
) {

  if (!turnstile) {

    return (
      "default-src 'self'; " +
      "style-src 'unsafe-inline'; " +
      "script-src 'unsafe-inline'; " +
      "connect-src 'self'; " +
      "frame-ancestors 'none'; " +
      "base-uri 'none'"
    );

  }


  return (
    "default-src 'self'; " +
    "style-src 'unsafe-inline'; " +
    "script-src 'unsafe-inline' https://challenges.cloudflare.com; " +
    "frame-src https://challenges.cloudflare.com; " +
    "connect-src 'self' https://challenges.cloudflare.com; " +
    "img-src 'self' data:; " +
    "frame-ancestors 'none'; " +
    "base-uri 'none'"
  );

}


export function renderHome() {

  return htmlResponse(

    pageShell(
      "Jingyan Media",
      `

<h1>
Jingyan Media
</h1>

<div class="card">

<p>
<a href="/account">
账户
</a>
</p>

<p>
<a href="/activate">
邀请码激活
</a>
</p>

<p>
<a href="/device">
新设备配对
</a>
</p>

<p>
<a href="/recover">
恢复登录
</a>
</p>

<p>
<a href="/owner-recover">
Owner 紧急恢复
</a>
</p>

<p>
<a href="/admin">
Owner 管理后台
</a>
</p>

</div>

`
    ),

    200,

    {
      "Content-Security-Policy":
        csp(false)
    }

  );

}


export function renderSetupComplete() {

  return htmlResponse(

    pageShell(
      "Jingyan Media Auth",
      `

<h1>
认证系统已初始化
</h1>

<p>
Owner 已创建。此入口不会再次创建 Owner。
</p>

<p>
<a href="/account">
进入账户页
</a>
</p>

`
    ),

    200,

    {
      "Content-Security-Policy":
        csp(false)
    }

  );

}


export function renderSetupPending() {

  return htmlResponse(

    pageShell(
      "初始化 Owner",
      `

<h1>
初始化 Owner
</h1>

<p>
仅在系统第一次初始化时使用。
</p>

<form
id="form"
class="card">

<label>

显示名称

<input
id="name"
class="wide"
required
maxlength="80"
value="JINGTING0714">

</label>

<br><br>

<label>

Bootstrap Secret

<input
id="secret"
class="wide"
type="password"
required
autocomplete="off">

</label>

<br><br>

<button>
创建 Owner
</button>

</form>

<pre id="result"></pre>

<script>

const formEl =
  document.getElementById(
    "form"
  );

const resultEl =
  document.getElementById(
    "result"
  );

const nameEl =
  document.getElementById(
    "name"
  );

const secretEl =
  document.getElementById(
    "secret"
  );


formEl.onsubmit =
  async event => {

    event.preventDefault();


    resultEl.textContent =
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
              secretEl.value

          },

          body:
            JSON.stringify({

              displayName:
                nameEl.value

            })

        }

      );


    const data =
      await response.json();


    resultEl.textContent =
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
            "/account";

        },
        600
      );

    }

  };

</script>

`
    ),

    200,

    {
      "Content-Security-Policy":
        csp(false)
    }

  );

}


function turnstileFormPage(
  env,
  {
    title,
    intro,
    endpoint,
    action,
    codeLabel,
    codePlaceholder = "",
    codeField = "code"
  }
) {

  const siteKey =
    escapeHtml(
      String(
        env.TURNSTILE_SITE_KEY ||
        ""
      )
    );


  const safeAction =
    escapeHtml(
      action
    );


  return htmlResponse(

    pageShell(

      title,

      `

<h1>
${escapeHtml(title)}
</h1>

<p>
${escapeHtml(intro)}
</p>

<form
id="form"
class="card">

<label>

${escapeHtml(codeLabel)}

<input
id="code"
class="wide"
required
autocomplete="one-time-code"
placeholder="${escapeHtml(codePlaceholder)}">

</label>

<br><br>

<div
class="cf-turnstile"
data-sitekey="${siteKey}"
data-action="${safeAction}">
</div>

<br>

<button>
继续
</button>

</form>

<pre id="result"></pre>

<script>

const formEl =
  document.getElementById(
    "form"
  );

const resultEl =
  document.getElementById(
    "result"
  );

const codeEl =
  document.getElementById(
    "code"
  );


formEl.onsubmit =
  async event => {

    event.preventDefault();


    resultEl.textContent =
      "处理中…";


    const token =
      document.querySelector(
        '[name="cf-turnstile-response"]'
      )?.value ||
      "";


    const response =
      await fetch(

        "${endpoint}",

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

              ${codeField}:
                codeEl.value,

              turnstileToken:
                token

            })

        }

      );


    const data =
      await response.json();


    resultEl.textContent =
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
            "/account";

        },
        700
      );

    } else if (
      window.turnstile
    ) {

      window.turnstile
        .reset();

    }

  };

</script>

`,

      {
        turnstile:
          true
      }

    ),

    200,

    {
      "Content-Security-Policy":
        csp(true)
    }

  );

}


export function renderActivate(
  env
) {

  return turnstileFormPage(

    env,

    {
      title:
        "邀请码激活",

      intro:
        "邀请码只需使用一次。激活成功后，此浏览器会长期保持登录。",

      endpoint:
        "/api/invites/redeem",

      action:
        "invite-redeem",

      codeLabel:
        "邀请码",

      codePlaceholder:
        "JY-XXXXX-XXXXX-XXXXX-XXXXX"
    }

  );

}


export function renderDevice(
  env
) {

  return turnstileFormPage(

    env,

    {
      title:
        "新设备配对",

      intro:
        "在已登录设备的账户页生成 6 位配对码，然后在这里输入。",

      endpoint:
        "/api/device-links/redeem",

      action:
        "device-redeem",

      codeLabel:
        "6 位配对码",

      codePlaceholder:
        "123456"
    }

  );

}


export function renderRecover(
  env
) {

  return turnstileFormPage(

    env,

    {
      title:
        "恢复登录",

      intro:
        "由 Owner 为既有用户生成一次性恢复码。恢复码不会创建新用户。",

      endpoint:
        "/api/recovery/redeem",

      action:
        "recovery-redeem",

      codeLabel:
        "恢复码",

      codePlaceholder:
        "JYR-XXXX-XXXX-XXXX-XXXX"
    }

  );

}


export function renderOwnerRecover(
  env
) {

  return turnstileFormPage(

    env,

    {
      title:
        "Owner 紧急恢复",

      intro:
        "仅在 Owner 所有 Session 都丢失时使用。先临时在 Worker Secrets 中设置 OWNER_RECOVERY_SECRET，恢复后立即删除。",

      endpoint:
        "/api/owner/recover",

      action:
        "owner-recovery",

      codeLabel:
        "临时 Owner Recovery Secret",

      codePlaceholder:
        "高强度临时 Secret",

      codeField:
        "recoverySecret"
    }

  );

}


export function renderAccount(
  user
) {

  return htmlResponse(

    pageShell(
      "账户",
      `

<h1>
账户
</h1>

<div class="card">

<strong>
${escapeHtml(user.displayName)}
</strong>

 ·

${escapeHtml(user.role)}

<span id="status"></span>

</div>

<div class="toolbar">

<button id="pair">
生成新设备配对码
</button>

<button id="logout">
退出当前设备
</button>

<button id="logoutAll">
退出全部设备
</button>

${
  user.role ===
  "owner"

    ? '<a href="/admin">Owner 后台</a>'

    : ""
}

</div>

<div
id="pairResult"
class="code hidden">
</div>

<h2>
登录设备
</h2>

<div id="sessions"></div>

<script>

const pairButton =
  document.getElementById(
    "pair"
  );

const logoutButton =
  document.getElementById(
    "logout"
  );

const logoutAllButton =
  document.getElementById(
    "logoutAll"
  );

const pairResultEl =
  document.getElementById(
    "pairResult"
  );

const sessionsEl =
  document.getElementById(
    "sessions"
  );

const statusEl =
  document.getElementById(
    "status"
  );


async function api(
  url,
  options = {}
) {

  const response =
    await fetch(

      url,

      {
        credentials:
          "same-origin",

        ...options,

        headers: {

          "Content-Type":
            "application/json",

          ...(
            options.headers ||
            {}
          )

        }

      }

    );


  const data =
    await response.json();


  if (
    !response.ok
  ) {

    throw new Error(
      data.error ||
      "request_failed"
    );

  }


  return data;

}


async function load() {

  const data =
    await api(
      "/api/account/sessions"
    );


  sessionsEl.innerHTML =
    "";


  for (
    const session
    of data.sessions
  ) {

    const box =
      document.createElement(
        "div"
      );


    box.className =
      "card small";


    const text =
      document.createElement(
        "div"
      );


    text.textContent =

      (
        session.deviceLabel ||
        "未命名设备"
      ) +

      " | created " +

      new Date(
        session.createdAt *
        1000
      ).toLocaleString() +

      " | expires " +

      new Date(
        session.expiresAt *
        1000
      ).toLocaleString() +

      (
        session.current
          ? " | 当前设备"
          : ""
      ) +

      (
        session.revokedAt
          ? " | 已撤销"
          : ""
      );


    box.append(
      text
    );


    if (
      !session.revokedAt
    ) {

      const button =
        document.createElement(
          "button"
        );


      button.textContent =
        "撤销此设备";


      button.onclick =
        async () => {

          try {

            await api(

              "/api/account/sessions/" +
              encodeURIComponent(
                session.id
              ) +
              "/revoke",

              {
                method:
                  "POST",

                body:
                  "{}"
              }

            );


            if (
              session.current
            ) {

              location.href =
                "/";

            } else {

              load();

            }

          } catch (error) {

            alert(
              error.message
            );

          }

        };


      box.append(
        button
      );

    }


    sessionsEl.append(
      box
    );

  }

}


pairButton.onclick =
  async () => {

    try {

      const data =
        await api(

          "/api/device-links",

          {
            method:
              "POST",

            body:
              "{}"
          }

        );


      pairResultEl
        .classList
        .remove(
          "hidden"
        );


      pairResultEl.textContent =

        "配对码：" +
        data.code +
        "（有效至 " +
        new Date(
          data.expiresAt *
          1000
        ).toLocaleString() +
        "）";

    } catch (error) {

      alert(
        error.message
      );

    }

  };


logoutButton.onclick =
  async () => {

    try {

      await api(

        "/api/auth/logout",

        {
          method:
            "POST",

          body:
            "{}"
        }

      );


      location.href =
        "/";

    } catch (error) {

      alert(
        error.message
      );

    }

  };


logoutAllButton.onclick =
  async () => {

    if (
      !confirm(
        "确认退出全部设备？"
      )
    ) {

      return;

    }


    try {

      await api(

        "/api/auth/logout-all",

        {
          method:
            "POST",

          body:
            "{}"
        }

      );


      location.href =
        "/";

    } catch (error) {

      alert(
        error.message
      );

    }

  };


load()
  .catch(
    error => {

      statusEl.textContent =
        error.message;

    }
  );

</script>

`
    ),

    200,

    {
      "Content-Security-Policy":
        csp(false)
    }

  );

}


export function renderAdmin(
  owner
) {

  const permissionKeys =
    JSON.stringify(
      PERMISSION_KEYS
    );


  return htmlResponse(

    pageShell(
      "Owner 管理后台",
      `

<h1>
Owner 管理后台
</h1>

<p>

${escapeHtml(owner.displayName)}

 ·

<a href="/account">
账户
</a>

</p>

<section class="card">

<h2>
创建一人一码邀请
</h2>

<label>

显示名称

<input
id="inviteName"
class="wide"
maxlength="80">

</label>

<br><br>

<label>

有效期

<select id="inviteExpiry">

<option value="30">
30 天
</option>

<option value="7">
7 天
</option>

<option value="0">
永不过期
</option>

</select>

</label>

<br><br>

<label>

备注

<textarea
id="inviteNote"
class="wide"
maxlength="200">
</textarea>

</label>

<div
id="invitePermissions"
class="permissions">
</div>

<br>

<button id="createInvite">
生成邀请码
</button>

<div
id="createdCode"
class="code hidden">
</div>

</section>

<h2>
用户
</h2>

<div id="users"></div>

<h2>
邀请
</h2>

<div id="invites"></div>

<h2>
最近审计日志
</h2>

<div id="audit"></div>

<script>

const permissionKeys =
  ${permissionKeys};


const inviteNameEl =
  document.getElementById(
    "inviteName"
  );

const inviteExpiryEl =
  document.getElementById(
    "inviteExpiry"
  );

const inviteNoteEl =
  document.getElementById(
    "inviteNote"
  );

const invitePermissionsEl =
  document.getElementById(
    "invitePermissions"
  );

const createInviteButton =
  document.getElementById(
    "createInvite"
  );

const createdCodeEl =
  document.getElementById(
    "createdCode"
  );

const usersEl =
  document.getElementById(
    "users"
  );

const invitesEl =
  document.getElementById(
    "invites"
  );

const auditEl =
  document.getElementById(
    "audit"
  );


const defaultUploader = {

  uploadImage:
    true,

  uploadAudio:
    true,

  uploadVideo:
    true,

  deleteMedia:
    false,

  editMedia:
    false,

  manageUsers:
    false,

  manageInvites:
    false,

  manageRepositories:
    false,

  manageSystem:
    false,

  runMaintenance:
    false

};


function checkboxGroup(
  container,
  prefix,
  values
) {

  container.innerHTML =
    "";


  for (
    const key
    of permissionKeys
  ) {

    const label =
      document.createElement(
        "label"
      );


    const input =
      document.createElement(
        "input"
      );


    input.type =
      "checkbox";


    input.id =
      prefix +
      key;


    input.checked =
      Boolean(
        values[key]
      );


    label.append(

      input,

      document.createTextNode(
        " " +
        key
      )

    );


    container.append(
      label
    );

  }

}


checkboxGroup(

  invitePermissionsEl,

  "new-",

  defaultUploader

);


function readChecks(
  prefix
) {

  const output =
    {};


  for (
    const key
    of permissionKeys
  ) {

    output[key] =
      document
        .getElementById(
          prefix +
          key
        )
        .checked;

  }


  return output;

}


async function api(
  url,
  options = {}
) {

  const response =
    await fetch(

      url,

      {
        credentials:
          "same-origin",

        ...options,

        headers: {

          "Content-Type":
            "application/json",

          ...(
            options.headers ||
            {}
          )

        }

      }

    );


  const data =
    await response.json();


  if (
    !response.ok
  ) {

    throw new Error(
      data.error ||
      "request_failed"
    );

  }


  return data;

}


createInviteButton.onclick =
  async () => {

    try {

      const days =
        Number(
          inviteExpiryEl.value
        );


      const data =
        await api(

          "/api/admin/invites",

          {
            method:
              "POST",

            body:
              JSON.stringify({

                displayName:
                  inviteNameEl.value,

                expiresInDays:
                  days === 0
                    ? null
                    : days,

                note:
                  inviteNoteEl.value,

                permissions:
                  readChecks(
                    "new-"
                  )

              })
          }

        );


      createdCodeEl
        .classList
        .remove(
          "hidden"
        );


      createdCodeEl.textContent =

        "只显示这一次：" +
        data.inviteCode;


      inviteNameEl.value =
        "";


      inviteNoteEl.value =
        "";


      await loadInvites();

    } catch (error) {

      alert(
        error.message
      );

    }

  };


async function loadUsers() {

  const data =
    await api(
      "/api/admin/users"
    );


  usersEl.innerHTML =
    "";


  for (
    const user
    of data.users
  ) {

    const box =
      document.createElement(
        "div"
      );


    box.className =
      "card";


    const heading =
      document.createElement(
        "h3"
      );


    heading.textContent =

      user.displayName +
      " · " +
      user.role +
      " · " +
      user.status;


    box.append(
      heading
    );


    if (
      user.role ===
      "owner"
    ) {

      const text =
        document.createElement(
          "div"
        );


      text.textContent =
        "Owner 权限固定为全部允许。";


      box.append(
        text
      );


      usersEl.append(
        box
      );


      continue;

    }


    const permissions =
      document.createElement(
        "div"
      );


    permissions.className =
      "permissions";


    box.append(
      permissions
    );


    checkboxGroup(

      permissions,

      "u-" +
      user.id +
      "-",

      user.permissions

    );


    const toolbar =
      document.createElement(
        "div"
      );


    toolbar.className =
      "toolbar";


    const save =
      document.createElement(
        "button"
      );


    save.textContent =
      "保存权限";


    save.onclick =
      async () => {

        try {

          await api(

            "/api/admin/users/" +
            encodeURIComponent(
              user.id
            ),

            {
              method:
                "PATCH",

              body:
                JSON.stringify({

                  permissions:
                    readChecks(
                      "u-" +
                      user.id +
                      "-"
                    )

                })

            }

          );


          alert(
            "已保存"
          );


          loadUsers();

        } catch (error) {

          alert(
            error.message
          );

        }

      };


    const toggle =
      document.createElement(
        "button"
      );


    toggle.textContent =
      user.status ===
        "active"

        ? "禁用用户"

        : "启用用户";


    toggle.onclick =
      async () => {

        if (
          !confirm(
            toggle.textContent +
            "？"
          )
        ) {

          return;

        }


        try {

          await api(

            "/api/admin/users/" +
            encodeURIComponent(
              user.id
            ),

            {
              method:
                "PATCH",

              body:
                JSON.stringify({

                  status:
                    user.status ===
                      "active"

                      ? "disabled"

                      : "active"

                })

            }

          );


          loadUsers();

        } catch (error) {

          alert(
            error.message
          );

        }

      };


    const recovery =
      document.createElement(
        "button"
      );


    recovery.textContent =
      "生成恢复码";


    recovery.onclick =
      async () => {

        try {

          const data =
            await api(

              "/api/admin/users/" +
              encodeURIComponent(
                user.id
              ) +
              "/recovery",

              {
                method:
                  "POST",

                body:
                  "{}"
              }

            );


          prompt(

            "恢复码只显示这一次：",

            data.recoveryCode

          );

        } catch (error) {

          alert(
            error.message
          );

        }

      };


    const revokeAll =
      document.createElement(
        "button"
      );


    revokeAll.textContent =
      "撤销全部 Session";


    revokeAll.onclick =
      async () => {

        if (
          !confirm(
            "撤销 " +
            user.displayName +
            " 的全部登录？"
          )
        ) {

          return;

        }


        try {

          await api(

            "/api/admin/users/" +
            encodeURIComponent(
              user.id
            ) +
            "/sessions/revoke-all",

            {
              method:
                "POST",

              body:
                "{}"
            }

          );


          alert(
            "已撤销"
          );

        } catch (error) {

          alert(
            error.message
          );

        }

      };


    const devices =
      document.createElement(
        "button"
      );


    devices.textContent =
      "查看设备";


    const deviceBox =
      document.createElement(
        "div"
      );


    devices.onclick =
      async () => {

        try {

          const data =
            await api(

              "/api/admin/users/" +
              encodeURIComponent(
                user.id
              ) +
              "/sessions"

            );


          deviceBox.innerHTML =
            "";


          for (
            const session
            of data.sessions
          ) {

            const line =
              document.createElement(
                "div"
              );


            line.className =
              "card small";


            line.textContent =

              (
                session.deviceLabel ||
                "未命名设备"
              ) +

              " | " +

              new Date(
                session.createdAt *
                1000
              ).toLocaleString() +

              (
                session.revokedAt
                  ? " | 已撤销"
                  : ""
              );


            if (
              !session.revokedAt
            ) {

              const revoke =
                document.createElement(
                  "button"
                );


              revoke.textContent =
                "撤销";


              revoke.onclick =
                async () => {

                  try {

                    await api(

                      "/api/admin/sessions/" +
                      encodeURIComponent(
                        session.id
                      ) +
                      "/revoke",

                      {
                        method:
                          "POST",

                        body:
                          "{}"
                      }

                    );


                    devices.click();

                  } catch (error) {

                    alert(
                      error.message
                    );

                  }

                };


              line.append(
                revoke
              );

            }


            deviceBox.append(
              line
            );

          }

        } catch (error) {

          alert(
            error.message
          );

        }

      };


    toolbar.append(

      save,
      toggle,
      recovery,
      revokeAll,
      devices

    );


    box.append(
      toolbar,
      deviceBox
    );


    usersEl.append(
      box
    );

  }

}


async function loadInvites() {

  const data =
    await api(
      "/api/admin/invites"
    );


  invitesEl.innerHTML =
    "";


  for (
    const invite
    of data.invites
  ) {

    const box =
      document.createElement(
        "div"
      );


    box.className =
      "card small";


    const text =
      document.createElement(
        "div"
      );


    text.textContent =

      invite.displayName +
      " · " +
      invite.status +
      " · created " +

      new Date(
        invite.createdAt *
        1000
      ).toLocaleString() +

      (
        invite.expiresAt

          ? (
              " · expires " +
              new Date(
                invite.expiresAt *
                1000
              ).toLocaleString()
            )

          : " · no expiry"
      );


    box.append(
      text
    );


    if (
      invite.status ===
      "active"
    ) {

      const button =
        document.createElement(
          "button"
        );


      button.textContent =
        "撤销邀请码";


      button.onclick =
        async () => {

          try {

            await api(

              "/api/admin/invites/" +
              encodeURIComponent(
                invite.id
              ) +
              "/revoke",

              {
                method:
                  "POST",

                body:
                  "{}"
              }

            );


            loadInvites();

          } catch (error) {

            alert(
              error.message
            );

          }

        };


      box.append(
        button
      );

    }


    invitesEl.append(
      box
    );

  }

}


async function loadAudit() {

  const data =
    await api(
      "/api/admin/audit"
    );


  auditEl.innerHTML =
    "";


  for (
    const entry
    of data.logs
  ) {

    const box =
      document.createElement(
        "div"
      );


    box.className =
      "card small";


    box.textContent =

      new Date(
        entry.createdAt *
        1000
      ).toLocaleString() +

      " | " +

      entry.action +

      " | " +

      (
        entry.targetType ||
        ""
      ) +

      " " +

      (
        entry.targetId ||
        ""
      );


    auditEl.append(
      box
    );

  }

}


Promise
  .all([

    loadUsers(),
    loadInvites(),
    loadAudit()

  ])
  .catch(
    error => {

      alert(
        error.message
      );

    }
  );

</script>

`
    ),

    200,

    {
      "Content-Security-Policy":
        csp(false)
    }

  );

}
