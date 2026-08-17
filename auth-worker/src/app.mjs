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
