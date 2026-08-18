import {
  HttpError
} from "./http.mjs";

import {
  createId,
  nowSeconds
} from "./crypto.mjs";


const MEDIA_TYPES =
  new Set([
    "image",
    "audio",
    "video"
  ]);


const SOURCE_FOLDERS =
  Object.freeze({
    image:
      "image",

    audio:
      "music",

    video:
      "video"
  });


function stripTrailingSlash(
  value
) {

  return String(
    value ||
    ""
  )
    .trim()
    .replace(
      /\/+$/,
      ""
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

  const type =
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
    MEDIA_TYPES.has(
      type
    )

      ? type

      : null
  );

}


function toEpochSeconds(
  value
) {

  if (!value) {

    return null;

  }


  const milliseconds =
    Date.parse(
      String(
        value
      )
    );


  if (
    !Number.isFinite(
      milliseconds
    )
  ) {

    return null;

  }


  return Math.floor(
    milliseconds /
    1000
  );

}


function parseJson(
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


function splitIntoChunks(
  list,
  size
) {

  const chunks =
    [];


  for (
    let index = 0;
    index < list.length;
    index += size
  ) {

    chunks.push(
      list.slice(
        index,
        index +
        size
      )
    );

  }


  return chunks;

}


export function normalizeManifestMeta(
  env,
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
      "invalid_media_manifest_meta"
    );

  }


  const configuredBaseUrl =
    stripTrailingSlash(
      env.MEDIA_CDN_BASE_URL
    );


  if (!configuredBaseUrl) {

    throw new Error(
      "MEDIA_CDN_BASE_URL missing"
    );

  }


  const suppliedBaseUrl =
    stripTrailingSlash(
      input.baseURL ||
      input.baseUrl ||
      configuredBaseUrl
    );


  if (
    suppliedBaseUrl !==
    configuredBaseUrl
  ) {

    throw new HttpError(
      400,
      "media_manifest_base_url_mismatch"
    );

  }


  const expectedWorker =
    String(
      env.MEDIA_CDN_WORKER ||
      ""
    )
      .trim();


  const worker =
    String(
      input.worker ||
      expectedWorker
    )
      .trim();


  if (
    expectedWorker &&
    worker !==
      expectedWorker
  ) {

    throw new HttpError(
      400,
      "media_manifest_worker_mismatch"
    );

  }


  const totalAssets =
    Number(
      input.totalAssets
    );


  if (
    !Number.isSafeInteger(
      totalAssets
    ) ||
    totalAssets <
      0 ||
    totalAssets >
      1000000
  ) {

    throw new HttpError(
      400,
      "invalid_media_manifest_count"
    );

  }


  return {

    version:
      input.version ??
      null,

    worker,

    baseUrl:
      configuredBaseUrl,

    updatedAt:
      input.updatedAt ||
      null,

    lastPublishedAt:
      input.lastPublishedAt ||
      null,

    lastVersionId:
      input.lastVersionId ||
      null,

    lastDeploymentId:
      input.lastDeploymentId ||
      null,

    totalAssets

  };

}


async function getUploadOwnerMap(
  env,
  mediaIds
) {

  const ids =
    [
      ...new Set(
        mediaIds
          .filter(
            Boolean
          )
      )
    ];


  const map =
    new Map();


  for (
    const group
    of splitIntoChunks(
      ids,
      80
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
          () => "?"
        )
        .join(
          ","
        );


    const result =
      await env.AUTH_DB
        .prepare(
          `
          SELECT

            media_id,
            user_id,
            id,
            original_name,
            completed_at

          FROM upload_jobs

          WHERE
            status = 'complete'

          AND
            media_id IN (
              ${placeholders}
            )

          ORDER BY
            completed_at ASC
          `
        )
        .bind(
          ...group
        )
        .all();


    for (
      const row
      of (
        result.results ||
        []
      )
    ) {

      if (
        !row.media_id ||
        map.has(
          row.media_id
        )
      ) {

        continue;

      }


      map.set(
        row.media_id,
        {
          userId:
            row.user_id ||
            null,

          jobId:
            row.id ||
            null,

          originalName:
            row.original_name ||
            null
        }
      );

    }

  }


  return map;

}


