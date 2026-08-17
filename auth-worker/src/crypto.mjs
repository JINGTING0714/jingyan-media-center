const encoder = new TextEncoder();

let cachedPepper = null;
let cachedPepperKeyPromise = null;

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(value => value.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function getPepperKey(env) {
  const secret = String(env.AUTH_PEPPER || "");

  if (!secret) {
    throw new Error("AUTH_PEPPER secret missing");
  }

  if (cachedPepper === secret && cachedPepperKeyPromise) {
    return cachedPepperKeyPromise;
  }

  cachedPepper = secret;

  cachedPepperKeyPromise = crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  return cachedPepperKeyPromise;
}

export function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function generateSessionToken() {
  return bytesToBase64Url(randomBytes(32));
}

export async function hashSecret(env, purpose, value) {
  const key = await getPepperKey(env);

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${purpose}:${String(value || "")}`)
  );

  return bytesToHex(
    new Uint8Array(signature)
  );
}

export async function secureEqualText(left, right) {
  const [a, b] = await Promise.all([
    crypto.subtle.digest(
      "SHA-256",
      encoder.encode(String(left || ""))
    ),

    crypto.subtle.digest(
      "SHA-256",
      encoder.encode(String(right || ""))
    )
  ]);

  const leftBytes = new Uint8Array(a);
  const rightBytes = new Uint8Array(b);

  let difference = 0;

  for (let index = 0; index < leftBytes.length; index++) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }

  return difference === 0;
}

export async function getRequestFingerprint(request, env) {
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    "unknown";

  const userAgent =
    request.headers.get("User-Agent") ||
    "unknown";

  const [ipHash, userAgentHash] = await Promise.all([
    hashSecret(env, "ip", ip),
    hashSecret(env, "ua", userAgent)
  ]);

  return {
    ipHash,
    userAgentHash
  };
}

export function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}
