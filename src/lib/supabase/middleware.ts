import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getPublicEnv } from "@/lib/env";

const ADMIN_PREFIX = "/admin";
const ADMIN_LOGIN_PATH = "/admin/login";

/**
 * 1) 로그인 세션 쿠키를 갱신한다 (/owner·/admin 에서 세션이 만료되지 않게).
 * 2) /admin/** (로그인 페이지 제외) 는 관리자만, /me·/owner 는 로그인 사용자만 통과시킨다.
 *    서버 컴포넌트/서버 액션에서도 requireAdmin() 으로 한 번 더 확인한다(이중 확인).
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const under = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);
  const isAdminArea = under(ADMIN_PREFIX);
  const isAdminLogin = pathname === ADMIN_LOGIN_PATH;

  // 로그인이 필요한 손님/사장님 영역: /me 하위(/me/favorites …), /owner. (/me 자체는 비로그인에게 로그인 안내를 보여준다)
  if ((pathname.startsWith("/me/") || under("/owner")) && !user) {
    return redirectWithCookies(request, response, "/login", { next: `${pathname}${search}` });
  }
  // /owner: 사장님 등록·연결 요청 화면(/owner/register, /owner/claim)은 손님도, 나머지는 owner/admin 만 (5단계)
  if (under("/owner") && user && !under("/owner/register") && !under("/owner/claim")) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "owner" && profile?.role !== "admin") {
      return redirectWithCookies(request, response, "/me", { notice: "owner-required" });
    }
  }

  if (isAdminArea && !isAdminLogin) {
    if (!user) {
      return redirectWithCookies(request, response, ADMIN_LOGIN_PATH, { next: pathname });
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin") {
      return redirectWithCookies(request, response, ADMIN_LOGIN_PATH, { error: "forbidden" });
    }
  }

  return response;
}

/** 리다이렉트하면서 방금 갱신된 세션 쿠키도 함께 내려보낸다. */
function redirectWithCookies(
  request: NextRequest,
  from: NextResponse,
  pathname: string,
  params: Record<string, string>,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = new URLSearchParams(params).toString();
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((c) => redirect.cookies.set(c));
  return redirect;
}
