import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // 로그인이 필요한 영역과 로그인 화면에서만 실행 (지도·목록 등 손님 화면은 거치지 않음)
  matcher: ["/me/:path*", "/owner/:path*", "/admin/:path*", "/auth/:path*", "/login"],
};
