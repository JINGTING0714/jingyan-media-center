import {
  HttpError,
  jsonResponse,
  requireSameOrigin,
  methodNotAllowed,
  notFound
} from "./http.mjs";

import {
  nowSeconds,
  getRequestFingerprint
} from "./crypto.mjs";

import {
  normalizePermissions
} from "./config.mjs";

import {
  auditStatement
} from "./db.mjs";


const USER_TRASH_RETENTION_SECONDS =
  7 * 86400;


function changes(
  result
) {
  return Number(
    result?.meta?.changes ||
    0
  );
}


function requireOwnerUserManagement(
  auth
) {
  if (
    !auth?.user ||
    auth.user.role !==
      "owner" ||
    auth.user.status !==
      "active" ||
    auth.user.permissions
      ?.manageUsers !==
      true
  ) {
    throw new HttpError(
      403,
      "permission_denied"
    );
  }
}


async function auditContext(
  request,
  env,
  auth
) {
  const fingerprint =
    await getRequestFingerprint(
      request,
      env
    );

  return {
    actorUserId:
      auth.user.id,

    actorSessionId:
      auth.session.id,

    ipHash:
      fingerprint.ipHash
  };
}


function publicDeletedUser(
  row
) {
  let permissions =
    {};

  try {
    permissions =
      JSON.parse(
        row.snapshot_permissions_json ||
        "{}"
      );

  } catch {
    permissions =
      {};
  }

  return {
    id:
      row.user_id,

    displayName:
      row.snapshot_display_name,

    role:
      "uploader",

    permissions:
      normalizePermissions(
        "uploader",
        permissions
      ),

    originalStatus:
      row.original_status,

    deletedAt:
      Number(
        row.deleted_at
      ),

    purgeAfter:
      Number(
        row.purge_after
      ),

    deletedByUserId:
      row.deleted_by_user_id,

    restoredAt:
      row.restored_at ===
        null
        ? null
        : Number(
            row.restored_at
          )
  };
}


async function handleListDeletedUsers(
  env,
  auth
) {
  requireOwnerUserManagement(
    auth
  );

  const result =
    await env.AUTH_DB
      .prepare(`
        SELECT
          d.user_id,
          d.snapshot_display_name,
          d.snapshot_permissions_json,
          d.original_status,
          d.deleted_at,
          d.purge_after,
          d.deleted_by_user_id,
          d.restored_at

        FROM user_deletions d

        INNER JOIN users u
          ON u.id =
             d.user_id

        WHERE
          d.restored_at IS NULL

        AND
          u.role =
            'uploader'

        ORDER BY
          d.deleted_at DESC
      `)
      .all();

  return jsonResponse({
    users:
      (
        result.results ||
        []
      )
        .map(
          publicDeletedUser
        )
  });
}


async function handleDeleteUser(
  request,
  env,
  auth,
  userId
) {
  requireOwnerUserManagement(
    auth
  );

  requireSameOrigin(
    request
  );

  const target =
    await env.AUTH_DB
      .prepare(`
        SELECT
          id,
          display_name,
          role,
          permissions_json,
          status

        FROM users

        WHERE
          id = ?

        LIMIT 1
      `)
      .bind(
        userId
      )
      .first();

  if (
    !target
  ) {
    throw new HttpError(
      404,
      "user_not_found"
    );
  }

  if (
    target.role ===
    "owner"
  ) {
    throw new HttpError(
      403,
      "owner_is_immutable"
    );
  }

  const existingDeletion =
    await env.AUTH_DB
      .prepare(`
        SELECT user_id

        FROM user_deletions

        WHERE
          user_id = ?
          AND restored_at IS NULL

        LIMIT 1
      `)
      .bind(
        userId
      )
      .first();

  if (
    existingDeletion
  ) {
    throw new HttpError(
      409,
      "user_already_deleted"
    );
  }

  const now =
    nowSeconds();

  const purgeAfter =
    now +
    USER_TRASH_RETENTION_SECONDS;

  const context =
    await auditContext(
      request,
      env,
      auth
    );

  const results =
    await env.AUTH_DB
      .batch([

        env.AUTH_DB
          .prepare(`
            UPDATE users

            SET
              status =
                'disabled',

              updated_at =
                ?

            WHERE
              id = ?

            AND
              role =
                'uploader'
          `)
          .bind(
            now,
            userId
          ),


        env.AUTH_DB
          .prepare(`
            UPDATE sessions

            SET
              revoked_at =
                COALESCE(
                  revoked_at,
                  ?
                )

            WHERE
              user_id = ?

            AND
              revoked_at IS NULL
          `)
          .bind(
            now,
            userId
          ),


        env.AUTH_DB
          .prepare(`
            DELETE FROM device_links
            WHERE user_id = ?
          `)
          .bind(
            userId
          ),


        env.AUTH_DB
          .prepare(`
            DELETE FROM recovery_codes
            WHERE user_id = ?
          `)
          .bind(
            userId
          ),


        env.AUTH_DB
          .prepare(`
            UPDATE passkey_credentials

            SET
              revoked_at =
                COALESCE(
                  revoked_at,
                  ?
                )

            WHERE
              user_id = ?

            AND
              revoked_at IS NULL
          `)
          .bind(
            now,
            userId
          ),


        env.AUTH_DB
          .prepare(`
            INSERT INTO user_deletions (
              user_id,
              snapshot_display_name,
              snapshot_permissions_json,
              original_status,
              deleted_at,
              purge_after,
              deleted_by_user_id,
              restored_at,
              restored_by_user_id
            )

            VALUES (
              ?, ?, ?, ?, ?, ?, ?, NULL, NULL
            )

            ON CONFLICT(
              user_id
            )
            DO UPDATE SET

              snapshot_display_name =
                excluded.snapshot_display_name,

              snapshot_permissions_json =
                excluded.snapshot_permissions_json,

              original_status =
                excluded.original_status,

              deleted_at =
                excluded.deleted_at,

              purge_after =
                excluded.purge_after,

              deleted_by_user_id =
                excluded.deleted_by_user_id,

              restored_at =
                NULL,

              restored_by_user_id =
                NULL
          `)
          .bind(
            userId,
            target.display_name,
            target.permissions_json,
            target.status,
            now,
            purgeAfter,
            auth.user.id
          ),


        auditStatement(
          env,
          {
            ...context,

            action:
              "user.delete",

            targetType:
              "user",

            targetId:
              userId,

            metadata: {
              displayName:
                target.display_name,

              previousStatus:
                target.status,

              purgeAfter,

              mediaPreserved:
                true,

              uploadHistoryPreserved:
                true
            },

            createdAt:
              now
          }
        )
      ]);

  if (
    changes(
      results[0]
    ) !==
    1
  ) {
    throw new HttpError(
      409,
      "user_delete_failed"
    );
  }

  return jsonResponse({
    ok:
      true,

    userId,

    deletedAt:
      now,

    purgeAfter,

    mediaPreserved:
      true
  });
}


