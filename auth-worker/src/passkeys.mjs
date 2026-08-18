import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from "@simplewebauthn/server";

import {
  HttpError,
  jsonResponse,
  readJson,
  requireSameOrigin,
  methodNotAllowed,
  notFound,
  withSessionCookie
} from "./http.mjs";

import {
  nowSeconds,
  generateSessionToken,
  hashSecret,
  getRequestFingerprint,
  createId
} from "./crypto.mjs";

import {
  getSessionTtlSeconds,
  publicUser
} from "./config.mjs";

import {
  auditStatement
} from "./db.mjs";


const DEFAULT_CHALLENGE_TTL_SECONDS =
  300;


/*
 * WebAuthn / COSE algorithms used for registration.
 *
 * -8   EdDSA
 * -7   ES256
 * -257 RS256
 *
 * Keep all three for broad desktop/mobile authenticator
 * compatibility.
 */
const REGISTRATION_ALGORITHM_IDS = [
  -8,
  -7,
  -257
];


function changes(
  result
) {
  return Number(
    result?.meta?.changes ||
    0
  );
}


function intSetting(
  env,
  key,
  fallback,
  min,
  max
) {
  const raw =
    Number(
      env[key]
    );

  const value =
    Number.isFinite(raw)
      ? Math.trunc(raw)
      : fallback;

  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );
}


function getRpName(
  env
) {
  return String(
    env.PASSKEY_RP_NAME ||
    "Jingyan Media Center"
  ).trim();
}


function getRpId(
  env
) {
  const value =
    String(
      env.PASSKEY_RP_ID ||
      ""
    ).trim();

  if (!value) {
    throw new Error(
      "PASSKEY_RP_ID missing"
    );
  }

  return value;
}


function getExpectedOrigin(
  env
) {
  const value =
    String(
      env.PASSKEY_ORIGIN ||
      ""
    )
      .trim()
      .replace(
        /\/+$/,
        ""
      );

  if (!value) {
    throw new Error(
      "PASSKEY_ORIGIN missing"
    );
  }

  return value;
}


function getChallengeTtlSeconds(
  env
) {
  return intSetting(
    env,
    "PASSKEY_CHALLENGE_TTL_SECONDS",
    DEFAULT_CHALLENGE_TTL_SECONDS,
    60,
    900
  );
}


function requireActiveUser(
  auth
) {
  if (
    !auth?.user ||
    !auth?.session ||
    auth.user.status !==
      "active"
  ) {
    throw new HttpError(
      403,
      "active_account_required"
    );
  }
}


