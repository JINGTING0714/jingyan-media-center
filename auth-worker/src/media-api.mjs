import {
  HttpError,
  methodNotAllowed,
  jsonResponse
} from "./http.mjs";

import {
  getLibraryPage
} from "./media-db.mjs";


const ALLOWED_TYPES = new Set([
  "image",
  "audio",
  "video"
]);

const TRASH_RETENTION_SECONDS =
  7 * 24 * 60 * 60;


function requireOwner(auth) {
  if (
    !auth?.user ||
    auth.user.role !== "owner" ||
    auth.user.status !== "active" ||
    auth.user.permissions?.manageSystem !== true
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
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(
    max,
    Math.max(
      min,
      Math.trunc(number)
    )
  );
}


function nowSeconds() {
  return Math.floor(
    Date.now() / 1000
  );
}


function toIso(seconds) {
  const value = Number(seconds);

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return null;
  }

  return new Date(
    value * 1000
  ).toISOString();
}


async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(
      400,
      "invalid_json"
    );
  }
}


function validateMediaId(value) {
  const mediaId = String(
    value || ""
  ).trim();

  if (
    !mediaId ||
    mediaId.length > 80
  ) {
    throw new HttpError(
      400,
      "invalid_media_id"
    );
  }

  return mediaId;
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
      WHERE id = ?
      LIMIT 1
    `)
    .bind(mediaId)
    .first();
}


async function getUploaderMap(
  env,
  rows
) {
  const ids = [
    ...new Set(
      rows
        .map(
          row =>
            row.uploader_user_id
        )
        .filter(Boolean)
    )
  ];

  const map = new Map();

  if (!ids.length) {
    return map;
  }

  for (
    let index = 0;
    index < ids.length;
    index += 80
  ) {
    const group =
      ids.slice(
        index,
        index + 80
      );

    const placeholders =
      group
        .map(() => "?")
        .join(",");

    const result =
      await env.AUTH_DB
        .prepare(`
          SELECT
            id,
            display_name
          FROM users
          WHERE id IN (${placeholders})
        `)
        .bind(...group)
        .all();

    for (
      const user
      of (
        result.results || []
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


function serializeRow(
  row,
  uploaderMap = new Map()
) {
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
        row.size_bytes || 0
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

    uploader:
      row.uploader_user_id
        ? {
            id:
              row.uploader_user_id,

            displayName:
              uploaderMap.get(
                row.uploader_user_id
              ) || null
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


async function addMediaEvent(
  env,
  {
    mediaId,
    actorUserId,
    action,
    metadata = null
  }
) {
  const eventId =
    `mevt_${crypto.randomUUID()}`;

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
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .bind(
      eventId,
      mediaId,
      actorUserId || null,
      action,
      metadata
        ? JSON.stringify(metadata)
        : null,
      nowSeconds()
    )
    .run();
}


async function getManifestState(env) {
  const row =
    await env.MEDIA_DB
      .prepare(`
        SELECT value
        FROM sync_state
        WHERE key = 'manifest_state'
        LIMIT 1
      `)
      .first();

  if (!row?.value) {
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


async function listTrashedMedia(
  request,
  env
) {
  const url =
    new URL(
      request.url
    );

  const type =
    String(
      url.searchParams.get(
        "type"
      ) || "all"
    )
      .trim()
      .toLowerCase();

  if (
    type !== "all" &&
    !ALLOWED_TYPES.has(type)
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
      ) || ""
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
      12,
      120
    );

  const summaryRow =
    await env.MEDIA_DB
      .prepare(`
        SELECT
          COUNT(*) AS total,

          COALESCE(
            SUM(
              CASE
                WHEN type = 'image'
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS image,

          COALESCE(
            SUM(
              CASE
                WHEN type = 'audio'
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS audio,

          COALESCE(
            SUM(
              CASE
                WHEN type = 'video'
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS video

        FROM media

        WHERE status = 'trashed'
      `)
      .first();

  const where = [
    "status = 'trashed'"
  ];

  const bindings = [];

  if (
    type !== "all"
  ) {
    where.push(
      "type = ?"
    );

    bindings.push(
      type
    );
  }

  if (query) {
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
      index < 6;
      index += 1
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

  const countRow =
    await env.MEDIA_DB
      .prepare(`
        SELECT
          COUNT(*) AS count
        FROM media
        WHERE ${whereSql}
      `)
      .bind(
        ...bindings
      )
      .first();

  const filteredTotal =
    Number(
      countRow?.count || 0
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
      safePage - 1
    ) * pageSize;

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

        WHERE ${whereSql}

        ORDER BY
          trashed_at DESC,
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

  const rows =
    result.results || [];

  const uploaderMap =
    await getUploaderMap(
      env,
      rows
    );

  const manifest =
    await getManifestState(
      env
    );

  return {
    manifest: {
      version:
        manifest.version ?? null,

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

    summary: {
      total:
        Number(
          summaryRow?.total || 0
        ),

      image:
        Number(
          summaryRow?.image || 0
        ),

      audio:
        Number(
          summaryRow?.audio || 0
        ),

      video:
        Number(
          summaryRow?.video || 0
        )
    },

    query: {
      status:
        "trashed",

      type,

      q:
        query,

      page:
        safePage,

      pageSize,

      filteredTotal,

      totalPages
    },

    items:
      rows.map(
        row =>
          serializeRow(
            row,
            uploaderMap
          )
      )
  };
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

  const status =
    String(
      url.searchParams.get(
        "status"
      ) || "published"
    )
      .trim()
      .toLowerCase();

  if (
    status === "trashed"
  ) {
    return jsonResponse(
      await listTrashedMedia(
        request,
        env
      )
    );
  }

  if (
    status !== "published"
  ) {
    throw new HttpError(
      400,
      "invalid_media_status_filter"
    );
  }

  const type =
    String(
      url.searchParams.get(
        "type"
      ) || "all"
    )
      .trim()
      .toLowerCase();

  if (
    type !== "all" &&
    !ALLOWED_TYPES.has(type)
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
      ) || ""
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

  data.query = {
    ...data.query,
    status:
      "published"
  };

  return jsonResponse(
    data
  );
}


async function trashMedia(
  request,
  env,
  auth
) {
  requireOwner(
    auth
  );

  const body =
    await readJson(
      request
    );

  const mediaId =
    validateMediaId(
      body.mediaId
    );

  const row =
    await getMediaRow(
      env,
      mediaId
    );

  if (!row) {
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
        serializeRow(
          row
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

  await env.MEDIA_DB
    .prepare(`
      UPDATE media

      SET
        status = 'trashed',
        trashed_at = ?,
        trash_expires_at = ?,
        updated_at = ?

      WHERE id = ?
      AND status = 'published'
      AND is_protected = 0
    `)
    .bind(
      timestamp,
      expiresAt,
      timestamp,
      mediaId
    )
    .run();

  await addMediaEvent(
    env,
    {
      mediaId,
      actorUserId:
        auth.user.id,

      action:
        "media.trash",

      metadata: {
        retentionDays:
          7
      }
    }
  );

  const updated =
    await getMediaRow(
      env,
      mediaId
    );

  return jsonResponse({
    ok:
      true,

    item:
      serializeRow(
        updated
      )
  });
}


async function restoreMedia(
  request,
  env,
  auth
) {
  requireOwner(
    auth
  );

  const body =
    await readJson(
      request
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

  const row =
    await getMediaRow(
      env,
      mediaId
    );

  if (!row) {
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
        serializeRow(
          row
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

  await env.MEDIA_DB
    .prepare(`
      UPDATE media

      SET
        status = 'published',
        trashed_at = NULL,
        trash_expires_at = NULL,
        deleted_at = NULL,
        updated_at = ?

      WHERE id = ?
      AND status = 'trashed'
    `)
    .bind(
      timestamp,
      mediaId
    )
    .run();

  await addMediaEvent(
    env,
    {
      mediaId,
      actorUserId:
        auth.user.id,

      action:
        "media.restore"
    }
  );

  const updated =
    await getMediaRow(
      env,
      mediaId
    );

  return jsonResponse({
    ok:
      true,

    item:
      serializeRow(
        updated
      )
  });
}


export async function handleAdminMediaRequest(
  request,
  env,
  auth
) {
  const method =
    request.method
      .toUpperCase();

  if (
    method === "GET"
  ) {
    return listMedia(
      request,
      env,
      auth
    );
  }

  if (
    method === "DELETE"
  ) {
    return trashMedia(
      request,
      env,
      auth
    );
  }

  if (
    method === "POST"
  ) {
    return restoreMedia(
      request,
      env,
      auth
    );
  }

  return methodNotAllowed([
    "GET",
    "DELETE",
    "POST"
  ]);
}
