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

import {
  verifyGitHubOidc
} from "./github-oidc.mjs";


const MIB =
  1024 *
  1024;


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

    EXTENSION_TO_TYPE
      .set(
        extension,
        type
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


function getExtension(
  filename
) {

  const index =
    filename
      .lastIndexOf(
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
      index + 1
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
    EXTENSION_TO_TYPE
      .get(
        extension
      );


  if (!type) {

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


function parseResultJson(
  value
) {

  if (!value) {

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


function publicJob(
  row
) {

  if (!row) {

    return null;

  }


  return {

    id:
      row.id,

    userId:
      row.user_id,

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

    githubRunId:
      row.github_run_id ===
        null
        ? null
        : Number(
            row.github_run_id
          ),

    githubRunUrl:
      row.github_run_url,

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


async function getJob(
  env,
  jobId
) {

  return env.AUTH_DB
    .prepare(
      `
      SELECT *

      FROM upload_jobs

      WHERE
        id = ?

      LIMIT 1
      `
    )
    .bind(
      jobId
    )
    .first();

}


function canViewJob(
  auth,
  job
) {

  return (
    job.user_id ===
      auth.user.id ||

    auth.user.role ===
      "owner"
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
    !auth?.user?.permissions?.[
      rule.permission
    ]
  ) {

    throw new HttpError(
      403,
      "upload_permission_denied"
    );

  }

}


async function enforceUploadRateLimit(
  env,
  userId
) {

  if (
    !env.AUTH_RATE_LIMITER
      ?.limit
  ) {

    throw new Error(
      "AUTH_RATE_LIMITER binding missing"
    );

  }


  const result =
    await env
      .AUTH_RATE_LIMITER
      .limit({
        key:
          `upload:user:${userId}`
      });


  if (
    !result.success
  ) {

    throw new HttpError(
      429,
      "upload_rate_limited"
    );

  }

}


async function insertAudit(
  env,
  {
    userId,
    sessionId,
    action,
    targetId,
    metadata,
    createdAt
  }
) {

  await env.AUTH_DB
    .prepare(
      `
      INSERT INTO audit_logs (

        id,
        actor_user_id,
        actor_session_id,
        action,
        target_type,
        target_id,
        metadata_json,
        ip_hash,
        created_at

      )

      VALUES (

        ?,
        ?,
        ?,
        ?,
        'upload_job',
        ?,
        ?,
        NULL,
        ?

      )
      `
    )
    .bind(

      createId(
        "audit"
      ),

      userId ||
        null,

      sessionId ||
        null,

      action,

      targetId,

      metadata
        ? JSON.stringify(
            metadata
          )
        : null,

      createdAt

    )
    .run();

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


async function dispatchWorkflow(
  env,
  jobId
) {

  const token =
    String(
      env.GITHUB_UPLOAD_TOKEN ||
      ""
    );


  if (!token) {

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
      env.GITHUB_UPLOAD_WORKFLOW
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
              web_job_id:
                jobId
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
      `GitHub workflow dispatch failed (${response.status}): ${text}`
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


async function createUploadJob(
  request,
  env,
  auth
) {

  requireSameOrigin(
    request
  );


  await enforceUploadRateLimit(
    env,
    auth.user.id
  );


  const body =
    await readJson(
      request
    );


  const media =
    normalizeOriginalName(
      body.originalName
    );


  assertUploadPermission(
    auth,
    media.type
  );


  const sizeBytes =
    Number(
      body.sizeBytes
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


  const jobId =
    createId(
      "upload"
    );


  const kvKey =
    `upload:${jobId}`;


  const now =
    nowSeconds();


  await env.AUTH_DB
    .batch([

      env.AUTH_DB
        .prepare(
          `
          INSERT INTO upload_jobs (

            id,
            user_id,
            created_by_session_id,
            original_name,
            media_type,
            size_bytes,
            content_type,
            status,
            kv_key,
            github_run_id,
            github_run_url,
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
            NULL,
            NULL,
            ?,
            ?,
            NULL

          )
          `
        )
        .bind(

          jobId,

          auth.user.id,

          auth.session?.id ||
            null,

          media.filename,

          media.type,

          sizeBytes,

          normalizeContentType(
            body.contentType
          ),

          kvKey,

          now,

          now

        ),


      env.AUTH_DB
        .prepare(
          `
          INSERT INTO audit_logs (

            id,
            actor_user_id,
            actor_session_id,
            action,
            target_type,
            target_id,
            metadata_json,
            ip_hash,
            created_at

          )

          VALUES (

            ?,
            ?,
            ?,
            'upload.create',
            'upload_job',
            ?,
            ?,
            NULL,
            ?

          )
          `
        )
        .bind(

          createId(
            "audit"
          ),

          auth.user.id,

          auth.session?.id ||
            null,

          jobId,

          JSON.stringify({

            originalName:
              media.filename,

            mediaType:
              media.type,

            sizeBytes

          }),

          now

        )

    ]);


  const job =
    await getJob(
      env,
      jobId
    );


  return jsonResponse(
    {
      ok:
        true,

      job:
        publicJob(
          job
        )
    },
    201
  );

}


async function listUploadJobs(
  env,
  auth
) {

  const result =
    await env.AUTH_DB
      .prepare(
        `
        SELECT *

        FROM upload_jobs

        WHERE
          user_id = ?

        ORDER BY
          created_at DESC

        LIMIT 30
        `
      )
      .bind(
        auth.user.id
      )
      .all();


  return jsonResponse({

    jobs:
      (
        result.results ||
        []
      )
        .map(
          publicJob
        )

  });

}


async function getUploadJob(
  env,
  auth,
  jobId
) {

  const job =
    await getJob(
      env,
      jobId
    );


  if (
    !job ||
    !canViewJob(
      auth,
      job
    )
  ) {

    throw new HttpError(
      404,
      "upload_job_not_found"
    );

  }


  return jsonResponse({
    job:
      publicJob(
        job
      )
  });

}


async function stageUploadContent(
  request,
  env,
  auth,
  jobId
) {

  requireSameOrigin(
    request
  );


  const job =
    await getJob(
      env,
      jobId
    );


  if (
    !job ||
    job.user_id !==
      auth.user.id
  ) {

    throw new HttpError(
      404,
      "upload_job_not_found"
    );

  }


  if (
    job.status !==
      "created"
  ) {

    throw new HttpError(
      409,
      "upload_job_not_ready"
    );

  }


  assertUploadPermission(
    auth,
    job.media_type
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
        job.size_bytes
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


  await env.UPLOAD_STAGING
    .put(

      job.kv_key,

      request.body,

      {
        expirationTtl:
          stagingTtl(
            env
          ),

        metadata: {
          jobId:
            job.id,

          userId:
            job.user_id,

          mediaType:
            job.media_type,

          sizeBytes:
            Number(
              job.size_bytes
            )
        }
      }

    );


  const now =
    nowSeconds();


  const staged =
    await env.AUTH_DB
      .prepare(
        `
        UPDATE upload_jobs

        SET
          status =
            'staged',

          updated_at =
            ?,

          error_message =
            NULL

        WHERE
          id = ?

        AND
          status =
            'created'
        `
      )
      .bind(
        now,
        job.id
      )
      .run();


  if (
    changes(
      staged
    ) !==
    1
  ) {

    await env.UPLOAD_STAGING
      .delete(
        job.kv_key
      );


    throw new HttpError(
      409,
      "upload_job_changed"
    );

  }


  let dispatch;


  try {

    dispatch =
      await dispatchWorkflow(
        env,
        job.id
      );

  } catch (error) {

    await env.AUTH_DB
      .prepare(
        `
        UPDATE upload_jobs

        SET
          status =
            'failed',

          error_message =
            ?,

          updated_at =
            ?

        WHERE
          id = ?
        `
      )
      .bind(

        String(
          error?.message ||
          "github_dispatch_failed"
        )
          .slice(
            0,
            500
          ),

        nowSeconds(),

        job.id

      )
      .run();


    throw new HttpError(
      502,
      "github_dispatch_failed"
    );

  }


  const queuedAt =
    nowSeconds();


  await env.AUTH_DB
    .prepare(
      `
      UPDATE upload_jobs

      SET
        status =
          'queued',

        github_run_id =
          ?,

        github_run_url =
          ?,

        updated_at =
          ?

      WHERE
        id = ?
      `
    )
    .bind(

      dispatch.runId,

      dispatch.runUrl,

      queuedAt,

      job.id

    )
    .run();


  await insertAudit(

    env,

    {
      userId:
        auth.user.id,

      sessionId:
        auth.session?.id,

      action:
        "upload.queued",

      targetId:
        job.id,

      metadata: {
        githubRunId:
          dispatch.runId
      },

      createdAt:
        queuedAt
    }

  );


  const updated =
    await getJob(
      env,
      job.id
    );


  return jsonResponse({
    ok:
      true,

    job:
      publicJob(
        updated
      )
  });

}


async function claimGithubRun(
  env,
  job,
  claims
) {

  const incoming =
    claims.runId;


  if (
    job.github_run_id !==
      null
  ) {

    if (
      Number(
        job.github_run_id
      ) !==
        incoming
    ) {

      throw new HttpError(
        403,
        "github_run_mismatch"
      );

    }


    return job;

  }


  await env.AUTH_DB
    .prepare(
      `
      UPDATE upload_jobs

      SET
        github_run_id =
          ?,

        updated_at =
          ?

      WHERE
        id = ?

      AND
        github_run_id IS NULL
      `
    )
    .bind(

      incoming,

      nowSeconds(),

      job.id

    )
    .run();


  const updated =
    await getJob(
      env,
      job.id
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


async function internalSource(
  request,
  env,
  jobId
) {

  const claims =
    await verifyGitHubOidc(
      request,
      env
    );


  let job =
    await getJob(
      env,
      jobId
    );


  if (!job) {

    throw new HttpError(
      404,
      "upload_job_not_found"
    );

  }


  job =
    await claimGithubRun(
      env,
      job,
      claims
    );


  if (
    ![
      "queued",
      "processing"
    ].includes(
      job.status
    )
  ) {

    throw new HttpError(
      409,
      "upload_job_not_downloadable"
    );

  }


  const stream =
    await env.UPLOAD_STAGING
      .get(
        job.kv_key,
        {
          type:
            "stream",

          cacheTtl:
            30
        }
      );


  if (!stream) {

    throw new HttpError(
      404,
      "staging_not_ready"
    );

  }


  const now =
    nowSeconds();


  await env.AUTH_DB
    .prepare(
      `
      UPDATE upload_jobs

      SET
        status =
          'processing',

        updated_at =
          ?

      WHERE
        id = ?

      AND
        status =
          'queued'
      `
    )
    .bind(
      now,
      job.id
    )
    .run();


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
            job.size_bytes
          ),

        "Content-Disposition":
          "attachment",

        "X-Upload-Filename":
          encodeURIComponent(
            job.original_name
          ),

        "X-Upload-Job-Id":
          job.id,

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
  job,
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
    )
      .trim();


  const filename =
    String(
      input.filename ||
      ""
    )
      .trim();


  const repository =
    String(
      input.repository ||
      ""
    )
      .trim();


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
    )
      .trim();


  const type =
    String(
      input.type ||
      ""
    )
      .trim();


  if (
    !id ||
    !filename ||
    !repository ||

    !/^[a-f0-9]{64}$/.test(
      sha256
    ) ||

    type !==
      job.media_type
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
  jobId
) {

  const claims =
    await verifyGitHubOidc(
      request,
      env
    );


  let job =
    await getJob(
      env,
      jobId
    );


  if (!job) {

    throw new HttpError(
      404,
      "upload_job_not_found"
    );

  }


  job =
    await claimGithubRun(
      env,
      job,
      claims
    );


  const body =
    await readJson(
      request
    );


  if (
    job.status ===
      "complete"
  ) {

    return jsonResponse({
      ok:
        true,

      job:
        publicJob(
          job
        )
    });

  }


  const now =
    nowSeconds();


  if (
    body.ok ===
      true
  ) {

    const result =
      normalizePipelineResult(

        env,

        job,

        body.result

      );


    await env.AUTH_DB
      .prepare(
        `
        UPDATE upload_jobs

        SET
          status =
            'complete',

          media_id =
            ?,

          final_filename =
            ?,

          source_repository =
            ?,

          sha256 =
            ?,

          cdn_url =
            ?,

          error_message =
            NULL,

          result_json =
            ?,

          updated_at =
            ?,

          completed_at =
            ?

        WHERE
          id = ?
        `
      )
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

        job.id

      )
      .run();


    await env.UPLOAD_STAGING
      .delete(
        job.kv_key
      );


    await insertAudit(

      env,

      {
        userId:
          job.user_id,

        sessionId:
          null,

        action:
          "upload.complete",

        targetId:
          job.id,

        metadata: {
          mediaId:
            result.id,

          cdn:
            result.cdn
        },

        createdAt:
          now
      }

    );

  } else {

    const message =
      String(
        body.error ||
        "pipeline_failed"
      )
        .slice(
          0,
          500
        );


    await env.AUTH_DB
      .prepare(
        `
        UPDATE upload_jobs

        SET
          status =
            'failed',

          error_message =
            ?,

          updated_at =
            ?,

          completed_at =
            ?

        WHERE
          id = ?

        AND
          status !=
            'complete'
        `
      )
      .bind(

        message,

        now,

        now,

        job.id

      )
      .run();


    await insertAudit(

      env,

      {
        userId:
          job.user_id,

        sessionId:
          null,

        action:
          "upload.failed",

        targetId:
          job.id,

        metadata: {
          error:
            message
        },

        createdAt:
          now
      }

    );

  }


  const updated =
    await getJob(
      env,
      job.id
    );


  return jsonResponse({
    ok:
      true,

    job:
      publicJob(
        updated
      )
  });

}


export async function handleUserUploadRequest(
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
      "/api/uploads"
  ) {

    if (
      method ===
        "GET"
    ) {

      return listUploadJobs(
        env,
        auth
      );

    }


    if (
      method ===
        "POST"
    ) {

      return createUploadJob(
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


  const contentMatch =
    pathname.match(
      /^\/api\/uploads\/([^/]+)\/content$/
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


    return stageUploadContent(

      request,

      env,

      auth,

      decodeURIComponent(
        contentMatch[1]
      )

    );

  }


  const jobMatch =
    pathname.match(
      /^\/api\/uploads\/([^/]+)$/
    );


  if (
    jobMatch
  ) {

    if (
      method !==
        "GET"
    ) {

      return methodNotAllowed([
        "GET"
      ]);

    }


    return getUploadJob(

      env,

      auth,

      decodeURIComponent(
        jobMatch[1]
      )

    );

  }


  return notFound();

}


export async function handleInternalUploadRequest(
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


  const sourceMatch =
    pathname.match(
      /^\/api\/internal\/uploads\/([^/]+)\/source$/
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
      )

    );

  }


  const callbackMatch =
    pathname.match(
      /^\/api\/internal\/uploads\/([^/]+)\/callback$/
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
