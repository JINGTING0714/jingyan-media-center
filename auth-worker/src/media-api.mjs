import {
  HttpError,
  methodNotAllowed,
  jsonResponse
} from "./http.mjs";

import {
  getLibraryPage
} from "./media-db.mjs";


const ALLOWED_TYPES =
  new Set([
    "image",
    "audio",
    "video"
  ]);


function requireOwner(
  auth
) {

  if (
    !auth?.user ||
    auth.user.role !==
      "owner" ||
    auth.user.status !==
      "active" ||
    auth.user.permissions
      ?.manageSystem !==
      true
  ) {

    throw new HttpError(
      403,
      "permission_denied"
    );

  }

}


function integerParam(
  value,
  fallback,
  min,
  max
) {

  const number =
    Number(
      value
    );


  if (
    !Number.isFinite(
      number
    )
  ) {

    return fallback;

  }


  return Math.min(

    max,

    Math.max(
      min,
      Math.trunc(
        number
      )
    )

  );

}


async function listMedia(
  request,
  env,
  auth
) {

  requireOwner(
    auth
  );


  const url =
    new URL(
      request.url
    );


  const type =
    String(
      url.searchParams.get(
        "type"
      ) ||
      "all"
    )
      .trim()
      .toLowerCase();


  if (
    type !==
      "all" &&
    !ALLOWED_TYPES.has(
      type
    )
  ) {

    throw new HttpError(
      400,
      "invalid_media_type_filter"
    );

  }


  const query =
    String(
      url.searchParams.get(
        "q"
      ) ||
      ""
    )
      .trim()
      .toLowerCase()
      .slice(
        0,
        120
      );


  const page =
    integerParam(
      url.searchParams.get(
        "page"
      ),
      1,
      1,
      100000
    );


  const pageSize =
    integerParam(
      url.searchParams.get(
        "pageSize"
      ),
      48,
      12,
      120
    );


  const data =
    await getLibraryPage(
      env,
      {
        type,
        query,
        page,
        pageSize
      }
    );


  return jsonResponse(
    data
  );

}


export async function handleAdminMediaRequest(
  request,
  env,
  auth
) {

  if (
    request.method
      .toUpperCase() !==
    "GET"
  ) {

    return methodNotAllowed([
      "GET"
    ]);

  }


  return listMedia(
    request,
    env,
    auth
  );

}
