/**
 * 로그인 후 돌아갈 경로(next)를 같은 사이트 내부 경로로만 제한한다 (open redirect 방지).
 *  - "/" 로 시작하는 상대 경로만 허용. "//evil.com", "/\\evil.com", "https://…" 는 거부
 *  - 제어 문자·역슬래시 포함 거부
 *  - 로그인/인증 경로로 다시 보내지 않는다 (무한 반복 방지)
 */
export function safeNextPath(next: unknown, fallback = "/"): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  try {
    const base = "http://same-site.invalid";
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    const path = `${url.pathname}${url.search}${url.hash}`;
    if (path === "/login" || path.startsWith("/login?") || path.startsWith("/auth/")) return fallback;
    return path;
  } catch {
    return fallback;
  }
}

/** /login?next=… 주소 */
export function loginPath(next: string): string {
  const safe = safeNextPath(next);
  return safe === "/" ? "/login" : `/login?next=${encodeURIComponent(safe)}`;
}
