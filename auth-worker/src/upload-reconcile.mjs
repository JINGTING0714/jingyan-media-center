import {
  createId,
  nowSeconds
} from "./crypto.mjs";


const ACTIVE_STATUSES =
  new Set([
    "queued",
    "processing"
  ]);


const RECONCILE_INTERVAL_SECONDS =
  30;


const MISSING_RUN_TIMEOUT_SECONDS =
  10 * 60;


const MAX_USER_RECONCILE_JOBS =
  8;


function canViewJob(
  auth,
  job
) {
  return Boolean(
    job &&
    auth?.user &&
    (
      job.user_id ===
        auth.user.id ||
      auth.user.role ===
        "owner"
    )
  );
}


async function getJob(
  env,
  jobId
) {
  return env.AUTH_DB
    .prepare(`
      SELECT *

      FROM upload_jobs

      WHERE id = ?

      LIMIT 1
    `)
    .bind(
      jobId
    )
    .first();
}


async function insertAudit(
  env,
  {
    job,
    error,
    githubStatus,
    githubConclusion,
    githubRunId
  }
) {
  const now =
    nowSeconds();


  await env.AUTH_DB
    .prepare(`
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
        NULL,
        'upload.failed',
        'upload_job',
        ?,
        ?,
        NULL,
        ?

      )
    `)
    .bind(
      createId(
        "audit"
      ),

      job.user_id,

      job.id,

      JSON.stringify({
        error,
        reconciled:
          true,

        githubStatus:
          githubStatus ||
          null,

        githubConclusion:
          githubConclusion ||
          null,

        githubRunId:
          githubRunId ||
          null
      }),

      now
    )
    .run();
}


function githubHeaders(
  env
) {
  const token =
    String(
      env.GITHUB_UPLOAD_TOKEN ||
      ""
    );


  if (
    !token
  ) {
    return null;
  }


  return {
    Accept:
      "application/vnd.github+json",

    Authorization:
      `Bearer ${token}`,

    "X-GitHub-Api-Version":
      "2026-03-10",

    "User-Agent":
      "jingyan-media-app"
  };
}


