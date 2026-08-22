import {
  HttpError,
  jsonResponse,
  requireSameOrigin,
  readJson,
  methodNotAllowed,
  notFound
} from "./http.mjs";

import {
  nowSeconds
} from "./crypto.mjs";

import {
  verifyGitHubOidc
} from "./github-oidc.mjs";


function changes(
  result
) {
  return Number(
    result?.meta?.changes ||
    0
  );
}


function stagingTtl(
  env
) {
  const value =
    Number(
      env.UPLOAD_STAGING_TTL_SECONDS ||
      21600
    );


  if (
    !Number.isFinite(
      value
    )
  ) {
    return 21600;
  }


  return Math.min(
    86400,
    Math.max(
      600,
      Math.trunc(
        value
      )
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

      WHERE id = ?

      LIMIT 1
    `)
    .bind(
      batchId
    )
    .first();
}


async function getItem(
  env,
  batchId,
  itemId
) {
  return env.AUTH_DB
    .prepare(`
      SELECT *

      FROM upload_batch_items

      WHERE
        id = ?

      AND
        batch_id = ?

      LIMIT 1
    `)
    .bind(
      itemId,
      batchId
    )
    .first();
}


async function getItems(
  env,
  batchId
) {
  const result =
    await env.AUTH_DB
      .prepare(`
        SELECT *

        FROM upload_batch_items

        WHERE batch_id = ?

        ORDER BY position ASC
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


function assertOwner(
  auth,
  batch
) {
  if (
    !batch ||

    batch.user_id !==
      auth?.user?.id
  ) {
    throw new HttpError(
      404,
      "upload_batch_not_found"
    );
  }
}


function assertPermission(
  auth,
  mediaType
) {
  const permission = {
    image:
      "uploadImage",

    audio:
      "uploadAudio",

    video:
      "uploadVideo"
  }[
    mediaType
  ];


  if (
    !permission ||

    auth?.user
      ?.permissions
      ?.[permission] !==
      true
  ) {
    throw new HttpError(
      403,
      "upload_permission_denied"
    );
  }
}


async function refreshBatchCounters(
  env,
  batchId
) {
  const batch =
    await getBatch(
      env,
      batchId
    );


  if (
    !batch
  ) {
    return null;
  }


  const items =
    await getItems(
      env,
      batchId
    );


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
        [
          "complete",
          "failed",
          "review",
          "cancelled"
        ].includes(
          item.status
        )
    ).length;


  let status =
    batch.status;


  if (
    batch.status !==
    "cancelled"
  ) {
    if (
      items.length > 0 &&
      completedCount ===
        items.length
    ) {
      status =
        "complete";

    } else if (
      items.length > 0 &&
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
      batch.status ===
        "queued" ||

      items.some(
        item =>
          item.status ===
          "queued"
      )
    ) {
      status =
        "queued";

    } else if (
      items.length > 0 &&
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
  }


  const terminalBatch =
    [
      "complete",
      "partial",
      "failed",
      "cancelled"
    ].includes(
      status
    );


  const now =
    nowSeconds();


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

      WHERE id = ?

      AND
        CASE status
          WHEN 'created' THEN 0
          WHEN 'staging' THEN 1
          WHEN 'ready' THEN 2
          WHEN 'queued' THEN 3
          WHEN 'processing' THEN 4
          WHEN 'complete' THEN 5
          WHEN 'partial' THEN 5
          WHEN 'failed' THEN 5
          WHEN 'cancelled' THEN 6
          ELSE 0
        END <= ?
    `)
    .bind(
      status,

      stagedCount,

      completedCount,

      failedCount,

      reviewCount,

      now,

      terminalBatch
        ? (
            batch.completed_at ||
            now
          )
        : null,

      batchId,

      batchStatusRank(
        status
      )
    )
    .run();


  return getBatch(
    env,
    batchId
  );
}


async function stageItem(
  request,
  env,
  auth,
  batchId,
  itemId,
  ctx
) {
  requireSameOrigin(
    request
  );


  const batch =
    await getBatch(
      env,
      batchId
    );


  assertOwner(
    auth,
    batch
  );


  const item =
    await getItem(
      env,
      batchId,
      itemId
    );


  if (
    !item
  ) {
    throw new HttpError(
      404,
      "upload_batch_item_not_found"
    );
  }


  if (
    [
      "staged",
      "queued",
      "processing",
      "complete"
    ].includes(
      item.status
    )
  ) {
    const currentBatch =
      await refreshBatchCounters(
        env,
        batchId
      );


    return jsonResponse({
      ok:
        true,

      alreadyStaged:
        true,

      batch: {
        id:
          currentBatch.id,

        status:
          currentBatch.status,

        stagedCount:
          Number(
            currentBatch.staged_count
          ),

        totalCount:
          Number(
            currentBatch.total_count
          ),

        handoff:
          [
            "queued",
            "processing",
            "complete",
            "partial"
          ].includes(
            currentBatch.status
          )
            ? "server_queued"
            : "already_staged"
      },

      item: {
        id:
          item.id,

        status:
          item.status
      }
    });
  }


  if (
    ![
      "created",
      "staging",
      "ready"
    ].includes(
      batch.status
    )
  ) {
    throw new HttpError(
      409,
      "upload_batch_not_stageable"
    );
  }


  if (
    item.status !==
    "created"
  ) {
    throw new HttpError(
      409,
      "upload_batch_item_not_ready"
    );
  }


  assertPermission(
    auth,
    item.media_type
  );


  const declaredLength =
    Number(
      request.headers.get(
        "Content-Length"
      )
    );


  if (
    Number.isFinite(
      declaredLength
    ) &&
    declaredLength >
      0 &&
    declaredLength !==
      Number(
        item.size_bytes
      )
  ) {
    throw new HttpError(
      400,
      "upload_size_mismatch"
    );
  }


  if (
    !request.body
  ) {
    throw new HttpError(
      400,
      "upload_body_required"
    );
  }


  await env.UPLOAD_STAGING.put(
    item.kv_key,
    request.body,
    {
      expirationTtl:
        stagingTtl(
          env
        ),

      metadata: {
        batchId,
        itemId,
        userId:
          batch.user_id,

        mediaType:
          item.media_type,

        sizeBytes:
          Number(
            item.size_bytes
          )
      }
    }
  );


  const now =
    nowSeconds();


  const result =
    await env.AUTH_DB
      .prepare(`
        UPDATE upload_batch_items

        SET
          status = 'staged',
          error_message = NULL,
          updated_at = ?

        WHERE
          id = ?

        AND
          batch_id = ?

        AND
          status = 'created'
      `)
      .bind(
        now,
        itemId,
        batchId
      )
      .run();


  if (
    changes(
      result
    ) !==
    1
  ) {
    await env.UPLOAD_STAGING
      .delete(
        item.kv_key
      );


    throw new HttpError(
      409,
      "upload_batch_item_changed"
    );
  }


  let updatedBatch =
    await refreshBatchCounters(
      env,
      batchId
    );


  const updatedItem =
    await getItem(
      env,
      batchId,
      itemId
    );


  let handoff =
    "waiting_for_files";


  if (
    updatedBatch.status ===
    "ready"
  ) {
    handoff =
      "server_queued";


    const takeover =
      queueReadyBatchWithRetry(
        env,
        batchId
      );


    if (
      typeof ctx?.waitUntil ===
      "function"
    ) {
      ctx.waitUntil(
        takeover.catch(
          error => {
            console.error(
              "Automatic batch handoff failed:",
              batchId,
              error
            );
          }
        )
      );
    }


    try {
      updatedBatch =
        await takeover;

    } catch (
      error
    ) {
      handoff =
        "retry_required";


      console.error(
        "Batch handoff will remain retryable:",
        batchId,
        error
      );


      updatedBatch =
        await getBatch(
          env,
          batchId
        );
    }
  }


  return jsonResponse({
    ok:
      true,

    batch: {
      id:
        updatedBatch.id,

      status:
        updatedBatch.status,

      stagedCount:
        Number(
          updatedBatch.staged_count
        ),

      totalCount:
        Number(
          updatedBatch.total_count
        ),

      handoff
    },

    item: {
      id:
        updatedItem.id,

      status:
        updatedItem.status
    }
  });
}


async function dispatchBatchWorkflow(
  env,
  batchId
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
      String(
        env.GITHUB_OWNER ||
        ""
      )
    );


  const repo =
    encodeURIComponent(
      String(
        env.GITHUB_REPO ||
        ""
      )
    );


  const workflow =
    encodeURIComponent(
      String(
        env.GITHUB_UPLOAD_WORKFLOW ||
        ""
      )
    );


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
            "2026-03-10",

          "User-Agent":
            "jingyan-media-app"
        },

        body:
          JSON.stringify({
            ref:
              env.GITHUB_UPLOAD_REF,

            inputs: {
              web_batch_id:
                batchId
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
          500
        );


    throw new Error(
      `GitHub batch workflow dispatch failed (${response.status}): ${text}`
    );
  }


  if (
    response.status ===
    204
  ) {
    return {
      runId:
        null,

      runUrl:
        null
    };
  }


  let data =
    null;


  try {
    data =
      await response.json();

  } catch {
    data =
      null;
  }


  const runId =
    Number(
      data?.workflow_run_id
    );


  return {
    runId:
      Number.isSafeInteger(
        runId
      )
        ? runId
        : null,

    runUrl:
      typeof data?.html_url ===
        "string"
        ? data.html_url
        : null
  };
}


async function queueReadyBatch(
  env,
  batchId
) {
  let batch =
    await getBatch(
      env,
      batchId
    );


  if (
    !batch
  ) {
    throw new HttpError(
      404,
      "upload_batch_not_found"
    );
  }


  batch =
    await refreshBatchCounters(
      env,
      batchId
    );


  if (
    [
      "queued",
      "processing",
      "complete",
      "partial",
      "failed",
      "cancelled"
    ].includes(
      batch.status
    )
  ) {
    return batch;
  }


  if (
    batch.status !==
    "ready"
  ) {
    throw new HttpError(
      409,
      "upload_batch_not_ready"
    );
  }


  const items =
    await getItems(
      env,
      batchId
    );


  if (
    items.length !==
      Number(
        batch.total_count
      ) ||

    !items.every(
      item =>
        item.status ===
        "staged"
    )
  ) {
    throw new HttpError(
      409,
      "upload_batch_items_not_ready"
    );
  }


  const now =
    nowSeconds();


  const reserved =
    await env.AUTH_DB
      .prepare(`
        UPDATE upload_batches

        SET
          status = 'queued',
          error_message = NULL,
          started_at = ?,
          updated_at = ?

        WHERE
          id = ?

        AND
          status = 'ready'

        AND
          github_run_id IS NULL
      `)
      .bind(
        now,
        now,
        batchId
      )
      .run();


  if (
    changes(
      reserved
    ) !==
    1
  ) {
    const current =
      await getBatch(
        env,
        batchId
      );


    if (
      current &&
      [
        "queued",
        "processing",
        "complete",
        "partial",
        "failed",
        "cancelled"
      ].includes(
        current.status
      )
    ) {
      return current;
    }


    throw new HttpError(
      409,
      "upload_batch_start_conflict"
    );
  }


  let dispatch;


  try {
    dispatch =
      await dispatchBatchWorkflow(
        env,
        batchId
      );

  } catch (
    error
  ) {
    const released =
      await env.AUTH_DB
      .prepare(`
        UPDATE upload_batches

        SET
          status = 'ready',
          error_message = ?,
          started_at = NULL,
          updated_at = ?

        WHERE
          id = ?

        AND
          status = 'queued'

        AND
          github_run_id IS NULL
      `)
      .bind(
        String(
          error?.message ||
          "github_batch_dispatch_failed"
        )
          .slice(
            0,
            500
          ),

        nowSeconds(),

        batchId
      )
      .run();


    if (
      changes(
        released
      ) !==
      1
    ) {
      const current =
        await getBatch(
          env,
          batchId
        );


      if (
        current &&
        [
          "queued",
          "processing",
          "complete",
          "partial",
          "failed",
          "cancelled"
        ].includes(
          current.status
        )
      ) {
        return current;
      }
    }


    throw new HttpError(
      502,
      "github_batch_dispatch_failed"
    );
  }


  const queuedAt =
    nowSeconds();


  await env.AUTH_DB.batch([

    env.AUTH_DB
      .prepare(`
        UPDATE upload_batches

        SET
          github_run_id = ?,
          github_run_url = ?,
          updated_at = ?

        WHERE id = ?
      `)
      .bind(
        dispatch.runId,
        dispatch.runUrl,
        queuedAt,
        batchId
      ),


    env.AUTH_DB
      .prepare(`
        UPDATE upload_batch_items

        SET
          status = 'queued',
          updated_at = ?

        WHERE
          batch_id = ?

        AND
          status = 'staged'
      `)
      .bind(
        queuedAt,
        batchId
      )

  ]);


  batch =
    await getBatch(
      env,
      batchId
    );


  return batch;
}


function batchStatusRank(
  status
) {
  return {
    created: 0,
    staging: 1,
    ready: 2,
    queued: 3,
    processing: 4,
    complete: 5,
    partial: 5,
    failed: 5,
    cancelled: 6
  }[
    status
  ] ?? 0;
}


async function queueReadyBatchWithRetry(
  env,
  batchId,
  attempts = 2
) {
  let lastError =
    null;


  for (
    let attempt = 0;
    attempt < attempts;
    attempt += 1
  ) {
    try {
      return await queueReadyBatch(
        env,
        batchId
      );

    } catch (
      error
    ) {
      lastError =
        error;


      if (
        error?.code !==
          "github_batch_dispatch_failed" ||
        attempt ===
          attempts - 1
      ) {
        throw error;
      }
    }
  }


  throw lastError;
}


async function startBatch(
  request,
  env,
  auth,
  batchId
) {
  requireSameOrigin(
    request
  );


  const existing =
    await getBatch(
      env,
      batchId
    );


  assertOwner(
    auth,
    existing
  );


  const batch =
    await queueReadyBatchWithRetry(
      env,
      batchId
    );


  return jsonResponse({
    ok:
      true,

    batch: {
      id:
        batch.id,

      status:
        batch.status,

      githubRunId:
        auth?.user?.role ===
          "owner" &&
        batch.github_run_id !==
          null
          ? Number(
              batch.github_run_id
            )
          : null,

      githubRunUrl:
        auth?.user?.role ===
          "owner"
          ? batch.github_run_url
          : null
    }
  });
}


async function claimGithubRun(
  env,
  batch,
  claims
) {
  const incoming =
    Number(
      claims.runId
    );


  if (
    !Number.isSafeInteger(
      incoming
    ) ||
    incoming <=
      0
  ) {
    throw new HttpError(
      403,
      "github_run_invalid"
    );
  }


  if (
    batch.github_run_id !==
    null
  ) {
    if (
      Number(
        batch.github_run_id
      ) !==
      incoming
    ) {
      throw new HttpError(
        403,
        "github_run_mismatch"
      );
    }


    return batch;
  }


  await env.AUTH_DB
    .prepare(`
      UPDATE upload_batches

      SET
        github_run_id = ?,
        updated_at = ?

      WHERE
        id = ?

      AND
        github_run_id IS NULL
    `)
    .bind(
      incoming,
      nowSeconds(),
      batch.id
    )
    .run();


  const updated =
    await getBatch(
      env,
      batch.id
    );


  if (
    Number(
      updated?.github_run_id
    ) !==
    incoming
  ) {
    throw new HttpError(
      403,
      "github_run_mismatch"
    );
  }


  return updated;
}


async function internalManifest(
  request,
  env,
  batchId
) {
  const claims =
    await verifyGitHubOidc(
      request,
      env
    );


  let batch =
    await getBatch(
      env,
      batchId
    );


  if (
    !batch
  ) {
    throw new HttpError(
      404,
      "upload_batch_not_found"
    );
  }


  batch =
    await claimGithubRun(
      env,
      batch,
      claims
    );


  if (
    ![
      "queued",
      "processing"
    ].includes(
      batch.status
    )
  ) {
    throw new HttpError(
      409,
      "upload_batch_not_processable"
    );
  }


  const items =
    await getItems(
      env,
      batchId
    );


  const now =
    nowSeconds();


  await env.AUTH_DB
    .prepare(`
      UPDATE upload_batches

      SET
        status = 'processing',
        updated_at = ?

      WHERE
        id = ?

      AND
        status = 'queued'
    `)
    .bind(
      now,
      batchId
    )
    .run();


  return jsonResponse({
    batch: {
      id:
        batchId,

      totalCount:
        items.length,

      items:
        items.map(
          item => ({
            id:
              item.id,

            position:
              Number(
                item.position
              ),

            originalName:
              item.original_name,

            mediaType:
              item.media_type,

            sizeBytes:
              Number(
                item.size_bytes
              ),

            contentType:
              item.content_type,

            status:
              item.status
          })
        )
    }
  });
}


async function internalSource(
  request,
  env,
  batchId,
  itemId
) {
  const claims =
    await verifyGitHubOidc(
      request,
      env
    );


  let batch =
    await getBatch(
      env,
      batchId
    );


  if (
    !batch
  ) {
    throw new HttpError(
      404,
      "upload_batch_not_found"
    );
  }


  batch =
    await claimGithubRun(
      env,
      batch,
      claims
    );


  const item =
    await getItem(
      env,
      batchId,
      itemId
    );


  if (
    !item
  ) {
    throw new HttpError(
      404,
      "upload_batch_item_not_found"
    );
  }


  if (
    ![
      "queued",
      "processing"
    ].includes(
      item.status
    )
  ) {
    throw new HttpError(
      409,
      "upload_batch_item_not_downloadable"
    );
  }


  const stream =
    await env.UPLOAD_STAGING
      .get(
        item.kv_key,
        {
          type:
            "stream",

          cacheTtl:
            30
        }
      );


  if (
    !stream
  ) {
    throw new HttpError(
      404,
      "staging_not_ready"
    );
  }


  const now =
    nowSeconds();


  await env.AUTH_DB.batch([

    env.AUTH_DB
      .prepare(`
        UPDATE upload_batch_items

        SET
          status = 'processing',
          updated_at = ?

        WHERE
          id = ?

        AND
          batch_id = ?

        AND
          status = 'queued'
      `)
      .bind(
        now,
        itemId,
        batchId
      ),


    env.AUTH_DB
      .prepare(`
        UPDATE upload_batches

        SET
          status = 'processing',
          updated_at = ?

        WHERE
          id = ?
      `)
      .bind(
        now,
        batchId
      )

  ]);


  return new Response(
    stream,
    {
      status:
        200,

      headers: {
        "Content-Type":
          "application/octet-stream",

        "Content-Length":
          String(
            item.size_bytes
          ),

        "Content-Disposition":
          "attachment",

        "X-Upload-Filename":
          encodeURIComponent(
            item.original_name
          ),

        "X-Upload-Batch-Id":
          batchId,

        "X-Upload-Batch-Item-Id":
          itemId,

        "Cache-Control":
          "no-store",

        "X-Content-Type-Options":
          "nosniff"
      }
    }
  );
}


function normalizePipelineResult(
  env,
  item,
  input
) {
  if (
    !input ||
    typeof input !==
      "object" ||
    Array.isArray(
      input
    )
  ) {
    throw new HttpError(
      400,
      "invalid_pipeline_result"
    );
  }


  const id =
    String(
      input.id ||
      ""
    ).trim();


  const filename =
    String(
      input.filename ||
      ""
    ).trim();


  const repository =
    String(
      input.repository ||
      ""
    ).trim();


  const sha256 =
    String(
      input.sha256 ||
      ""
    )
      .trim()
      .toLowerCase();


  const cdn =
    String(
      input.cdn ||
      ""
    ).trim();


  const type =
    String(
      input.type ||
      ""
    ).trim();


  if (
    !id ||
    !filename ||
    !repository ||

    !/^[a-f0-9]{64}$/.test(
      sha256
    ) ||

    type !==
      item.media_type
  ) {
    throw new HttpError(
      400,
      "invalid_pipeline_result"
    );
  }


  const baseUrl =
    String(
      env.MEDIA_CDN_BASE_URL ||
      ""
    )
      .replace(
        /\/+$/,
        ""
      );


  if (
    !baseUrl ||
    !cdn.startsWith(
      `${baseUrl}/`
    )
  ) {
    throw new HttpError(
      400,
      "invalid_cdn_url"
    );
  }


  return {
    id,
    filename,
    repository,
    sha256,
    cdn,
    type,

    recovered:
      Boolean(
        input.recovered
      ),

    duplicate:
      Boolean(
        input.duplicate
      )
  };
}


async function internalCallback(
  request,
  env,
  batchId
) {
  const claims =
    await verifyGitHubOidc(
      request,
      env
    );


  let batch =
    await getBatch(
      env,
      batchId
    );


  if (
    !batch
  ) {
    throw new HttpError(
      404,
      "upload_batch_not_found"
    );
  }


  batch =
    await claimGithubRun(
      env,
      batch,
      claims
    );


  const body =
    await readJson(
      request
    );


  const reports =
    Array.isArray(
      body.items
    )
      ? body.items
      : [];


  const reportMap =
    new Map(
      reports.map(
        report => [
          String(
            report?.itemId ||
            ""
          ),
          report
        ]
      )
    );


  const pipelineOk =
    body.pipelineOk ===
    true;


  const items =
    await getItems(
      env,
      batchId
    );


  const now =
    nowSeconds();


  const statements = [];

  const completedKvKeys = [];


  for (
    const item
    of items
  ) {
    if (
      [
        "complete",
        "cancelled"
      ].includes(
        item.status
      )
    ) {
      continue;
    }


    const report =
      reportMap.get(
        item.id
      );


    if (
      !report
    ) {
      statements.push(
        env.AUTH_DB
          .prepare(`
            UPDATE upload_batch_items

            SET
              status = 'review',
              error_message = ?,
              updated_at = ?,
              completed_at = ?

            WHERE
              id = ?

            AND
              batch_id = ?
          `)
          .bind(
            pipelineOk
              ? "batch_item_result_missing"
              : "pipeline_state_not_saved",

            now,
            now,
            item.id,
            batchId
          )
      );


      continue;
    }


    if (
      report.ok ===
        true &&
      pipelineOk
    ) {
      const result =
        normalizePipelineResult(
          env,
          item,
          report.result
        );


      statements.push(
        env.AUTH_DB
          .prepare(`
            UPDATE upload_batch_items

            SET
              status = 'complete',

              media_id = ?,
              final_filename = ?,
              source_repository = ?,
              sha256 = ?,
              cdn_url = ?,

              error_message = NULL,
              result_json = ?,

              updated_at = ?,
              completed_at = ?

            WHERE
              id = ?

            AND
              batch_id = ?
          `)
          .bind(
            result.id,
            result.filename,
            result.repository,
            result.sha256,
            result.cdn,

            JSON.stringify(
              result
            ),

            now,
            now,

            item.id,
            batchId
          )
      );


      completedKvKeys.push(
        item.kv_key
      );


      continue;
    }


    const error =
      report.ok ===
        true
        ? "pipeline_state_not_saved"
        : String(
            report.error ||
            (
              pipelineOk
                ? "batch_item_pipeline_failed"
                : "pipeline_state_not_saved"
            )
          )
            .slice(
              0,
              500
            );


    statements.push(
      env.AUTH_DB
        .prepare(`
          UPDATE upload_batch_items

          SET
            status = 'review',
            error_message = ?,
            updated_at = ?,
            completed_at = ?

          WHERE
            id = ?

          AND
            batch_id = ?
        `)
        .bind(
          error,
          now,
          now,
          item.id,
          batchId
        )
    );
  }


  if (
    statements.length >
    0
  ) {
    await env.AUTH_DB.batch(
      statements
    );
  }


  for (
    const kvKey
    of completedKvKeys
  ) {
    await env.UPLOAD_STAGING
      .delete(
        kvKey
      );
  }


  await refreshBatchCounters(
    env,
    batchId
  );


  if (
    !pipelineOk
  ) {
    await env.AUTH_DB
      .prepare(`
        UPDATE upload_batches

        SET
          error_message =
            'pipeline_state_not_saved',

          updated_at = ?

        WHERE id = ?
      `)
      .bind(
        nowSeconds(),
        batchId
      )
      .run();
  }


  const updated =
    await getBatch(
      env,
      batchId
    );


  const updatedItems =
    await getItems(
      env,
      batchId
    );


  return jsonResponse({
    ok:
      true,

    batch: {
      id:
        updated.id,

      status:
        updated.status,

      totalCount:
        Number(
          updated.total_count
        ),

      completedCount:
        Number(
          updated.completed_count
        ),

      failedCount:
        Number(
          updated.failed_count
        ),

      reviewCount:
        Number(
          updated.review_count
        ),

      items:
        updatedItems.map(
          item => ({
            id:
              item.id,

            status:
              item.status,

            mediaId:
              item.media_id,

            error:
              item.error_message
          })
        )
    }
  });
}


export function isUserUploadBatchStagePath(
  pathname
) {
  return Boolean(
    pathname.match(
      /^\/api\/upload-batches\/[^/]+\/items\/[^/]+\/content$/
    ) ||

    pathname.match(
      /^\/api\/upload-batches\/[^/]+\/start$/
    )
  );
}


export async function handleUserUploadBatchStageRequest(
  request,
  env,
  auth,
  ctx
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


  const contentMatch =
    pathname.match(
      /^\/api\/upload-batches\/([^/]+)\/items\/([^/]+)\/content$/
    );


  if (
    contentMatch
  ) {
    if (
      method !==
      "PUT"
    ) {
      return methodNotAllowed([
        "PUT"
      ]);
    }


    return stageItem(
      request,
      env,
      auth,

      decodeURIComponent(
        contentMatch[1]
      ),

      decodeURIComponent(
        contentMatch[2]
      ),

      ctx
    );
  }


  const startMatch =
    pathname.match(
      /^\/api\/upload-batches\/([^/]+)\/start$/
    );


  if (
    startMatch
  ) {
    if (
      method !==
      "POST"
    ) {
      return methodNotAllowed([
        "POST"
      ]);
    }


    return startBatch(
      request,
      env,
      auth,

      decodeURIComponent(
        startMatch[1]
      )
    );
  }


  return notFound();
}


export async function handleInternalUploadBatchRequest(
  request,
  env
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


  const manifestMatch =
    pathname.match(
      /^\/api\/internal\/upload-batches\/([^/]+)\/manifest$/
    );


  if (
    manifestMatch
  ) {
    if (
      method !==
      "GET"
    ) {
      return methodNotAllowed([
        "GET"
      ]);
    }


    return internalManifest(
      request,
      env,
      decodeURIComponent(
        manifestMatch[1]
      )
    );
  }


  const sourceMatch =
    pathname.match(
      /^\/api\/internal\/upload-batches\/([^/]+)\/items\/([^/]+)\/source$/
    );


  if (
    sourceMatch
  ) {
    if (
      method !==
      "GET"
    ) {
      return methodNotAllowed([
        "GET"
      ]);
    }


    return internalSource(
      request,
      env,

      decodeURIComponent(
        sourceMatch[1]
      ),

      decodeURIComponent(
        sourceMatch[2]
      )
    );
  }


  const callbackMatch =
    pathname.match(
      /^\/api\/internal\/upload-batches\/([^/]+)\/callback$/
    );


  if (
    callbackMatch
  ) {
    if (
      method !==
      "POST"
    ) {
      return methodNotAllowed([
        "POST"
      ]);
    }


    return internalCallback(
      request,
      env,
      decodeURIComponent(
        callbackMatch[1]
      )
    );
  }


  return notFound();
}
