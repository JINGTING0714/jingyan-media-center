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


function requireActiveUser(
  auth
) {

  if (
    !auth?.user ||
    auth.user.status !==
      "active"
  ) {

    throw new HttpError(
      403,
      "active_account_required"
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


function parseType(
  url
) {

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


  return type;
}


function parseQuery(
  url
) {

  return String(
    url.searchParams.get(
      "q"
    ) ||
    ""
  )
    .normalize(
      "NFC"
    )
    .trim()
    .toLowerCase()
    .slice(
      0,
      120
    );
}


function parsePaging(
  url
) {

  return {

    page:
      integerParam(
        url.searchParams.get(
          "page"
        ),
        1,
        1,
        100000
      ),

    pageSize:
      integerParam(
        url.searchParams.get(
          "pageSize"
        ),
        24,
        12,
        48
      )
  };
}


function toIso(
  seconds
) {

  const value =
    Number(
      seconds
    );


  if (
    !Number.isFinite(
      value
    ) ||
    value <=
      0
  ) {

    return null;
  }


  return new Date(
    value *
    1000
  ).toISOString();
}


async function getManifestState(
  env
) {

  const row =
    await env.MEDIA_DB
      .prepare(`
        SELECT
          value

        FROM sync_state

        WHERE
          key =
            'manifest_state'

        LIMIT 1
      `)
      .first();


  if (
    !row?.value
  ) {

    return {};
  }


  try {

    return JSON.parse(
      row.value
    );

  } catch {

    return {};
  }
}


function buildUploadWhere(
  userId,
  type,
  query
) {

  const where =
    [
      "user_id = ?",
      "status = 'complete'",
      "media_id IS NOT NULL",
      "TRIM(media_id) <> ''"
    ];


  const bindings =
    [
      userId
    ];


  if (
    type !==
      "all"
  ) {

    where.push(
      "media_type = ?"
    );

    bindings.push(
      type
    );
  }


  if (
    query
  ) {

    where.push(`
      (
        instr(
          lower(
            COALESCE(
              original_name,
              ''
            )
          ),
          ?
        ) > 0

        OR

        instr(
          lower(
            COALESCE(
              final_filename,
              ''
            )
          ),
          ?
        ) > 0

        OR

        instr(
          lower(
            COALESCE(
              media_id,
              ''
            )
          ),
          ?
        ) > 0

        OR

        instr(
          lower(
            COALESCE(
              sha256,
              ''
            )
          ),
          ?
        ) > 0

        OR

        instr(
          lower(
            COALESCE(
              source_repository,
              ''
            )
          ),
          ?
        ) > 0

        OR

        instr(
          lower(
            COALESCE(
              cdn_url,
              ''
            )
          ),
          ?
        ) > 0
      )
    `);


    for (
      let index = 0;
      index < 6;
      index += 1
    ) {

      bindings.push(
        query
      );
    }
  }


  return {
    whereSql:
      where.join(
        "\nAND\n"
      ),

    bindings
  };
}


async function getSummary(
  env,
  userId
) {

  const row =
    await env.AUTH_DB
      .prepare(`
        WITH owned_media AS (

          SELECT
            media_id,

            MAX(
              media_type
            ) AS media_type

          FROM upload_jobs

          WHERE
            user_id = ?

          AND
            status = 'complete'

          AND
            media_id IS NOT NULL

          AND
            TRIM(media_id) <> ''

          GROUP BY
            media_id
        )

        SELECT

          COUNT(*) AS total,

          COALESCE(
            SUM(
              CASE
                WHEN media_type = 'image'
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS image,

          COALESCE(
            SUM(
              CASE
                WHEN media_type = 'audio'
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS audio,

          COALESCE(
            SUM(
              CASE
                WHEN media_type = 'video'
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS video

        FROM owned_media
      `)
      .bind(
        userId
      )
      .first();


  return {

    total:
      Number(
        row?.total ||
        0
      ),

    image:
      Number(
        row?.image ||
        0
      ),

    audio:
      Number(
        row?.audio ||
        0
      ),

    video:
      Number(
        row?.video ||
        0
      )
  };
}


async function getOwnedPage(
  env,
  userId,
  {
    type,
    query,
    page,
    pageSize
  }
) {

  const {
    whereSql,
    bindings
  } =
    buildUploadWhere(
      userId,
      type,
      query
    );


  const countRow =
    await env.AUTH_DB
      .prepare(`
        WITH owned_media AS (

          SELECT
            media_id

          FROM upload_jobs

          WHERE
            ${whereSql}

          GROUP BY
            media_id
        )

        SELECT
          COUNT(*) AS count

        FROM owned_media
      `)
      .bind(
        ...bindings
      )
      .first();


  const filteredTotal =
    Number(
      countRow?.count ||
      0
    );


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredTotal /
        pageSize
      )
    );


  const safePage =
    Math.min(
      page,
      totalPages
    );


  const offset =
    (
      safePage -
      1
    ) *
    pageSize;


  const result =
    await env.AUTH_DB
      .prepare(`
        SELECT

          media_id,

          MAX(
            COALESCE(
              completed_at,
              updated_at,
              created_at
            )
          ) AS owned_at,

          MAX(
            media_type
          ) AS media_type

        FROM upload_jobs

        WHERE
          ${whereSql}

        GROUP BY
          media_id

        ORDER BY
          owned_at DESC,
          media_id DESC

        LIMIT ?
        OFFSET ?
      `)
      .bind(
        ...bindings,
        pageSize,
        offset
      )
      .all();


  return {

    page:
      safePage,

    pageSize,

    filteredTotal,

    totalPages,

    rows:
      result.results ||
      []
  };
}


async function hydrateMedia(
  env,
  ownedRows
) {

  const ids =
    ownedRows
      .map(
        row =>
          String(
            row.media_id ||
            ""
          ).trim()
      )
      .filter(
        Boolean
      );


  if (
    ids.length ===
      0
  ) {

    return [];
  }


  const placeholders =
    ids
      .map(
        () => "?"
      )
      .join(
        ","
      );


  const result =
    await env.MEDIA_DB
      .prepare(`
        SELECT

          id,
          type,
          filename,
          original_name,
          display_title,
          public_path,
          cdn_url,
          cdn_shard,
          cloudflare_hash,
          sha256,
          size_bytes,
          source_repository,
          source_branch,
          source_path,
          uploader_user_id,
          first_upload_job_id,
          status,
          is_protected,
          added_at,
          published_at,
          trashed_at,
          trash_expires_at,
          deleted_at,
          created_at,
          updated_at

        FROM media

        WHERE
          id IN (
            ${placeholders}
          )

        AND
          status = 'published'
      `)
      .bind(
        ...ids
      )
      .all();


  const mediaMap =
    new Map(
      (
        result.results ||
        []
      ).map(
        row => [
          row.id,
          row
        ]
      )
    );


  return ownedRows
    .map(
      owned => {

        const media =
          mediaMap.get(
            owned.media_id
          );


        if (
          !media
        ) {

          return null;
        }


        return {
          media,
          ownedAt:
            Number(
              owned.owned_at ||
              0
            )
        };
      }
    )
    .filter(
      Boolean
    );
}


function serializeMedia(
  entry,
  user
) {

  const row =
    entry.media;


  return {

    path:
      row.public_path,

    url:
      row.cdn_url,

    filename:
      row.filename,

    originalName:
      row.original_name,

    displayTitle:
      row.display_title,

    type:
      row.type,

    mediaId:
      row.id,

    sizeBytes:
      Number(
        row.size_bytes ||
        0
      ),

    sha256:
      row.sha256,

    cloudflareHash:
      row.cloudflare_hash,

    cdnShard:
      row.cdn_shard,

    protected:
      Boolean(
        row.is_protected
      ),

    status:
      row.status,

    source: {

      repository:
        row.source_repository,

      branch:
        row.source_branch,

      path:
        row.source_path
    },

    uploader: {

      id:
        user.id,

      displayName:
        user.displayName ||
        user.display_name ||
        null
    },

    addedAt:
      toIso(
        row.added_at
      ),

    publishedAt:
      toIso(
        row.published_at
      ),

    ownedAt:
      toIso(
        entry.ownedAt
      ),

    trashedAt:
      null,

    trashExpiresAt:
      null
  };
}


function capabilities() {

  return {

    readMedia:
      true,

    copyCdn:
      true,

    preview:
      true,

    collections:
      true,

    viewTrash:
      false,

    deleteMedia:
      false,

    restoreMedia:
      false,

    editMedia:
      false,

    personalLibrary:
      true
  };
}


async function listPersonalLibrary(
  request,
  env,
  auth
) {

  requireActiveUser(
    auth
  );


  const url =
    new URL(
      request.url
    );


  const requestedStatus =
    String(
      url.searchParams.get(
        "status"
      ) ||
      "published"
    )
      .trim()
      .toLowerCase();


  if (
    requestedStatus !==
      "published"
  ) {

    throw new HttpError(
      400,
      "personal_library_published_only"
    );
  }


  const type =
    parseType(
      url
    );


  const query =
    parseQuery(
      url
    );


  const {
    page,
    pageSize
  } =
    parsePaging(
      url
    );


  const [
    summary,
    ownedPage,
    manifest
  ] =
    await Promise.all([

      getSummary(
        env,
        auth.user.id
      ),

      getOwnedPage(
        env,
        auth.user.id,
        {
          type,
          query,
          page,
          pageSize
        }
      ),

      getManifestState(
        env
      )
    ]);


  const hydrated =
    await hydrateMedia(
      env,
      ownedPage.rows
    );


  return jsonResponse({

    scope:
      "personal",

    ownerUserId:
      auth.user.id,

    manifest: {

      version:
        manifest.version ??
        null,

      worker:
        manifest.worker ||
        env.MEDIA_CDN_WORKER ||
        null,

      baseUrl:
        manifest.baseUrl ||
        env.MEDIA_CDN_BASE_URL ||
        null,

      updatedAt:
        manifest.updatedAt ||
        null,

      lastPublishedAt:
        manifest.lastPublishedAt ||
        null,

      syncedAt:
        manifest.syncedAt ||
        null
    },

    summary,

    query: {

      status:
        "published",

      type,

      q:
        query,

      page:
        ownedPage.page,

      pageSize:
        ownedPage.pageSize,

      filteredTotal:
        ownedPage.filteredTotal,

      totalPages:
        ownedPage.totalPages
    },

    capabilities:
      capabilities(),

    items:
      hydrated.map(
        entry =>
          serializeMedia(
            entry,
            auth.user
          )
      )
  });
}


export async function handlePersonalLibraryRequest(
  request,
  env,
  auth
) {

  requireActiveUser(
    auth
  );


  const method =
    request.method
      .toUpperCase();


  if (
    method ===
      "GET"
  ) {

    return listPersonalLibrary(
      request,
      env,
      auth
    );
  }


  return methodNotAllowed([
    "GET"
  ]);
}