async function fetchGithubRun(
  env,
  runId
) {
  const headers =
    githubHeaders(
      env
    );


  if (
    !headers
  ) {
    return {
      ok:
        false,

      unavailable:
        true,

      status:
        0,

      run:
        null
    };
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


  if (
    !owner ||
    !repo
  ) {
    return {
      ok:
        false,

      unavailable:
        true,

      status:
        0,

      run:
        null
    };
  }


  let response;


  try {
    response =
      await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/runs/${encodeURIComponent(runId)}`,
        {
          method:
            "GET",

          headers
        }
      );

  } catch (
    error
  ) {
    console.error(
      "Upload reconcile GitHub request failed:",
      error
    );


    return {
      ok:
        false,

      unavailable:
        true,

      status:
        0,

      run:
        null
    };
  }


  if (
    response.status ===
    404
  ) {
    return {
      ok:
        false,

      unavailable:
        false,

      status:
        404,

      run:
        null
    };
  }


  if (
    !response.ok
  ) {
    console.error(
      "Upload reconcile GitHub response:",
      response.status
    );


    return {
      ok:
        false,

      unavailable:
        true,

      status:
        response.status,

      run:
        null
    };
  }


  let run;


  try {
    run =
      await response.json();

  } catch (
    error
  ) {
    console.error(
      "Upload reconcile GitHub JSON failed:",
      error
    );


    return {
      ok:
        false,

      unavailable:
        true,

      status:
        response.status,

      run:
        null
    };
  }


  return {
    ok:
      true,

    unavailable:
      false,

    status:
      response.status,

    run
  };
}


async function heartbeatJob(
  env,
  job,
  run
) {
  const now =
    nowSeconds();


  const runUrl =
    typeof run?.html_url ===
      "string"
        ? run.html_url
        : job.github_run_url;


  await env.AUTH_DB
    .prepare(`
      UPDATE upload_jobs

      SET
        github_run_url = ?,
        updated_at = ?

      WHERE
        id = ?

      AND
        status IN (
          'queued',
          'processing'
        )
    `)
    .bind(
      runUrl ||
      null,

      now,

      job.id
    )
    .run();
}


async function markFailed(
  env,
  job,
  {
    error,
    githubStatus = null,
    githubConclusion = null,
    githubRunId = null,
    githubRunUrl = null
  }
) {
  const now =
    nowSeconds();


  const result =
    await env.AUTH_DB
      .prepare(`
        UPDATE upload_jobs

        SET
          status = 'failed',

          error_message = ?,

          github_run_url =
            COALESCE(
              ?,
              github_run_url
            ),

          updated_at = ?,

          completed_at = ?

        WHERE
          id = ?

        AND
          status IN (
            'queued',
            'processing'
          )
      `)
      .bind(
        error,

        githubRunUrl,

        now,

        now,

        job.id
      )
      .run();


  const changed =
    Number(
      result?.meta?.changes ||
      0
    );


  if (
    changed !==
    1
  ) {
    return;
  }


  await insertAudit(
    env,
    {
      job,
      error,
      githubStatus,
      githubConclusion,
      githubRunId
    }
  );
}


function normalizeRunStatus(
  input
) {
  return String(
    input ||
    ""
  )
    .trim()
    .toLowerCase();
}


function normalizeConclusion(
  input
) {
  return String(
    input ||
    ""
  )
    .trim()
    .toLowerCase();
}


function activeAge(
  job
) {
  return (
    nowSeconds() -
    Number(
      job.updated_at ||
      job.created_at ||
      0
    )
  );
}


function totalAge(
  job
) {
  return (
    nowSeconds() -
    Number(
      job.created_at ||
      0
    )
  );
}


export async function reconcileUploadJob(
  env,
  auth,
  jobId
) {
  let job;


  try {
    job =
      await getJob(
        env,
        jobId
      );

  } catch (
    error
  ) {
    console.error(
      "Upload reconcile DB read failed:",
      error
    );


    return;
  }


  if (
    !job ||
    !canViewJob(
      auth,
      job
    ) ||
    !ACTIVE_STATUSES.has(
      job.status
    )
  ) {
    return;
  }


  /*
   * 避免浏览器每 4 秒 Poll 一次时，
   * 同时每 4 秒打一次 GitHub API。
   */
  if (
    activeAge(
      job
    ) <
    RECONCILE_INTERVAL_SECONDS
  ) {
    return;
  }


  const runId =
    Number(
      job.github_run_id
    );


  /*
   * GitHub 2026 API 正常情况下 Dispatch
   * 应当已经返回 workflow_run_id。
   *
   * 如果旧任务没有保存 Run ID，
   * 超过 10 分钟就进入“结果不确定”。
   */
  if (
    !Number.isSafeInteger(
      runId
    ) ||
    runId <=
    0
  ) {
    if (
      totalAge(
        job
      ) >=
      MISSING_RUN_TIMEOUT_SECONDS
    ) {
      await markFailed(
        env,
        job,
        {
          /*
           * 现有 Batch V1 已经把这个错误
           * 识别为不能盲目重试的“需确认”。
           */
          error:
            "pipeline_state_not_saved"
        }
      );
    }


    return;
  }


  const github =
    await fetchGithubRun(
      env,
      runId
    );


  /*
   * GitHub API 临时不可用时，
   * 绝不能因为“检查失败”反过来把
   * 正常上传任务标记失败。
   */
  if (
    github.unavailable
  ) {
    return;
  }


  /*
   * Run ID 已记录，但是 GitHub 查不到。
   * 短时间可能只是异常传播，因此仍给
   * 10 分钟保护窗口。
   */
  if (
    !github.ok &&
    github.status ===
      404
  ) {
    if (
      totalAge(
        job
      ) >=
      MISSING_RUN_TIMEOUT_SECONDS
    ) {
      await markFailed(
        env,
        job,
        {
          error:
            "pipeline_state_not_saved",

          githubRunId:
            runId
        }
      );
    }


    return;
  }


  if (
    !github.ok ||
    !github.run
  ) {
    return;
  }


  const run =
    github.run;


  const status =
    normalizeRunStatus(
      run.status
    );


  const conclusion =
    normalizeConclusion(
      run.conclusion
    );


  /*
   * requested / waiting / pending / queued
   * 都仍属于真正的 GitHub 等待状态。
   */
  if (
    [
      "requested",
      "waiting",
      "pending",
      "queued"
    ].includes(
      status
    )
  ) {
    await heartbeatJob(
      env,
      job,
      run
    );


    return;
  }


  /*
   * 不根据 GitHub 的 in_progress
   * 直接把 DB 改成 processing。
   *
   * DB processing 的定义更严格：
   * GitHub Runner 已经真正向 Worker
   * 请求 staged source。
   *
   * 这个状态由 internalSource() 设置。
   */
  if (
    status ===
    "in_progress"
  ) {
    await heartbeatJob(
      env,
      job,
      run
    );


    return;
  }


  if (
    status !==
    "completed"
  ) {
    await heartbeatJob(
      env,
      job,
      run
    );


    return;
  }


  /*
   * GitHub Run 已经结束。
   * 再读取一次 DB，避免 Callback 与
   * Reconciler 正好同时运行导致误判。
   */
  const latest =
    await getJob(
      env,
      job.id
    );


  if (
    !latest ||
    !ACTIVE_STATUSES.has(
      latest.status
    )
  ) {
    return;
  }


  /*
   * 如果 Workflow 成功结束，
   * 但 upload_job 仍然 queued / processing，
   * 说明 Callback / Pipeline State 出现异常。
   *
   * 不能盲目重试，因为物理媒体可能已经写入。
   */
  if (
    conclusion ===
    "success"
  ) {
    await markFailed(
      env,
      latest,
      {
        error:
          "pipeline_state_not_saved",

        githubStatus:
          status,

        githubConclusion:
          conclusion,

        githubRunId:
          runId,

        githubRunUrl:
          typeof run.html_url ===
            "string"
              ? run.html_url
              : null
      }
    );


    return;
  }


  /*
   * queued 仍表示 GitHub Runner 从未成功
   * 获取 staged source。
   *
   * 所以如果此时 GitHub Workflow 已经失败、
   * 取消、超时等，可以认为媒体处理尚未开始，
   * 使用现有 pipeline_failed：
   *
   * Batch V1 会允许“安全重试”。
   */
  if (
    latest.status ===
    "queued"
  ) {
    await markFailed(
      env,
      latest,
      {
        error:
          "pipeline_failed",

        githubStatus:
          status,

        githubConclusion:
          conclusion ||
          "unknown",

        githubRunId:
          runId,

        githubRunUrl:
          typeof run.html_url ===
            "string"
              ? run.html_url
              : null
      }
    );


    return;
  }


  /*
   * processing 表示 Runner 已经拿到了媒体。
   *
   * 此时任何异常终止都可能已经发生部分写入，
   * 所以不能自动安全重试。
   */
  await markFailed(
    env,
    latest,
    {
      error:
        "pipeline_state_not_saved",

      githubStatus:
        status,

      githubConclusion:
        conclusion ||
        "unknown",

      githubRunId:
        runId,

      githubRunUrl:
        typeof run.html_url ===
          "string"
            ? run.html_url
            : null
    }
  );
}


export async function reconcileUserUploadJobs(
  env,
  auth
) {
  if (
    !auth?.user?.id
  ) {
    return;
  }


  let result;


  try {
    result =
      await env.AUTH_DB
        .prepare(`
          SELECT *

          FROM upload_jobs

          WHERE
            user_id = ?

          AND
            status IN (
              'queued',
              'processing'
            )

          ORDER BY
            created_at DESC

          LIMIT ?
        `)
        .bind(
          auth.user.id,
          MAX_USER_RECONCILE_JOBS
        )
        .all();

  } catch (
    error
  ) {
    console.error(
      "Upload reconcile list failed:",
      error
    );


    return;
  }


  const jobs =
    result.results ||
    [];


  for (
    const job
    of jobs
  ) {
    await reconcileUploadJob(
      env,
      auth,
      job.id
    );
  }
}
