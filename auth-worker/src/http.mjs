import {
  getCookieName,
  getSessionTtlSeconds
} from "./config.mjs";

export class HttpError extends Error {
  constructor(status, code, message = code) {
    super(message);

    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

function securityHeaders() {
  return {
    "Cache-Control": "no-store",

    "Content-Security-Policy":
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",

    "Referrer-Policy":
      "no-referrer",

    "X-Content-Type-Options":
      "nosniff",

    "X-Frame-Options":
      "DENY"
  };
}

export function jsonResponse(
  data,
  status = 200,
  extraHeaders = {}
) {
  return new Response(
    JSON.stringify(data),
    {
      status,

      headers: {
        "Content-Type":
          "application/json; charset=utf-8",

        ...securityHeaders(),
        ...extraHeaders
      }
    }
  );
}

export function htmlResponse(
  html,
  status = 200,
  extraHeaders = {}
) {
  return new Response(
    html,
    {
      status,

      headers: {
        "Content-Type":
          "text/html; charset=utf-8",

        "Cache-Control":
          "no-store",

        "Referrer-Policy":
          "no-referrer",

        "X-Content-Type-Options":
          "nosniff",

        "X-Frame-Options":
          "DENY",

        ...extraHeaders
      }
    }
  );
}

export async function readJson(
  request,
  maxBytes = 65536
) {
  const contentType =
    request.headers.get(
      "Content-Type"
    ) || "";

  if (
    !contentType
      .toLowerCase()
      .includes(
        "application/json"
      )
  ) {
    throw new HttpError(
      415,
      "content_type_required",
      "Content-Type must be application/json"
    );
  }

  const declared =
    Number(
      request.headers.get(
        "Content-Length"
      ) || 0
    );

  if (
    Number.isFinite(declared) &&
    declared > maxBytes
  ) {
    throw new HttpError(
      413,
      "request_too_large"
    );
  }

  const text =
    await request.text();

  if (
    new TextEncoder()
      .encode(text)
      .byteLength >
    maxBytes
  ) {
    throw new HttpError(
      413,
      "request_too_large"
    );
  }

  try {
    const parsed =
      JSON.parse(
        text || "{}"
      );

    if (
      !parsed ||
      typeof parsed !==
        "object" ||
      Array.isArray(parsed)
    ) {
      throw new Error(
        "Object required"
      );
    }

    return parsed;

  } catch {
    throw new HttpError(
      400,
      "invalid_json"
    );
  }
}

export function parseCookies(request) {
  const header =
    request.headers.get(
      "Cookie"
    ) || "";

  const output = {};

  for (
    const part
    of header.split(";")
  ) {
    const separator =
      part.indexOf("=");

    if (
      separator < 0
    ) {
      continue;
    }

    const key =
      part
        .slice(
          0,
          separator
        )
        .trim();

    const value =
      part
        .slice(
          separator + 1
        )
        .trim();

    if (key) {
      output[key] =
        value;
    }
  }

  return output;
}

export function getSessionTokenFromRequest(
  request,
  env
) {
  return (
    parseCookies(request)[
      getCookieName(env)
    ] ||
    null
  );
}

function sessionCookie(
  token,
  env,
  maxAge
) {
  return [
    `${getCookieName(env)}=${token}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAge}`
  ].join("; ");
}

function cloneWithCookie(
  response,
  cookie
) {
  const headers =
    new Headers(
      response.headers
    );

  headers.append(
    "Set-Cookie",
    cookie
  );

  return new Response(
    response.body,
    {
      status:
        response.status,

      statusText:
        response.statusText,

      headers
    }
  );
}

export function withSessionCookie(
  response,
  token,
  env
) {
  return cloneWithCookie(
    response,
    sessionCookie(
      token,
      env,
      getSessionTtlSeconds(env)
    )
  );
}

export function withClearedSessionCookie(
  response,
  env
) {
  return cloneWithCookie(
    response,
    sessionCookie(
      "",
      env,
      0
    )
  );
}

export function isSameOriginRequest(
  request
) {
  const url =
    new URL(
      request.url
    );

  const origin =
    request.headers.get(
      "Origin"
    );

  if (origin) {
    return (
      origin ===
      url.origin
    );
  }

  const fetchSite =
    request.headers.get(
      "Sec-Fetch-Site"
    );

  return (
    fetchSite ===
      "same-origin" ||
    fetchSite ===
      "none"
  );
}

export function requireSameOrigin(
  request
) {
  if (
    !isSameOriginRequest(
      request
    )
  ) {
    throw new HttpError(
      403,
      "origin_rejected"
    );
  }
}

export function methodNotAllowed(
  allowed
) {
  return jsonResponse(
    {
      error:
        "method_not_allowed"
    },
    405,
    {
      Allow:
        allowed.join(", ")
    }
  );
}

export function notFound() {
  return jsonResponse(
    {
      error:
        "not_found"
    },
    404
  );
}
