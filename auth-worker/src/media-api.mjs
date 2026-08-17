import {
  HttpError,
  jsonResponse,
  methodNotAllowed
} from "./http.mjs";


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


function safeDecode(
  value
) {

  try {

    return decodeURIComponent(
      value
    );

  } catch {

    return value;

  }

}


function filenameFromPath(
  publicPath
) {

  const segments =
    String(
      publicPath ||
      ""
    )
      .split(
        "/"
      )
      .filter(
        Boolean
      );


  return safeDecode(
    segments[
      segments.length -
      1
    ] ||
    ""
  );

}


function typeFromPath(
  publicPath
) {

  const segment =
    String(
      publicPath ||
      ""
    )
      .split(
        "/"
      )
      .filter(
        Boolean
      )[0];


  return (
    ALLOWED_TYPES.has(
      segment
    )

      ? segment

      : null
  );

}


function manifestUrl(
  env
) {

  const owner =
    String(
      env.GITHUB_OWNER ||
      ""
    ).trim();


  const repo =
    String(
      env.GITHUB_REPO ||
      ""
    ).trim();


  const ref =
    String(
      env.GITHUB_UPLOAD_REF ||
      "main"
    ).trim();


  if (
    !owner ||
    !repo ||
    !ref
  ) {

    throw new Error(
      "GitHub manifest configuration missing"
    );

  }


  const url =
    new URL(
      `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(ref)}/data/cdn-manifest.json`
    );


  /*
   * 30-second cache-busting bucket.
   *
   * Owner-only page, so this produces very little traffic while
   * avoiding an old raw.githubusercontent.com response after upload.
   */
  url.searchParams.set(
    "v",
    String(
      Math.floor(
        Date.now() /
        30000
      )
    )
  );


  return url;

}


async function readManifest(
  env
) {

  const response =
    await fetch(
      manifestUrl(
        env
      ),
      {
        headers: {
          "Accept":
            "application/json",

          "Cache-Control":
            "no-cache",

          "User-Agent":
            "jingyan-media-app"
        }
      }
    );


  if (
    !response.ok
  ) {

    throw new Error(
      `CDN manifest fetch failed: ${response.status}`
    );

  }


  let manifest;


  try {

    manifest =
      await response.json();

  } catch {

    throw new Error(
      "CDN manifest JSON invalid"
    );

  }


  if (
    !manifest ||
    typeof manifest !==
      "object" ||
    !manifest.assets ||
    typeof manifest.assets !==
      "object" ||
    Array.isArray(
      manifest.assets
    )
  ) {

    throw new Error(
      "CDN manifest structure invalid"
    );

  }


  return manifest;

}


function normalizedBaseUrl(
  manifest,
  env
) {

  const value =
    String(
      manifest.baseURL ||
      env.MEDIA_CDN_BASE_URL ||
      ""
    )
      .trim()
      .replace(
        /\/+$/,
        ""
      );


  if (!value) {

    throw new Error(
      "MEDIA_CDN_BASE_URL missing"
    );

  }


  return value;

}


function dateWeight(
  value
) {

  const timestamp =
    Date.parse(
      String(
        value ||
        ""
      )
    );


  return (
    Number.isFinite(
      timestamp
    )

      ? timestamp

      : 0
  );

}


function publicAsset(
  manifest,
  env,
  publicPath,
  entry
) {

  const inferredType =
    typeFromPath(
      publicPath
    );


  const declaredType =
    ALLOWED_TYPES.has(
      entry?.type
    )

      ? entry.type

      : null;


  const type =
    declaredType ||
    inferredType;


  if (!type) {

    return null;

  }


  const baseUrl =
    normalizedBaseUrl(
      manifest,
      env
    );


  const source =
    entry?.source &&
    typeof entry.source ===
      "object"

      ? {
          repository:
            String(
              entry.source.repo ||
              ""
            ),

          branch:
            String(
              entry.source.branch ||
              "main"
            ),

          path:
            String(
              entry.source.path ||
              ""
            )
        }

      : null;


  return {

    path:
      publicPath,

    url:
      baseUrl +
      publicPath,

    filename:
      filenameFromPath(
        publicPath
      ),

    type,

    mediaId:
      entry?.mediaId ||
      null,

    sizeBytes:
      Number.isFinite(
        Number(
          entry?.size
        )
      )

        ? Number(
            entry.size
          )

        : 0,

    sha256:
      entry?.sha256 ||
      null,

    cloudflareHash:
      entry?.hash ||
      null,

    source,

    addedAt:
      entry?.addedAt ||
      null

  };

}


