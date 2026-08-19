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


const AVATAR_MODES =
  new Set([
    "initial",
    "emoji",
    "media"
  ]);


function assertActiveUser(
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


function normalizeDisplayName(
  value
) {

  const text =
    String(
      value ??
      ""
    ).trim();


  if (
    !text ||
    Array.from(
      text
    ).length >
      40
  ) {

    throw new HttpError(
      400,
      "invalid_display_name"
    );

  }


  if (
    /[\u0000-\u001F\u007F<>]/u
      .test(
        text
      )
  ) {

    throw new HttpError(
      400,
      "invalid_display_name"
    );

  }


  return text;

}


function normalizeBio(
  value
) {

  const text =
    String(
      value ??
      ""
    )
      .replace(
        /\r\n?/g,
        "\n"
      )
      .trim();


  if (
    Array.from(
      text
    ).length >
      160
  ) {

    throw new HttpError(
      400,
      "profile_bio_too_long"
    );

  }


  if (
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u
      .test(
        text
      )
  ) {

    throw new HttpError(
      400,
      "profile_bio_invalid"
    );

  }


  return (
    text ||
    null
  );

}


function normalizeAvatarMode(
  value
) {

  const mode =
    String(
      value ||
      "initial"
    )
      .trim()
      .toLowerCase();


  if (
    !AVATAR_MODES.has(
      mode
    )
  ) {

    throw new HttpError(
      400,
      "invalid_avatar_mode"
    );

  }


  return mode;

}


function normalizeEmoji(
  value
) {

  const text =
    String(
      value ??
      ""
    ).trim();


  const length =
    Array.from(
      text
    ).length;


  if (
    !text ||
    length >
      12
  ) {

    throw new HttpError(
      400,
      "invalid_avatar_emoji"
    );

  }


  if (
    /[\u0000-\u001F\u007F<>]/u
      .test(
        text
      )
  ) {

    throw new HttpError(
      400,
      "invalid_avatar_emoji"
    );

  }


  return text;

}


function normalizeMediaId(
  value
) {

  const text =
    String(
      value ??
      ""
    ).trim();


  if (
    !text ||
    text.length >
      80 ||
    /[\u0000-\u001F\u007F]/u
      .test(
        text
      )
  ) {

    throw new HttpError(
      400,
      "invalid_avatar_media"
    );

  }


  return text;

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


async function getProfileRow(
  env,
  userId
) {

  return env.AUTH_DB
    .prepare(`
      SELECT
        id,
        display_name,
        role,
        status,
        profile_bio,
        avatar_mode,
        avatar_value,
        created_at,
        updated_at,
        last_login_at

      FROM users

      WHERE id = ?

      LIMIT 1
    `)
    .bind(
      userId
    )
    .first();

}


async function getAvatarMedia(
  env,
  userId,
  mediaId
) {

  if (
    !mediaId
  ) {

    return null;

  }


  return env.MEDIA_DB
    .prepare(`
      SELECT
        id,
        filename,
        original_name,
        display_title,
        cdn_url,
        size_bytes,
        added_at,
        published_at

      FROM media

      WHERE
        id = ?

      AND
        uploader_user_id = ?

      AND
        type = 'image'

      AND
        status = 'published'

      LIMIT 1
    `)
    .bind(
      mediaId,
      userId
    )
    .first();

}


async function serializeProfile(
  env,
  row,
  auth
) {

  let avatarMode =
    AVATAR_MODES.has(
      row.avatar_mode
    )
      ? row.avatar_mode
      : "initial";


  let avatarValue =
    row.avatar_value ||
    null;


  let avatarUrl =
    null;


  if (
    avatarMode ===
      "media"
  ) {

    const media =
      await getAvatarMedia(
        env,
        row.id,
        avatarValue
      );


    if (
      media?.cdn_url
    ) {

      avatarUrl =
        media.cdn_url;

    } else {

      avatarMode =
        "initial";

      avatarValue =
        null;

    }

  }


  if (
    avatarMode ===
      "initial"
  ) {

    avatarValue =
      null;

  }


  return {
    userId:
      row.id,

    displayName:
      row.display_name,

    role:
      row.role,

    status:
      row.status,

    bio:
      row.profile_bio ||
      "",

    avatar: {
      mode:
        avatarMode,

      value:
        avatarValue,

      url:
        avatarUrl
    },

    roleExpiresAt:
      null,

    ownerPermanent:
      row.role ===
        "owner",

    session: {
      expiresAt:
        auth?.session?.expiresAt
          ? toIso(
              auth.session.expiresAt
            )
          : null,

      rolling:
        true
    },

    createdAt:
      toIso(
        row.created_at
      ),

    updatedAt:
      toIso(
        row.updated_at
      ),

    lastLoginAt:
      toIso(
        row.last_login_at
      )
  };

}


async function getSettings(
  request,
  env,
  auth
) {

  assertActiveUser(
    auth
  );


  const row =
    await getProfileRow(
      env,
      auth.user.id
    );


  if (
    !row
  ) {

    throw new HttpError(
      404,
      "profile_not_found"
    );

  }


  return jsonResponse({
    profile:
      await serializeProfile(
        env,
        row,
        auth
      )
  });

}


async function listAvatarImages(
  request,
  env,
  auth
) {

  assertActiveUser(
    auth
  );


  const url =
    new URL(
      request.url
    );


  const limit =
    integerParam(
      url.searchParams.get(
        "limit"
      ),
      18,
      1,
      30
    );


  const result =
    await env.MEDIA_DB
      .prepare(`
        SELECT
          id,
          filename,
          original_name,
          display_title,
          cdn_url,
          size_bytes,
          added_at,
          published_at

        FROM media

        WHERE
          uploader_user_id = ?

        AND
          type = 'image'

        AND
          status = 'published'

        ORDER BY
          COALESCE(
            published_at,
            added_at,
            created_at
          ) DESC,

          id DESC

        LIMIT ?
      `)
      .bind(
        auth.user.id,
        limit
      )
      .all();


  return jsonResponse({
    items:
      (
        result.results ||
        []
      ).map(
        row => ({
          mediaId:
            row.id,

          title:
            row.display_title ||
            row.original_name ||
            row.filename ||
            row.id,

          filename:
            row.filename,

          url:
            row.cdn_url,

          sizeBytes:
            Number(
              row.size_bytes ||
              0
            ),

          publishedAt:
            toIso(
              row.published_at ||
              row.added_at
            )
        })
      )
  });

}


async function updateSettings(
  request,
  env,
  auth
) {

  assertActiveUser(
    auth
  );


  requireSameOrigin(
    request
  );


  const body =
    await readJson(
      request
    );


  const current =
    await getProfileRow(
      env,
      auth.user.id
    );


  if (
    !current
  ) {

    throw new HttpError(
      404,
      "profile_not_found"
    );

  }


  const displayName =
    normalizeDisplayName(
      body.displayName ??
      current.display_name
    );


  const bio =
    normalizeBio(
      body.bio ??
      current.profile_bio ??
      ""
    );


  const avatarMode =
    normalizeAvatarMode(
      body.avatarMode ??
      current.avatar_mode ??
      "initial"
    );


  let avatarValue =
    null;


  if (
    avatarMode ===
      "emoji"
  ) {

    avatarValue =
      normalizeEmoji(
        body.avatarValue ??
        current.avatar_value
      );

  }


  if (
    avatarMode ===
      "media"
  ) {

    avatarValue =
      normalizeMediaId(
        body.avatarValue ??
        current.avatar_value
      );


    const media =
      await getAvatarMedia(
        env,
        auth.user.id,
        avatarValue
      );


    if (
      !media
    ) {

      throw new HttpError(
        400,
        "invalid_avatar_media"
      );

    }

  }


  const now =
    nowSeconds();


  await env.AUTH_DB
    .prepare(`
      UPDATE users

      SET
        display_name = ?,
        profile_bio = ?,
        avatar_mode = ?,
        avatar_value = ?,
        updated_at = ?

      WHERE id = ?
    `)
    .bind(
      displayName,
      bio,
      avatarMode,
      avatarValue,
      now,
      auth.user.id
    )
    .run();


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
        ?,
        'profile.updated',
        'user',
        ?,
        ?,
        NULL,
        ?
      )
    `)
    .bind(
      createId(
        "aud"
      ),

      auth.user.id,

      auth.session?.id ||
      null,

      auth.user.id,

      JSON.stringify({
        displayNameChanged:
          displayName !==
          current.display_name,

        bioLength:
          Array.from(
            bio ||
            ""
          ).length,

        avatarMode
      }),

      now
    )
    .run();


  const updated =
    await getProfileRow(
      env,
      auth.user.id
    );


  return jsonResponse({
    ok:
      true,

    profile:
      await serializeProfile(
        env,
        updated,
        auth
      )
  });

}


export async function handleProfileSettingsRequest(
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
      "/api/profile/settings"
  ) {

    if (
      method ===
        "GET"
    ) {

      return getSettings(
        request,
        env,
        auth
      );

    }


    if (
      method ===
        "PATCH"
    ) {

      return updateSettings(
        request,
        env,
        auth
      );

    }


    return methodNotAllowed([
      "GET",
      "PATCH"
    ]);

  }


  if (
    url.pathname ===
      "/api/profile/settings/avatar-images"
  ) {

    if (
      method !==
        "GET"
    ) {

      return methodNotAllowed([
        "GET"
      ]);

    }


    return listAvatarImages(
      request,
      env,
      auth
    );

  }


  return notFound();

}
