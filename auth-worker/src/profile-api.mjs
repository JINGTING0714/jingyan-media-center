import {
  HttpError,
  jsonResponse,
  requireSameOrigin,
  methodNotAllowed,
  notFound
} from "./http.mjs";

import {
  createId,
  nowSeconds
} from "./crypto.mjs";


const TYPES =
  new Set([
    "image",
    "audio",
    "video"
  ]);


function assertActiveUser(
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


function normalizeMediaId(
  input
) {

  const value =
    String(
      input ||
      ""
    ).trim();


  if (
    !value ||
    value.length >
      80 ||
    /[\u0000-\u001F\u007F]/u
      .test(
        value
      )
  ) {

    throw new HttpError(
      400,
      "invalid_media_id"
    );

  }


  return value;

}


function readListQuery(
  request
) {

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
    !TYPES.has(
      type
    )
  ) {

    throw new HttpError(
      400,
      "invalid_media_type_filter"
    );

  }


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
      12,
      1,
      48
    );


  return {
    type,
    page,
    pageSize
  };

}


function serializeMedia(
  row,
  uploaderMap
) {

  return {
    mediaId:
      row.id,

    type:
      row.type,

    filename:
      row.filename,

    originalName:
      row.original_name,

    displayTitle:
      row.display_title,

    url:
      row.cdn_url,

    cdnUrl:
      row.cdn_url,

    sizeBytes:
      Number(
        row.size_bytes ||
        0
      ),

    status:
      row.status,

    favorite:
      Boolean(
        row.is_favorite
      ),

    uploader:
      row.uploader_user_id
        ? {
            id:
              row.uploader_user_id,

            displayName:
              uploaderMap.get(
                row.uploader_user_id
              ) ||
              null
          }
        : null,

    addedAt:
      toIso(
        row.added_at
      ),

    publishedAt:
      toIso(
        row.published_at
      ),

    favoritedAt:
      toIso(
        row.favorite_created_at
      )
  };

}


async function getUploaderMap(
  env,
  rows
) {

  const ids =
    [
      ...new Set(
        rows
          .map(
            row =>
              row.uploader_user_id
          )
          .filter(
            Boolean
          )
      )
    ];


  const map =
    new Map();


  if (
    ids.length ===
    0
  ) {

    return map;

  }


  for (
    let offset = 0;
    offset <
      ids.length;
    offset +=
      80
  ) {

    const group =
      ids.slice(
        offset,
        offset +
          80
      );


    const placeholders =
      group
        .map(
          () =>
            "?"
        )
        .join(
          ","
        );


    const result =
      await env.AUTH_DB
        .prepare(`
          SELECT
            id,
            display_name

          FROM users

          WHERE id IN (
            ${placeholders}
          )
        `)
        .bind(
          ...group
        )
        .all();


    for (
      const user
      of (
        result.results ||
        []
      )
    ) {

      map.set(
        user.id,
        user.display_name
      );

    }

  }


  return map;

}


async function addMediaEvent(
  env,
  {
    mediaId,
    actorUserId,
    action
  }
) {

  await env.MEDIA_DB
    .prepare(`
      INSERT INTO media_events (
        id,
        media_id,
        actor_user_id,
        action,
        metadata_json,
        created_at
      )

      VALUES (
        ?,
        ?,
        ?,
        ?,
        NULL,
        ?
      )
    `)
    .bind(
      createId(
        "mevt"
      ),

      mediaId,

      actorUserId,

      action,

      nowSeconds()
    )
    .run();

}


async function getMediaRow(
  env,
  userId,
  mediaId
) {

  return env.MEDIA_DB
    .prepare(`
      SELECT
        m.id,
        m.type,
        m.filename,
        m.original_name,
        m.display_title,
        m.cdn_url,
        m.size_bytes,
        m.uploader_user_id,
        m.status,
        m.added_at,
        m.published_at,

        CASE
          WHEN mf.media_id IS NULL
          THEN 0
          ELSE 1
        END
        AS is_favorite,

        mf.created_at
        AS favorite_created_at

      FROM media m

      LEFT JOIN media_favorites mf
        ON
          mf.media_id =
            m.id

        AND
          mf.user_id =
            ?

      WHERE
        m.id =
          ?

      LIMIT 1
    `)
    .bind(
      userId,
      mediaId
    )
    .first();

}


