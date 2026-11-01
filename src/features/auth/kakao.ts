"use client";

import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/safe-redirect";

/**
 * 카카오 로그인 시작. 카카오 → Supabase → /auth/callback?next=… 로 돌아온다.
 * 성공하면 브라우저가 카카오 로그인 화면으로 이동하므로 이 함수는 돌아오지 않는다.
 */
export async function signInWithKakao(next: string): Promise<void> {
  const supabase = createClient();
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}`;
  const { error } = await supabase.auth.signInWithOAuth({ provider: "kakao", options: { redirectTo } });
  if (error) throw error;
}