async function handleRestoreUser(
  request,
  env,
  auth,
  userId
) {
  requireOwnerUserManagement(
    auth
  );

  requireSameOrigin(
    request
  );

  const deletion =
    await env.AUTH_DB
      .prepare(`
        SELECT
          d.user_id,
          d.snapshot_display_name,
          d.snapshot_permissions_json,
          d.original_status,
          d.deleted_at,
          d.purge_after,
          d.restored_at,
          u.role

        FROM user_deletions d

        INNER JOIN users u
          ON u.id =
             d.user_id

        WHERE
          d.user_id = ?

        AND
          d.restored_at IS NULL

        LIMIT 1
      `)
      .bind(
        userId
      )
      .first();

  if (
    !deletion
  ) {
    throw new HttpError(
      404,
      "deleted_user_not_found"
    );
  }

  if (
    deletion.role ===
    "owner"
  ) {
    throw new HttpError(
      403,
      "owner_is_immutable"
    );
  }

  const now =
    nowSeconds();

  const context =
    await auditContext(
      request,
      env,
      auth
    );

  const results =
    await env.AUTH_DB
      .batch([

        env.AUTH_DB
          .prepare(`
            UPDATE users

            SET
              display_name =
                ?,

              permissions_json =
                ?,

              status =
                'active',

              updated_at =
                ?

            WHERE
              id = ?

            AND
              role =
                'uploader'
          `)
          .bind(
            deletion
              .snapshot_display_name,

            deletion
              .snapshot_permissions_json,

            now,

            userId
          ),


        env.AUTH_DB
          .prepare(`
            UPDATE user_deletions

            SET
              restored_at =
                ?,

              restored_by_user_id =
                ?

            WHERE
              user_id = ?

            AND
              restored_at IS NULL
          `)
          .bind(
            now,
            auth.user.id,
            userId
          ),


        auditStatement(
          env,
          {
            ...context,

            action:
              "user.restore",

            targetType:
              "user",

            targetId:
              userId,

            metadata: {
              displayName:
                deletion
                  .snapshot_display_name,

              oldSessionsRestored:
                false,

              oldPasskeysRestored:
                false
            },

            createdAt:
              now
          }
        )
      ]);

  if (
    changes(
      results[0]
    ) !== 1 ||
    changes(
      results[1]
    ) !== 1
  ) {
    throw new HttpError(
      409,
      "user_restore_failed"
    );
  }

  return jsonResponse({
    ok:
      true,

    userId,

    restoredAt:
      now,

    requiresNewLogin:
      true
  });
}


