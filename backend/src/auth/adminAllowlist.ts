/**
 * Admin access is a fixed allowlist of Official Mail IDs, not a DB-driven
 * role — matches the size of this app (a handful of admins, if that) and
 * needs no migration path if the list changes; just update the env var.
 */
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.has(email.toLowerCase());
}