function matchesSearch(
  item,
  query
) {

  if (!query) {

    return true;

  }


  const haystack = [

    item.filename,

    item.mediaId,

    item.path,

    item.sha256,

    item.cloudflareHash,

    item.source
      ?.repository,

    item.source
      ?.branch,

    item.source
      ?.path

  ]
    .filter(
      Boolean
    )
    .join(
      "\n"
    )
    .toLowerCase();


  return haystack
    .includes(
      query
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


  const requestUrl =
    new URL(
      request.url
    );


  const requestedType =
    String(
      requestUrl
        .searchParams
        .get(
          "type"
        ) ||
      "all"
    )
      .toLowerCase()
      .trim();


  if (
    requestedType !==
      "all" &&
    !ALLOWED_TYPES.has(
      requestedType
    )
  ) {

    throw new HttpError(
      400,
      "invalid_media_type_filter"
    );

  }


  const query =
    String(
      requestUrl
        .searchParams
        .get(
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


  const requestedPage =
    integerParam(
      requestUrl
        .searchParams
        .get(
          "page"
        ),
      1,
      1,
      100000
    );


  const pageSize =
    integerParam(
      requestUrl
        .searchParams
        .get(
          "pageSize"
        ),
      48,
      12,
      120
    );


  const manifest =
    await readManifest(
      env
    );


  const allItems =
    Object.entries(
      manifest.assets
    )
      .map(
        ([
          publicPath,
          entry
        ]) =>
          publicAsset(
            manifest,
            env,
            publicPath,
            entry
          )
      )
      .filter(
        Boolean
      )
      .sort(
        (
          a,
          b
        ) => {

          const dateDifference =
            dateWeight(
              b.addedAt
            ) -
            dateWeight(
              a.addedAt
            );


          if (
            dateDifference !==
            0
          ) {

            return dateDifference;

          }


          return b.path
            .localeCompare(
              a.path
            );

        }
      );


  const summary = {

    total:
      allItems.length,

    image:
      0,

    audio:
      0,

    video:
      0

  };


  const repositories =
    new Set();


  for (
    const item
    of allItems
  ) {

    summary[
      item.type
    ] +=
      1;


    if (
      item.source
        ?.repository
    ) {

      repositories.add(
        item.source.repository
      );

    }

  }


  const filtered =
    allItems.filter(
      item => {

        if (
          requestedType !==
            "all" &&
          item.type !==
            requestedType
        ) {

          return false;

        }


        return matchesSearch(
          item,
          query
        );

      }
    );


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filtered.length /
        pageSize
      )
    );


  const page =
    Math.min(
      requestedPage,
      totalPages
    );


  const start =
    (
      page -
      1
    ) *
    pageSize;


  const items =
    filtered.slice(
      start,
      start +
      pageSize
    );


  return jsonResponse({

    manifest: {

      version:
        manifest.version ||
        null,

      worker:
        manifest.worker ||
        null,

      baseUrl:
        normalizedBaseUrl(
          manifest,
          env
        ),

      updatedAt:
        manifest.updatedAt ||
        null,

      lastPublishedAt:
        manifest.lastPublishedAt ||
        null,

      repositoryCount:
        repositories.size

    },

    summary,

    query: {

      type:
        requestedType,

      q:
        query,

      page,

      pageSize,

      filteredTotal:
        filtered.length,

      totalPages

    },

    items

  });

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
