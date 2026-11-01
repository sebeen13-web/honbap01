"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type AuthState = { status: "loading" } | { status: "guest" } | { status: "user"; userId: string };

/**
 * 브라우저에서 로그인 상태를 구독한다 (화면 표시용).
 * 권한 판단은 서버(RLS·서버 컴포넌트·미들웨어)가 하므로, 여기서는 세션 유무만 본다.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      setState({ status: "guest" });
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setState(data.session ? { status: "user", userId: data.session.user.id } : { status: "guest" });
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(session ? { status: "user", userId: session.user.id } : { status: "guest" });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
