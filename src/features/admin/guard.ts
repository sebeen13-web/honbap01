import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/session";

export const ADMIN_LOGIN_PATH = "/admin/login";

/**
 * 관리자 페이지·서버 액션의 첫 줄에서 호출한다 (미들웨어와 별도로 한 번 더 확인).
 *  - 비로그인 → /admin/login
 *  - 로그인했지만 admin 아님 → /admin/login?error=forbidden (안내 문구 표시)
 * 서버 액션은 레이아웃 보호를 거치지 않으므로 액션마다 반드시 호출해야 한다.
 */
export async function requireAdmin() {
  const { supabase, user, role } = await getCurrentUser();
  if (!user) redirect(ADMIN_LOGIN_PATH);
  if (role !== "admin") redirect(`${ADMIN_LOGIN_PATH}?error=forbidden`);
  return { supabase, user };
}