async function getOverview(
  request,
  env,
  auth
) {

  assertActiveUser(
    auth
  );


  const userId =
    auth.user.id;


  const recentCountRow =
    await env.MEDIA_DB
      .prepare(`
        SELECT
          COUNT(*) AS count

        FROM media

        WHERE
          uploader_user_id = ?

        AND
          status = 'published'
      `)
      .bind(
        userId
      )
      .first();


  const favoriteCountRow =
    await env.MEDIA_DB
      .prepare(`
        SELECT
          COUNT(*) AS count

        FROM media_favorites mf

        INNER JOIN media m
          ON
            m.id =
              mf.media_id

        WHERE
          mf.user_id = ?

        AND
          m.status = 'published'
      `)
      .bind(
        userId
      )
      .first();


  const recentResult =
    await env.MEDIA_DB
      .prepare(`
        SELECT
          m.id,
          m.type,
          m.filename,
          m.original_name,
          m.display_title,
          m.cdn_url,
          m.size_bytes,
          m.uploader_user_id,
          m.status,
          m.added_at,
          m.published_at,

          CASE
            WHEN mf.media_id IS NULL
            THEN 0
            ELSE 1
          END
          AS is_favorite,

          mf.created_at
          AS favorite_created_at

        FROM media m

        LEFT JOIN media_favorites mf
          ON
            mf.media_id =
              m.id

          AND
            mf.user_id =
              ?

        WHERE
          m.uploader_user_id =
            ?

        AND
          m.status =
            'published'

        ORDER BY
          COALESCE(
            m.published_at,
            m.added_at,
            m.created_at
          ) DESC,

          m.id DESC

        LIMIT 10
      `)
      .bind(
        userId,
        userId
      )
      .all();


  const favoriteResult =
    await env.MEDIA_DB
      .prepare(`
        SELECT
          m.id,
          m.type,
          m.filename,
          m.original_name,
          m.display_title,
          m.cdn_url,
          m.size_bytes,
          m.uploader_user_id,
          m.status,
          m.added_at,
          m.published_at,

          1
          AS is_favorite,

          mf.created_at
          AS favorite_created_at

        FROM media_favorites mf

        INNER JOIN media m
          ON
            m.id =
              mf.media_id

        WHERE
          mf.user_id =
            ?

        AND
          m.status =
            'published'

        ORDER BY
          mf.created_at DESC,
          m.id DESC

        LIMIT 10
      `)
      .bind(
        userId
      )
      .all();


  const recentRows =
    recentResult.results ||
    [];


  const favoriteRows =
    favoriteResult.results ||
    [];


  const uploaderMap =
    await getUploaderMap(
      env,
      [
        ...recentRows,
        ...favoriteRows
      ]
    );


  return jsonResponse({

    view:
      "summary",

    recentUploads: {

      total:
        Number(
          recentCountRow
            ?.count ||
          0
        ),

      items:
        recentRows.map(
          row =>
            serializeMedia(
              row,
              uploaderMap
            )
        )

    },

    favorites: {

      total:
        Number(
          favoriteCountRow
            ?.count ||
          0
        ),

      items:
        favoriteRows.map(
          row =>
            serializeMedia(
              row,
              uploaderMap
            )
        )

    }

  });

}


