import baseApp
from "./app.mjs";

import {
  jsonResponse
} from "./http.mjs";

import {
  handleFeedbackRequest,
  handleOwnerIncidentRequest
} from "./feedback-api.mjs";

import {
  renderFeedbackPage
} from "./feedback-page.mjs";

import {
  renderIncidentInboxPage
} from "./incident-page.mjs";


const FEEDBACK_ENTRY =
`<script>
(() => {

  "use strict";


  const ICON =
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M6.5 5.5h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-5.2L8.5 19v-2.5h-2a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
    '<path d="M8 10h8M8 13h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
    '</svg>';


  const STYLE_ID =
    "jy-global-feedback-style";


  function addStyle() {

    if (
      document.getElementById(
        STYLE_ID
      )
    ) {

      return;

    }


    const style =
      document.createElement(
        "style"
      );


    style.id =
      STYLE_ID;


    style.textContent =
      ".jy-feedback-icon{" +
      "width:22px;height:22px;" +
      "display:inline-grid;place-items:center;" +
      "flex:0 0 22px}" +

      ".jy-feedback-icon svg{" +
      "width:100%;height:100%}" +

      ".jy-feedback-count{" +
      "margin-left:auto;" +
      "min-width:22px;height:22px;" +
      "padding:0 7px;" +
      "border-radius:999px;" +
      "display:inline-flex;" +
      "align-items:center;" +
      "justify-content:center;" +
      "background:rgba(117,80,234,.12);" +
      "color:#7550ea;" +
      "font-size:11px;" +
      "font-weight:800}";


    document.head.append(
      style
    );

  }


  function category() {

    const path =
      location.pathname;


    if (
      path === "/" ||
      path.startsWith(
        "/upload"
      )
    ) {

      return "upload";

    }


    if (
      path.startsWith(
        "/library"
      )
    ) {

      return "media";

    }


    if (
      path.startsWith(
        "/account"
      ) ||
      path.startsWith(
        "/passkeys"
      )
    ) {

      return "account";

    }


    if (
      path.startsWith(
        "/profile"
      )
    ) {

      return "ui";

    }


    return "other";

  }


  function feedbackHref() {

    const params =
      new URLSearchParams();


    params.set(
      "category",
      category()
    );


    params.set(
      "page",
      location.pathname +
      location.search
    );


    return (
      "/feedback/?" +
      params.toString()
    );

  }


  async function getUser() {

    try {

      const response =
        await fetch(
          "/api/auth/me",
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


      if (!response.ok) {

        return null;

      }


      const data =
        await response.json();


      if (
        !data ||
        !data.authenticated ||
        !data.user ||
        data.user.status !==
          "active"
      ) {

        return null;

      }


      return data.user;

    } catch {

      return null;

    }

  }


  async function openIncidentCount(
    user
  ) {

    if (
      !user ||
      user.role !==
        "owner"
    ) {

      return 0;

    }


    try {

      const response =
        await fetch(
          "/api/admin/incidents?status=open&limit=100",
          {
            credentials:
              "same-origin",

            cache:
              "no-store"
          }
        );


      if (!response.ok) {

        return 0;

      }


      const data =
        await response.json();


      return Array.isArray(
        data.incidents
      )
        ? data.incidents.length
        : 0;

    } catch {

      return 0;

    }

  }


  function makeNavLink(
    id,
    href,
    label
  ) {

    const link =
      document.createElement(
        "a"
      );


    link.id =
      id;


    link.href =
      href;


    link.className =
      location.pathname.startsWith(
        href.split("?")[0]
      )

        ? "jy-nav-link active"

        : "jy-nav-link";


    const icon =
      document.createElement(
        "span"
      );


    icon.className =
      "jy-nav-icon jy-feedback-icon";


    icon.innerHTML =
      ICON;


    const text =
      document.createElement(
        "span"
      );


    text.className =
      "jy-nav-text";


    text.textContent =
      label;


    link.append(
      icon,
      text
    );


    return link;

  }


  function addSidebar(
    user
  ) {

    const nav =
      document.querySelector(
        ".jy-nav"
      );


    if (!nav) {

      return;

    }


    if (
      !document.getElementById(
        "jy-feedback-nav"
      )
    ) {

      nav.append(
        makeNavLink(
          "jy-feedback-nav",
          feedbackHref(),
          "反馈问题"
        )
      );

    }


    if (
      user.role ===
        "owner" &&
      !document.getElementById(
        "jy-incident-nav"
      )
    ) {

      nav.append(
        makeNavLink(
          "jy-incident-nav",
          "/admin/incidents/",
          "反馈收件箱"
        )
      );

    }

  }


  function menuLink(
    href,
    label,
    meta,
    count
  ) {

    const link =
      document.createElement(
        "a"
      );


    link.className =
      "jy-menu-link";


    link.href =
      href;


    const icon =
      document.createElement(
        "span"
      );


    icon.className =
      "jy-feedback-icon";


    icon.innerHTML =
      ICON;


    const text =
      document.createElement(
        "span"
      );


    text.textContent =
      label;


    link.append(
      icon,
      text
    );


    if (meta) {

      const small =
        document.createElement(
          "small"
        );


      small.textContent =
        meta;


      link.append(
        small
      );

    }


    if (
      Number(
        count
      ) >
      0
    ) {

      const badge =
        document.createElement(
          "span"
        );


      badge.className =
        "jy-feedback-count";


      badge.textContent =
        Number(
          count
        ) >
        99

          ? "99+"

          : String(
              count
            );


      link.append(
        badge
      );

    }


    return link;

  }


  function addMenu(
    user,
    count
  ) {

    if (
      document.getElementById(
        "jy-feedback-menu-marker"
      )
    ) {

      return;

    }


    const labels =
      Array.from(
        document.querySelectorAll(
          ".jy-menu-label"
        )
      );


    if (!labels.length) {

      return;

    }


    const panel =
      labels[0]
        .parentElement;


    if (!panel) {

      return;

    }


    const marker =
      document.createElement(
        "span"
      );


    marker.id =
      "jy-feedback-menu-marker";


    marker.hidden =
      true;


    const separator =
      document.createElement(
        "div"
      );


    separator.className =
      "jy-menu-separator";


    const help =
      document.createElement(
        "div"
      );


    help.className =
      "jy-menu-label";


    help.textContent =
      "HELP";


    panel.append(
      marker,
      separator,
      help,
      menuLink(
        feedbackHref(),
        "帮助与反馈",
        "反馈当前页面的问题",
        0
      )
    );


    if (
      user.role ===
        "owner"
    ) {

      panel.append(
        menuLink(
          "/admin/incidents/",
          "反馈收件箱",
          "Owner",
          count
        )
      );

    }

  }


  async function start() {

    const user =
      await getUser();


    if (!user) {

      return;

    }


    addStyle();


    const count =
      await openIncidentCount(
        user
      );


    const apply =
      function () {

        addSidebar(
          user
        );


        addMenu(
          user,
          count
        );

      };


    apply();


    const observer =
      new MutationObserver(
        apply
      );


    observer.observe(
      document.body,
      {
        childList:
          true,

        subtree:
          true
      }
    );

  }


  if (
    document.readyState ===
      "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      start,
      {
        once:
          true
      }
    );

  } else {

    start();

  }

})();
</script>`;


