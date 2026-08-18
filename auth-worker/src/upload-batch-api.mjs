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


const MIB =
  1024 *
  1024;


const MIN_BATCH_FILES =
  2;


const MAX_BATCH_FILES =
  20;


const ACTIVE_BATCH_STATUSES =
  new Set([
    "created",
    "staging",
    "ready",
    "queued",
    "processing"
  ]);


const TERMINAL_ITEM_STATUSES =
  new Set([
    "complete",
    "failed",
    "review",
    "cancelled"
  ]);


const MEDIA_RULES =
  Object.freeze({

    image: {
      extensions: [
        "jpg",
        "jpeg",
        "png",
        "webp",
        "gif"
      ],

      permission:
        "uploadImage",

      maxBytes:
        15 *
        MIB
    },


    audio: {
      extensions: [
        "mp3",
        "wav",
        "flac",
        "aac"
      ],

      permission:
        "uploadAudio",

      maxBytes:
        24 *
        MIB
    },


    video: {
      extensions: [
        "mp4",
        "webm"
      ],

      permission:
        "uploadVideo",

      maxBytes:
        24 *
        MIB
    }

  });


const EXTENSION_TO_TYPE =
  new Map();


for (
  const [
    type,
    rule
  ]
  of Object.entries(
    MEDIA_RULES
  )
) {

  for (
    const extension
    of rule.extensions
  ) {

    EXTENSION_TO_TYPE.set(
      extension,
      type
    );

  }

}


function getExtension(
  filename
) {

  const index =
    filename.lastIndexOf(
      "."
    );


  if (
    index <=
      0 ||

    index ===
      filename.length -
      1
  ) {

    return "";

  }


  return filename
    .slice(
      index +
      1
    )
    .toLowerCase();

}


function normalizeOriginalName(
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
      .trim();


  if (
    !value ||

    value.length >
      180 ||

    value ===
      ".gitkeep" ||

    /[\/\\\0\r\n]/.test(
      value
    )
  ) {

    throw new HttpError(
      400,
      "invalid_filename"
    );

  }


  const extension =
    getExtension(
      value
    );


  const type =
    EXTENSION_TO_TYPE.get(
      extension
    );


  if (
    !type
  ) {

    throw new HttpError(
      415,
      "unsupported_media_type"
    );

  }


  return {
    filename:
      value,

    extension,

    type,

    rule:
      MEDIA_RULES[
        type
      ]
  };

}


function normalizeContentType(
  input
) {

  const value =
    String(
      input ||
      ""
    )
      .trim()
      .slice(
        0,
        120
      );


  return (
    value ||
    "application/octet-stream"
  );

}


function assertUploadPermission(
  auth,
  type
) {

  const rule =
    MEDIA_RULES[
      type
    ];


  if (
    !rule ||

    auth?.user
      ?.permissions
      ?.[
        rule.permission
      ] !==
      true
  ) {

    throw new HttpError(
      403,
      "upload_permission_denied"
    );

  }

}


function parseResultJson(
  value
) {

  if (
    !value
  ) {

    return null;

  }


  try {

    return JSON.parse(
      value
    );

  } catch {

    return null;

  }

}


function publicItem(
  row
) {

  if (
    !row
  ) {

    return null;

  }


  return {

    id:
      row.id,

    batchId:
      row.batch_id,

    position:
      Number(
        row.position
      ),

    originalName:
      row.original_name,

    mediaType:
      row.media_type,

    sizeBytes:
      Number(
        row.size_bytes
      ),

    contentType:
      row.content_type,

    status:
      row.status,

    mediaId:
      row.media_id,

    filename:
      row.final_filename,

    repository:
      row.source_repository,

    sha256:
      row.sha256,

    cdnUrl:
      row.cdn_url,

    error:
      row.error_message,

    result:
      parseResultJson(
        row.result_json
      ),

    createdAt:
      Number(
        row.created_at
      ),

    updatedAt:
      Number(
        row.updated_at
      ),

    completedAt:
      row.completed_at ===
        null
        ? null
        : Number(
            row.completed_at
          )

  };

}


function publicBatch(
  row,
  items = []
) {

  if (
    !row
  ) {

    return null;

  }


  return {

    id:
      row.id,

    userId:
      row.user_id,

    status:
      row.status,

    totalCount:
      Number(
        row.total_count
      ),

    stagedCount:
      Number(
        row.staged_count
      ),

    completedCount:
      Number(
        row.completed_count
      ),

    failedCount:
      Number(
        row.failed_count
      ),

    reviewCount:
      Number(
        row.review_count
      ),

    totalBytes:
      Number(
        row.total_bytes
      ),

    githubRunId:
      row.github_run_id ===
        null
        ? null
        : Number(
            row.github_run_id
          ),

    githubRunUrl:
      row.github_run_url,

    error:
      row.error_message,

    createdAt:
      Number(
        row.created_at
      ),

    updatedAt:
      Number(
        row.updated_at
      ),

    startedAt:
      row.started_at ===
        null
        ? null
        : Number(
            row.started_at
          ),

    completedAt:
      row.completed_at ===
        null
        ? null
        : Number(
            row.completed_at
          ),

    items:
      items.map(
        publicItem
      )

  };

}


