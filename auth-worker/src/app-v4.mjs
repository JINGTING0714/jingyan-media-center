import appV3
from "./app-v3.mjs";


import baseApp
from "./app.mjs";


import {
  HttpError,
  jsonResponse
} from "./http.mjs";


import {
  handlePersonalLibraryRequest
} from "./personal-library-api.mjs";


const LIBRARY_ACCESS_SCRIPT =
  `<script src="/library-access-v2.js?v=20260820-personal-library-v2"></script>`;


function cloneWithCookie(
  response,
  cookie
) {

  if (
    !cookie
  ) {

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


async function authenticateThroughV3(
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


  headers.delete(
    "Content-Length"
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
    await appV3.fetch(
      authRequest,
      env,
      ctx
    );


  const cookie =
    response.headers.get(
      "Set-Cookie"
    );


  if (
    !response.ok
  ) {

    return {
      ok:
        false,

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
    !data?.user ||
    data.user.status !==
      "active"
  ) {

    return {
      ok:
        false,

      cookie
    };
  }


  return {

    ok:
      true,

    cookie,

    user:
      data.user,

    session:
      data.session ||
      null
  };
}


async function handlePersonalLibraryApi(
  request,
  env,
  ctx
) {

  const authentication =
    await authenticateThroughV3(
      request,
      env,
      ctx
    );


  if (
    !authentication.ok
  ) {

    return cloneWithCookie(

      jsonResponse(
        {
          error:
            "authentication_required"
        },
        401
      ),

      authentication.cookie
    );
  }


  try {

    const response =
      await handlePersonalLibraryRequest(
        request,
        env,
        {
          user:
            authentication.user,

          session:
            authentication.session
        }
      );


    return cloneWithCookie(
      response,
      authentication.cookie
    );

  } catch (
    error
  ) {

    console.error(
      "Personal library API error:",
      error
    );


    if (
      error instanceof
        HttpError
    ) {

      return cloneWithCookie(

        jsonResponse(
          {
            error:
              error.code
          },
          error.status
        ),

        authentication.cookie
      );
    }


    return cloneWithCookie(

      jsonResponse(
        {
          error:
            "internal_error"
        },
        500
      ),

      authentication.cookie
    );
  }
}


function isLibraryPath(
  pathname
) {

  return (
    pathname ===
      "/library" ||
    pathname ===
      "/library/" ||
    pathname ===
      "/library/index.html"
  );
}


async function serveLibraryV4(
  request,
  env,
  ctx
) {

  const response =
    await appV3.fetch(
      request,
      env,
      ctx
    );


  if (
    request.method
      .toUpperCase() !==
      "GET" ||
    response.status !==
      200
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

    /*
     * 删除 V3 注入的旧 library-access，
     * 防止 Owner 被重新显示回收站。
     */
    .on(
      'script[src^="/library-access.js"]',
      {

        element(
          element
        ) {

          element.remove();
        }
      }
    )

    /*
     * 不使用 defer。
     *
     * 它位于 head 最后，
     * 会在原本 defer 的 library.js 执行之前
     * 先完成 fetch 拦截。
     */
    .on(
      "head",
      {

        element(
          element
        ) {

          element.append(
            LIBRARY_ACCESS_SCRIPT,
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


    /*
     * ------------------------------------------------
     * PERSONAL MEDIA LIBRARY
     * CURRENT USER ONLY
     * ------------------------------------------------
     */
    if (
      pathname ===
        "/api/library/media"
    ) {

      return handlePersonalLibraryApi(
        request,
        env,
        ctx
      );
    }


    /*
     * ------------------------------------------------
     * GLOBAL MEDIA ADMIN
     *
     * V3 曾经为了让普通成员访问媒体库，
     * 临时放宽了 /api/admin/media。
     *
     * V4 在这里重新交回 app.mjs，
     * 恢复真正的 Owner 管理权限。
     * ------------------------------------------------
     */
    if (
      pathname ===
        "/api/admin/media"
    ) {

      return baseApp.fetch(
        request,
        env,
        ctx
      );
    }


    /*
     * ------------------------------------------------
     * LIBRARY PAGE
     * ------------------------------------------------
     */
    if (
      isLibraryPath(
        pathname
      )
    ) {

      return serveLibraryV4(
        request,
        env,
        ctx
      );
    }


    /*
     * 其余所有功能继续使用稳定的 V3。
     */
    return appV3.fetch(
      request,
      env,
      ctx
    );
  }

};