function normalizeManifestAsset(
  env,
  manifest,
  publicPath,
  entry,
  uploadInfo,
  syncId,
  timestamp
) {

  if (
    !entry ||
    typeof entry !==
      "object" ||
    Array.isArray(
      entry
    )
  ) {

    throw new HttpError(
      400,
      "invalid_media_manifest_asset"
    );

  }


  const normalizedPath =
    String(
      publicPath ||
      ""
    )
      .trim();


  const inferredType =
    typeFromPath(
      normalizedPath
    );


  const declaredType =
    MEDIA_TYPES.has(
      entry.type
    )

      ? entry.type

      : null;


  const type =
    declaredType ||
    inferredType;


  if (
    !type ||
    !normalizedPath.startsWith(
      `/${type}/`
    )
  ) {

    throw new HttpError(
      400,
      "invalid_media_manifest_path"
    );

  }


  const id =
    String(
      entry.mediaId ||
      ""
    )
      .trim();


  if (
    !id ||
    id.length >
    80
  ) {

    throw new HttpError(
      400,
      "invalid_media_id"
    );

  }


  const filename =
    filenameFromPath(
      normalizedPath
    );


  if (
    !filename ||
    filename.length >
    220
  ) {

    throw new HttpError(
      400,
      "invalid_media_filename"
    );

  }


  const sha256 =
    String(
      entry.sha256 ||
      ""
    )
      .trim()
      .toLowerCase();


  if (
    !/^[a-f0-9]{64}$/
      .test(
        sha256
      )
  ) {

    throw new HttpError(
      400,
      "invalid_media_sha256"
    );

  }


  let cloudflareHash =
    entry.hash ===
      null ||
    entry.hash ===
      undefined

      ? null

      : String(
          entry.hash
        )
          .trim()
          .toLowerCase();


  if (
    cloudflareHash &&
    !/^[a-f0-9]{32}$/
      .test(
        cloudflareHash
      )
  ) {

    throw new HttpError(
      400,
      "invalid_cloudflare_asset_hash"
    );

  }


  const sizeBytes =
    Number(
      entry.size
    );


  if (
    !Number.isSafeInteger(
      sizeBytes
    ) ||
    sizeBytes <
      0
  ) {

    throw new HttpError(
      400,
      "invalid_media_size"
    );

  }


  const source =
    entry.source;


  if (
    !source ||
    typeof source !==
      "object"
  ) {

    throw new HttpError(
      400,
      "invalid_media_source"
    );

  }


  const sourceRepository =
    String(
      source.repo ||
      ""
    )
      .trim();


  const sourceBranch =
    String(
      source.branch ||
      "main"
    )
      .trim();


  const sourcePath =
    String(
      source.path ||
      ""
    )
      .trim();


  if (
    !sourceRepository ||
    !sourceBranch ||
    !sourcePath
  ) {

    throw new HttpError(
      400,
      "invalid_media_source"
    );

  }


  const addedAt =
    toEpochSeconds(
      entry.addedAt
    ) ||
    timestamp;


  return {

    id,

    type,

    filename,

    originalName:
      uploadInfo
        ?.originalName ||
      null,

    publicPath:
      normalizedPath,

    cdnUrl:
      manifest.baseUrl +
      normalizedPath,

    cdnShard:
      manifest.worker,

    cloudflareHash,

    sha256,

    sizeBytes,

    sourceRepository,

    sourceBranch,

    sourcePath,

    uploaderUserId:
      uploadInfo
        ?.userId ||
      null,

    firstUploadJobId:
      uploadInfo
        ?.jobId ||
      null,

    addedAt,

    publishedAt:
      addedAt,

    createdAt:
      addedAt,

    updatedAt:
      timestamp,

    lastSyncId:
      syncId ||
      null

  };

}


