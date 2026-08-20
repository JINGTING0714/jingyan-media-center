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


async function serveLibrary(
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
     * V3 仍会在内部页面中注入旧脚本。
     * V4 统一把所有历史权限补丁移除。
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

    .on(
      'script[src^="/library-access-v2.js"]',
      {
        element(
          element
        ) {
          element.remove();
        }
      }
    )

    /*
     * 强制刷新新的正式 library.js，
     * 不再依赖额外 access 脚本。
     */
    .on(
      'script[src^="/library.js"]',
      {
        element(
          element
        ) {
          element.setAttribute(
            "src",
            "/library.js?v=20260820-personal-v3"
          );
        }
      }
    )

    .on(
      'link[href^="/library.css"]',
      {
        element(
          element
        ) {
          element.setAttribute(
            "href",
            "/library.css?v=20260820-personal-v3"
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
     * 当前登录用户自己的媒体库。
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
     * Owner 全局媒体接口仍交回原稳定实现。
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
     * 页面允许所有已登录成员进入，
     * 数据权限由 /api/library/media 决定。
     */
    if (
      isLibraryPath(
        pathname
      )
    ) {
      return serveLibrary(
        request,
        env,
        ctx
      );
    }


    return appV3.fetch(
      request,
      env,
      ctx
    );
  }

};