async function handlePurgeUser(
  request,
  env,
  auth,
  userId
) {
  requireOwnerUserManagement(
    auth
  );

  requireSameOrigin(
    request
  );

  const deletion =
    await env.AUTH_DB
      .prepare(`
        SELECT
          d.user_id,
          d.snapshot_display_name,
          u.role

        FROM user_deletions d

        INNER JOIN users u
          ON u.id =
             d.user_id

        WHERE
          d.user_id = ?

        AND
          d.restored_at IS NULL

        LIMIT 1
      `)
      .bind(
        userId
      )
      .first();

  if (
    !deletion
  ) {
    throw new HttpError(
      404,
      "deleted_user_not_found"
    );
  }

  if (
    deletion.role ===
    "owner"
  ) {
    throw new HttpError(
      403,
      "owner_is_immutable"
    );
  }

  const context =
    await auditContext(
      request,
      env,
      auth
    );

  const now =
    nowSeconds();


  /*
   * MEDIA_DB 与 AUTH_DB 是两个独立 D1。
   *
   * 永久删除账号时：
   * - 不删除用户曾经上传的媒体；
   * - 把媒体上传者匿名化；
   * - 删除该用户自己的收藏与分组；
   * - 清除跨数据库残留 user id。
   */
  await env.MEDIA_DB
    .batch([

      env.MEDIA_DB
        .prepare(`
          UPDATE media

          SET
            uploader_user_id = NULL,
            updated_at = ?

          WHERE
            uploader_user_id = ?
        `)
        .bind(
          now,
          userId
        ),


      env.MEDIA_DB
        .prepare(`
          DELETE FROM media_favorites
          WHERE user_id = ?
        `)
        .bind(
          userId
        ),


      env.MEDIA_DB
        .prepare(`
          DELETE FROM collections
          WHERE owner_user_id = ?
        `)
        .bind(
          userId
        ),


      env.MEDIA_DB
        .prepare(`
          UPDATE collection_items
          SET added_by_user_id = NULL
          WHERE added_by_user_id = ?
        `)
        .bind(
          userId
        ),


      env.MEDIA_DB
        .prepare(`
          UPDATE media_tags
          SET created_by_user_id = NULL
          WHERE created_by_user_id = ?
        `)
        .bind(
          userId
        ),


      env.MEDIA_DB
        .prepare(`
          UPDATE media_events
          SET actor_user_id = NULL
          WHERE actor_user_id = ?
        `)
        .bind(
          userId
        )
    ]);


  const result =
    await env.AUTH_DB
      .prepare(`
        DELETE FROM users

        WHERE
          id = ?
          AND role = 'uploader'
      `)
      .bind(
        userId
      )
      .run();


  if (
    changes(
      result
    ) !== 1
  ) {
    throw new HttpError(
      409,
      "user_purge_failed"
    );
  }


  await auditStatement(
    env,
    {
      ...context,

      action:
        "user.purge",

      targetType:
        "user",

      targetId:
        userId,

      metadata: {
        displayName:
          deletion
            .snapshot_display_name,

        permanent:
          true,

        mediaPreserved:
          true,

        mediaOwnershipAnonymized:
          true,

        uploadHistoryDeleted:
          true
      },

      createdAt:
        now
    }
  )
    .run();


  return jsonResponse({
    ok:
      true,

    userId,

    permanent:
      true,

    mediaPreserved:
      true,

    mediaOwnershipAnonymized:
      true,

    uploadHistoryDeleted:
      true
  });
}


export function isAdminUserLifecyclePath(
  pathname
) {
  if (
    pathname ===
    "/api/admin/deleted-users"
  ) {
    return true;
  }

  if (
    /^\/api\/admin\/users\/[^/]+$/
      .test(
        pathname
      )
  ) {
    return true;
  }

  if (
    /^\/api\/admin\/deleted-users\/[^/]+\/restore$/
      .test(
        pathname
      )
  ) {
    return true;
  }

  if (
    /^\/api\/admin\/deleted-users\/[^/]+\/purge$/
      .test(
        pathname
      )
  ) {
    return true;
  }

  return false;
}


export async function handleAdminUserLifecycleRequest(
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
    "/api/admin/deleted-users"
  ) {
    if (
      method !==
      "GET"
    ) {
      return methodNotAllowed([
        "GET"
      ]);
    }

    return handleListDeletedUsers(
      env,
      auth
    );
  }


  const userMatch =
    pathname.match(
      /^\/api\/admin\/users\/([^/]+)$/
    );

  if (
    userMatch &&
    method ===
      "DELETE"
  ) {
    return handleDeleteUser(
      request,
      env,
      auth,
      decodeURIComponent(
        userMatch[1]
      )
    );
  }


  const restoreMatch =
    pathname.match(
      /^\/api\/admin\/deleted-users\/([^/]+)\/restore$/
    );

  if (
    restoreMatch
  ) {
    if (
      method !==
      "POST"
    ) {
      return methodNotAllowed([
        "POST"
      ]);
    }

    return handleRestoreUser(
      request,
      env,
      auth,
      decodeURIComponent(
        restoreMatch[1]
      )
    );
  }


  const purgeMatch =
    pathname.match(
      /^\/api\/admin\/deleted-users\/([^/]+)\/purge$/
    );

  if (
    purgeMatch
  ) {
    if (
      method !==
      "DELETE"
    ) {
      return methodNotAllowed([
        "DELETE"
      ]);
    }

    return handlePurgeUser(
      request,
      env,
      auth,
      decodeURIComponent(
        purgeMatch[1]
      )
    );
  }


  return notFound();
}