function cleanLabel(
  value,
  fallback = "Passkey"
) {
  const text =
    String(
      value ||
      ""
    )
      .replace(
        /[\u0000-\u001f\u007f]/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim()
      .slice(
        0,
        80
      );

  return (
    text ||
    fallback
  );
}


function parseTransports(
  value
) {
  if (!value) {
    return [];
  }

  try {
    const parsed =
      JSON.parse(
        value
      );

    return Array.isArray(
      parsed
    )
      ? parsed.filter(
          item =>
            typeof item ===
            "string"
        )
      : [];

  } catch {
    return [];
  }
}


function cleanPreferredAuthenticatorType(
  value
) {
  const normalized =
    String(
      value ||
      ""
    ).trim();

  if (
    [
      "localDevice",
      "remoteDevice",
      "securityKey"
    ].includes(
      normalized
    )
  ) {
    return normalized;
  }

  return null;
}


function bytesToBase64Url(
  value
) {
  const bytes =
    value instanceof
    Uint8Array
      ? value
      : new Uint8Array(
          value
        );

  let binary =
    "";

  for (
    let index = 0;
    index < bytes.length;
    index += 1
  ) {
    binary +=
      String.fromCharCode(
        bytes[index]
      );
  }

  return btoa(
    binary
  )
    .replace(
      /\+/g,
      "-"
    )
    .replace(
      /\//g,
      "_"
    )
    .replace(
      /=+$/g,
      ""
    );
}


function base64UrlToBytes(
  value
) {
  let base64 =
    String(
      value ||
      ""
    )
      .replace(
        /-/g,
        "+"
      )
      .replace(
        /_/g,
        "/"
      );

  while (
    base64.length %
      4 !==
    0
  ) {
    base64 +=
      "=";
  }

  const binary =
    atob(
      base64
    );

  return Uint8Array.from(
    binary,
    character =>
      character
        .charCodeAt(
          0
        )
  );
}


async function enforcePublicPasskeyRateLimit(
  request,
  env
) {
  if (
    !env.AUTH_RATE_LIMITER
      ?.limit
  ) {
    throw new Error(
      "AUTH_RATE_LIMITER binding missing"
    );
  }

  const fingerprint =
    await getRequestFingerprint(
      request,
      env
    );

  const key =
    [
      "passkey-auth",

      String(
        fingerprint.ipHash ||
        "unknown-ip"
      ),

      String(
        fingerprint.userAgentHash ||
        "unknown-agent"
      ).slice(
        0,
        32
      )
    ].join(":");

  const result =
    await env
      .AUTH_RATE_LIMITER
      .limit({
        key
      });

  if (
    !result.success
  ) {
    throw new HttpError(
      429,
      "rate_limited"
    );
  }
}


async function cleanupChallenges(
  env
) {
  const cutoff =
    nowSeconds() -
    86400;

  await env.AUTH_DB
    .prepare(
      `
      DELETE FROM webauthn_challenges

      WHERE
        expires_at < ?

      OR (
        used_at IS NOT NULL
        AND used_at < ?
      )
      `
    )
    .bind(
      cutoff,
      cutoff
    )
    .run();
}


async function listActivePasskeyRows(
  env,
  userId
) {
  const result =
    await env.AUTH_DB
      .prepare(
        `
        SELECT

          id,
          user_id,
          credential_id,
          public_key_b64,
          webauthn_user_id,
          counter,
          device_type,
          backed_up,
          transports_json,
          aaguid,
          display_name,
          created_at,
          last_used_at,
          revoked_at,
          created_by_session_id

        FROM passkey_credentials

        WHERE
          user_id = ?
          AND revoked_at IS NULL

        ORDER BY
          created_at ASC
        `
      )
      .bind(
        userId
      )
      .all();

  return (
    result.results ||
    []
  );
}


function publicPasskey(
  row
) {
  return {
    id:
      row.id,

    displayName:
      row.display_name,

    deviceType:
      row.device_type ||
      null,

    backedUp:
      Boolean(
        row.backed_up
      ),

    transports:
      parseTransports(
        row.transports_json
      ),

    createdAt:
      Number(
        row.created_at
      ),

    lastUsedAt:
      row.last_used_at ===
        null ||
      row.last_used_at ===
        undefined
        ? null
        : Number(
            row.last_used_at
          )
  };
}


function publicPasskeyFromJoinedRow(
  row
) {
  return {
    id:
      row.passkey_id,

    displayName:
      row.passkey_display_name,

    deviceType:
      row.device_type ||
      null,

    backedUp:
      Boolean(
        row.backed_up
      ),

    transports:
      parseTransports(
        row.transports_json
      ),

    createdAt:
      Number(
        row.passkey_created_at
      ),

    lastUsedAt:
      row.passkey_last_used_at ===
        null ||
      row.passkey_last_used_at ===
        undefined
        ? null
        : Number(
            row.passkey_last_used_at
          )
  };
}


async function createChallenge(
  request,
  env,
  {
    purpose,
    challenge,
    userId = null,
    sessionId = null,
    webauthnUserId = null
  }
) {
  await cleanupChallenges(
    env
  );

  const now =
    nowSeconds();

  const fingerprint =
    await getRequestFingerprint(
      request,
      env
    );

  const id =
    createId(
      "wch"
    );

  await env.AUTH_DB
    .prepare(
      `
      INSERT INTO webauthn_challenges (

        id,
        purpose,
        user_id,
        session_id,
        challenge,
        webauthn_user_id,
        created_at,
        expires_at,
        used_at,
        ip_hash,
        user_agent_hash

      )

      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?
      )
      `
    )
    .bind(
      id,
      purpose,
      userId,
      sessionId,
      challenge,
      webauthnUserId,
      now,
      now +
        getChallengeTtlSeconds(
          env
        ),
      fingerprint.ipHash,
      fingerprint.userAgentHash
    )
    .run();

  return id;
}


async function claimChallenge(
  env,
  {
    id,
    purpose,
    userId = null,
    sessionId = null
  }
) {
  const challengeId =
    String(
      id ||
      ""
    ).trim();

  if (!challengeId) {
    throw new HttpError(
      400,
      "passkey_ceremony_id_required"
    );
  }

  const row =
    await env.AUTH_DB
      .prepare(
        `
        SELECT

          id,
          purpose,
          user_id,
          session_id,
          challenge,
          webauthn_user_id,
          created_at,
          expires_at,
          used_at

        FROM webauthn_challenges

        WHERE id = ?

        LIMIT 1
        `
      )
      .bind(
        challengeId
      )
      .first();

  const now =
    nowSeconds();

  if (
    !row ||
    row.purpose !==
      purpose ||
    row.used_at !==
      null ||
    Number(
      row.expires_at
    ) <=
      now
  ) {
    throw new HttpError(
      400,
      "passkey_ceremony_expired"
    );
  }

  if (
    userId !==
      null &&
    row.user_id !==
      userId
  ) {
    throw new HttpError(
      403,
      "passkey_ceremony_rejected"
    );
  }

  if (
    sessionId !==
      null &&
    row.session_id !==
      sessionId
  ) {
    throw new HttpError(
      403,
      "passkey_ceremony_rejected"
    );
  }

  const claimed =
    await env.AUTH_DB
      .prepare(
        `
        UPDATE webauthn_challenges

        SET used_at = ?

        WHERE
          id = ?
          AND used_at IS NULL
          AND expires_at > ?
        `
      )
      .bind(
        now,
        challengeId,
        now
      )
      .run();

  if (
    changes(
      claimed
    ) !==
    1
  ) {
    throw new HttpError(
      409,
      "passkey_ceremony_already_used"
    );
  }

  return row;
}


async function createRegistrationOptions(
  request,
  env,
  auth
) {
  requireActiveUser(
    auth
  );

  requireSameOrigin(
    request
  );

  const body =
    await readJson(
      request
    );

  const preferredAuthenticatorType =
    cleanPreferredAuthenticatorType(
      body.preferredAuthenticatorType
    );

  const passkeys =
    await listActivePasskeyRows(
      env,
      auth.user.id
    );

  const userIdBytes =
    new TextEncoder()
      .encode(
        auth.user.id
      );

  const optionInput = {
    rpName:
      getRpName(
        env
      ),

    rpID:
      getRpId(
        env
      ),

    userName:
      auth.user.id,

    userDisplayName:
      auth.user.displayName,

    userID:
      userIdBytes,

    attestationType:
      "none",

    excludeCredentials:
      passkeys.map(
        passkey => ({
          id:
            passkey.credential_id,

          transports:
            parseTransports(
              passkey.transports_json
            )
        })
      ),

    authenticatorSelection: {
      residentKey:
        "required",

      userVerification:
        "required"
    },

    supportedAlgorithmIDs:
      REGISTRATION_ALGORITHM_IDS
  };

  if (
    preferredAuthenticatorType
  ) {
    optionInput.preferredAuthenticatorType =
      preferredAuthenticatorType;
  }

  const options =
    await generateRegistrationOptions(
      optionInput
    );

  const ceremonyId =
    await createChallenge(
      request,
      env,
      {
        purpose:
          "registration",

        challenge:
          options.challenge,

        userId:
          auth.user.id,

        sessionId:
          auth.session.id,

        webauthnUserId:
          options.user.id
      }
    );

  return jsonResponse({
    ceremonyId,
    options,
    preferredAuthenticatorType
  });
}


async function verifyRegistration(
  request,
  env,
  auth
) {
  requireActiveUser(
    auth
  );

  requireSameOrigin(
    request
  );

  const body =
    await readJson(
      request
    );

  const challenge =
    await claimChallenge(
      env,
      {
        id:
          body.ceremonyId,

        purpose:
          "registration",

        userId:
          auth.user.id,

        sessionId:
          auth.session.id
      }
    );

  if (
    !body.response ||
    typeof body.response !==
      "object"
  ) {
    throw new HttpError(
      400,
      "passkey_registration_response_required"
    );
  }

  let verification;

  try {
    verification =
      await verifyRegistrationResponse({
        response:
          body.response,

        expectedChallenge:
          challenge.challenge,

        expectedOrigin:
          getExpectedOrigin(
            env
          ),

        expectedRPID:
          getRpId(
            env
          ),

        requireUserVerification:
          true,

        supportedAlgorithmIDs:
          REGISTRATION_ALGORITHM_IDS
      });

  } catch (
    error
  ) {
    console.error(
      "Passkey registration verification failed:",
      error
    );

    throw new HttpError(
      400,
      "passkey_registration_failed"
    );
  }

  if (
    !verification.verified ||
    !verification.registrationInfo
  ) {
    throw new HttpError(
      400,
      "passkey_registration_failed"
    );
  }

  const {
    credential,
    credentialDeviceType,
    credentialBackedUp,
    aaguid
  } =
    verification
      .registrationInfo;

  const existing =
    await env.AUTH_DB
      .prepare(
        `
        SELECT
          id,
          user_id,
          revoked_at

        FROM passkey_credentials

        WHERE credential_id = ?

        LIMIT 1
        `
      )
      .bind(
        credential.id
      )
      .first();

  if (
    existing
  ) {
    if (
      existing.user_id ===
        auth.user.id &&
      existing.revoked_at ===
        null
    ) {
      throw new HttpError(
        409,
        "passkey_already_registered"
      );
    }

    throw new HttpError(
      409,
      "passkey_credential_conflict"
    );
  }

  const now =
    nowSeconds();

  const id =
    createId(
      "pk"
    );

  const currentPasskeys =
    await listActivePasskeyRows(
      env,
      auth.user.id
    );

  const displayName =
    cleanLabel(
      body.displayName,
      `Passkey ${
        currentPasskeys.length +
        1
      }`
    );

  const transports =
    Array.isArray(
      credential.transports
    )
      ? credential.transports
      : [];

  const fingerprint =
    await getRequestFingerprint(
      request,
      env
    );

  await env.AUTH_DB
    .batch([
      env.AUTH_DB
        .prepare(
          `
          INSERT INTO passkey_credentials (

            id,
            user_id,
            credential_id,
            public_key_b64,
            webauthn_user_id,
            counter,
            device_type,
            backed_up,
            transports_json,
            aaguid,
            display_name,
            created_at,
            last_used_at,
            revoked_at,
            created_by_session_id

          )

          VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?
          )
          `
        )
        .bind(
          id,
          auth.user.id,
          credential.id,
          bytesToBase64Url(
            credential.publicKey
          ),
          challenge.webauthn_user_id,
          Number(
            credential.counter ||
            0
          ),
          credentialDeviceType ||
            null,
          credentialBackedUp
            ? 1
            : 0,
          JSON.stringify(
            transports
          ),
          aaguid ||
            null,
          displayName,
          now,
          auth.session.id
        ),

      auditStatement(
        env,
        {
          actorUserId:
            auth.user.id,

          actorSessionId:
            auth.session.id,

          action:
            "passkey.register",

          targetType:
            "passkey",

          targetId:
            id,

          metadata: {
            displayName,

            deviceType:
              credentialDeviceType ||
              null,

            backedUp:
              Boolean(
                credentialBackedUp
              )
          },

          ipHash:
            fingerprint.ipHash,

          createdAt:
            now
        }
      )
    ]);

  const row =
    await env.AUTH_DB
      .prepare(
        `
        SELECT *

        FROM passkey_credentials

        WHERE id = ?

        LIMIT 1
        `
      )
      .bind(
        id
      )
      .first();

  return jsonResponse({
    verified:
      true,

    passkey:
      publicPasskey(
        row
      )
  });
}


async function getCredentialForAuthentication(
  env,
  credentialId
) {
  return env.AUTH_DB
    .prepare(
      `
      SELECT

        p.id
          AS passkey_id,

        p.user_id
          AS passkey_user_id,

        p.credential_id,

        p.public_key_b64,

        p.webauthn_user_id,

        p.counter,

        p.device_type,

        p.backed_up,

        p.transports_json,

        p.aaguid,

        p.display_name
          AS passkey_display_name,

        p.created_at
          AS passkey_created_at,

        p.last_used_at
          AS passkey_last_used_at,

        p.revoked_at
          AS passkey_revoked_at,

        u.id,

        u.display_name,

        u.role,

        u.permissions_json,

        u.status,

        u.created_at,

        u.updated_at,

        u.last_login_at,

        u.created_by_user_id

      FROM passkey_credentials p

      INNER JOIN users u
        ON u.id = p.user_id

      WHERE

        p.credential_id = ?

        AND
          p.revoked_at IS NULL

        AND
          u.status = 'active'

      LIMIT 1
      `
    )
    .bind(
      credentialId
    )
    .first();
}


async function verifyCredentialAssertion(
  env,
  bodyResponse,
  challenge,
  expectedUserId = null
) {
  if (
    !bodyResponse ||
    typeof bodyResponse !==
      "object" ||
    !bodyResponse.id
  ) {
    throw new HttpError(
      400,
      "passkey_authentication_response_required"
    );
  }

  const row =
    await getCredentialForAuthentication(
      env,
      String(
        bodyResponse.id
      )
    );

  if (!row) {
    throw new HttpError(
      401,
      "passkey_authentication_failed"
    );
  }

  if (
    expectedUserId !==
      null &&
    row.id !==
      expectedUserId
  ) {
    throw new HttpError(
      403,
      "passkey_wrong_account"
    );
  }

  let verification;

  try {
    verification =
      await verifyAuthenticationResponse({
        response:
          bodyResponse,

        expectedChallenge:
          challenge.challenge,

        expectedOrigin:
          getExpectedOrigin(
            env
          ),

        expectedRPID:
          getRpId(
            env
          ),

        credential: {
          id:
            row.credential_id,

          publicKey:
            base64UrlToBytes(
              row.public_key_b64
            ),

          counter:
            Number(
              row.counter ||
              0
            ),

          transports:
            parseTransports(
              row.transports_json
            )
        },

        requireUserVerification:
          true
      });

  } catch (
    error
  ) {
    console.error(
      "Passkey authentication verification failed:",
      error
    );

    throw new HttpError(
      401,
      "passkey_authentication_failed"
    );
  }

  if (
    !verification.verified ||
    !verification.authenticationInfo
  ) {
    throw new HttpError(
      401,
      "passkey_authentication_failed"
    );
  }

  return {
    row,
    verification
  };
}


async function createPublicAuthenticationOptions(
  request,
  env
) {
  requireSameOrigin(
    request
  );

  await enforcePublicPasskeyRateLimit(
    request,
    env
  );

  const options =
    await generateAuthenticationOptions({
      rpID:
        getRpId(
          env
        ),

      userVerification:
        "required"
    });

  const ceremonyId =
    await createChallenge(
      request,
      env,
      {
        purpose:
          "authentication",

        challenge:
          options.challenge
      }
    );

  return jsonResponse({
    ceremonyId,
    options
  });
}


async function verifyPublicAuthentication(
  request,
  env
) {
  requireSameOrigin(
    request
  );

  const body =
    await readJson(
      request
    );

  const challenge =
    await claimChallenge(
      env,
      {
        id:
          body.ceremonyId,

        purpose:
          "authentication"
      }
    );

  const {
    row,
    verification
  } =
    await verifyCredentialAssertion(
      env,
      body.response,
      challenge,
      null
    );

  const now =
    nowSeconds();

  const sessionId =
    createId(
      "ses"
    );

  const rawToken =
    generateSessionToken();

  const tokenHash =
    await hashSecret(
      env,
      "session",
      rawToken
    );

  const fingerprint =
    await getRequestFingerprint(
      request,
      env
    );

  const expiresAt =
    now +
    getSessionTtlSeconds(
      env
    );

  const suppliedDevice =
    cleanLabel(
      body.deviceLabel,
      "Device"
    );

  const sessionPrefix =
    row.role ===
    "owner"
      ? "Owner Passkey"
      : "Passkey";

  const sessionLabel =
    cleanLabel(
      `${sessionPrefix} · ${suppliedDevice}`,
      sessionPrefix
    );

  await env.AUTH_DB
    .batch([
      env.AUTH_DB
        .prepare(
          `
          INSERT INTO sessions (

            id,
            user_id,
            token_hash,
            created_at,
            last_seen_at,
            expires_at,
            revoked_at,
            ip_hash,
            user_agent_hash,
            device_label

          )

          VALUES (
            ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?
          )
          `
        )
        .bind(
          sessionId,
          row.id,
          tokenHash,
          now,
          now,
          expiresAt,
          fingerprint.ipHash,
          fingerprint.userAgentHash,
          sessionLabel
        ),

      env.AUTH_DB
        .prepare(
          `
          UPDATE users

          SET
            last_login_at = ?,
            updated_at = ?

          WHERE id = ?
          `
        )
        .bind(
          now,
          now,
          row.id
        ),

      env.AUTH_DB
        .prepare(
          `
          UPDATE passkey_credentials

          SET
            counter = ?,
            last_used_at = ?

          WHERE
            id = ?
            AND revoked_at IS NULL
          `
        )
        .bind(
          Number(
            verification
              .authenticationInfo
              .newCounter ||
            0
          ),
          now,
          row.passkey_id
        ),

      auditStatement(
        env,
        {
          actorUserId:
            row.id,

          actorSessionId:
            sessionId,

          action:
            "passkey.login",

          targetType:
            "passkey",

          targetId:
            row.passkey_id,

          metadata: {
            displayName:
              row.passkey_display_name,

            sessionLabel
          },

          ipHash:
            fingerprint.ipHash,

          createdAt:
            now
        }
      )
    ]);

  const response =
    jsonResponse({
      ok:
        true,

      authenticated:
        true,

      user:
        publicUser({
          ...row,
          last_login_at:
            now,
          updated_at:
            now
        }),

      passkey:
        publicPasskeyFromJoinedRow({
          ...row,
          passkey_last_used_at:
            now
        }),

      session: {
        id:
          sessionId,

        createdAt:
          now,

        lastSeenAt:
          now,

        expiresAt,

        deviceLabel:
          sessionLabel
      }
    });

  return withSessionCookie(
    response,
    rawToken,
    env
  );
}


async function createPasskeyTestOptions(
  request,
  env,
  auth
) {
  requireActiveUser(
    auth
  );

  requireSameOrigin(
    request
  );

  const passkeys =
    await listActivePasskeyRows(
      env,
      auth.user.id
    );

  if (
    passkeys.length <
    1
  ) {
    throw new HttpError(
      409,
      "passkey_not_configured_for_user"
    );
  }

  const options =
    await generateAuthenticationOptions({
      rpID:
        getRpId(
          env
        ),

      userVerification:
        "required",

      allowCredentials:
        passkeys.map(
          passkey => ({
            id:
              passkey.credential_id,

            transports:
              parseTransports(
                passkey.transports_json
              )
          })
        )
    });

  const ceremonyId =
    await createChallenge(
      request,
      env,
      {
        purpose:
          "authentication",

        challenge:
          options.challenge,

        userId:
          auth.user.id,

        sessionId:
          auth.session.id
      }
    );

  return jsonResponse({
    ceremonyId,
    options
  });
}


async function verifyPasskeyTest(
  request,
  env,
  auth
) {
  requireActiveUser(
    auth
  );

  requireSameOrigin(
    request
  );

  const body =
    await readJson(
      request
    );

  const challenge =
    await claimChallenge(
      env,
      {
        id:
          body.ceremonyId,

        purpose:
          "authentication",

        userId:
          auth.user.id,

        sessionId:
          auth.session.id
      }
    );

  const {
    row,
    verification
  } =
    await verifyCredentialAssertion(
      env,
      body.response,
      challenge,
      auth.user.id
    );

  const now =
    nowSeconds();

  await env.AUTH_DB
    .prepare(
      `
      UPDATE passkey_credentials

      SET
        counter = ?,
        last_used_at = ?

      WHERE
        id = ?
        AND revoked_at IS NULL
      `
    )
    .bind(
      Number(
        verification
          .authenticationInfo
          .newCounter ||
        0
      ),
      now,
      row.passkey_id
    )
    .run();

  const fingerprint =
    await getRequestFingerprint(
      request,
      env
    );

  await auditStatement(
    env,
    {
      actorUserId:
        auth.user.id,

      actorSessionId:
        auth.session.id,

      action:
        "passkey.test",

      targetType:
        "passkey",

      targetId:
        row.passkey_id,

      metadata: {
        displayName:
          row.passkey_display_name
      },

      ipHash:
        fingerprint.ipHash,

      createdAt:
        now
    }
  ).run();

  return jsonResponse({
    verified:
      true,

    deviceCanUsePasskey:
      true,

    passkey:
      publicPasskeyFromJoinedRow({
        ...row,
        passkey_last_used_at:
          now
      })
  });
}


async function listPasskeys(
  env,
  auth
) {
  requireActiveUser(
    auth
  );

  const rows =
    await listActivePasskeyRows(
      env,
      auth.user.id
    );

  const passkeys =
    rows.map(
      publicPasskey
    );

  const hasBackedUpPasskey =
    passkeys.some(
      passkey =>
        passkey.backedUp
    );

  let securityStatus =
    "none";

  if (
    passkeys.length >
    0
  ) {
    securityStatus =
      hasBackedUpPasskey ||
      passkeys.length >=
        2
        ? "good"
        : "attention";
  }

  return jsonResponse({
    passkeys,

    role:
      auth.user.role,

    recommendedMinimum:
      auth.user.role ===
      "owner"
        ? 2
        : 1,

    hasBackedUpPasskey,

    securityStatus
  });
}


async function renamePasskey(
  request,
  env,
  auth,
  passkeyId
) {
  requireActiveUser(
    auth
  );

  requireSameOrigin(
    request
  );

  const body =
    await readJson(
      request
    );

  const displayName =
    cleanLabel(
      body.displayName,
      "Passkey"
    );

  const result =
    await env.AUTH_DB
      .prepare(
        `
        UPDATE passkey_credentials

        SET
          display_name = ?

        WHERE
          id = ?
          AND user_id = ?
          AND revoked_at IS NULL
        `
      )
      .bind(
        displayName,
        passkeyId,
        auth.user.id
      )
      .run();

  if (
    changes(
      result
    ) !==
    1
  ) {
    throw new HttpError(
      404,
      "passkey_not_found"
    );
  }

  const now =
    nowSeconds();

  const fingerprint =
    await getRequestFingerprint(
      request,
      env
    );

  await auditStatement(
    env,
    {
      actorUserId:
        auth.user.id,

      actorSessionId:
        auth.session.id,

      action:
        "passkey.rename",

      targetType:
        "passkey",

      targetId:
        passkeyId,

      metadata: {
        displayName
      },

      ipHash:
        fingerprint.ipHash,

      createdAt:
        now
    }
  ).run();

  return jsonResponse({
    ok:
      true,

    displayName
  });
}


async function revokePasskey(
  request,
  env,
  auth,
  passkeyId
) {
  requireActiveUser(
    auth
  );

  requireSameOrigin(
    request
  );

  const target =
    await env.AUTH_DB
      .prepare(
        `
        SELECT
          id,
          display_name

        FROM passkey_credentials

        WHERE
          id = ?
          AND user_id = ?
          AND revoked_at IS NULL

        LIMIT 1
        `
      )
      .bind(
        passkeyId,
        auth.user.id
      )
      .first();

  if (!target) {
    throw new HttpError(
      404,
      "passkey_not_found"
    );
  }

  if (
    auth.user.role ===
    "owner"
  ) {
    const countRow =
      await env.AUTH_DB
        .prepare(
          `
          SELECT
            COUNT(*) AS count

          FROM passkey_credentials

          WHERE
            user_id = ?
            AND revoked_at IS NULL
          `
        )
        .bind(
          auth.user.id
        )
        .first();

    if (
      Number(
        countRow?.count ||
        0
      ) <=
      1
    ) {
      throw new HttpError(
        409,
        "last_owner_passkey_cannot_be_removed"
      );
    }
  }

  const now =
    nowSeconds();

  const result =
    await env.AUTH_DB
      .prepare(
        `
        UPDATE passkey_credentials

        SET
          revoked_at = ?

        WHERE
          id = ?
          AND user_id = ?
          AND revoked_at IS NULL
        `
      )
      .bind(
        now,
        passkeyId,
        auth.user.id
      )
      .run();

  if (
    changes(
      result
    ) !==
    1
  ) {
    throw new HttpError(
      409,
      "passkey_revoke_conflict"
    );
  }

  const fingerprint =
    await getRequestFingerprint(
      request,
      env
    );

  await auditStatement(
    env,
    {
      actorUserId:
        auth.user.id,

      actorSessionId:
        auth.session.id,

      action:
        "passkey.revoke",

      targetType:
        "passkey",

      targetId:
        passkeyId,

      metadata: {
        displayName:
          target.display_name
      },

      ipHash:
        fingerprint.ipHash,

      createdAt:
        now
    }
  ).run();

  return jsonResponse({
    ok:
      true
  });
}


export function isPublicPasskeyApiPath(
  pathname
) {
  return [
    "/api/passkeys/authentication/options",
    "/api/passkeys/authentication/verify"
  ].includes(
    pathname
  );
}


export async function handlePasskeyApiRequest(
  request,
  env,
  auth = null
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
    "/api/passkeys/authentication/options"
  ) {
    if (
      method !==
      "POST"
    ) {
      return methodNotAllowed([
        "POST"
      ]);
    }

    return createPublicAuthenticationOptions(
      request,
      env
    );
  }


  if (
    pathname ===
    "/api/passkeys/authentication/verify"
  ) {
    if (
      method !==
      "POST"
    ) {
      return methodNotAllowed([
        "POST"
      ]);
    }

    return verifyPublicAuthentication(
      request,
      env
    );
  }


  if (
    pathname ===
    "/api/passkeys/test/options"
  ) {
    if (
      method !==
      "POST"
    ) {
      return methodNotAllowed([
        "POST"
      ]);
    }

    return createPasskeyTestOptions(
      request,
      env,
      auth
    );
  }


  if (
    pathname ===
    "/api/passkeys/test/verify"
  ) {
    if (
      method !==
      "POST"
    ) {
      return methodNotAllowed([
        "POST"
      ]);
    }

    return verifyPasskeyTest(
      request,
      env,
      auth
    );
  }


  if (
    pathname ===
    "/api/passkeys/registration/options"
  ) {
    if (
      method !==
      "POST"
    ) {
      return methodNotAllowed([
        "POST"
      ]);
    }

    return createRegistrationOptions(
      request,
      env,
      auth
    );
  }


  if (
    pathname ===
    "/api/passkeys/registration/verify"
  ) {
    if (
      method !==
      "POST"
    ) {
      return methodNotAllowed([
        "POST"
      ]);
    }

    return verifyRegistration(
      request,
      env,
      auth
    );
  }


  if (
    pathname ===
    "/api/passkeys"
  ) {
    if (
      method !==
      "GET"
    ) {
      return methodNotAllowed([
        "GET"
      ]);
    }

    return listPasskeys(
      env,
      auth
    );
  }


  const match =
    pathname.match(
      /^\/api\/passkeys\/([^/]+)$/
    );


  if (
    match
  ) {
    const passkeyId =
      decodeURIComponent(
        match[1]
      );


    if (
      method ===
      "PATCH"
    ) {
      return renamePasskey(
        request,
        env,
        auth,
        passkeyId
      );
    }


    if (
      method ===
      "DELETE"
    ) {
      return revokePasskey(
        request,
        env,
        auth,
        passkeyId
      );
    }


    return methodNotAllowed([
      "PATCH",
      "DELETE"
    ]);
  }


  return notFound();
}
