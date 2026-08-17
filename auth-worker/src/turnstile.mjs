import {
  HttpError
} from "./http.mjs";


export async function verifyTurnstile(
  request,
  env,
  token,
  expectedAction
) {

  if (
    String(
      env.TURNSTILE_REQUIRED ||
      "true"
    ).toLowerCase() ===
    "false"
  ) {

    return {
      success:
        true,

      bypassed:
        true
    };

  }


  const secret =
    String(
      env.TURNSTILE_SECRET ||
      ""
    ).trim();


  if (!secret) {

    throw new Error(
      "TURNSTILE_SECRET secret missing"
    );

  }


  const responseToken =
    String(
      token ||
      ""
    ).trim();


  if (
    !responseToken ||
    responseToken.length >
    2048
  ) {

    throw new HttpError(
      400,
      "turnstile_required"
    );

  }


  const body =
    new FormData();


  body.set(
    "secret",
    secret
  );


  body.set(
    "response",
    responseToken
  );


  body.set(
    "idempotency_key",
    crypto.randomUUID()
  );


  const remoteIp =
    request.headers.get(
      "CF-Connecting-IP"
    );


  if (remoteIp) {

    body.set(
      "remoteip",
      remoteIp
    );

  }


  const response =
    await fetch(

      "https://challenges.cloudflare.com/turnstile/v0/siteverify",

      {
        method:
          "POST",

        body
      }

    );


  if (
    !response.ok
  ) {

    throw new HttpError(
      502,
      "turnstile_service_error"
    );

  }


  const result =
    await response.json();


  if (
    !result.success
  ) {

    throw new HttpError(
      403,
      "turnstile_failed"
    );

  }


  const expectedHostname =
    String(
      env.TURNSTILE_EXPECTED_HOSTNAME ||
      ""
    ).trim();


  if (
    expectedHostname &&
    result.hostname !==
      expectedHostname
  ) {

    throw new HttpError(
      403,
      "turnstile_hostname_mismatch"
    );

  }


  if (
    String(
      env.TURNSTILE_REQUIRE_ACTION ||
      "true"
    ).toLowerCase() !==
      "false" &&

    expectedAction &&

    result.action !==
      expectedAction
  ) {

    throw new HttpError(
      403,
      "turnstile_action_mismatch"
    );

  }


  return result;

}
