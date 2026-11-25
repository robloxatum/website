/**
 * Only allow redirects back into this site (prevents open redirects through
 * ?next=https://evil.example). The result is the NORMALIZED path, and is
 * checked again afterwards: "/..//evil.com" normalizes to "//evil.com", which
 * a browser (or new URL(path, base)) treats as another host.
 */
export function safeNext(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  try {
    const base = "http://local.invalid";
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    const path = url.pathname + url.search + url.hash;
    if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return fallback;
    return path;
  } catch {
    return fallback;
  }
}
