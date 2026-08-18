import {
  HttpError,
  jsonResponse,
  readJson,
  methodNotAllowed,
  notFound
} from "./http.mjs";

import {
  verifyGitHubOidc,
  verifyGitHubMediaSyncOidc
} from "./github-oidc.mjs";

import {
  normalizeManifestMeta,
  startFullSync,
  assertFullSync,
  upsertManifestAssets,
  finishFullSync,
  upsertUploadJobMedia
} from "./media-db.mjs";


async function handleUploadIndex(
  request,
  env
) {

  const claims =
    await verifyGitHubOidc(
      request,
      env
    );


  const body =
    await readJson(
      request
    );


  const jobId =
    String(
      body.jobId ||
      ""
    )
      .trim();


  if (!jobId) {

    throw new HttpError(
      400,
      "upload_job_id_required"
    );

  }


  const job =
    await env.AUTH_DB
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


  if (!job) {

    throw new HttpError(
      404,
      "upload_job_not_found"
    );

  }


  if (
    Number(
      job.github_run_id
    ) !==
      claims.runId
  ) {

    throw new HttpError(
      403,
      "github_run_mismatch"
    );

  }


  if (
    job.status !==
    "complete"
  ) {

    throw new HttpError(
      409,
      "upload_job_not_complete"
    );

  }


  const media =
    await upsertUploadJobMedia(
      env,
      job
    );


  return jsonResponse({
    ok:
      true,

    mediaId:
      media.id
  });

}


async function handleFullStart(
  request,
  env
) {

  const claims =
    await verifyGitHubMediaSyncOidc(
      request,
      env
    );


  const body =
    await readJson(
      request
    );


  const manifest =
    normalizeManifestMeta(
      env,
      body.manifest
    );


  const state =
    await startFullSync(
      env,
      claims,
      manifest
    );


  return jsonResponse({
    ok:
      true,

    syncId:
      state.id,

    expectedCount:
      state.expectedCount
  });

}


async function handleFullChunk(
  request,
  env
) {

  const claims =
    await verifyGitHubMediaSyncOidc(
      request,
      env
    );


  const body =
    await readJson(
      request
    );


  const syncId =
    String(
      body.syncId ||
      ""
    )
      .trim();


  if (!syncId) {

    throw new HttpError(
      400,
      "media_sync_id_required"
    );

  }


  const assets =
    Array.isArray(
      body.assets
    )

      ? body.assets

      : null;


  if (!assets) {

    throw new HttpError(
      400,
      "invalid_media_sync_assets"
    );

  }


  if (
    assets.length >
    160
  ) {

    throw new HttpError(
      413,
      "media_sync_chunk_too_large"
    );

  }


  const state =
    await assertFullSync(
      env,
      syncId,
      claims.runId
    );


  const written =
    await upsertManifestAssets(

      env,

      state.manifest,

      assets,

      syncId

    );


  return jsonResponse({
    ok:
      true,

    written
  });

}


async function handleFullFinalize(
  request,
  env
) {

  const claims =
    await verifyGitHubMediaSyncOidc(
      request,
      env
    );


  const body =
    await readJson(
      request
    );


  const syncId =
    String(
      body.syncId ||
      ""
    )
      .trim();


  if (!syncId) {

    throw new HttpError(
      400,
      "media_sync_id_required"
    );

  }


  const state =
    await assertFullSync(
      env,
      syncId,
      claims.runId
    );


  const manifest =
    await finishFullSync(
      env,
      state
    );


  return jsonResponse({

    ok:
      true,

    syncId,

    syncedCount:
      manifest.syncedCount,

    syncedAt:
      manifest.syncedAt

  });

}


export async function handleInternalMediaSyncRequest(
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


  if (
    pathname ===
    "/api/internal/media-sync/upload"
  ) {

    if (
      method !==
      "POST"
    ) {

      return methodNotAllowed([
        "POST"
      ]);

    }


    return handleUploadIndex(
      request,
      env
    );

  }


  if (
    pathname ===
    "/api/internal/media-sync/full/start"
  ) {

    if (
      method !==
      "POST"
    ) {

      return methodNotAllowed([
        "POST"
      ]);

    }


    return handleFullStart(
      request,
      env
    );

  }


  if (
    pathname ===
    "/api/internal/media-sync/full/chunk"
  ) {

    if (
      method !==
      "POST"
    ) {

      return methodNotAllowed([
        "POST"
      ]);

    }


    return handleFullChunk(
      request,
      env
    );

  }


  if (
    pathname ===
    "/api/internal/media-sync/full/finalize"
  ) {

    if (
      method !==
      "POST"
    ) {

      return methodNotAllowed([
        "POST"
      ]);

    }


    return handleFullFinalize(
      request,
      env
    );

  }


  return notFound();

}