function buildUpsertStatement(
  env,
  rows
) {

  const columnsPerRow =
    20;


  const placeholders =
    rows
      .map(
        () =>
          `(${new Array(columnsPerRow)
            .fill("?")
            .join(",")})`
      )
      .join(
        ","
      );


  const values =
    [];


  for (
    const row
    of rows
  ) {

    values.push(

      row.id,

      row.type,

      row.filename,

      row.originalName,

      row.publicPath,

      row.cdnUrl,

      row.cdnShard,

      row.cloudflareHash,

      row.sha256,

      row.sizeBytes,

      row.sourceRepository,

      row.sourceBranch,

      row.sourcePath,

      row.uploaderUserId,

      row.firstUploadJobId,

      row.addedAt,

      row.publishedAt,

      row.createdAt,

      row.updatedAt,

      row.lastSyncId

    );

  }


  return env.MEDIA_DB
    .prepare(
      `
      INSERT INTO media (

        id,
        type,
        filename,
        original_name,
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
        added_at,
        published_at,
        created_at,
        updated_at,
        last_sync_id

      )

      VALUES
        ${placeholders}

      ON CONFLICT(id)
      DO UPDATE SET

        type =
          excluded.type,

        filename =
          excluded.filename,

        original_name =
          COALESCE(
            media.original_name,
            excluded.original_name
          ),

        public_path =
          excluded.public_path,

        cdn_url =
          excluded.cdn_url,

        cdn_shard =
          excluded.cdn_shard,

        cloudflare_hash =
          COALESCE(
            excluded.cloudflare_hash,
            media.cloudflare_hash
          ),

        sha256 =
          excluded.sha256,

        size_bytes =
          excluded.size_bytes,

        source_repository =
          excluded.source_repository,

        source_branch =
          excluded.source_branch,

        source_path =
          excluded.source_path,

        uploader_user_id =
          COALESCE(
            media.uploader_user_id,
            excluded.uploader_user_id
          ),

        first_upload_job_id =
          COALESCE(
            media.first_upload_job_id,
            excluded.first_upload_job_id
          ),

        added_at =
          COALESCE(
            media.added_at,
            excluded.added_at
          ),

        published_at =
          COALESCE(
            excluded.published_at,
            media.published_at
          ),

        status =
          CASE

            WHEN media.status IN (
              'trashed',
              'deleted'
            )

            THEN media.status

            ELSE 'published'

          END,

        updated_at =
          excluded.updated_at,

        last_sync_id =
          COALESCE(
            excluded.last_sync_id,
            media.last_sync_id
          )
      `
    )
    .bind(
      ...values
    );

}


async function writeRows(
  env,
  rows
) {

  if (
    rows.length ===
    0
  ) {

    return 0;

  }


  const statements =
    splitIntoChunks(
      rows,
      4
    )
      .map(
        group =>
          buildUpsertStatement(
            env,
            group
          )
      );


  await env.MEDIA_DB
    .batch(
      statements
    );


  return rows.length;

}