function cloneWithCookie(
  response,
  cookie
) {

  if (!cookie) {

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


function redirect(
  request,
  pathname,
  cookie = null
) {

  const url =
    new URL(
      pathname,
      request.url
    );


  const headers =
    new Headers({

      Location:
        url.toString(),

      "Cache-Control":
        "no-store"

    });


  if (cookie) {

    headers.append(
      "Set-Cookie",
      cookie
    );

  }


  return new Response(
    null,
    {

      status:
        302,

      headers

    }
  );

}


async function authenticate(
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


  const authRequest =
    new Request(
      url.toString(),
      {

        method:
          "GET",

        headers:
          new Headers(
            request.headers
          )

      }
    );


  const response =
    await baseApp.fetch(
      authRequest,
      env,
      ctx
    );


  const cookie =
    response.headers.get(
      "Set-Cookie"
    );


  if (!response.ok) {

    return {

      ok:
        false,

      response,

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
    !data?.user
  ) {

    return {

      ok:
        false,

      response:
        jsonResponse(
          {
            error:
              "authentication_required"
          },
          401
        ),

      cookie

    };

  }


  return {

    ok:
      true,

    cookie,

    auth: {

      user:
        data.user,

      session:
        data.session ||
        null

    }

  };

}


function activeUser(
  auth
) {

  return Boolean(

    auth?.user &&

    auth.user.status ===
      "active"

  );

}


function ownerUser(
  auth
) {

  return Boolean(

    activeUser(
      auth
    ) &&

    auth.user.role ===
      "owner" &&

    auth.user.permissions
      ?.manageSystem ===
      true

  );

}


function enhanceHtml(
  request,
  response
) {

  if (
    request.method
      .toUpperCase() !==
      "GET"
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


  return new HTMLRewriter()

    .on(
      "body",
      {

        element(
          element
        ) {

          element.append(
            FEEDBACK_ENTRY,
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


async function authenticatedApi(
  request,
  env,
  ctx,
  handler,
  ownerOnly = false
) {

  const authentication =
    await authenticate(
      request,
      env,
      ctx
    );


  if (
    !authentication.ok
  ) {

    return authentication
      .response;

  }


  if (
    !activeUser(
      authentication.auth
    )
  ) {

    return jsonResponse(
      {
        error:
          "active_account_required"
      },
      403
    );

  }


  if (
    ownerOnly &&
    !ownerUser(
      authentication.auth
    )
  ) {

    return jsonResponse(
      {
        error:
          "permission_denied"
      },
      403
    );

  }


  const response =
    await handler(
      authentication.auth
    );


  return cloneWithCookie(
    response,
    authentication.cookie
  );

}


async function serveFeedbackPage(
  request,
  env,
  ctx
) {

  if (
    request.method
      .toUpperCase() !==
      "GET"
  ) {

    return new Response(
      null,
      {

        status:
          405,

        headers: {
          Allow:
            "GET"
        }

      }
    );

  }


  const authentication =
    await authenticate(
      request,
      env,
      ctx
    );


  if (
    !authentication.ok
  ) {

    return redirect(
      request,
      "/login",
      authentication.cookie
    );

  }


  if (
    !activeUser(
      authentication.auth
    )
  ) {

    return redirect(
      request,
      "/",
      authentication.cookie
    );

  }


  let response =
    renderFeedbackPage();


  response =
    enhanceHtml(
      request,
      response
    );


  return cloneWithCookie(
    response,
    authentication.cookie
  );

}


async function serveIncidentInbox(
  request,
  env,
  ctx
) {

  if (
    request.method
      .toUpperCase() !==
      "GET"
  ) {

    return new Response(
      null,
      {

        status:
          405,

        headers: {
          Allow:
            "GET"
        }

      }
    );

  }


  const authentication =
    await authenticate(
      request,
      env,
      ctx
    );


  if (
    !authentication.ok
  ) {

    return redirect(
      request,
      "/login",
      authentication.cookie
    );

  }


  if (
    !ownerUser(
      authentication.auth
    )
  ) {

    return redirect(
      request,
      "/",
      authentication.cookie
    );

  }


  let response =
    renderIncidentInboxPage();


  response =
    enhanceHtml(
      request,
      response
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


    try {

      if (
        pathname ===
          "/feedback" ||
        pathname ===
          "/feedback/"
      ) {

        return await serveFeedbackPage(
          request,
          env,
          ctx
        );

      }


      if (
        pathname ===
          "/admin/incidents" ||
        pathname ===
          "/admin/incidents/"
      ) {

        return await serveIncidentInbox(
          request,
          env,
          ctx
        );

      }


      if (
        pathname ===
          "/api/feedback" ||
        pathname ===
          "/api/feedback/mine"
      ) {

        return await authenticatedApi(

          request,

          env,

          ctx,

          auth =>
            handleFeedbackRequest(
              request,
              env,
              auth
            )

        );

      }


      if (
        pathname ===
          "/api/admin/incidents" ||
        pathname.startsWith(
          "/api/admin/incidents/"
        )
      ) {

        return await authenticatedApi(

          request,

          env,

          ctx,

          auth =>
            handleOwnerIncidentRequest(
              request,
              env,
              auth
            ),

          true

        );

      }


      let response =
        await baseApp.fetch(
          request,
          env,
          ctx
        );


      response =
        enhanceHtml(
          request,
          response
        );


      return response;

    } catch (
      error
    ) {

      console.error(
        "App V2 error:",
        error
      );


      return jsonResponse(
        {
          error:
            error?.code ||
            "internal_error"
        },
        Number(
          error?.status ||
          500
        )
      );

    }

  }

};
