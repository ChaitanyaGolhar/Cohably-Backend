const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Generates a 6-character alphanumeric invite code.
 * Excludes ambiguous characters (0, O, 1, l, I) for readability.
 */
export function generateInviteCode(length: number = 6): string {
  let code = "";
  const randomBytes = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) {
    code += CHARS[randomBytes[i]! % CHARS.length];
  }
  return code;
}
