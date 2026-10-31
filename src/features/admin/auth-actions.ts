"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.email("이메일 형식이 올바르지 않습니다."),
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
  next: z.string().optional(),
});

export type LoginState = {
  error?: string;
  fieldErrors?: { email?: string; password?: string };
  email?: string;
};

/** 로그인 후 돌아갈 곳. 외부 주소로 튀지 않게 /admin 하위만 허용한다. */
function safeNext(next: string | undefined) {
  if (next && /^\/admin(\/[A-Za-z0-9\-_/]*)?$/.test(next) && next !== "/admin/login") return next;
  return "/admin/restaurants";
}

export async function adminLoginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    next: formData.get("next") ? String(formData.get("next")) : undefined,
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) {
    const fieldErrors: LoginState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if ((key === "email" || key === "password") && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors, email };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    const msg = error?.message ?? "";
    if (/email not confirmed/i.test(msg)) {
      return { error: "이메일 인증이 아직 끝나지 않았어요. 받은편지함의 인증 메일을 확인해 주세요.", email };
    }
    if (/invalid login credentials/i.test(msg)) {
      return { error: "이메일 또는 비밀번호가 올바르지 않습니다.", email };
    }
    return { error: "로그인하지 못했어요. 잠시 후 다시 시도해 주세요.", email };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (profile?.role !== "admin") {
    // 관리자 아닌 계정은 세션을 남기지 않는다.
    await supabase.auth.signOut();
    return {
      error: "관리자 권한이 없는 계정입니다. 관리자 계정으로 로그인하거나, 운영자에게 권한을 요청해 주세요.",
      email,
    };
  }

  redirect(safeNext(parsed.data.next));
}

export async function adminLogoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
