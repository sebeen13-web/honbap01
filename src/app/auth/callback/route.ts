import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

/**
 * 카카오 로그인 / 이메일 인증 링크가 돌아오는 곳.
 * ?code=… 를 세션으로 바꾸고, 원래 있던 화면(next, 같은 사이트 경로만)으로 보낸다.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNextPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  const toLogin = (reason: string, detail?: string | null) => {
    const target = new URL("/login", url.origin);
    target.searchParams.set("error", reason);
    if (next !== "/") target.searchParams.set("next", next);
    if (detail) target.searchParams.set("detail", detail.slice(0, 200));
    return NextResponse.redirect(target);
  };

  if (providerError) return toLogin("provider", providerError);
  if (!code) return toLogin("callback");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return toLogin("callback", error.message);

  return NextResponse.redirect(new URL(next, url.origin));
}
