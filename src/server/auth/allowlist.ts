export function parseAllowedEmails(raw: string): Set<string> {
  return new Set(
    raw
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isEmailAllowed(
  email: string | null | undefined,
  allowed: Set<string>,
): boolean {
  if (!email) return false;
  return allowed.has(email.trim().toLowerCase());
}
