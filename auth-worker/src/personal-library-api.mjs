import {
  HttpError,
  jsonResponse,
  requireSameOrigin,
  methodNotAllowed
} from "./http.mjs";


const ALLOWED_TYPES =
  new Set([
    "image",
    "audio",
    "video"
  ]);


const ALLOWED_STATUS =
  new Set([
    "published",
    "trashed"
  ]);


const UNASSIGNED_LIBRARY_ID =
  "__unassigned__";


const TRASH_RETENTION_SECONDS =
  7 * 24 * 60 * 60;


/* =========================================================
 * Basic helpers
 * ======================================================= */


function nowSeconds() {
  return Math.floor(
    Date.now() /
    1000
  );
}


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


function isOwner(
  auth
) {
  return (
    auth?.user?.role ===
    "owner"
  );
}


function canDeleteMedia(
  auth
) {
  return Boolean(
    isOwner(
      auth
    ) ||
    auth?.user?.permissions
      ?.deleteMedia ===
      true
  );
}


function requireDeletePermission(
  auth
) {
  if (
    !canDeleteMedia(
      auth
    )
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


function splitIntoChunks(
  values,
  size = 80
) {
  const chunks = [];


  for (
    let index = 0;
    index <
      values.length;
    index +=
      size
  ) {
    chunks.push(
      values.slice(
        index,
        index +
          size
      )
    );
  }


  return chunks;
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


function parseStatus(
  url
) {
  const status =
    String(
      url.searchParams.get(
        "status"
      ) ||
      "published"
    )
      .trim()
      .toLowerCase();


  if (
    !ALLOWED_STATUS.has(
      status
    )
  ) {
    throw new HttpError(
      400,
      "invalid_media_status_filter"
    );
  }


  return status;
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


function validateMediaId(
  value
) {
  const mediaId =
    String(
      value ||
      ""
    )
      .trim();


  if (
    !mediaId ||
    mediaId.length >
      80
  ) {
    throw new HttpError(
      400,
      "invalid_media_id"
    );
  }


  return mediaId;
}


async function readJson(
  request
) {
  try {

    return await request.json();

  } catch {

    throw new HttpError(
      400,
      "invalid_json"
    );
  }
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


/* =========================================================
 * Ownership
 *
 * 普通成员：
 *   uploader_user_id = 当前用户
 *
 * Owner：
 *   1. uploader_user_id = Owner
 *   2. 历史迁移媒体：
 *      uploader_user_id IS NULL
 *      first_upload_job_id IS NULL
 *
 * 第二种用于接回账户系统建立前的历史媒体。
 *
 * 特别注意：
 * 永久删除用户后匿名化的现代媒体通常仍然保留
 * first_upload_job_id，因此不会被误认成 Owner 历史媒体。
 * ======================================================= */


function normalizeLibraryId(
  value,
  auth
) {
  const requested =
    String(
      value ||
      "self"
    )
      .trim();


  if (
    requested ===
      "self" ||
    requested ===
      auth.user.id
  ) {
    return auth.user.id;
  }


  if (
    !isOwner(
      auth
    )
  ) {
    throw new HttpError(
      403,
      "library_scope_denied"
    );
  }


  if (
    requested ===
      UNASSIGNED_LIBRARY_ID
  ) {
    return UNASSIGNED_LIBRARY_ID;
  }


  if (
    !requested ||
    requested.length >
      120 ||
    /[\u0000-\u001f\u007f]/.test(
      requested
    )
  ) {
    throw new HttpError(
      400,
      "invalid_library_owner"
    );
  }


  return requested;
}


function requestedLibraryId(
  url,
  auth
) {
  return normalizeLibraryId(
    url.searchParams.get(
      "owner"
    ),
    auth
  );
}


function mutationLibraryId(
  body,
  auth
) {
  return normalizeLibraryId(
    body?.libraryOwnerId,
    auth
  );
}


function ownershipScope(
  auth,
  libraryUserId =
    auth?.user?.id
) {
  if (
    isOwner(
      auth
    ) &&
    libraryUserId ===
      UNASSIGNED_LIBRARY_ID
  ) {
    return {
      sql: `
        uploader_user_id IS NULL

        AND

        first_upload_job_id IS NOT NULL
      `,

      bindings: []
    };
  }


  if (
    isOwner(
      auth
    ) &&
    libraryUserId ===
      auth.user.id
  ) {
    return {
      sql: `
        (
          uploader_user_id = ?

          OR

          (
            uploader_user_id IS NULL

            AND

            first_upload_job_id IS NULL
          )
        )
      `,

      bindings: [
        auth.user.id
      ]
    };
  }


  return {
    sql:
      "uploader_user_id = ?",

    bindings: [
      isOwner(
        auth
      )
        ? libraryUserId
        : auth.user.id
    ]
  };
}


function isLegacyOwnerMedia(
  row,
  auth
) {
  return Boolean(
    isOwner(
      auth
    ) &&
    !row.uploader_user_id &&
    !row.first_upload_job_id
  );
}


async function resolveLibrarySelection(
  env,
  auth,
  libraryUserId
) {
  if (
    libraryUserId ===
      auth.user.id
  ) {
    return {
      id:
        auth.user.id,

      userId:
        auth.user.id,

      displayName:
        auth.user.displayName ||
        auth.user.display_name ||
        "我的媒体",

      kind:
        "self",

      isSelf:
        true,

      status:
        auth.user.status ||
        "active"
    };
  }


  if (
    libraryUserId ===
      UNASSIGNED_LIBRARY_ID
  ) {
    return {
      id:
        UNASSIGNED_LIBRARY_ID,

      userId:
        null,

      displayName:
        "已移除用户",

      kind:
        "unassigned",

      isSelf:
        false,

      status:
        "removed"
    };
  }


  const user =
    await env.AUTH_DB
      .prepare(`
        SELECT
          id,
          display_name,
          status

        FROM users

        WHERE id = ?

        LIMIT 1
      `)
      .bind(
        libraryUserId
      )
      .first();


  return {
    id:
      libraryUserId,

    userId:
      libraryUserId,

    displayName:
      user?.display_name ||
      "已移除用户",

    kind:
      user
        ? "member"
        : "removed",

    isSelf:
      false,

    status:
      user?.status ||
      "removed"
  };
}


async function getLibraryDirectory(
  env,
  auth,
  status
) {
  if (
    !isOwner(
      auth
    )
  ) {
    return [];
  }


  const result =
    await env.MEDIA_DB
      .prepare(`
        SELECT

          CASE
            WHEN
              uploader_user_id IS NULL
              AND
              first_upload_job_id IS NULL

            THEN ?

            WHEN
              uploader_user_id IS NULL

            THEN ?

            ELSE
              uploader_user_id
          END AS library_user_id,

          COALESCE(
            SUM(
              CASE
                WHEN status = ?
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS total,

          COALESCE(
            SUM(
              CASE
                WHEN
                  status = ?
                  AND
                  type = 'image'
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS image,

          COALESCE(
            SUM(
              CASE
                WHEN
                  status = ?
                  AND
                  type = 'audio'
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS audio,

          COALESCE(
            SUM(
              CASE
                WHEN
                  status = ?
                  AND
                  type = 'video'
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS video

        FROM media

        WHERE status IN (
          'published',
          'trashed'
        )

        GROUP BY
          library_user_id
      `)
      .bind(
        auth.user.id,
        UNASSIGNED_LIBRARY_ID,
        status,
        status,
        status,
        status
      )
      .all();


  const rows =
    result.results ||
    [];


  const userIds =
    [
      ...new Set(
        rows
          .map(
            row =>
              row.library_user_id
          )
          .filter(
            value =>
              value &&
              value !==
                auth.user.id &&
              value !==
                UNASSIGNED_LIBRARY_ID
          )
      )
    ];


  const userMap =
    new Map();


  for (
    const group
    of splitIntoChunks(
      userIds
    )
  ) {
    if (
      group.length ===
        0
    ) {
      continue;
    }


    const placeholders =
      group
        .map(
          () =>
            "?"
        )
        .join(
          ","
        );


    const users =
      await env.AUTH_DB
        .prepare(`
          SELECT
            id,
            display_name,
            status

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
        users.results ||
        []
      )
    ) {
      userMap.set(
        user.id,
        user
      );
    }
  }


  const directory =
    rows.map(
      row => {
        const id =
          row.library_user_id;


        const self =
          id ===
          auth.user.id;


        const unassigned =
          id ===
          UNASSIGNED_LIBRARY_ID;


        const user =
          userMap.get(
            id
          );


        return {
          id,

          userId:
            unassigned
              ? null
              : id,

          displayName:
            self
              ? (
                  auth.user.displayName ||
                  auth.user.display_name ||
                  "Owner"
                )
              : (
                  unassigned
                    ? "已移除用户"
                    : (
                        user?.display_name ||
                        "已移除用户"
                      )
                ),

          label:
            self
              ? "我的媒体"
              : (
                  unassigned
                    ? "已移除用户"
                    : (
                        user?.display_name ||
                        "已移除用户"
                      )
                ),

          kind:
            self
              ? "self"
              : (
                  unassigned
                    ? "unassigned"
                    : (
                        user
                          ? "member"
                          : "removed"
                      )
                ),

          status:
            self
              ? auth.user.status
              : (
                  unassigned
                    ? "removed"
                    : (
                        user?.status ||
                        "removed"
                      )
                ),

          summary: {
            total:
              Number(
                row.total ||
                0
              ),

            image:
              Number(
                row.image ||
                0
              ),

            audio:
              Number(
                row.audio ||
                0
              ),

            video:
              Number(
                row.video ||
                0
              )
          }
        };
      }
    );


  if (
    !directory.some(
      item =>
        item.id ===
        auth.user.id
    )
  ) {
    directory.push({
      id:
        auth.user.id,

      userId:
        auth.user.id,

      displayName:
        auth.user.displayName ||
        auth.user.display_name ||
        "Owner",

      label:
        "我的媒体",

      kind:
        "self",

      status:
        auth.user.status,

      summary: {
        total:
          0,

        image:
          0,

        audio:
          0,

        video:
          0
      }
    });
  }


  return directory.sort(
    (
      left,
      right
    ) => {
      if (
        left.kind ===
          "self"
      ) {
        return -1;
      }


      if (
        right.kind ===
          "self"
      ) {
        return 1;
      }


      if (
        left.kind ===
          "unassigned"
      ) {
        return 1;
      }


      if (
        right.kind ===
          "unassigned"
      ) {
        return -1;
      }


      return left.displayName.localeCompare(
        right.displayName,
        "zh-CN"
      );
    }
  );
}


/* =========================================================
 * Manifest
 * ======================================================= */


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


/* =========================================================
 * Media
 * ======================================================= */


async function getOwnedMediaRow(
  env,
  auth,
  mediaId,
  libraryUserId =
    auth.user.id
) {
  const scope =
    ownershipScope(
      auth,
      libraryUserId
    );


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
        id = ?

      AND
        ${scope.sql}

      LIMIT 1
    `)
    .bind(
      mediaId,
      ...scope.bindings
    )
    .first();
}


function serializeMedia(
  row,
  auth,
  library = null
) {
  const legacyOwner =
    isLegacyOwnerMedia(
      row,
      auth
    );


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
      isOwner(
        auth
      )
        ? row.sha256
        : null,

    cloudflareHash:
      isOwner(
        auth
      )
        ? row.cloudflare_hash
        : null,

    cdnShard:
      isOwner(
        auth
      )
        ? row.cdn_shard
        : null,

    protected:
      Boolean(
        row.is_protected
      ),

    status:
      row.status,

    legacyOwnerMedia:
      legacyOwner,

    source:
      isOwner(
        auth
      )
        ? {

            repository:
              row.source_repository,

            branch:
              row.source_branch,

            path:
              row.source_path

          }
        : null,

    uploader: {

      id:
        row.uploader_user_id ||
        (
          legacyOwner
            ? auth.user.id
            : null
        ),

      displayName:
        legacyOwner
          ? (
              auth.user.displayName ||
              auth.user.display_name ||
              "Owner"
            )
          : (
              library &&
              (
                row.uploader_user_id ===
                  library.userId ||
                (
                  !row.uploader_user_id &&
                  library.id ===
                    UNASSIGNED_LIBRARY_ID
                )
              )
                ? (
                    library.displayName ||
                    null
                  )
                : (
                    row.uploader_user_id ===
                      auth.user.id
                      ? (
                          auth.user.displayName ||
                          auth.user.display_name ||
                          null
                        )
                      : null
                  )
            ),

      legacy:
        legacyOwner

    },

    addedAt:
      toIso(
        row.added_at
      ),

    publishedAt:
      toIso(
        row.published_at
      ),

    trashedAt:
      toIso(
        row.trashed_at
      ),

    trashExpiresAt:
      toIso(
        row.trash_expires_at
      )

  };
}


/* =========================================================
 * Audit
 * ======================================================= */


async function addMediaEvent(
  env,
  {
    mediaId,
    actorUserId,
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
        ?, ?, ?, ?, ?, ?
      )
    `)
    .bind(

      `mevt_${crypto.randomUUID()}`,

      mediaId,

      actorUserId ||
        null,

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


/* =========================================================
 * Summary
 * ======================================================= */


async function getSummary(
  env,
  auth,
  libraryUserId,
  status
) {
  const scope =
    ownershipScope(
      auth,
      libraryUserId
    );


  const row =
    await env.MEDIA_DB
      .prepare(`
        SELECT

          COUNT(*) AS total,

          COALESCE(
            SUM(
              CASE

                WHEN
                  type =
                    'image'

                THEN
                  1

                ELSE
                  0

              END
            ),
            0
          ) AS image,

          COALESCE(
            SUM(
              CASE

                WHEN
                  type =
                    'audio'

                THEN
                  1

                ELSE
                  0

              END
            ),
            0
          ) AS audio,

          COALESCE(
            SUM(
              CASE

                WHEN
                  type =
                    'video'

                THEN
                  1

                ELSE
                  0

              END
            ),
            0
          ) AS video

        FROM media

        WHERE
          ${scope.sql}

        AND
          status = ?
      `)
      .bind(
        ...scope.bindings,
        status
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


/* =========================================================
 * List personal library
 * ======================================================= */


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


  const libraryUserId =
    requestedLibraryId(
      url,
      auth
    );


  const library =
    await resolveLibrarySelection(
      env,
      auth,
      libraryUserId
    );


  const status =
    parseStatus(
      url
    );


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


  const scope =
    ownershipScope(
      auth,
      libraryUserId
    );


  const where = [
    scope.sql,
    "status = ?"
  ];


  const bindings = [
    ...scope.bindings,
    status
  ];


  if (
    type !==
      "all"
  ) {
    where.push(
      "type = ?"
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
              filename,
              ''
            )
          ),
          ?
        ) > 0

        OR

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
              display_title,
              ''
            )
          ),
          ?
        ) > 0

        OR

        instr(
          lower(
            COALESCE(
              id,
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
              source_path,
              ''
            )
          ),
          ?
        ) > 0
      )
    `);


    for (
      let index = 0;
      index <
        7;
      index +=
        1
    ) {
      bindings.push(
        query
      );
    }
  }


  const whereSql =
    where.join(
      "\nAND\n"
    );


  const [
    summary,
    countRow,
    manifest,
    libraries
  ] =
    await Promise.all([

      getSummary(
        env,
        auth,
        libraryUserId,
        status
      ),

      env.MEDIA_DB
        .prepare(`
          SELECT
            COUNT(*) AS count

          FROM media

          WHERE
            ${whereSql}
        `)
        .bind(
          ...bindings
        )
        .first(),

      getManifestState(
        env
      ),

      getLibraryDirectory(
        env,
        auth,
        status
      )

    ]);


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


  const orderExpression =
    status ===
      "trashed"

      ? "COALESCE(trashed_at, updated_at)"

      : "COALESCE(added_at, created_at)";


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
          ${whereSql}

        ORDER BY
          ${orderExpression} DESC,
          id DESC

        LIMIT ?
        OFFSET ?
      `)
      .bind(
        ...bindings,
        pageSize,
        offset
      )
      .all();


  const items =
    (
      result.results ||
      []
    )
      .map(
        row =>
          serializeMedia(
            row,
            auth,
            library
          )
      );


  return jsonResponse({

    scope:
      library.isSelf
        ? "personal"
        : "owner-selected",

    ownerUserId:
      library.userId,

    viewerUserId:
      auth.user.id,

    library,

    libraries,

    ownershipMode:
      !isOwner(
        auth
      )
        ? "personal-only"
        : (
            library.isSelf
              ? "owner-plus-legacy"
              : "owner-selected-library"
          ),

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

      status,

      type,

      q:
        query,

      page:
        safePage,

      pageSize,

      filteredTotal,

      totalPages

    },

    capabilities: {

      readMedia:
        true,

      copyCdn:
        true,

      preview:
        true,

      collections:
        true,

      viewTrash:
        true,

      deleteMedia:
        canDeleteMedia(
          auth
        ),

      restoreMedia:
        canDeleteMedia(
          auth
        ),

      permanentDelete:
        canDeleteMedia(
          auth
        ),

      editMedia:
        Boolean(
          isOwner(
            auth
          ) ||
          auth.user.permissions
            ?.editMedia ===
            true
        ),

      personalLibrary:
        true,

      legacyOwnerMedia:
        Boolean(
          isOwner(
            auth
          ) &&
          library.isSelf
        ),

      ownerLibraryDirectory:
        isOwner(
          auth
        )

    },

    items

  });
}


/* =========================================================
 * Trash
 * ======================================================= */


async function trashMedia(
  request,
  env,
  auth,
  body
) {
  requireSameOrigin(
    request
  );


  requireDeletePermission(
    auth
  );


  const mediaId =
    validateMediaId(
      body.mediaId
    );


  const libraryUserId =
    mutationLibraryId(
      body,
      auth
    );


  const library =
    await resolveLibrarySelection(
      env,
      auth,
      libraryUserId
    );


  const row =
    await getOwnedMediaRow(
      env,
      auth,
      mediaId,
      libraryUserId
    );


  if (
    !row
  ) {
    throw new HttpError(
      404,
      "media_not_found"
    );
  }


  if (
    Boolean(
      row.is_protected
    )
  ) {
    throw new HttpError(
      409,
      "media_protected"
    );
  }


  if (
    row.status ===
      "trashed"
  ) {
    return jsonResponse({

      ok:
        true,

      alreadyTrashed:
        true,

      item:
        serializeMedia(
          row,
          auth,
          library
        )

    });
  }


  if (
    row.status !==
      "published"
  ) {
    throw new HttpError(
      409,
      "media_not_published"
    );
  }


  const timestamp =
    nowSeconds();


  const expiresAt =
    timestamp +
    TRASH_RETENTION_SECONDS;


  /*
   * 已经通过 getOwnedMediaRow 完成权限确认。
   * 这里按 media id 更新，
   * 这样历史媒体 uploader_user_id = NULL 也能操作。
   */
  const result =
    await env.MEDIA_DB
      .prepare(`
        UPDATE media

        SET
          status =
            'trashed',

          trashed_at =
            ?,

          trash_expires_at =
            ?,

          updated_at =
            ?

        WHERE
          id = ?

        AND
          status =
            'published'

        AND
          is_protected =
            0
      `)
      .bind(
        timestamp,
        expiresAt,
        timestamp,
        mediaId
      )
      .run();


  if (
    Number(
      result?.meta?.changes ||
      0
    ) !==
      1
  ) {
    throw new HttpError(
      409,
      "media_trash_failed"
    );
  }


  await addMediaEvent(
    env,
    {

      mediaId,

      actorUserId:
        auth.user.id,

      action:
        "media.trash",

      metadata: {

        scope:
          library.isSelf
            ? "personal"
            : "owner-selected",

        libraryOwnerId:
          library.userId,

        legacyOwnerMedia:
          isLegacyOwnerMedia(
            row,
            auth
          ),

        retentionDays:
          7

      }

    }
  );


  const updated =
    await getOwnedMediaRow(
      env,
      auth,
      mediaId,
      libraryUserId
    );


  return jsonResponse({

    ok:
      true,

    item:
      serializeMedia(
        updated,
        auth,
        library
      )

  });
}


/* =========================================================
 * Restore
 * ======================================================= */


async function restoreMedia(
  request,
  env,
  auth,
  body
) {
  requireSameOrigin(
    request
  );


  requireDeletePermission(
    auth
  );


  if (
    body.action !==
      "restore"
  ) {
    throw new HttpError(
      400,
      "invalid_media_action"
    );
  }


  const mediaId =
    validateMediaId(
      body.mediaId
    );


  const libraryUserId =
    mutationLibraryId(
      body,
      auth
    );


  const library =
    await resolveLibrarySelection(
      env,
      auth,
      libraryUserId
    );


  const row =
    await getOwnedMediaRow(
      env,
      auth,
      mediaId,
      libraryUserId
    );


  if (
    !row
  ) {
    throw new HttpError(
      404,
      "media_not_found"
    );
  }


  if (
    row.status ===
      "published"
  ) {
    return jsonResponse({

      ok:
        true,

      alreadyRestored:
        true,

      item:
        serializeMedia(
          row,
          auth,
          library
        )

    });
  }


  if (
    row.status !==
      "trashed"
  ) {
    throw new HttpError(
      409,
      "media_not_trashed"
    );
  }


  const timestamp =
    nowSeconds();


  const result =
    await env.MEDIA_DB
      .prepare(`
        UPDATE media

        SET
          status =
            'published',

          trashed_at =
            NULL,

          trash_expires_at =
            NULL,

          deleted_at =
            NULL,

          updated_at =
            ?

        WHERE
          id = ?

        AND
          status =
            'trashed'
      `)
      .bind(
        timestamp,
        mediaId
      )
      .run();


  if (
    Number(
      result?.meta?.changes ||
      0
    ) !==
      1
  ) {
    throw new HttpError(
      409,
      "media_restore_failed"
    );
  }


  await addMediaEvent(
    env,
    {

      mediaId,

      actorUserId:
        auth.user.id,

      action:
        "media.restore",

      metadata: {

        scope:
          library.isSelf
            ? "personal"
            : "owner-selected",

        libraryOwnerId:
          library.userId,

        legacyOwnerMedia:
          isLegacyOwnerMedia(
            row,
            auth
          )

      }

    }
  );


  const updated =
    await getOwnedMediaRow(
      env,
      auth,
      mediaId,
      libraryUserId
    );


  return jsonResponse({

    ok:
      true,

    item:
      serializeMedia(
        updated,
        auth,
        library
      )

  });
}


/* =========================================================
 * GitHub permanent purge dispatch
 * ======================================================= */


async function dispatchMediaPurge(
  env,
  row
) {
  const token =
    String(
      env.GITHUB_UPLOAD_TOKEN ||
      ""
    );


  if (
    !token
  ) {
    throw new Error(
      "GITHUB_UPLOAD_TOKEN secret missing"
    );
  }


  const owner =
    encodeURIComponent(
      env.GITHUB_OWNER
    );


  const repo =
    encodeURIComponent(
      env.GITHUB_REPO
    );


  const workflow =
    encodeURIComponent(
      env.GITHUB_MEDIA_DELETE_WORKFLOW ||
      "media-delete.yml"
    );


  if (
    !row.source_repository ||
    !row.source_path ||
    !row.public_path
  ) {
    throw new HttpError(
      409,
      "media_source_missing"
    );
  }


  const response =
    await fetch(

      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`,

      {

        method:
          "POST",

        headers: {

          Accept:
            "application/vnd.github+json",

          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json",

          "X-GitHub-Api-Version":
            "2022-11-28",

          "User-Agent":
            "jingyan-media-app"

        },

        body:
          JSON.stringify({

            ref:
              env.GITHUB_UPLOAD_REF ||
              "main",

            inputs: {

              media_id:
                String(
                  row.id
                ),

              media_type:
                String(
                  row.type
                ),

              source_repository:
                String(
                  row.source_repository
                ),

              source_branch:
                String(
                  row.source_branch ||
                  "main"
                ),

              source_path:
                String(
                  row.source_path
                ),

              public_path:
                String(
                  row.public_path
                )

            }

          })

      }

    );


  if (
    !response.ok
  ) {
    const text =
      (
        await response.text()
      )
        .slice(
          0,
          600
        );


    throw new Error(
      `Media purge dispatch failed (${response.status}): ${text}`
    );
  }
}


/* =========================================================
 * Permanent delete
 * ======================================================= */


async function permanentDeleteMedia(
  request,
  env,
  auth,
  body
) {
  requireSameOrigin(
    request
  );


  requireDeletePermission(
    auth
  );


  const mediaId =
    validateMediaId(
      body.mediaId
    );


  const libraryUserId =
    mutationLibraryId(
      body,
      auth
    );


  const library =
    await resolveLibrarySelection(
      env,
      auth,
      libraryUserId
    );


  const row =
    await getOwnedMediaRow(
      env,
      auth,
      mediaId,
      libraryUserId
    );


  if (
    !row
  ) {
    throw new HttpError(
      404,
      "media_not_found"
    );
  }


  if (
    Boolean(
      row.is_protected
    )
  ) {
    throw new HttpError(
      409,
      "media_protected"
    );
  }


  if (
    row.status ===
      "deleted"
  ) {
    return jsonResponse({

      ok:
        true,

      alreadyDeleted:
        true

    });
  }


  if (
    row.status !==
      "published" &&
    row.status !==
      "trashed"
  ) {
    throw new HttpError(
      409,
      "media_not_deletable"
    );
  }


  const timestamp =
    nowSeconds();


  const previous = {

    status:
      row.status,

    trashedAt:
      row.trashed_at,

    trashExpiresAt:
      row.trash_expires_at,

    deletedAt:
      row.deleted_at

  };


  /*
   * 先在媒体索引里标记 deleted，
   * 避免用户重复触发永久删除。
   */
  const marked =
    await env.MEDIA_DB
      .prepare(`
        UPDATE media

        SET
          status =
            'deleted',

          deleted_at =
            ?,

          trashed_at =
            NULL,

          trash_expires_at =
            NULL,

          updated_at =
            ?

        WHERE
          id = ?
      `)
      .bind(
        timestamp,
        timestamp,
        mediaId
      )
      .run();


  if (
    Number(
      marked?.meta?.changes ||
      0
    ) !==
      1
  ) {
    throw new HttpError(
      409,
      "media_delete_failed"
    );
  }


  /*
   * 启动 GitHub + CDN 的真正删除。
   *
   * 如果连 Workflow 都无法启动，
   * 就把 MEDIA_DB 状态恢复，
   * 不留半删除状态。
   */
  try {

    await dispatchMediaPurge(
      env,
      row
    );

  } catch (
    error
  ) {

    await env.MEDIA_DB
      .prepare(`
        UPDATE media

        SET
          status =
            ?,

          trashed_at =
            ?,

          trash_expires_at =
            ?,

          deleted_at =
            ?,

          updated_at =
            ?

        WHERE
          id = ?
      `)
      .bind(
        previous.status,
        previous.trashedAt,
        previous.trashExpiresAt,
        previous.deletedAt,
        nowSeconds(),
        mediaId
      )
      .run();


    console.error(
      "Permanent media purge dispatch failed:",
      error
    );


    throw new HttpError(
      502,
      "media_purge_dispatch_failed"
    );
  }


  /*
   * 清理媒体和个人功能之间的关系。
   */
  await env.MEDIA_DB
    .batch([

      env.MEDIA_DB
        .prepare(`
          UPDATE collections

          SET
            cover_media_id =
              NULL

          WHERE
            cover_media_id = ?
        `)
        .bind(
          mediaId
        ),


      env.MEDIA_DB
        .prepare(`
          DELETE FROM
            collection_items

          WHERE
            media_id = ?
        `)
        .bind(
          mediaId
        ),


      env.MEDIA_DB
        .prepare(`
          DELETE FROM
            media_favorites

          WHERE
            media_id = ?
        `)
        .bind(
          mediaId
        ),


      env.MEDIA_DB
        .prepare(`
          DELETE FROM
            media_tags

          WHERE
            media_id = ?
        `)
        .bind(
          mediaId
        )

    ]);


  await addMediaEvent(
    env,
    {

      mediaId,

      actorUserId:
        auth.user.id,

      action:
        "media.delete_permanent",

      metadata: {

        scope:
          library.isSelf
            ? "personal"
            : "owner-selected",

        libraryOwnerId:
          library.userId,

        legacyOwnerMedia:
          isLegacyOwnerMedia(
            row,
            auth
          ),

        sourceRepository:
          row.source_repository,

        sourcePath:
          row.source_path,

        publicPath:
          row.public_path,

        purgeQueued:
          true

      }

    }
  );


  return jsonResponse({

    ok:
      true,

    mediaId,

    permanent:
      true,

    purgeQueued:
      true

  });
}


/* =========================================================
 * Router
 * ======================================================= */


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


  if (
    method ===
      "DELETE"
  ) {
    const body =
      await readJson(
        request
      );


    if (
      body.permanent ===
        true
    ) {
      return permanentDeleteMedia(
        request,
        env,
        auth,
        body
      );
    }


    return trashMedia(
      request,
      env,
      auth,
      body
    );
  }


  if (
    method ===
      "POST"
  ) {
    const body =
      await readJson(
        request
      );


    return restoreMedia(
      request,
      env,
      auth,
      body
    );
  }


  return methodNotAllowed([
    "GET",
    "DELETE",
    "POST"
  ]);
}
