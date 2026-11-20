/**
 * Returns a user-supplied link only when it is an http(s) URL, so stored values
 * (including rows saved before validation was tightened) can never render as
 * `javascript:` or `data:` hrefs. Safe to use from server and client components.
 */
export function safeExternalHref(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
