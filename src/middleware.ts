import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // 로그인이 필요한 영역에서만 실행 (손님 화면은 거치지 않음)
  matcher: ["/owner/:path*", "/admin/:path*", "/auth/:path*"],
};