async function listUploads(
  request,
  env,
  auth
) {

  assertActiveUser(
    auth
  );


  const {
    type,
    page,
    pageSize
  } =
    readListQuery(
      request
    );


  const where = [
    "m.uploader_user_id = ?",
    "m.status = 'published'"
  ];


  const bindings = [
    auth.user.id
  ];


  if (
    type !==
    "all"
  ) {

    where.push(
      "m.type = ?"
    );


    bindings.push(
      type
    );

  }


  const whereSql =
    where.join(
      "\nAND\n"
    );


  const countRow =
    await env.MEDIA_DB
      .prepare(`
        SELECT
          COUNT(*) AS count

        FROM media m

        WHERE
          ${whereSql}
      `)
      .bind(
        ...bindings
      )
      .first();


  const total =
    Number(
      countRow
        ?.count ||
      0
    );


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        total /
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
    await env.MEDIA_DB
      .prepare(`
        SELECT
          m.id,
          m.type,
          m.filename,
          m.original_name,
          m.display_title,
          m.cdn_url,
          m.size_bytes,
          m.uploader_user_id,
          m.status,
          m.added_at,
          m.published_at,

          CASE
            WHEN mf.media_id IS NULL
            THEN 0
            ELSE 1
          END
          AS is_favorite,

          mf.created_at
          AS favorite_created_at

        FROM media m

        LEFT JOIN media_favorites mf
          ON
            mf.media_id =
              m.id

          AND
            mf.user_id =
              ?

        WHERE
          ${whereSql}

        ORDER BY
          COALESCE(
            m.published_at,
            m.added_at,
            m.created_at
          ) DESC,

          m.id DESC

        LIMIT ?
        OFFSET ?
      `)
      .bind(
        auth.user.id,
        ...bindings,
        pageSize,
        offset
      )
      .all();


  const rows =
    result.results ||
    [];


  const uploaderMap =
    await getUploaderMap(
      env,
      rows
    );


  return jsonResponse({

    view:
      "uploads",

    query: {

      type,

      page:
        safePage,

      pageSize,

      total,

      totalPages

    },

    items:
      rows.map(
        row =>
          serializeMedia(
            row,
            uploaderMap
          )
      )

  });

}


async function listFavorites(
  request,
  env,
  auth
) {

  assertActiveUser(
    auth
  );


  const {
    type,
    page,
    pageSize
  } =
    readListQuery(
      request
    );


  const where = [
    "mf.user_id = ?",
    "m.status = 'published'"
  ];


  const bindings = [
    auth.user.id
  ];


  if (
    type !==
    "all"
  ) {

    where.push(
      "m.type = ?"
    );


    bindings.push(
      type
    );

  }


  const whereSql =
    where.join(
      "\nAND\n"
    );


  const countRow =
    await env.MEDIA_DB
      .prepare(`
        SELECT
          COUNT(*) AS count

        FROM media_favorites mf

        INNER JOIN media m
          ON
            m.id =
              mf.media_id

        WHERE
          ${whereSql}
      `)
      .bind(
        ...bindings
      )
      .first();


  const total =
    Number(
      countRow
        ?.count ||
      0
    );


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        total /
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
    await env.MEDIA_DB
      .prepare(`
        SELECT
          m.id,
          m.type,
          m.filename,
          m.original_name,
          m.display_title,
          m.cdn_url,
          m.size_bytes,
          m.uploader_user_id,
          m.status,
          m.added_at,
          m.published_at,

          1
          AS is_favorite,

          mf.created_at
          AS favorite_created_at

        FROM media_favorites mf

        INNER JOIN media m
          ON
            m.id =
              mf.media_id

        WHERE
          ${whereSql}

        ORDER BY
          mf.created_at DESC,
          m.id DESC

        LIMIT ?
        OFFSET ?
      `)
      .bind(
        ...bindings,
        pageSize,
        offset
      )
      .all();


  const rows =
    result.results ||
    [];


  const uploaderMap =
    await getUploaderMap(
      env,
      rows
    );


  return jsonResponse({

    view:
      "favorites",

    query: {

      type,

      page:
        safePage,

      pageSize,

      total,

      totalPages

    },

    items:
      rows.map(
        row =>
          serializeMedia(
            row,
            uploaderMap
          )
      )

  });

}


