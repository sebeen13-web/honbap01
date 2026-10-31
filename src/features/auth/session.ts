import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/types/database";

/**
 * 현재 로그인 사용자와 역할을 돌려준다. 로그인하지 않았으면 user = null.
 * getUser() 는 Supabase Auth 서버에 토큰을 검증하므로 쿠키 위조로 속일 수 없다.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null as Role | null };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return { supabase, user, role: (profile?.role ?? null) as Role | null };
}
