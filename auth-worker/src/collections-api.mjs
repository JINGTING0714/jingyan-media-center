import {
  HttpError,
  jsonResponse,
  readJson,
  requireSameOrigin,
  methodNotAllowed,
  notFound
} from "./http.mjs";

import {
  createId,
  nowSeconds
} from "./crypto.mjs";


const COLLECTION_TYPES =
  new Set([
    "image",
    "audio",
    "video"
  ]);


const VISIBILITIES =
  new Set([
    "private",
    "members"
  ]);


const TYPE_LABELS =
  Object.freeze({

    image:
      "图库",

    audio:
      "歌单",

    video:
      "影集"

  });


const MAX_NAME_LENGTH =
  60;


const MAX_DESCRIPTION_LENGTH =
  500;


const MIN_SORT_ORDER =
  -1000000;


const MAX_SORT_ORDER =
  1000000;


function isOwner(
  auth
) {
  return Boolean(
    auth?.user &&
    auth.user.status ===
      "active" &&
    auth.user.role ===
      "owner"
  );
}


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


function changes(
  result
) {
  return Number(
    result?.meta?.changes ||
    0
  );
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


function characterLength(
  value
) {
  return Array
    .from(
      String(
        value ||
        ""
      )
    )
    .length;
}


function normalizeCollectionName(
  input
) {
  const value =
    String(
      input ||
      ""
    )
      .normalize(
        "NFC"
      )
      .replace(
        /\s+/gu,
        " "
      )
      .trim();


  if (
    !value
  ) {
    throw new HttpError(
      400,
      "collection_name_required"
    );
  }


  if (
    characterLength(
      value
    ) >
    MAX_NAME_LENGTH
  ) {
    throw new HttpError(
      400,
      "collection_name_too_long"
    );
  }


  /*
   * 名称允许：
   *
   * 中文
   * English
   * 数字
   * 空格
   * Emoji
   *
   * 但是拒绝 HTML 标签入口和控制字符。
   */
  if (
    /[<>\u0000-\u001F\u007F-\u009F]/u
      .test(
        value
      )
  ) {
    throw new HttpError(
      400,
      "collection_name_invalid"
    );
  }


  return value;
}


function normalizeDescription(
  input
) {
  if (
    input ===
      null ||
    input ===
      undefined
  ) {
    return null;
  }


  const value =
    String(
      input
    )
      .normalize(
        "NFC"
      )
      .replace(
        /\r\n?/gu,
        "\n"
      )
      .trim();


  if (
    !value
  ) {
    return null;
  }


  if (
    characterLength(
      value
    ) >
    MAX_DESCRIPTION_LENGTH
  ) {
    throw new HttpError(
      400,
      "collection_description_too_long"
    );
  }


  /*
   * 描述允许换行和 Tab，
   * 但拒绝 HTML 标签入口和其余控制字符。
   */
  if (
    /[<>\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u
      .test(
        value
      )
  ) {
    throw new HttpError(
      400,
      "collection_description_invalid"
    );
  }


  return value;
}


function normalizeType(
  input
) {
  const value =
    String(
      input ||
      ""
    )
      .trim()
      .toLowerCase();


  if (
    !COLLECTION_TYPES.has(
      value
    )
  ) {
    throw new HttpError(
      400,
      "invalid_collection_type"
    );
  }


  return value;
}


function normalizeVisibility(
  input,
  fallback =
    "members"
) {
  const value =
    String(
      input ||
      fallback
    )
      .trim()
      .toLowerCase();


  if (
    !VISIBILITIES.has(
      value
    )
  ) {
    throw new HttpError(
      400,
      "invalid_collection_visibility"
    );
  }


  return value;
}


function normalizeSortOrder(
  input,
  fallback =
    0
) {
  if (
    input ===
      undefined ||
    input ===
      null ||
    input ===
      ""
  ) {
    return fallback;
  }


  const value =
    Number(
      input
    );


  if (
    !Number.isSafeInteger(
      value
    ) ||
    value <
      MIN_SORT_ORDER ||
    value >
      MAX_SORT_ORDER
  ) {
    throw new HttpError(
      400,
      "invalid_sort_order"
    );
  }


  return value;
}


function normalizeBoolean(
  input,
  fallback =
    false
) {
  if (
    input ===
      undefined
  ) {
    return fallback;
  }


  if (
    input ===
      true ||
    input ===
      false
  ) {
    return input;
  }


  throw new HttpError(
    400,
    "invalid_boolean"
  );
}


function normalizeId(
  input,
  errorCode
) {
  const value =
    String(
      input ||
      ""
    )
      .trim();


  if (
    !value ||
    value.length >
      120 ||
    /[\0\r\n/\\]/u
      .test(
        value
      )
  ) {
    throw new HttpError(
      400,
      errorCode
    );
  }


  return value;
}


function normalizeCollectionId(
  input
) {
  return normalizeId(
    input,
    "invalid_collection_id"
  );
}


function normalizeMediaId(
  input
) {
  return normalizeId(
    input,
    "invalid_media_id"
  );
}


function normalizeUserId(
  input
) {
  return normalizeId(
    input,
    "invalid_user_id"
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


function hasOwn(
  object,
  key
) {
  return Object.prototype
    .hasOwnProperty
    .call(
      object,
      key
    );
}


function isUniqueError(
  error
) {
  return /unique|constraint/i
    .test(
      String(
        error?.message ||
        error ||
        ""
      )
    );
}


async function getUserRow(
  env,
  userId
) {
  return env.AUTH_DB
    .prepare(`
      SELECT
        id,
        display_name,
        role,
        status,
        created_at

      FROM users

      WHERE id = ?

      LIMIT 1
    `)
    .bind(
      userId
    )
    .first();
}


async function requireActiveTargetUser(
  env,
  userId
) {
  const user =
    await getUserRow(
      env,
      userId
    );


  if (
    !user ||
    user.status !==
      "active"
  ) {
    throw new HttpError(
      404,
      "collection_owner_not_found"
    );
  }


  return user;
}


async function getCollectionRow(
  env,
  collectionId
) {
  return env.MEDIA_DB
    .prepare(`
      SELECT
        c.id,
        c.owner_user_id,
        c.type,
        c.name,
        c.description,
        c.cover_media_id,
        c.visibility,
        c.sort_order,
        c.is_pinned,
        c.pinned_order,
        c.created_at,
        c.updated_at,

        (
          SELECT
            COUNT(*)

          FROM collection_items ci

          WHERE
            ci.collection_id =
              c.id
        ) AS item_count,

        cover.id AS cover_id,
        cover.type AS cover_type,
        cover.filename AS cover_filename,
        cover.original_name AS cover_original_name,
        cover.display_title AS cover_display_title,
        cover.cdn_url AS cover_cdn_url,
        cover.status AS cover_status

      FROM collections c

      LEFT JOIN media cover
        ON
          cover.id =
            c.cover_media_id

      WHERE
        c.id = ?

      LIMIT 1
    `)
    .bind(
      collectionId
    )
    .first();
}


async function getMediaRow(
  env,
  mediaId
) {
  return env.MEDIA_DB
    .prepare(`
      SELECT
        id,
        type,
        filename,
        original_name,
        display_title,
        public_path,
        cdn_url,
        sha256,
        size_bytes,
        uploader_user_id,
        status,
        is_protected,
        added_at,
        published_at,
        created_at,
        updated_at

      FROM media

      WHERE id = ?

      LIMIT 1
    `)
    .bind(
      mediaId
    )
    .first();
}


function canManageCollection(
  auth,
  collection
) {
  return Boolean(
    collection &&
    auth?.user &&
    (
      collection.owner_user_id ===
        auth.user.id ||
      isOwner(
        auth
      )
    )
  );
}


function canReadCollection(
  auth,
  collection
) {
  if (
    !collection ||
    !auth?.user ||
    auth.user.status !==
      "active"
  ) {
    return false;
  }


  if (
    canManageCollection(
      auth,
      collection
    )
  ) {
    return true;
  }


  return (
    collection.visibility ===
    "members"
  );
}


async function requireReadableCollection(
  env,
  auth,
  collectionId
) {
  const collection =
    await getCollectionRow(
      env,
      collectionId
    );


  if (
    !collection ||
    !canReadCollection(
      auth,
      collection
    )
  ) {
    throw new HttpError(
      404,
      "collection_not_found"
    );
  }


  return collection;
}


async function requireManageableCollection(
  env,
  auth,
  collectionId
) {
  const collection =
    await getCollectionRow(
      env,
      collectionId
    );


  if (
    !collection
  ) {
    throw new HttpError(
      404,
      "collection_not_found"
    );
  }


  if (
    !canManageCollection(
      auth,
      collection
    )
  ) {
    throw new HttpError(
      403,
      "collection_permission_denied"
    );
  }


  return collection;
}


function serializeOwner(
  user,
  fallbackId
) {
  return {
    id:
      user?.id ||
      fallbackId,

    displayName:
      user?.display_name ||
      null,

    role:
      user?.role ||
      null,

    status:
      user?.status ||
      null
  };
}


function serializeCover(
  row
) {
  if (
    !row?.cover_id
  ) {
    return null;
  }


  return {
    mediaId:
      row.cover_id,

    type:
      row.cover_type,

    filename:
      row.cover_filename,

    originalName:
      row.cover_original_name,

    displayTitle:
      row.cover_display_title,

    cdnUrl:
      row.cover_cdn_url,

    status:
      row.cover_status
  };
}


function serializeCollection(
  row,
  owner = null
) {
  return {
    id:
      row.id,

    owner:
      serializeOwner(
        owner,
        row.owner_user_id
      ),

    type:
      row.type,

    typeLabel:
      TYPE_LABELS[
        row.type
      ] ||
      "分组",

    name:
      row.name,

    description:
      row.description,

    visibility:
      row.visibility,

    sortOrder:
      Number(
        row.sort_order ||
        0
      ),

    pinned:
      Boolean(
        row.is_pinned
      ),

    pinnedOrder:
      Number(
        row.pinned_order ||
        0
      ),

    itemCount:
      Number(
        row.item_count ||
        0
      ),

    cover:
      serializeCover(
        row
      ),

    createdAt:
      toIso(
        row.created_at
      ),

    updatedAt:
      toIso(
        row.updated_at
      )
  };
}


function serializeMedia(
  row
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

    publicPath:
      row.public_path,

    cdnUrl:
      row.cdn_url,

    sha256:
      row.sha256,

    sizeBytes:
      Number(
        row.size_bytes ||
        0
      ),

    uploaderUserId:
      row.uploader_user_id,

    status:
      row.status,

    protected:
      Boolean(
        row.is_protected
      ),

    addedAt:
      toIso(
        row.added_at
      ),

    publishedAt:
      toIso(
        row.published_at
      )
  };
}


async function addMediaEvent(
  env,
  {
    mediaId = null,
    actorUserId = null,
    action,
    metadata = null
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
        ?,
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

      metadata
        ? JSON.stringify(
            metadata
          )
        : null,

      nowSeconds()
    )
    .run();
}


async function getOwnerMap(
  env,
  collectionRows
) {
  const ids =
    [
      ...new Set(
        collectionRows
          .map(
            row =>
              row.owner_user_id
          )
          .filter(
            Boolean
          )
      )
    ];


  const map =
    new Map();


  if (
    !ids.length
  ) {
    return map;
  }


  for (
    let index = 0;
    index <
      ids.length;
    index +=
      80
  ) {
    const group =
      ids.slice(
        index,
        index +
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
            display_name,
            role,
            status,
            created_at

          FROM users

          WHERE
            id IN (
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
        user
      );
    }
  }


  return map;
}


async function nextCollectionSortOrder(
  env,
  ownerUserId,
  type
) {
  const row =
    await env.MEDIA_DB
      .prepare(`
        SELECT
          COALESCE(
            MAX(sort_order),
            0
          ) AS maximum

        FROM collections

        WHERE
          owner_user_id = ?

        AND
          type = ?
      `)
      .bind(
        ownerUserId,
        type
      )
      .first();


  return Math.min(
    MAX_SORT_ORDER,
    Number(
      row?.maximum ||
      0
    ) +
      10
  );
}


async function nextItemSortOrder(
  env,
  collectionId
) {
  const row =
    await env.MEDIA_DB
      .prepare(`
        SELECT
          COALESCE(
            MAX(sort_order),
            0
          ) AS maximum

        FROM collection_items

        WHERE
          collection_id = ?
      `)
      .bind(
        collectionId
      )
      .first();


  return Math.min(
    MAX_SORT_ORDER,
    Number(
      row?.maximum ||
      0
    ) +
      10
  );
}


async function listCollections(
  request,
  env,
  auth
) {
  assertActiveUser(
    auth
  );


  const url =
    new URL(
      request.url
    );


  const rawType =
    String(
      url.searchParams.get(
        "type"
      ) ||
      "all"
    )
      .trim()
      .toLowerCase();


  if (
    rawType !==
      "all" &&
    !COLLECTION_TYPES.has(
      rawType
    )
  ) {
    throw new HttpError(
      400,
      "invalid_collection_type"
    );
  }


  const ownerUserIdParam =
    String(
      url.searchParams.get(
        "ownerUserId"
      ) ||
      ""
    )
      .trim();


  const scope =
    String(
      url.searchParams.get(
        "scope"
      ) ||
      ""
    )
      .trim()
      .toLowerCase();


  const query =
    String(
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
      24,
      1,
      100
    );


  const where =
    [];


  const bindings =
    [];


  if (
    scope ===
      "all"
  ) {
    if (
      !isOwner(
        auth
      )
    ) {
      throw new HttpError(
        403,
        "collection_permission_denied"
      );
    }

  } else {
    const targetOwnerId =
      ownerUserIdParam
        ? normalizeUserId(
            ownerUserIdParam
          )
        : auth.user.id;


    where.push(
      "c.owner_user_id = ?"
    );


    bindings.push(
      targetOwnerId
    );


    if (
      targetOwnerId !==
        auth.user.id &&
      !isOwner(
        auth
      )
    ) {
      where.push(
        "c.visibility = 'members'"
      );
    }
  }


  if (
    rawType !==
      "all"
  ) {
    where.push(
      "c.type = ?"
    );


    bindings.push(
      rawType
    );
  }


  if (
    query
  ) {
    where.push(`
      (
        instr(
          lower(
            c.name
          ),
          ?
        ) > 0

        OR

        instr(
          lower(
            COALESCE(
              c.description,
              ''
            )
          ),
          ?
        ) > 0
      )
    `);


    bindings.push(
      query,
      query
    );
  }


  const whereSql =
    where.length
      ? where.join(
          "\nAND\n"
        )
      : "1 = 1";


  const summaryRow =
    await env.MEDIA_DB
      .prepare(`
        SELECT
          COUNT(*) AS total,

          COALESCE(
            SUM(
              CASE
                WHEN c.type = 'image'
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS image,

          COALESCE(
            SUM(
              CASE
                WHEN c.type = 'audio'
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS audio,

          COALESCE(
            SUM(
              CASE
                WHEN c.type = 'video'
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS video

        FROM collections c

        WHERE
          ${whereSql}
      `)
      .bind(
        ...bindings
      )
      .first();


  const total =
    Number(
      summaryRow?.total ||
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
          c.id,
          c.owner_user_id,
          c.type,
          c.name,
          c.description,
          c.cover_media_id,
          c.visibility,
          c.sort_order,
          c.is_pinned,
          c.pinned_order,
          c.created_at,
          c.updated_at,

          (
            SELECT
              COUNT(*)

            FROM collection_items ci

            WHERE
              ci.collection_id =
                c.id
          ) AS item_count,

          cover.id AS cover_id,
          cover.type AS cover_type,
          cover.filename AS cover_filename,
          cover.original_name AS cover_original_name,
          cover.display_title AS cover_display_title,
          cover.cdn_url AS cover_cdn_url,
          cover.status AS cover_status

        FROM collections c

        LEFT JOIN media cover
          ON
            cover.id =
              c.cover_media_id

        WHERE
          ${whereSql}

        ORDER BY
          c.is_pinned DESC,
          c.pinned_order ASC,
          c.sort_order ASC,
          c.updated_at DESC,
          c.id ASC

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


  const ownerMap =
    await getOwnerMap(
      env,
      rows
    );


  return jsonResponse({
    summary: {
      total,

      image:
        Number(
          summaryRow?.image ||
          0
        ),

      audio:
        Number(
          summaryRow?.audio ||
          0
        ),

      video:
        Number(
          summaryRow?.video ||
          0
        )
    },

    query: {
      type:
        rawType,

      q:
        query,

      page:
        safePage,

      pageSize,

      totalPages,

      total
    },

    collections:
      rows.map(
        row =>
          serializeCollection(
            row,
            ownerMap.get(
              row.owner_user_id
            ) ||
              null
          )
      )
  });
}


async function getCollectionItems(
  env,
  auth,
  collection,
  {
    page,
    pageSize
  }
) {
  const manager =
    canManageCollection(
      auth,
      collection
    );


  const where =
    [
      "ci.collection_id = ?"
    ];


  const bindings =
    [
      collection.id
    ];


  /*
   * Collection 的主人和 Owner
   * 可以看见已经进入回收站的项目状态，
   * 方便后面恢复。
   *
   * 其他成员只读取 published。
   */
  if (
    !manager
  ) {
    where.push(
      "m.status = 'published'"
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

        FROM collection_items ci

        INNER JOIN media m
          ON
            m.id =
              ci.media_id

        WHERE
          ${whereSql}
      `)
      .bind(
        ...bindings
      )
      .first();


  const total =
    Number(
      countRow?.count ||
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
          ci.sort_order AS collection_sort_order,
          ci.added_by_user_id AS collection_added_by_user_id,
          ci.created_at AS collection_added_at,

          m.id,
          m.type,
          m.filename,
          m.original_name,
          m.display_title,
          m.public_path,
          m.cdn_url,
          m.sha256,
          m.size_bytes,
          m.uploader_user_id,
          m.status,
          m.is_protected,
          m.added_at,
          m.published_at,
          m.created_at,
          m.updated_at

        FROM collection_items ci

        INNER JOIN media m
          ON
            m.id =
              ci.media_id

        WHERE
          ${whereSql}

        ORDER BY
          ci.sort_order ASC,
          ci.created_at ASC,
          m.id ASC

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

    total,

    totalPages,

    items:
      (
        result.results ||
        []
      )
        .map(
          row => ({
            ...serializeMedia(
              row
            ),

            collection: {
              sortOrder:
                Number(
                  row.collection_sort_order ||
                  0
                ),

              addedByUserId:
                row.collection_added_by_user_id,

              addedAt:
                toIso(
                  row.collection_added_at
                )
            }
          })
        )
  };
}


async function getCollectionDetail(
  request,
  env,
  auth,
  collectionId
) {
  assertActiveUser(
    auth
  );


  const collection =
    await requireReadableCollection(
      env,
      auth,
      collectionId
    );


  const owner =
    await getUserRow(
      env,
      collection.owner_user_id
    );


  const url =
    new URL(
      request.url
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
      24,
      1,
      100
    );


  const items =
    await getCollectionItems(
      env,
      auth,
      collection,
      {
        page,
        pageSize
      }
    );


  return jsonResponse({
    collection:
      serializeCollection(
        collection,
        owner
      ),

    items
  });
}


async function createCollection(
  request,
  env,
  auth
) {
  assertActiveUser(
    auth
  );


  requireSameOrigin(
    request
  );


  const body =
    await readJson(
      request
    );


  const type =
    normalizeType(
      body.type
    );


  const name =
    normalizeCollectionName(
      body.name
    );


  const description =
    normalizeDescription(
      body.description
    );


  const visibility =
    normalizeVisibility(
      body.visibility,
      "members"
    );


  let ownerUserId =
    auth.user.id;


  if (
    body.ownerUserId !==
      undefined &&
    body.ownerUserId !==
      null &&
    String(
      body.ownerUserId
    ).trim()
  ) {
    ownerUserId =
      normalizeUserId(
        body.ownerUserId
      );


    if (
      ownerUserId !==
        auth.user.id &&
      !isOwner(
        auth
      )
    ) {
      throw new HttpError(
        403,
        "collection_permission_denied"
      );
    }
  }


  const owner =
    await requireActiveTargetUser(
      env,
      ownerUserId
    );


  const defaultSortOrder =
    await nextCollectionSortOrder(
      env,
      ownerUserId,
      type
    );


  const sortOrder =
    normalizeSortOrder(
      body.sortOrder,
      defaultSortOrder
    );


  const pinned =
    normalizeBoolean(
      body.pinned,
      false
    );


  const pinnedOrder =
    normalizeSortOrder(
      body.pinnedOrder,
      0
    );


  const collectionId =
    createId(
      "col"
    );


  const now =
    nowSeconds();


  try {
    await env.MEDIA_DB
      .prepare(`
        INSERT INTO collections (
          id,
          owner_user_id,
          type,
          name,
          description,
          cover_media_id,
          visibility,
          sort_order,
          is_pinned,
          pinned_order,
          created_at,
          updated_at
        )

        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          NULL,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?
        )
      `)
      .bind(
        collectionId,
        ownerUserId,
        type,
        name,
        description,
        visibility,
        sortOrder,
        pinned
          ? 1
          : 0,
        pinnedOrder,
        now,
        now
      )
      .run();

  } catch (
    error
  ) {
    if (
      isUniqueError(
        error
      )
    ) {
      throw new HttpError(
        409,
        "collection_name_exists"
      );
    }


    throw error;
  }


  await addMediaEvent(
    env,
    {
      actorUserId:
        auth.user.id,

      action:
        "collection.created",

      metadata: {
        collectionId,
        ownerUserId,
        type,
        name,
        visibility
      }
    }
  );


  const created =
    await getCollectionRow(
      env,
      collectionId
    );


  return jsonResponse(
    {
      ok:
        true,

      collection:
        serializeCollection(
          created,
          owner
        )
    },
    201
  );
}


async function validateCoverMedia(
  env,
  collection,
  mediaId
) {
  if (
    mediaId ===
      null
  ) {
    return null;
  }


  if (
    collection.type ===
      "audio"
  ) {
    throw new HttpError(
      400,
      "audio_collection_cover_not_supported"
    );
  }


  const media =
    await getMediaRow(
      env,
      mediaId
    );


  if (
    !media ||
    media.status !==
      "published"
  ) {
    throw new HttpError(
      404,
      "collection_cover_media_not_found"
    );
  }


  if (
    media.type !==
      collection.type
  ) {
    throw new HttpError(
      409,
      "collection_cover_type_mismatch"
    );
  }


  const relation =
    await env.MEDIA_DB
      .prepare(`
        SELECT
          1 AS present

        FROM collection_items

        WHERE
          collection_id = ?

        AND
          media_id = ?

        LIMIT 1
      `)
      .bind(
        collection.id,
        mediaId
      )
      .first();


  if (
    !relation
  ) {
    throw new HttpError(
      409,
      "collection_cover_must_be_item"
    );
  }


  return mediaId;
}


async function updateCollection(
  request,
  env,
  auth,
  collectionId
) {
  assertActiveUser(
    auth
  );


  requireSameOrigin(
    request
  );


  const collection =
    await requireManageableCollection(
      env,
      auth,
      collectionId
    );


  const body =
    await readJson(
      request
    );


  const fields =
    [];


  const bindings =
    [];


  const changedFields =
    [];


  if (
    hasOwn(
      body,
      "name"
    )
  ) {
    fields.push(
      "name = ?"
    );


    bindings.push(
      normalizeCollectionName(
        body.name
      )
    );


    changedFields.push(
      "name"
    );
  }


  if (
    hasOwn(
      body,
      "description"
    )
  ) {
    fields.push(
      "description = ?"
    );


    bindings.push(
      normalizeDescription(
        body.description
      )
    );


    changedFields.push(
      "description"
    );
  }


  if (
    hasOwn(
      body,
      "visibility"
    )
  ) {
    fields.push(
      "visibility = ?"
    );


    bindings.push(
      normalizeVisibility(
        body.visibility
      )
    );


    changedFields.push(
      "visibility"
    );
  }


  if (
    hasOwn(
      body,
      "sortOrder"
    )
  ) {
    fields.push(
      "sort_order = ?"
    );


    bindings.push(
      normalizeSortOrder(
        body.sortOrder
      )
    );


    changedFields.push(
      "sortOrder"
    );
  }


  if (
    hasOwn(
      body,
      "pinned"
    )
  ) {
    fields.push(
      "is_pinned = ?"
    );


    bindings.push(
      normalizeBoolean(
        body.pinned
      )
        ? 1
        : 0
    );


    changedFields.push(
      "pinned"
    );
  }


  if (
    hasOwn(
      body,
      "pinnedOrder"
    )
  ) {
    fields.push(
      "pinned_order = ?"
    );


    bindings.push(
      normalizeSortOrder(
        body.pinnedOrder
      )
    );


    changedFields.push(
      "pinnedOrder"
    );
  }


  if (
    hasOwn(
      body,
      "coverMediaId"
    )
  ) {
    let coverMediaId =
      null;


    if (
      body.coverMediaId !==
        null &&
      String(
        body.coverMediaId ||
        ""
      ).trim()
    ) {
      coverMediaId =
        normalizeMediaId(
          body.coverMediaId
        );
    }


    coverMediaId =
      await validateCoverMedia(
        env,
        collection,
        coverMediaId
      );


    fields.push(
      "cover_media_id = ?"
    );


    bindings.push(
      coverMediaId
    );


    changedFields.push(
      "coverMediaId"
    );
  }


  if (
    !fields.length
  ) {
    throw new HttpError(
      400,
      "collection_update_empty"
    );
  }


  const now =
    nowSeconds();


  fields.push(
    "updated_at = ?"
  );


  bindings.push(
    now,
    collection.id
  );


  try {
    await env.MEDIA_DB
      .prepare(`
        UPDATE collections

        SET
          ${fields.join(",\n")}

        WHERE
          id = ?
      `)
      .bind(
        ...bindings
      )
      .run();

  } catch (
    error
  ) {
    if (
      isUniqueError(
        error
      )
    ) {
      throw new HttpError(
        409,
        "collection_name_exists"
      );
    }


    throw error;
  }


  await addMediaEvent(
    env,
    {
      actorUserId:
        auth.user.id,

      action:
        "collection.updated",

      metadata: {
        collectionId:
          collection.id,

        ownerUserId:
          collection.owner_user_id,

        changedFields
      }
    }
  );


  const updated =
    await getCollectionRow(
      env,
      collection.id
    );


  const owner =
    await getUserRow(
      env,
      updated.owner_user_id
    );


  return jsonResponse({
    ok:
      true,

    collection:
      serializeCollection(
        updated,
        owner
      )
  });
}


async function deleteCollection(
  request,
  env,
  auth,
  collectionId
) {
  assertActiveUser(
    auth
  );


  requireSameOrigin(
    request
  );


  const collection =
    await requireManageableCollection(
      env,
      auth,
      collectionId
    );


  const itemCount =
    Number(
      collection.item_count ||
      0
    );


  const result =
    await env.MEDIA_DB
      .prepare(`
        DELETE FROM collections

        WHERE id = ?
      `)
      .bind(
        collection.id
      )
      .run();


  if (
    changes(
      result
    ) !==
      1
  ) {
    throw new HttpError(
      409,
      "collection_delete_conflict"
    );
  }


  await addMediaEvent(
    env,
    {
      actorUserId:
        auth.user.id,

      action:
        "collection.deleted",

      metadata: {
        collectionId:
          collection.id,

        ownerUserId:
          collection.owner_user_id,

        type:
          collection.type,

        name:
          collection.name,

        itemCount
      }
    }
  );


  return jsonResponse({
    ok:
      true,

    deleted: {
      collectionId:
        collection.id,

      itemRelationsRemoved:
        itemCount,

      mediaDeleted:
        false
    }
  });
}


async function addCollectionItem(
  request,
  env,
  auth,
  collectionId
) {
  assertActiveUser(
    auth
  );


  requireSameOrigin(
    request
  );


  const collection =
    await requireManageableCollection(
      env,
      auth,
      collectionId
    );


  const body =
    await readJson(
      request
    );


  const mediaId =
    normalizeMediaId(
      body.mediaId
    );


  const media =
    await getMediaRow(
      env,
      mediaId
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


  if (
    media.type !==
      collection.type
  ) {
    throw new HttpError(
      409,
      "collection_media_type_mismatch"
    );
  }


  const defaultSortOrder =
    await nextItemSortOrder(
      env,
      collection.id
    );


  const sortOrder =
    normalizeSortOrder(
      body.sortOrder,
      defaultSortOrder
    );


  const now =
    nowSeconds();


  const result =
    await env.MEDIA_DB
      .prepare(`
        INSERT OR IGNORE
        INTO collection_items (
          collection_id,
          media_id,
          added_by_user_id,
          sort_order,
          created_at,
          updated_at
        )

        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?
        )
      `)
      .bind(
        collection.id,
        media.id,
        auth.user.id,
        sortOrder,
        now,
        now
      )
      .run();


  const added =
    changes(
      result
    ) ===
      1;


  if (
    added
  ) {
    await env.MEDIA_DB
      .prepare(`
        UPDATE collections

        SET
          updated_at = ?

        WHERE id = ?
      `)
      .bind(
        now,
        collection.id
      )
      .run();


    await addMediaEvent(
      env,
      {
        mediaId:
          media.id,

        actorUserId:
          auth.user.id,

        action:
          "collection.item_added",

        metadata: {
          collectionId:
            collection.id,

          collectionName:
            collection.name,

          collectionType:
            collection.type,

          collectionOwnerUserId:
            collection.owner_user_id
        }
      }
    );
  }


  return jsonResponse(
    {
      ok:
        true,

      added,

      item: {
        collectionId:
          collection.id,

        media:
          serializeMedia(
            media
          ),

        sortOrder
      }
    },
    added
      ? 201
      : 200
  );
}


async function removeCollectionItem(
  request,
  env,
  auth,
  collectionId,
  mediaId
) {
  assertActiveUser(
    auth
  );


  requireSameOrigin(
    request
  );


  const collection =
    await requireManageableCollection(
      env,
      auth,
      collectionId
    );


  const normalizedMediaId =
    normalizeMediaId(
      mediaId
    );


  const now =
    nowSeconds();


  const result =
    await env.MEDIA_DB
      .prepare(`
        DELETE FROM collection_items

        WHERE
          collection_id = ?

        AND
          media_id = ?
      `)
      .bind(
        collection.id,
        normalizedMediaId
      )
      .run();


  const removed =
    changes(
      result
    ) ===
      1;


  if (
    removed
  ) {
    /*
     * 如果删掉的媒体正好是 Collection 封面，
     * 自动清除封面。
     */
    await env.MEDIA_DB
      .prepare(`
        UPDATE collections

        SET
          cover_media_id =
            CASE
              WHEN cover_media_id = ?
              THEN NULL
              ELSE cover_media_id
            END,

          updated_at = ?

        WHERE id = ?
      `)
      .bind(
        normalizedMediaId,
        now,
        collection.id
      )
      .run();


    await addMediaEvent(
      env,
      {
        mediaId:
          normalizedMediaId,

        actorUserId:
          auth.user.id,

        action:
          "collection.item_removed",

        metadata: {
          collectionId:
            collection.id,

          collectionName:
            collection.name,

          collectionType:
            collection.type,

          collectionOwnerUserId:
            collection.owner_user_id
        }
      }
    );
  }


  return jsonResponse({
    ok:
      true,

    removed,

    collectionId:
      collection.id,

    mediaId:
      normalizedMediaId,

    mediaDeleted:
      false
  });
}


async function updateCollectionItem(
  request,
  env,
  auth,
  collectionId,
  mediaId
) {
  assertActiveUser(
    auth
  );


  requireSameOrigin(
    request
  );


  const collection =
    await requireManageableCollection(
      env,
      auth,
      collectionId
    );


  const normalizedMediaId =
    normalizeMediaId(
      mediaId
    );


  const body =
    await readJson(
      request
    );


  if (
    !hasOwn(
      body,
      "sortOrder"
    )
  ) {
    throw new HttpError(
      400,
      "collection_item_update_empty"
    );
  }


  const sortOrder =
    normalizeSortOrder(
      body.sortOrder
    );


  const now =
    nowSeconds();


  const result =
    await env.MEDIA_DB
      .prepare(`
        UPDATE collection_items

        SET
          sort_order = ?,
          updated_at = ?

        WHERE
          collection_id = ?

        AND
          media_id = ?
      `)
      .bind(
        sortOrder,
        now,
        collection.id,
        normalizedMediaId
      )
      .run();


  if (
    changes(
      result
    ) !==
      1
  ) {
    throw new HttpError(
      404,
      "collection_item_not_found"
    );
  }


  await env.MEDIA_DB
    .prepare(`
      UPDATE collections

      SET
        updated_at = ?

      WHERE id = ?
    `)
    .bind(
      now,
      collection.id
    )
    .run();


  await addMediaEvent(
    env,
    {
      mediaId:
        normalizedMediaId,

      actorUserId:
        auth.user.id,

      action:
        "collection.item_reordered",

      metadata: {
        collectionId:
          collection.id,

        sortOrder
      }
    }
  );


  return jsonResponse({
    ok:
      true,

    item: {
      collectionId:
        collection.id,

      mediaId:
        normalizedMediaId,

      sortOrder
    }
  });
}


export async function handleCollectionRequest(
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


  /*
   * /api/collections
   */
  if (
    pathname ===
      "/api/collections"
  ) {
    if (
      method ===
        "GET"
    ) {
      return listCollections(
        request,
        env,
        auth
      );
    }


    if (
      method ===
        "POST"
    ) {
      return createCollection(
        request,
        env,
        auth
      );
    }


    return methodNotAllowed([
      "GET",
      "POST"
    ]);
  }


  /*
   * /api/collections/:id/items/:mediaId
   */
  const itemMatch =
    pathname.match(
      /^\/api\/collections\/([^/]+)\/items\/([^/]+)$/
    );


  if (
    itemMatch
  ) {
    const collectionId =
      normalizeCollectionId(
        decodeURIComponent(
          itemMatch[1]
        )
      );


    const mediaId =
      normalizeMediaId(
        decodeURIComponent(
          itemMatch[2]
        )
      );


    if (
      method ===
        "PATCH"
    ) {
      return updateCollectionItem(
        request,
        env,
        auth,
        collectionId,
        mediaId
      );
    }


    if (
      method ===
        "DELETE"
    ) {
      return removeCollectionItem(
        request,
        env,
        auth,
        collectionId,
        mediaId
      );
    }


    return methodNotAllowed([
      "PATCH",
      "DELETE"
    ]);
  }


  /*
   * /api/collections/:id/items
   */
  const itemsMatch =
    pathname.match(
      /^\/api\/collections\/([^/]+)\/items$/
    );


  if (
    itemsMatch
  ) {
    const collectionId =
      normalizeCollectionId(
        decodeURIComponent(
          itemsMatch[1]
        )
      );


    if (
      method ===
        "POST"
    ) {
      return addCollectionItem(
        request,
        env,
        auth,
        collectionId
      );
    }


    return methodNotAllowed([
      "POST"
    ]);
  }


  /*
   * /api/collections/:id
   */
  const collectionMatch =
    pathname.match(
      /^\/api\/collections\/([^/]+)$/
    );


  if (
    collectionMatch
  ) {
    const collectionId =
      normalizeCollectionId(
        decodeURIComponent(
          collectionMatch[1]
        )
      );


    if (
      method ===
        "GET"
    ) {
      return getCollectionDetail(
        request,
        env,
        auth,
        collectionId
      );
    }


    if (
      method ===
        "PATCH"
    ) {
      return updateCollection(
        request,
        env,
        auth,
        collectionId
      );
    }


    if (
      method ===
        "DELETE"
    ) {
      return deleteCollection(
        request,
        env,
        auth,
        collectionId
      );
    }


    return methodNotAllowed([
      "GET",
      "PATCH",
      "DELETE"
    ]);
  }


  return notFound();
}