async function addFavorite(
  request,
  env,
  auth,
  mediaId
) {

  assertActiveUser(
    auth
  );


  requireSameOrigin(
    request
  );


  const normalizedMediaId =
    normalizeMediaId(
      mediaId
    );


  const media =
    await getMediaRow(
      env,
      auth.user.id,
      normalizedMediaId
    );


  if (
    !media ||
    media.status !==
      "published"
  ) {

    throw new HttpError(
      404,
      "media_not_found"
    );

  }


  const result =
    await env.MEDIA_DB
      .prepare(`
        INSERT OR IGNORE
        INTO media_favorites (
          user_id,
          media_id,
          created_at
        )

        VALUES (
          ?,
          ?,
          ?
        )
      `)
      .bind(
        auth.user.id,
        normalizedMediaId,
        nowSeconds()
      )
      .run();


  const added =
    Number(
      result
        ?.meta
        ?.changes ||
      0
    ) ===
    1;


  if (
    added
  ) {

    await addMediaEvent(
      env,
      {
        mediaId:
          normalizedMediaId,

        actorUserId:
          auth.user.id,

        action:
          "favorite.added"
      }
    );

  }


  return jsonResponse(
    {
      ok:
        true,

      favorite:
        true,

      added,

      mediaId:
        normalizedMediaId
    },

    added
      ? 201
      : 200
  );

}


async function removeFavorite(
  request,
  env,
  auth,
  mediaId
) {

  assertActiveUser(
    auth
  );


  requireSameOrigin(
    request
  );


  const normalizedMediaId =
    normalizeMediaId(
      mediaId
    );


  const result =
    await env.MEDIA_DB
      .prepare(`
        DELETE FROM
          media_favorites

        WHERE
          user_id = ?

        AND
          media_id = ?
      `)
      .bind(
        auth.user.id,
        normalizedMediaId
      )
      .run();


  const removed =
    Number(
      result
        ?.meta
        ?.changes ||
      0
    ) ===
    1;


  if (
    removed
  ) {

    await addMediaEvent(
      env,
      {
        mediaId:
          normalizedMediaId,

        actorUserId:
          auth.user.id,

        action:
          "favorite.removed"
      }
    );

  }


  return jsonResponse({

    ok:
      true,

    favorite:
      false,

    removed,

    mediaId:
      normalizedMediaId

  });

}


export async function handleProfileRequest(
  request,
  env,
  auth
) {

  const url =
    new URL(
      request.url
    );


  const pathname =
    url.pathname;


  const method =
    request.method
      .toUpperCase();


  if (
    pathname ===
      "/api/profile/overview"
  ) {

    if (
      method !==
      "GET"
    ) {

      return methodNotAllowed([
        "GET"
      ]);

    }


    const view =
      String(
        url.searchParams.get(
          "view"
        ) ||
        "summary"
      )
        .trim()
        .toLowerCase();


    if (
      view ===
      "summary"
    ) {

      return getOverview(
        request,
        env,
        auth
      );

    }


    if (
      view ===
      "uploads"
    ) {

      return listUploads(
        request,
        env,
        auth
      );

    }


    if (
      view ===
      "favorites"
    ) {

      return listFavorites(
        request,
        env,
        auth
      );

    }


    throw new HttpError(
      400,
      "invalid_profile_view"
    );

  }


  if (
    pathname ===
      "/api/favorites"
  ) {

    if (
      method !==
      "GET"
    ) {

      return methodNotAllowed([
        "GET"
      ]);

    }


    return listFavorites(
      request,
      env,
      auth
    );

  }


  const match =
    pathname.match(
      /^\/api\/favorites\/([^/]+)$/
    );


  if (
    match
  ) {

    const mediaId =
      decodeURIComponent(
        match[1]
      );


    if (
      method ===
      "POST"
    ) {

      return addFavorite(
        request,
        env,
        auth,
        mediaId
      );

    }


    if (
      method ===
      "DELETE"
    ) {

      return removeFavorite(
        request,
        env,
        auth,
        mediaId
      );

    }


    return methodNotAllowed([
      "POST",
      "DELETE"
    ]);

  }


  return notFound();

}
