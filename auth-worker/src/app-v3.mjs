import appV2
from "./app-v2.mjs";


const HOME_SCRIPT =
  `<script src="/upload-convenience.js?v=20260820-history-v1" defer></script>`;


const LOGIN_SCRIPT =
  `<script src="/login-v3.js?v=20260820-login-v3" defer></script>`;


function enhancementForPath(
  pathname
) {

  if (
    pathname ===
      "/" ||
    pathname ===
      "/index.html"
  ) {

    return HOME_SCRIPT;
  }


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

    return LOGIN_SCRIPT;
  }


  return null;
}


function canEnhance(
  request,
  response,
  enhancement
) {

  if (
    !enhancement
  ) {

    return false;
  }


  if (
    request.method
      .toUpperCase() !==
    "GET"
  ) {

    return false;
  }


  if (
    response.status !==
    200
  ) {

    return false;
  }


  const contentType =
    response.headers.get(
      "Content-Type"
    ) || "";


  return contentType
    .toLowerCase()
    .includes(
      "text/html"
    );
}


function injectScript(
  response,
  script
) {

  return new HTMLRewriter()

    .on(
      "head",
      {

        element(
          element
        ) {

          element.append(
            script,
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

    const response =
      await appV2.fetch(
        request,
        env,
        ctx
      );


    const url =
      new URL(
        request.url
      );


    const enhancement =
      enhancementForPath(
        url.pathname
      );


    if (
      !canEnhance(
        request,
        response,
        enhancement
      )
    ) {

      return response;
    }


    return injectScript(
      response,
      enhancement
    );

  }

};
