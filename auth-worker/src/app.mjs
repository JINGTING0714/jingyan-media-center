import authWorker
from "./index.mjs";

import {
  HttpError,
  jsonResponse
} from "./http.mjs";

import {
  handleUserUploadRequest,
  handleInternalUploadRequest
} from "./upload-api.mjs";

import {
  handleAdminMediaRequest
} from "./media-api.mjs";

import {
  handleInternalMediaSyncRequest
} from "./media-sync-api.mjs";


const PROTECTED_OWNER_ASSETS =
  new Map([

    [
      "/admin",
      "/admin/"
    ],

    [
      "/admin/",
      "/admin/"
    ],

    [
      "/admin/index.html",
      "/admin/"
    ],

    [
      "/library",
      "/library/"
    ],

    [
      "/library/",
      "/library/"
    ],

    [
      "/library/index.html",
      "/library/"
    ]

  ]);


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


function redirectWithCookie(
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


async function authenticateThroughExistingWorker(
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
    await authWorker.fetch(
      authRequest,
      env,
      ctx
    );


  if (
    !response.ok
  ) {

    return {

      ok:
        false,

      response

    };

  }


  const cookie =
    response.headers.get(
      "Set-Cookie"
    );


  const data =
    await response.json();


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
        )

    };

  }


  return {

    ok:
      true,

    auth: {

      user:
        data.user,

      session:
        data.session

    },

    cookie

  };

}


function hasOwnerControlAccess(
  user
) {

  return Boolean(

    user &&

    user.role ===
      "owner" &&

    user.status ===
      "active" &&

    user.permissions
      ?.manageUsers ===
      true &&

    user.permissions
      ?.manageInvites ===
      true &&

    user.permissions
      ?.manageSystem ===
      true

  );

}


async function serveProtectedOwnerAsset(
  request,
  env,
  ctx,
  canonicalPath
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


  const authentication =
    await authenticateThroughExistingWorker(
      request,
      env,
      ctx
    );


  if (
    !authentication.ok
  ) {

    const clearCookie =
      authentication
        .response
        .headers
        .get(
          "Set-Cookie"
        );


    if (
      authentication
        .response
        .status ===
      401
    ) {

      return redirectWithCookie(
        request,
        "/activate",
        clearCookie
      );

    }


    return authentication
      .response;

  }


  if (
    !hasOwnerControlAccess(
      authentication
        .auth
        .user
    )
  ) {

    return redirectWithCookie(
      request,
      "/",
      authentication.cookie
    );

  }


  const assetUrl =
    new URL(
      request.url
    );


  assetUrl.pathname =
    canonicalPath;

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


  const response =
    await env.ASSETS.fetch(
      assetRequest
    );


  return cloneWithCookie(
    response,
    authentication.cookie
  );

}


async function handleProtectedAdminMediaApi(
  request,
  env,
  ctx
) {

  const authentication =
    await authenticateThroughExistingWorker(
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
    !hasOwnerControlAccess(
      authentication
        .auth
        .user
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
    await handleAdminMediaRequest(
      request,
      env,
      authentication.auth
    );


  return cloneWithCookie(
    response,
    authentication.cookie
  );

}


function errorResponse(
  error
) {

  if (
    error instanceof
    HttpError
  ) {

    return jsonResponse(
      {
        error:
          error.code
      },
      error.status
    );

  }


  console.error(
    "Unhandled app error:",
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


    try {

      if (
        url.pathname.startsWith(
          "/api/internal/media-sync/"
        )
      ) {

        return await handleInternalMediaSyncRequest(
          request,
          env
        );

      }


      if (
        url.pathname.startsWith(
          "/api/internal/uploads/"
        )
      ) {

        return await handleInternalUploadRequest(
          request,
          env
        );

      }


      if (
        url.pathname ===
          "/api/uploads" ||

        url.pathname.startsWith(
          "/api/uploads/"
        )
      ) {

        const authentication =
          await authenticateThroughExistingWorker(
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


        const response =
          await handleUserUploadRequest(
            request,
            env,
            authentication.auth
          );


        return cloneWithCookie(
          response,
          authentication.cookie
        );

      }


      if (
        url.pathname ===
        "/api/admin/media"
      ) {

        return await handleProtectedAdminMediaApi(
          request,
          env,
          ctx
        );

      }


      const protectedAsset =
        PROTECTED_OWNER_ASSETS
          .get(
            url.pathname
          );


      if (
        protectedAsset
      ) {

        return await serveProtectedOwnerAsset(
          request,
          env,
          ctx,
          protectedAsset
        );

      }


      return await authWorker.fetch(
        request,
        env,
        ctx
      );

    } catch (error) {

      return errorResponse(
        error
      );

    }

  }

};
