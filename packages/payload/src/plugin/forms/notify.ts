/**
 * Whether `address` is one the site may send notifications to: an allowlist entry is an exact
 * address (`ops@example.com`) or a domain (`@example.com`). Comparison ignores case.
 */
export function isAllowedRecipient(address: string, allowlist: readonly string[]): boolean {
  const value = address.trim().toLowerCase();
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+$/.test(value)) return false;
  return allowlist.some((entry) => {
    const allowed = entry.trim().toLowerCase();
    return allowed.startsWith('@') ? value.endsWith(allowed) : value === allowed;
  });
}
