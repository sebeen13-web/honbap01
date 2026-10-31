import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getPublicEnv } from "@/lib/env";

/**
 * 로그인 세션 쿠키를 갱신한다.
 * 손님(비로그인) 화면에는 영향이 없고, /owner·/admin 에서 세션이 만료되지 않게 해 준다.
 * 접근 제어(로그인/역할 확인)는 2·5단계에서 각 페이지에 추가한다.
 */
export async function updateSession(request: NextRequest) {
  const env = getPublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() 호출이 만료된 토큰을 갱신한다. 지우지 말 것.
  await supabase.auth.getUser();

  return response;
}