function canViewBatch(
  auth,
  batch
) {

  return Boolean(

    batch &&

    auth?.user &&

    (
      batch.user_id ===
        auth.user.id ||

      auth.user.role ===
        "owner"
    )

  );

}


async function getBatch(
  env,
  batchId
) {

  return env.AUTH_DB
    .prepare(`
      SELECT *

      FROM upload_batches

      WHERE
        id = ?

      LIMIT 1
    `)
    .bind(
      batchId
    )
    .first();

}


async function getBatchItems(
  env,
  batchId
) {

  const result =
    await env.AUTH_DB
      .prepare(`
        SELECT *

        FROM upload_batch_items

        WHERE
          batch_id = ?

        ORDER BY
          position ASC
      `)
      .bind(
        batchId
      )
      .all();


  return (
    result.results ||
    []
  );

}


function deriveBatchSummary(
  batch,
  items
) {

  const stagedCount =
    items.filter(
      item =>
        item.status !==
        "created"
    ).length;


  const completedCount =
    items.filter(
      item =>
        item.status ===
        "complete"
    ).length;


  const failedCount =
    items.filter(
      item =>
        item.status ===
        "failed"
    ).length;


  const reviewCount =
    items.filter(
      item =>
        item.status ===
        "review"
    ).length;


  const terminalCount =
    items.filter(
      item =>
        TERMINAL_ITEM_STATUSES.has(
          item.status
        )
    ).length;


  let status =
    batch.status;


  if (
    batch.status ===
    "cancelled"
  ) {

    return {
      status,
      stagedCount,
      completedCount,
      failedCount,
      reviewCount
    };

  }


  if (
    items.length >
      0 &&

    completedCount ===
      items.length
  ) {

    status =
      "complete";

  } else if (
    items.length >
      0 &&

    terminalCount ===
      items.length
  ) {

    status =
      completedCount >
        0
        ? "partial"
        : "failed";

  } else if (
    items.some(
      item =>
        item.status ===
        "processing"
    )
  ) {

    status =
      "processing";

  } else if (
    items.some(
      item =>
        item.status ===
        "queued"
    )
  ) {

    status =
      "queued";

  } else if (
    items.length >
      0 &&

    items.every(
      item =>
        item.status ===
        "staged"
    )
  ) {

    status =
      "ready";

  } else if (
    items.some(
      item =>
        item.status ===
        "staged"
    )
  ) {

    status =
      "staging";

  } else {

    status =
      "created";

  }


  return {
    status,
    stagedCount,
    completedCount,
    failedCount,
    reviewCount
  };

}


async function syncBatchSummary(
  env,
  batch,
  items
) {

  const summary =
    deriveBatchSummary(
      batch,
      items
    );


  const now =
    nowSeconds();


  let completedAt =
    batch.completed_at;


  if (
    [
      "complete",
      "partial",
      "failed",
      "cancelled"
    ].includes(
      summary.status
    )
  ) {

    completedAt =
      completedAt ||
      now;

  } else {

    completedAt =
      null;

  }


  await env.AUTH_DB
    .prepare(`
      UPDATE upload_batches

      SET
        status = ?,

        staged_count = ?,

        completed_count = ?,

        failed_count = ?,

        review_count = ?,

        updated_at = ?,

        completed_at = ?

      WHERE
        id = ?
    `)
    .bind(
      summary.status,

      summary.stagedCount,

      summary.completedCount,

      summary.failedCount,

      summary.reviewCount,

      now,

      completedAt,

      batch.id
    )
    .run();


  return getBatch(
    env,
    batch.id
  );

}


async function loadBatch(
  env,
  auth,
  batchId
) {

  let batch =
    await getBatch(
      env,
      batchId
    );


  if (
    !batch ||

    !canViewBatch(
      auth,
      batch
    )
  ) {

    throw new HttpError(
      404,
      "upload_batch_not_found"
    );

  }


  const items =
    await getBatchItems(
      env,
      batch.id
    );


  batch =
    await syncBatchSummary(
      env,
      batch,
      items
    );


  return {
    batch,
    items
  };

}


async function findActiveBatch(
  env,
  userId
) {

  return env.AUTH_DB
    .prepare(`
      SELECT *

      FROM upload_batches

      WHERE
        user_id = ?

      AND
        status IN (
          'created',
          'staging',
          'ready',
          'queued',
          'processing'
        )

      ORDER BY
        created_at DESC

      LIMIT 1
    `)
    .bind(
      userId
    )
    .first();

}


