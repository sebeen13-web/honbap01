import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/session";
import { loginPath } from "@/lib/safe-redirect";

/** 로그인이 필요한 서버 페이지·액션의 첫 줄에서 호출 (미들웨어와 별도로 한 번 더 확인) */
export async function requireUser(nextPath: string) {
  const ctx = await getCurrentUser();
  if (!ctx.user) redirect(loginPath(nextPath));
  return { ...ctx, user: ctx.user };
}

/**
 * 사장님 화면용 (5단계에서 사용). 로그인 + owner/admin 역할.
 * 사장님 등록·연결 요청 화면 자체는 손님(user)도 들어가야 하므로 거기서는 requireUser 를 쓴다.
 */
export async function requireOwner(nextPath: string) {
  const ctx = await requireUser(nextPath);
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect("/me?notice=owner-required");
  return ctx;
}
