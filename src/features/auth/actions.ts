"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/features/auth/guard";

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export type DeleteAccountResult = { ok: false; message: string };

/** 회원 탈퇴: DB 함수가 확인 기록·즐겨찾기·프로필을 지우고 계정을 삭제한다. */
export async function deleteAccountAction(): Promise<DeleteAccountResult> {
  const { supabase } = await requireUser("/me");
  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    console.error("[delete_my_account]", error.code, error.message);
    if (error.code === "42501" && /관리자/.test(error.message)) return { ok: false, message: error.message };
    return { ok: false, message: "탈퇴를 처리하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  // 계정이 지워졌으니 이 브라우저의 로그인 쿠키도 지운다
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  redirect("/login?notice=deleted");
}
