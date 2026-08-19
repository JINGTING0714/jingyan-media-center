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

import {
  handleOwnerSystemHealthRequest,
  renderSystemHealthPage
} from "./system-health.mjs";


const FEEDBACK_ENTRY =
  `<script src="/feedback-entry.js?v=20260820-feedback-v3" defer></script>`;


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
        "no-store, max-age=0",

      Pragma:
        "no-cache"
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

  const headers =
    new Headers(
      request.headers
    );

  headers.set(
    "Accept",
    "application/json"
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
    ) || "";

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
      "head",
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


async function requirePageUser(
  request,
  env,
  ctx,
  {
    ownerOnly = false
  } = {}
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

    return {
      ok:
        false,

      response:
        redirect(
          request,
          "/login",
          authentication.cookie
        )
    };
  }

  if (
    !activeUser(
      authentication.auth
    )
  ) {

    return {
      ok:
        false,

      response:
        redirect(
          request,
          "/login",
          authentication.cookie
        )
    };
  }

  if (
    ownerOnly &&
    !ownerUser(
      authentication.auth
    )
  ) {

    return {
      ok:
        false,

      response:
        redirect(
          request,
          "/",
          authentication.cookie
        )
    };
  }

  return {
    ok:
      true,

    authentication
  };
}


async function serveProtectedHome(
  request,
  env,
  ctx
) {

  const method =
    request.method
      .toUpperCase();

  if (
    ![
      "GET",
      "HEAD"
    ].includes(
      method
    )
  ) {

    return new Response(
      null,
      {
        status:
          405,

        headers: {
          Allow:
            "GET, HEAD"
        }
      }
    );
  }

  const gate =
    await requirePageUser(
      request,
      env,
      ctx
    );

  if (!gate.ok) {
    return gate.response;
  }

  const {
    authentication
  } = gate;

  const assetUrl =
    new URL(
      request.url
    );

  assetUrl.pathname =
    "/index.html";

  assetUrl.search =
    "";

  const assetRequest =
    new Request(
      assetUrl.toString(),
      {
        method,

        headers:
          new Headers(
            request.headers
          )
      }
    );

  const assetResponse =
    await env.ASSETS.fetch(
      assetRequest
    );

  const headers =
    new Headers(
      assetResponse.headers
    );

  headers.set(
    "Cache-Control",
    "no-store, max-age=0"
  );

  headers.set(
    "Pragma",
    "no-cache"
  );

  if (
    authentication.cookie
  ) {

    headers.append(
      "Set-Cookie",
      authentication.cookie
    );
  }

  let response =
    new Response(
      assetResponse.body,
      {
        status:
          assetResponse.status,

        statusText:
          assetResponse.statusText,

        headers
      }
    );

  if (
    method ===
      "GET"
  ) {

    response =
      enhanceHtml(
        request,
        response
      );
  }

  return response;
}


async function serveLoginOrRedirect(
  request,
  env,
  ctx
) {

  const method =
    request.method
      .toUpperCase();

  if (
    method !==
      "GET"
  ) {

    return baseApp.fetch(
      request,
      env,
      ctx
    );
  }

  const authentication =
    await authenticate(
      request,
      env,
      ctx
    );

  if (
    authentication.ok &&
    activeUser(
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

  const gate =
    await requirePageUser(
      request,
      env,
      ctx
    );

  if (!gate.ok) {
    return gate.response;
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
    gate.authentication.cookie
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

  const gate =
    await requirePageUser(
      request,
      env,
      ctx,
      {
        ownerOnly:
          true
      }
    );

  if (!gate.ok) {
    return gate.response;
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
    gate.authentication.cookie
  );
}


async function serveSystemHealthPage(
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

  const gate =
    await requirePageUser(
      request,
      env,
      ctx,
      {
        ownerOnly:
          true
      }
    );

  if (!gate.ok) {
    return gate.response;
  }

  let response =
    renderSystemHealthPage();

  response =
    enhanceHtml(
      request,
      response
    );

  return cloneWithCookie(
    response,
    gate.authentication.cookie
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

      /*
       * -----------------------------------------------
       * FORMAL APP HOME
       * -----------------------------------------------
       */

      if (
        pathname ===
          "/" ||
        pathname ===
          "/index.html"
      ) {

        return await serveProtectedHome(
          request,
          env,
          ctx
        );
      }


      /*
       * -----------------------------------------------
       * LOGIN
       * -----------------------------------------------
       */

      if (
        pathname ===
          "/login" ||
        pathname ===
          "/login/" ||
        pathname ===
          "/owner-login" ||
        pathname ===
          "/owner-login/"
      ) {

        return await serveLoginOrRedirect(
          request,
          env,
          ctx
        );
      }


      /*
       * -----------------------------------------------
       * FEEDBACK
       * -----------------------------------------------
       */

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


      /*
       * -----------------------------------------------
       * OWNER INCIDENT INBOX
       * -----------------------------------------------
       */

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


      /*
       * -----------------------------------------------
       * OWNER SYSTEM HEALTH
       * -----------------------------------------------
       */

      if (
        pathname ===
          "/admin/system-health" ||
        pathname ===
          "/admin/system-health/"
      ) {

        return await serveSystemHealthPage(
          request,
          env,
          ctx
        );
      }


      /*
       * -----------------------------------------------
       * USER FEEDBACK API
       * -----------------------------------------------
       */

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


      /*
       * -----------------------------------------------
       * OWNER INCIDENT API
       * -----------------------------------------------
       */

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


      /*
       * -----------------------------------------------
       * OWNER SYSTEM HEALTH API
       * -----------------------------------------------
       */

      if (
        pathname ===
          "/api/admin/health"
      ) {

        return await authenticatedApi(
          request,
          env,
          ctx,
          auth =>
            handleOwnerSystemHealthRequest(
              request,
              env,
              auth
            ),
          true
        );
      }


      /*
       * -----------------------------------------------
       * EXISTING APPLICATION
       * -----------------------------------------------
       *
       * Account
       * Profile
       * Library
       * Admin
       * Upload APIs
       * Batch V2
       * Collections
       * Favorites
       * Passkeys
       * Device pairing
       * Recovery
       * Authentication
       * User lifecycle
       *
       * all continue through baseApp.
       */

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