export async function upsertManifestAssets(
  env,
  manifest,
  assets,
  syncId = null
) {

  if (
    !Array.isArray(
      assets
    )
  ) {

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


  const timestamp =
    nowSeconds();


  const mediaIds =
    assets.map(
      item =>
        item?.entry?.mediaId
    );


  const uploadMap =
    await getUploadOwnerMap(
      env,
      mediaIds
    );


  const rows =
    assets.map(
      item => {

        const mediaId =
          item?.entry?.mediaId;


        return normalizeManifestAsset(

          env,

          manifest,

          item?.path,

          item?.entry,

          uploadMap.get(
            mediaId
          ),

          syncId,

          timestamp

        );

      }
    );


  return writeRows(
    env,
    rows
  );

}


export async function upsertUploadJobMedia(
  env,
  job
) {

  if (
    !job ||
    job.status !==
      "complete" ||
    !job.media_id ||
    !job.final_filename ||
    !job.source_repository ||
    !job.sha256 ||
    !job.cdn_url
  ) {

    throw new HttpError(
      409,
      "upload_job_not_indexable"
    );

  }


  const type =
    String(
      job.media_type ||
      ""
    );


  if (
    !MEDIA_TYPES.has(
      type
    )
  ) {

    throw new HttpError(
      400,
      "invalid_media_type"
    );

  }


  const baseUrl =
    stripTrailingSlash(
      env.MEDIA_CDN_BASE_URL
    );


  if (
    !String(
      job.cdn_url
    ).startsWith(
      `${baseUrl}/`
    )
  ) {

    throw new HttpError(
      400,
      "invalid_cdn_url"
    );

  }


  const cdnUrl =
    new URL(
      job.cdn_url
    );


  const publicPath =
    cdnUrl.pathname;


  const completedAt =
    Number(
      job.completed_at
    ) ||
    nowSeconds();


  const row = {

    id:
      job.media_id,

    type,

    filename:
      job.final_filename,

    originalName:
      job.original_name ||
      null,

    publicPath,

    cdnUrl:
      job.cdn_url,

    cdnShard:
      String(
        env.MEDIA_CDN_WORKER ||
        "jingyan-media-cdn"
      ),

    cloudflareHash:
      null,

    sha256:
      String(
        job.sha256
      )
        .toLowerCase(),

    sizeBytes:
      Number(
        job.size_bytes
      ) ||
      0,

    sourceRepository:
      job.source_repository,

    sourceBranch:
      "main",

    sourcePath:
      `${SOURCE_FOLDERS[type]}/${job.final_filename}`,

    uploaderUserId:
      job.user_id ||
      null,

    firstUploadJobId:
      job.id,

    addedAt:
      completedAt,

    publishedAt:
      completedAt,

    createdAt:
      completedAt,

    updatedAt:
      nowSeconds(),

    lastSyncId:
      null

  };


  await writeRows(
    env,
    [
      row
    ]
  );


  return row;

}


async function getState(
  env,
  key
) {

  const row =
    await env.MEDIA_DB
      .prepare(
        `
        SELECT
          value,
          updated_at

        FROM sync_state

        WHERE
          key = ?

        LIMIT 1
        `
      )
      .bind(
        key
      )
      .first();


  if (!row) {

    return null;

  }


  return {
    value:
      parseJson(
        row.value
      ),

    updatedAt:
      row.updated_at
  };

}


async function putState(
  env,
  key,
  value,
  timestamp
) {

  await env.MEDIA_DB
    .prepare(
      `
      INSERT INTO sync_state (
        key,
        value,
        updated_at
      )

      VALUES (
        ?,
        ?,
        ?
      )

      ON CONFLICT(key)
      DO UPDATE SET

        value =
          excluded.value,

        updated_at =
          excluded.updated_at
      `
    )
    .bind(
      key,
      JSON.stringify(
        value
      ),
      timestamp
    )
    .run();

}


export async function startFullSync(
  env,
  claims,
  manifest
) {

  const timestamp =
    nowSeconds();


  const syncId =
    createId(
      "msync"
    );


  const state = {

    id:
      syncId,

    runId:
      claims.runId,

    expectedCount:
      manifest.totalAssets,

    manifest,

    startedAt:
      timestamp

  };


  await putState(
    env,
    "active_full_sync",
    state,
    timestamp
  );


  return state;

}


export async function assertFullSync(
  env,
  syncId,
  runId
) {

  const state =
    await getState(
      env,
      "active_full_sync"
    );


  if (
    !state?.value ||
    state.value.id !==
      syncId ||
    Number(
      state.value.runId
    ) !==
      Number(
        runId
      )
  ) {

    throw new HttpError(
      409,
      "media_sync_not_active"
    );

  }


  return state.value;

}


export async function finishFullSync(
  env,
  state
) {

  const timestamp =
    nowSeconds();


  const countRow =
    await env.MEDIA_DB
      .prepare(
        `
        SELECT
          COUNT(*) AS count

        FROM media

        WHERE
          last_sync_id = ?
        `
      )
      .bind(
        state.id
      )
      .first();


  const syncedCount =
    Number(
      countRow?.count ||
      0
    );


  if (
    syncedCount !==
    Number(
      state.expectedCount
    )
  ) {

    throw new HttpError(
      409,
      "media_sync_incomplete"
    );

  }


  const manifestState = {

    ...state.manifest,

    syncedAt:
      timestamp,

    syncId:
      state.id,

    syncRunId:
      state.runId,

    syncedCount

  };


  await env.MEDIA_DB
    .batch([

      env.MEDIA_DB
        .prepare(
          `
          UPDATE media

          SET

            status =
              'missing',

            updated_at =
              ?

          WHERE
            status NOT IN (
              'trashed',
              'deleted'
            )

          AND (
            last_sync_id IS NULL
            OR
            last_sync_id != ?
          )
          `
        )
        .bind(
          timestamp,
          state.id
        ),


      env.MEDIA_DB
        .prepare(
          `
          INSERT INTO sync_state (
            key,
            value,
            updated_at
          )

          VALUES (
            'manifest_state',
            ?,
            ?
          )

          ON CONFLICT(key)
          DO UPDATE SET

            value =
              excluded.value,

            updated_at =
              excluded.updated_at
          `
        )
        .bind(
          JSON.stringify(
            manifestState
          ),
          timestamp
        ),


      env.MEDIA_DB
        .prepare(
          `
          DELETE FROM sync_state

          WHERE
            key =
              'active_full_sync'
          `
        )

    ]);


  return manifestState;

}


export async function getLibraryPage(
  env,
  {
    type,
    query,
    page,
    pageSize
  }
) {

  const summaryRow =
    await env.MEDIA_DB
      .prepare(
        `
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
          ) AS video,

          COUNT(
            DISTINCT source_repository
          ) AS repository_count

        FROM media

        WHERE
          status =
            'published'
        `
      )
      .first();


  const where = [
    "status = 'published'"
  ];


  const bindings =
    [];


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

    where.push(
      `
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

        OR

        instr(
          lower(
            COALESCE(
              public_path,
              ''
            )
          ),
          ?
        ) > 0
      )
      `
    );


    for (
      let index = 0;
      index < 7;
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
      .prepare(
        `
        SELECT
          COUNT(*) AS count

        FROM media

        WHERE
          ${whereSql}
        `
      )
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


  const rowsResult =
    await env.MEDIA_DB
      .prepare(
        `
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
          created_at,
          updated_at

        FROM media

        WHERE
          ${whereSql}

        ORDER BY

          COALESCE(
            added_at,
            created_at
          ) DESC,

          id DESC

        LIMIT ?
        OFFSET ?
        `
      )
      .bind(
        ...bindings,
        pageSize,
        offset
      )
      .all();


  const rows =
    rowsResult.results ||
    [];


  const uploaderIds =
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


  const uploaderMap =
    new Map();


  for (
    const group
    of splitIntoChunks(
      uploaderIds,
      80
    )
  ) {

    if (
      !group.length
    ) {

      continue;

    }


    const placeholders =
      group
        .map(
          () => "?"
        )
        .join(
          ","
        );


    const users =
      await env.AUTH_DB
        .prepare(
          `
          SELECT
            id,
            display_name

          FROM users

          WHERE
            id IN (
              ${placeholders}
            )
          `
        )
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

      uploaderMap.set(
        user.id,
        user.display_name
      );

    }

  }


  const manifestState =
    await getState(
      env,
      "manifest_state"
    );


  const toIso =
    seconds => {

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
      )
        .toISOString();

    };


  const items =
    rows.map(
      row => ({

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
          )

      })
    );


  const manifest =
    manifestState?.value ||
    {};


  return {

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
        stripTrailingSlash(
          env.MEDIA_CDN_BASE_URL
        ),

      updatedAt:
        manifest.updatedAt ||
        null,

      lastPublishedAt:
        manifest.lastPublishedAt ||
        null,

      repositoryCount:
        Number(
          summaryRow
            ?.repository_count ||
          0
        ),

      syncedAt:
        manifest.syncedAt ||
        null

    },

    summary: {

      total:
        Number(
          summaryRow?.total ||
          0
        ),

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

      type,

      q:
        query,

      page:
        safePage,

      pageSize,

      filteredTotal,

      totalPages

    },

    items

  };

}
