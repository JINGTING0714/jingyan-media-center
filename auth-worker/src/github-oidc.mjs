import {
  HttpError
} from "./http.mjs";


const ISSUER =
  "https://token.actions.githubusercontent.com";

const JWKS_URL =
  "https://token.actions.githubusercontent.com/.well-known/jwks";

const AUDIENCE =
  "jingyan-media-upload";


let cachedKeys =
  new Map();

let cachedUntil =
  0;


function decodeBase64Url(
  value
) {

  let base64 =
    String(
      value || ""
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
        .charCodeAt(0)

  );

}


function decodeJsonSegment(
  value
) {

  try {

    return JSON.parse(

      new TextDecoder()
        .decode(
          decodeBase64Url(
            value
          )
        )

    );

  } catch {

    throw new HttpError(
      401,
      "invalid_github_oidc"
    );

  }

}


async function refreshKeys() {

  const response =
    await fetch(
      JWKS_URL,
      {
        headers: {
          Accept:
            "application/json"
        }
      }
    );


  if (
    !response.ok
  ) {

    throw new HttpError(
      502,
      "github_oidc_jwks_unavailable"
    );

  }


  const data =
    await response.json();


  const next =
    new Map();


  for (
    const key
    of (
      data.keys ||
      []
    )
  ) {

    if (
      key.kid
    ) {

      next.set(
        key.kid,
        key
      );

    }

  }


  cachedKeys =
    next;


  cachedUntil =
    Date.now() +
    60 *
    60 *
    1000;

}


async function getSigningKey(
  kid
) {

  if (
    Date.now() >
      cachedUntil ||
    !cachedKeys.size
  ) {

    await refreshKeys();

  }


  let jwk =
    cachedKeys.get(
      kid
    );


  if (!jwk) {

    await refreshKeys();


    jwk =
      cachedKeys.get(
        kid
      );

  }


  if (!jwk) {

    throw new HttpError(
      401,
      "github_oidc_key_not_found"
    );

  }


  return crypto.subtle
    .importKey(

      "jwk",

      jwk,

      {
        name:
          "RSASSA-PKCS1-v1_5",

        hash:
          "SHA-256"
      },

      false,

      [
        "verify"
      ]

    );

}


function audienceMatches(
  value
) {

  if (
    Array.isArray(
      value
    )
  ) {

    return value
      .includes(
        AUDIENCE
      );

  }


  return (
    value ===
    AUDIENCE
  );

}


function expectedWorkflowRef(
  env
) {

  const repository =
    `${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;


  return (
    repository +
    "/.github/workflows/" +
    env.GITHUB_UPLOAD_WORKFLOW +
    "@refs/heads/" +
    env.GITHUB_UPLOAD_REF
  );

}


export async function verifyGitHubOidc(
  request,
  env
) {

  const authorization =
    String(
      request.headers.get(
        "Authorization"
      ) ||
      ""
    );


  if (
    !authorization.startsWith(
      "Bearer "
    )
  ) {

    throw new HttpError(
      401,
      "github_oidc_required"
    );

  }


  const token =
    authorization
      .slice(7)
      .trim();


  const parts =
    token.split(
      "."
    );


  if (
    parts.length !==
    3
  ) {

    throw new HttpError(
      401,
      "invalid_github_oidc"
    );

  }


  const header =
    decodeJsonSegment(
      parts[0]
    );


  const payload =
    decodeJsonSegment(
      parts[1]
    );


  if (
    header.alg !==
      "RS256" ||
    !header.kid
  ) {

    throw new HttpError(
      401,
      "invalid_github_oidc"
    );

  }


  const key =
    await getSigningKey(
      header.kid
    );


  const signedData =
    new TextEncoder()
      .encode(
        `${parts[0]}.${parts[1]}`
      );


  const valid =
    await crypto.subtle
      .verify(

        {
          name:
            "RSASSA-PKCS1-v1_5"
        },

        key,

        decodeBase64Url(
          parts[2]
        ),

        signedData

      );


  if (!valid) {

    throw new HttpError(
      401,
      "invalid_github_oidc_signature"
    );

  }


  const now =
    Math.floor(
      Date.now() /
      1000
    );


  if (
    payload.iss !==
      ISSUER ||

    !audienceMatches(
      payload.aud
    ) ||

    !Number.isFinite(
      Number(
        payload.exp
      )
    ) ||

    Number(
      payload.exp
    ) <=
      now ||

    (
      payload.nbf !==
        undefined &&

      Number(
        payload.nbf
      ) >
        now + 30
    )
  ) {

    throw new HttpError(
      401,
      "invalid_github_oidc_claims"
    );

  }


  const repository =
    `${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;


  if (
    payload.repository !==
      repository ||

    payload.event_name !==
      "workflow_dispatch" ||

    payload.ref !==
      `refs/heads/${env.GITHUB_UPLOAD_REF}` ||

    payload.workflow_ref !==
      expectedWorkflowRef(
        env
      )
  ) {

    throw new HttpError(
      403,
      "github_workflow_rejected"
    );

  }


  const runId =
    Number(
      payload.run_id
    );


  if (
    !Number.isSafeInteger(
      runId
    ) ||
    runId <=
      0
  ) {

    throw new HttpError(
      401,
      "invalid_github_run_id"
    );

  }


  return {
    ...payload,
    runId
  };

}
