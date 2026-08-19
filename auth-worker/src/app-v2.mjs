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

    return authentication.response;

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


  return cloneWithCookie(
    renderFeedbackPage(),
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


      return await baseApp.fetch(
        request,
        env,
        ctx
      );

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
