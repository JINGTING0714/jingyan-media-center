export const PERMISSION_KEYS = Object.freeze([
  "uploadImage",
  "uploadAudio",
  "uploadVideo",
  "deleteMedia",
  "editMedia",
  "manageUsers",
  "manageInvites",
  "manageRepositories",
  "manageSystem",
  "runMaintenance"
]);

export const OWNER_PERMISSIONS = Object.freeze(
  Object.fromEntries(PERMISSION_KEYS.map(key => [key, true]))
);

export const UPLOADER_PERMISSIONS = Object.freeze({
  uploadImage: true,
  uploadAudio: true,
  uploadVideo: true,
  deleteMedia: false,
  editMedia: false,
  manageUsers: false,
  manageInvites: false,
  manageRepositories: false,
  manageSystem: false,
  runMaintenance: false
});

export function normalizePermissions(role, input = {}) {
  if (role === "owner") return { ...OWNER_PERMISSIONS };

  const source =
    input && typeof input === "object" && !Array.isArray(input)
      ? input
      : {};

  const output = { ...UPLOADER_PERMISSIONS };

  for (const key of PERMISSION_KEYS) {
    if (typeof source[key] === "boolean") output[key] = source[key];
  }

  return output;
}

export function parsePermissions(role, value) {
  let parsed = {};

  if (typeof value === "string" && value) {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = {};
    }
  } else if (value && typeof value === "object") {
    parsed = value;
  }

  return normalizePermissions(role, parsed);
}

export function publicUser(row) {
  if (!row) return null;

  return {
    id: row.id,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    permissions: parsePermissions(row.role, row.permissions_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at
  };
}

function intSetting(env, key, fallback, min, max) {
  const raw = Number(env[key]);
  const value = Number.isFinite(raw) ? Math.trunc(raw) : fallback;
  return Math.min(max, Math.max(min, value));
}

export function getSessionTtlSeconds(env) {
  return intSetting(env, "SESSION_TTL_DAYS", 180, 1, 3650) * 86400;
}

export function getSessionRefreshSeconds(env) {
  return intSetting(env, "SESSION_REFRESH_HOURS", 24, 1, 720) * 3600;
}

export function getCookieName(env) {
  return (
    String(env.COOKIE_NAME || "jy_session")
      .replace(/[^A-Za-z0-9_-]/g, "") ||
    "jy_session"
  );
}