function normalizeBatchFiles(
  auth,
  input
) {

  if (
    !Array.isArray(
      input
    )
  ) {

    throw new HttpError(
      400,
      "upload_batch_files_required"
    );

  }


  if (
    input.length <
      MIN_BATCH_FILES ||

    input.length >
      MAX_BATCH_FILES
  ) {

    throw new HttpError(
      400,
      "upload_batch_file_count_invalid"
    );

  }


  let totalBytes =
    0;


  const files =
    input.map(
      (
        item,
        position
      ) => {

        if (
          !item ||

          typeof item !==
            "object" ||

          Array.isArray(
            item
          )
        ) {

          throw new HttpError(
            400,
            "invalid_upload_batch_file"
          );

        }


        const media =
          normalizeOriginalName(
            item.originalName
          );


        assertUploadPermission(
          auth,
          media.type
        );


        const sizeBytes =
          Number(
            item.sizeBytes
          );


        if (
          !Number.isSafeInteger(
            sizeBytes
          ) ||

          sizeBytes <=
            0 ||

          sizeBytes >
            media.rule.maxBytes
        ) {

          throw new HttpError(
            413,
            "media_too_large"
          );

        }


        totalBytes +=
          sizeBytes;


        return {
          position,

          originalName:
            media.filename,

          mediaType:
            media.type,

          sizeBytes,

          contentType:
            normalizeContentType(
              item.contentType
            )
        };

      }
    );


  return {
    files,
    totalBytes
  };

}


async function createBatch(
  request,
  env,
  auth
) {

  requireSameOrigin(
    request
  );


  const existing =
    await findActiveBatch(
      env,
      auth.user.id
    );


  if (
    existing
  ) {

    throw new HttpError(
      409,
      "upload_batch_active_exists"
    );

  }


  const body =
    await readJson(
      request
    );


  const normalized =
    normalizeBatchFiles(
      auth,
      body.files
    );


  const batchId =
    createId(
      "batch"
    );


  const now =
    nowSeconds();


  const statements = [];


  statements.push(

    env.AUTH_DB
      .prepare(`
        INSERT INTO upload_batches (

          id,
          user_id,
          created_by_session_id,
          status,
          total_count,
          staged_count,
          completed_count,
          failed_count,
          review_count,
          total_bytes,
          github_run_id,
          github_run_url,
          error_message,
          created_at,
          updated_at,
          started_at,
          completed_at

        )

        VALUES (

          ?,
          ?,
          ?,
          'created',
          ?,
          0,
          0,
          0,
          0,
          ?,
          NULL,
          NULL,
          NULL,
          ?,
          ?,
          NULL,
          NULL

        )
      `)
      .bind(
        batchId,

        auth.user.id,

        auth.session?.id ||
          null,

        normalized.files.length,

        normalized.totalBytes,

        now,

        now
      )

  );


  for (
    const file
    of normalized.files
  ) {

    const itemId =
      createId(
        "batch_item"
      );


    const kvKey =
      `upload-batch:${batchId}:${itemId}`;


    statements.push(

      env.AUTH_DB
        .prepare(`
          INSERT INTO upload_batch_items (

            id,
            batch_id,
            position,
            original_name,
            media_type,
            size_bytes,
            content_type,
            status,
            kv_key,
            media_id,
            final_filename,
            source_repository,
            sha256,
            cdn_url,
            error_message,
            result_json,
            created_at,
            updated_at,
            completed_at

          )

          VALUES (

            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            'created',
            ?,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            ?,
            ?,
            NULL

          )
        `)
        .bind(
          itemId,

          batchId,

          file.position,

          file.originalName,

          file.mediaType,

          file.sizeBytes,

          file.contentType,

          kvKey,

          now,

          now
        )

    );

  }


  await env.AUTH_DB.batch(
    statements
  );


  const loaded =
    await loadBatch(
      env,
      auth,
      batchId
    );


  return jsonResponse(
    {
      ok:
        true,

      batch:
        publicBatch(
          loaded.batch,
          loaded.items
        )
    },
    201
  );

}


async function getCurrentBatch(
  env,
  auth
) {

  const current =
    await findActiveBatch(
      env,
      auth.user.id
    );


  if (
    !current
  ) {

    return jsonResponse({
      batch:
        null
    });

  }


  const loaded =
    await loadBatch(
      env,
      auth,
      current.id
    );


  return jsonResponse({
    batch:
      publicBatch(
        loaded.batch,
        loaded.items
      )
  });

}


async function getBatchById(
  env,
  auth,
  batchId
) {

  const loaded =
    await loadBatch(
      env,
      auth,
      batchId
    );


  return jsonResponse({
    batch:
      publicBatch(
        loaded.batch,
        loaded.items
      )
  });

}


export async function handleUserUploadBatchRequest(
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
    "/api/upload-batches"
  ) {

    if (
      method ===
      "POST"
    ) {

      return createBatch(
        request,
        env,
        auth
      );

    }


    return methodNotAllowed([
      "POST"
    ]);

  }


  if (
    pathname ===
    "/api/upload-batches/current"
  ) {

    if (
      method !==
      "GET"
    ) {

      return methodNotAllowed([
        "GET"
      ]);

    }


    return getCurrentBatch(
      env,
      auth
    );

  }


  const batchMatch =
    pathname.match(
      /^\/api\/upload-batches\/([^/]+)$/
    );


  if (
    batchMatch
  ) {

    if (
      method !==
      "GET"
    ) {

      return methodNotAllowed([
        "GET"
      ]);

    }


    return getBatchById(

      env,

      auth,

      decodeURIComponent(
        batchMatch[1]
      )

    );

  }


  return notFound();

}
