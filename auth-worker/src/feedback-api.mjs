import {
  createId
} from "./crypto.mjs";

import {
  HttpError,
  jsonResponse,
  readJson,
  requireSameOrigin,
  methodNotAllowed
} from "./http.mjs";


const CATEGORIES =
  new Set([
    "upload",
    "media",
    "playback",
    "collection",
    "account",
    "ui",
    "other"
  ]);


const INCIDENT_STATUSES =
  new Set([
    "open",
    "investigating",
    "resolved",
    "muted"
  ]);


const SEVERITIES =
  new Set([
    "low",
    "normal",
    "high",
    "critical"
  ]);


function nowSeconds() {

  return Math.floor(
    Date.now() / 1000
  );

}


function cleanText(
  value,
  maxLength
) {

  if (
    value === null ||
    value === undefined
  ) {

    return "";

  }


  return String(
    value
  )
    .replace(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
      ""
    )
    .trim()
    .slice(
      0,
      maxLength
    );

}


function nullableText(
  value,
  maxLength
) {

  const text =
    cleanText(
      value,
      maxLength
    );

  return text || null;

}


function safeInteger(
  value
) {

  const number =
    Number(
      value
    );


  if (
    !Number.isInteger(
      number
    )
  ) {

    return null;

  }


  return number;

}


function safeHttpStatus(
  value
) {

  const number =
    safeInteger(
      value
    );


  if (
    number === null ||
    number < 100 ||
    number > 599
  ) {

    return null;

  }


  return number;

}


function normalizePath(
  value
) {

  const text =
    cleanText(
      value,
      600
    );


  if (!text) {

    return null;

  }


  try {

    const url =
      new URL(
        text,
        "https://jingyan.invalid"
      );


    let pathname =
      url.pathname || "/";


    pathname =
      pathname
        .replace(
          /\/+/g,
          "/"
        );


    const search =
      url.search
        .slice(
          0,
          240
        );


    return (
      pathname +
      search
    ).slice(
      0,
      500
    );

  } catch {

    return text
      .split("#")[0]
      .slice(
        0,
        500
      );

  }

}


function normalizeFingerprintPath(
  value
) {

  const path =
    normalizePath(
      value
    );


  if (!path) {

    return "";

  }


  return path
    .split("?")[0]
    .replace(
      /\/[0-9a-f]{8,}(?=\/|$)/gi,
      "/:id"
    )
    .replace(
      /\/(?:usr|media|image|video|audio|upload|batch|col)_[A-Za-z0-9_-]+/g,
      "/:id"
    );

}


function cleanContext(
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

    return {};

  }


  const result = {};


  const stringKeys = [
    "mediaId",
    "collectionId",
    "uploadJobId",
    "uploadBatchId",
    "action",
    "route",
    "browser",
    "platform",
    "viewport",
    "network",
    "source"
  ];


  for (
    const key
    of stringKeys
  ) {

    const value =
      nullableText(
        input[key],
        300
      );


    if (value) {

      result[key] =
        value;

    }

  }


  return result;

}


function titleForReport({
  category,
  errorCode,
  apiPath,
  pagePath
}) {

  const labelMap = {

    upload:
      "上传问题",

    media:
      "媒体问题",

    playback:
      "播放问题",

    collection:
      "分组问题",

    account:
      "账户问题",

    ui:
      "界面问题",

    other:
      "其他反馈"

  };


  const label =
    labelMap[category] ||
    "用户反馈";


  if (errorCode) {

    return `${label} · ${errorCode}`;

  }


  if (apiPath) {

    return `${label} · ${apiPath}`;

  }


  if (pagePath) {

    return `${label} · ${pagePath}`;

  }


  return label;

}


async function sha256Hex(
  value
) {

  const bytes =
    new TextEncoder()
      .encode(
        value
      );


  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      bytes
    );


  return Array
    .from(
      new Uint8Array(
        digest
      )
    )
    .map(
      byte =>
        byte
          .toString(16)
          .padStart(
            2,
            "0"
          )
    )
    .join("");

}


