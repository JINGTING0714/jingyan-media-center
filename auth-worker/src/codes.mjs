const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function alphabetCode(length) {
  return Array.from(
    randomBytes(length),
    value => CODE_ALPHABET[value & 31]
  ).join("");
}

function group(raw, size) {
  const parts = [];

  for (
    let index = 0;
    index < raw.length;
    index += size
  ) {
    parts.push(
      raw.slice(
        index,
        index + size
      )
    );
  }

  return parts.join("-");
}

export function generateInviteCode() {
  return (
    "JY-" +
    group(
      alphabetCode(20),
      5
    )
  );
}

export function generateRecoveryCode() {
  return (
    "JYR-" +
    group(
      alphabetCode(16),
      4
    )
  );
}

export function generatePairingCode() {
  const digits = [];

  while (
    digits.length <
    6
  ) {
    for (
      const value
      of randomBytes(8)
    ) {
      if (
        value >=
        250
      ) {
        continue;
      }

      digits.push(
        String(
          value % 10
        )
      );

      if (
        digits.length ===
        6
      ) {
        break;
      }
    }
  }

  return digits.join("");
}

export function normalizePublicCode(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toUpperCase()
    .replace(
      /[\s_]+/g,
      "-"
    )
    .replace(
      /-+/g,
      "-"
    );
}

export function normalizePairingCode(
  value
) {
  return String(
    value || ""
  )
    .replace(
      /\D/g,
      ""
    )
    .slice(
      0,
      6
    );
}