async function buildFingerprint({
  category,
  pagePath,
  apiPath,
  httpStatus,
  errorCode
}) {

  const source = [

    category,

    normalizeFingerprintPath(
      pagePath
    ),

    normalizeFingerprintPath(
      apiPath
    ),

    httpStatus === null
      ? ""
      : String(
          httpStatus
        ),

    (
      errorCode ||
      ""
    )
      .toLowerCase()

  ].join("|");


  return (
    await sha256Hex(
      source
    )
  ).slice(
    0,
    40
  );

}


function sessionIdFromAuth(
  auth
) {

  return (
    auth?.session?.id ||
    auth?.session?.sessionId ||
    null
  );

}


async function createFeedback(
  request,
  env,
  auth
) {

  requireSameOrigin(
    request
  );


  const body =
    await readJson(
      request
    );


  const category =
    cleanText(
      body.category,
      30
    )
      .toLowerCase();


  if (
    !CATEGORIES.has(
      category
    )
  ) {

    throw new HttpError(
      400,
      "invalid_feedback_category"
    );

  }


  const message =
    nullableText(
      body.message,
      1600
    );


  const pagePath =
    normalizePath(
      body.pageUrl ||
      body.pagePath
    );


  const apiPath =
    normalizePath(
      body.apiPath
    );


  const httpStatus =
    safeHttpStatus(
      body.httpStatus
    );


  const errorCode =
    nullableText(
      body.errorCode,
      120
    );


  const context =
    cleanContext(
      body.context
    );


  if (
    !message &&
    !pagePath &&
    !apiPath &&
    !errorCode
  ) {

    throw new HttpError(
      400,
      "feedback_is_empty"
    );

  }


  const fingerprint =
    await buildFingerprint({

      category,

      pagePath,

      apiPath,

      httpStatus,

      errorCode

    });


  const title =
    titleForReport({

      category,

      errorCode,

      apiPath,

      pagePath

    });


  const incidentId =
    createId(
      "inc"
    );


  const reportId =
    createId(
      "report"
    );


  const auditId =
    createId(
      "audit"
    );


  const now =
    nowSeconds();


  const userId =
    auth.user.id;


  const sessionId =
    sessionIdFromAuth(
      auth
    );


  const contextJson =
    JSON.stringify(
      context
    );


  await env.AUTH_DB.batch([

    env.AUTH_DB
      .prepare(
        `
        INSERT OR IGNORE INTO incidents (

          id,
          fingerprint,
          category,
          title,
          status,
          severity,
          report_count,
          first_seen_at,
          last_seen_at,
          owner_note,
          resolved_at,
          resolved_by_user_id,
          created_by_user_id

        )

        VALUES (

          ?,
          ?,
          ?,
          ?,
          'open',
          'normal',
          0,
          ?,
          ?,
          NULL,
          NULL,
          NULL,
          ?

        )
        `
      )
      .bind(

        incidentId,

        fingerprint,

        category,

        title,

        now,

        now,

        userId

      ),


    env.AUTH_DB
      .prepare(
        `
        UPDATE incidents

        SET

          report_count =
            report_count + 1,

          last_seen_at =
            ?,

          status =
            CASE

              WHEN status =
                'resolved'

              THEN
                'open'

              ELSE
                status

            END,

          resolved_at =
            CASE

              WHEN status =
                'resolved'

              THEN
                NULL

              ELSE
                resolved_at

            END,

          resolved_by_user_id =
            CASE

              WHEN status =
                'resolved'

              THEN
                NULL

              ELSE
                resolved_by_user_id

            END

        WHERE
          fingerprint = ?
        `
      )
      .bind(
        now,
        fingerprint
      ),


    env.AUTH_DB
      .prepare(
        `
        INSERT INTO incident_reports (

          id,
          incident_id,
          reporter_user_id,
          reporter_session_id,
          message,
          page_path,
          api_path,
          http_status,
          error_code,
          context_json,
          created_at

        )

        SELECT

          ?,
          id,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?

        FROM incidents

        WHERE
          fingerprint = ?

        LIMIT 1
        `
      )
      .bind(

        reportId,

        userId,

        sessionId,

        message,

        pagePath,

        apiPath,

        httpStatus,

        errorCode,

        contextJson,

        now,

        fingerprint

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
          NULL,
          'feedback.report',
          'incident',
          (
            SELECT id
            FROM incidents
            WHERE fingerprint = ?
            LIMIT 1
          ),
          ?,
          NULL,
          ?

        )
        `
      )
      .bind(

        auditId,

        userId,

        fingerprint,

        JSON.stringify({

          category,

          reportId,

          pagePath,

          apiPath,

          httpStatus,

          errorCode

        }),

        now

      )

  ]);


  const incident =
    await env.AUTH_DB
      .prepare(
        `
        SELECT

          id,
          fingerprint,
          category,
          title,
          status,
          severity,
          report_count,
          first_seen_at,
          last_seen_at

        FROM incidents

        WHERE
          fingerprint = ?

        LIMIT 1
        `
      )
      .bind(
        fingerprint
      )
      .first();


  return jsonResponse(
    {

      ok:
        true,

      report: {

        id:
          reportId,

        incidentId:
          incident?.id ||
          incidentId,

        status:
          incident?.status ||
          "open",

        reportCount:
          Number(
            incident?.report_count ||
            1
          )

      }

    },
    201
  );

}


async function listMyFeedback(
  request,
  env,
  auth
) {

  const url =
    new URL(
      request.url
    );


  const rawLimit =
    Number(
      url.searchParams.get(
        "limit"
      ) ||
      10
    );


  const limit =
    Math.max(
      1,
      Math.min(
        20,
        Number.isFinite(
          rawLimit
        )
          ? Math.trunc(
              rawLimit
            )
          : 10
      )
    );


  const result =
    await env.AUTH_DB
      .prepare(
        `
        SELECT

          r.id AS report_id,
          r.message,
          r.page_path,
          r.api_path,
          r.http_status,
          r.error_code,
          r.created_at,

          i.id AS incident_id,
          i.category,
          i.title,
          i.status,
          i.severity,
          i.report_count,
          i.last_seen_at

        FROM incident_reports r

        INNER JOIN incidents i
          ON i.id =
             r.incident_id

        WHERE
          r.reporter_user_id = ?

        ORDER BY
          r.created_at DESC

        LIMIT ?
        `
      )
      .bind(
        auth.user.id,
        limit
      )
      .all();


  const reports =
    (
      result.results ||
      []
    )
      .map(
        row => ({

          id:
            row.report_id,

          incidentId:
            row.incident_id,

          category:
            row.category,

          title:
            row.title,

          status:
            row.status,

          severity:
            row.severity,

          reportCount:
            Number(
              row.report_count ||
              0
            ),

          message:
            row.message,

          pagePath:
            row.page_path,

          apiPath:
            row.api_path,

          httpStatus:
            row.http_status,

          errorCode:
            row.error_code,

          createdAt:
            row.created_at,

          lastSeenAt:
            row.last_seen_at

        })
      );


  return jsonResponse({
    reports
  });

}


async function listAdminIncidents(
  request,
  env
) {

  const url =
    new URL(
      request.url
    );


  const status =
    cleanText(
      url.searchParams.get(
        "status"
      ),
      30
    );


  const category =
    cleanText(
      url.searchParams.get(
        "category"
      ),
      30
    );


  const query =
    cleanText(
      url.searchParams.get(
        "q"
      ),
      100
    );


  const rawLimit =
    Number(
      url.searchParams.get(
        "limit"
      ) ||
      50
    );


  const limit =
    Math.max(
      1,
      Math.min(
        100,
        Number.isFinite(
          rawLimit
        )
          ? Math.trunc(
              rawLimit
            )
          : 50
      )
    );


  const clauses = [
    "1 = 1"
  ];


  const values = [];


  if (
    status &&
    INCIDENT_STATUSES.has(
      status
    )
  ) {

    clauses.push(
      "i.status = ?"
    );

    values.push(
      status
    );

  }


  if (
    category &&
    CATEGORIES.has(
      category
    )
  ) {

    clauses.push(
      "i.category = ?"
    );

    values.push(
      category
    );

  }


  if (query) {

    clauses.push(
      `
      (
        i.title LIKE ?
        OR
        i.fingerprint LIKE ?
        OR
        i.owner_note LIKE ?
      )
      `
    );


    const like =
      `%${query}%`;


    values.push(
      like,
      like,
      like
    );

  }


  values.push(
    limit
  );


  const result =
    await env.AUTH_DB
      .prepare(
        `
        SELECT

          i.id,
          i.fingerprint,
          i.category,
          i.title,
          i.status,
          i.severity,
          i.report_count,
          i.first_seen_at,
          i.last_seen_at,
          i.owner_note,
          i.resolved_at,
          i.resolved_by_user_id,
          i.created_by_user_id,

          u.display_name AS first_reporter_name

        FROM incidents i

        LEFT JOIN users u
          ON u.id =
             i.created_by_user_id

        WHERE
          ${clauses.join(
            "\nAND\n"
          )}

        ORDER BY

          CASE i.severity

            WHEN 'critical'
            THEN 0

            WHEN 'high'
            THEN 1

            WHEN 'normal'
            THEN 2

            ELSE 3

          END,

          CASE i.status

            WHEN 'open'
            THEN 0

            WHEN 'investigating'
            THEN 1

            WHEN 'resolved'
            THEN 2

            ELSE 3

          END,

          i.last_seen_at DESC

        LIMIT ?
        `
      )
      .bind(
        ...values
      )
      .all();


  return jsonResponse({

    incidents:
      (
        result.results ||
        []
      )
        .map(
          row => ({

            id:
              row.id,

            fingerprint:
              row.fingerprint,

            category:
              row.category,

            title:
              row.title,

            status:
              row.status,

            severity:
              row.severity,

            reportCount:
              Number(
                row.report_count ||
                0
              ),

            firstSeenAt:
              row.first_seen_at,

            lastSeenAt:
              row.last_seen_at,

            ownerNote:
              row.owner_note,

            resolvedAt:
              row.resolved_at,

            resolvedByUserId:
              row.resolved_by_user_id,

            firstReporterName:
              row.first_reporter_name

          })
        )

  });

}


async function getAdminIncident(
  env,
  incidentId
) {

  const incident =
    await env.AUTH_DB
      .prepare(
        `
        SELECT

          i.*,

          u.display_name AS first_reporter_name

        FROM incidents i

        LEFT JOIN users u
          ON u.id =
             i.created_by_user_id

        WHERE
          i.id = ?

        LIMIT 1
        `
      )
      .bind(
        incidentId
      )
      .first();


  if (!incident) {

    throw new HttpError(
      404,
      "incident_not_found"
    );

  }


  const reportResult =
    await env.AUTH_DB
      .prepare(
        `
        SELECT

          r.id,
          r.reporter_user_id,
          r.message,
          r.page_path,
          r.api_path,
          r.http_status,
          r.error_code,
          r.context_json,
          r.created_at,

          u.display_name AS reporter_name

        FROM incident_reports r

        LEFT JOIN users u
          ON u.id =
             r.reporter_user_id

        WHERE
          r.incident_id = ?

        ORDER BY
          r.created_at DESC

        LIMIT 100
        `
      )
      .bind(
        incidentId
      )
      .all();


  return jsonResponse({

    incident: {

      id:
        incident.id,

      fingerprint:
        incident.fingerprint,

      category:
        incident.category,

      title:
        incident.title,

      status:
        incident.status,

      severity:
        incident.severity,

      reportCount:
        Number(
          incident.report_count ||
          0
        ),

      firstSeenAt:
        incident.first_seen_at,

      lastSeenAt:
        incident.last_seen_at,

      ownerNote:
        incident.owner_note,

      resolvedAt:
        incident.resolved_at,

      resolvedByUserId:
        incident.resolved_by_user_id,

      firstReporterName:
        incident.first_reporter_name

    },


    reports:
      (
        reportResult.results ||
        []
      )
        .map(
          row => ({

            id:
              row.id,

            reporterUserId:
              row.reporter_user_id,

            reporterName:
              row.reporter_name,

            message:
              row.message,

            pagePath:
              row.page_path,

            apiPath:
              row.api_path,

            httpStatus:
              row.http_status,

            errorCode:
              row.error_code,

            context:
              (() => {

                try {

                  return JSON.parse(
                    row.context_json ||
                    "{}"
                  );

                } catch {

                  return {};

                }

              })(),

            createdAt:
              row.created_at

          })
        )

  });

}


async function updateAdminIncident(
  request,
  env,
  auth,
  incidentId
) {

  requireSameOrigin(
    request
  );


  const body =
    await readJson(
      request
    );


  const current =
    await env.AUTH_DB
      .prepare(
        `
        SELECT
          id,
          status,
          severity,
          owner_note

        FROM incidents

        WHERE
          id = ?

        LIMIT 1
        `
      )
      .bind(
        incidentId
      )
      .first();


  if (!current) {

    throw new HttpError(
      404,
      "incident_not_found"
    );

  }


  const nextStatus =
    body.status ===
      undefined

      ? current.status

      : cleanText(
          body.status,
          30
        );


  const nextSeverity =
    body.severity ===
      undefined

      ? current.severity

      : cleanText(
          body.severity,
          30
        );


  if (
    !INCIDENT_STATUSES.has(
      nextStatus
    )
  ) {

    throw new HttpError(
      400,
      "invalid_incident_status"
    );

  }


  if (
    !SEVERITIES.has(
      nextSeverity
    )
  ) {

    throw new HttpError(
      400,
      "invalid_incident_severity"
    );

  }


  const ownerNote =
    body.ownerNote ===
      undefined

      ? current.owner_note

      : nullableText(
          body.ownerNote,
          3000
        );


  const now =
    nowSeconds();


  const resolved =
    nextStatus ===
      "resolved";


  await env.AUTH_DB.batch([

    env.AUTH_DB
      .prepare(
        `
        UPDATE incidents

        SET

          status = ?,

          severity = ?,

          owner_note = ?,

          resolved_at = ?,

          resolved_by_user_id = ?

        WHERE
          id = ?
        `
      )
      .bind(

        nextStatus,

        nextSeverity,

        ownerNote,

        resolved
          ? now
          : null,

        resolved
          ? auth.user.id
          : null,

        incidentId

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
          NULL,
          'incident.update',
          'incident',
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

        incidentId,

        JSON.stringify({

          status:
            nextStatus,

          severity:
            nextSeverity

        }),

        now

      )

  ]);


  return jsonResponse({
    ok:
      true
  });

}


export async function handleFeedbackRequest(
  request,
  env,
  auth
) {

  const url =
    new URL(
      request.url
    );


  const method =
    request.method
      .toUpperCase();


  if (
    url.pathname ===
      "/api/feedback"
  ) {

    if (
      method ===
        "POST"
    ) {

      return createFeedback(
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
    url.pathname ===
      "/api/feedback/mine"
  ) {

    if (
      method ===
        "GET"
    ) {

      return listMyFeedback(
        request,
        env,
        auth
      );

    }


    return methodNotAllowed([
      "GET"
    ]);

  }


  throw new HttpError(
    404,
    "feedback_route_not_found"
  );

}


export async function handleOwnerIncidentRequest(
  request,
  env,
  auth
) {

  const url =
    new URL(
      request.url
    );


  const method =
    request.method
      .toUpperCase();


  if (
    url.pathname ===
      "/api/admin/incidents"
  ) {

    if (
      method ===
        "GET"
    ) {

      return listAdminIncidents(
        request,
        env
      );

    }


    return methodNotAllowed([
      "GET"
    ]);

  }


  const match =
    url.pathname.match(
      /^\/api\/admin\/incidents\/([^/]+)$/
    );


  if (!match) {

    throw new HttpError(
      404,
      "incident_route_not_found"
    );

  }


  const incidentId =
    decodeURIComponent(
      match[1]
    );


  if (
    method ===
      "GET"
  ) {

    return getAdminIncident(
      env,
      incidentId
    );

  }


  if (
    method ===
      "PATCH"
  ) {

    return updateAdminIncident(
      request,
      env,
      auth,
      incidentId
    );

  }


  return methodNotAllowed([
    "GET",
    "PATCH"
  ]);

}
