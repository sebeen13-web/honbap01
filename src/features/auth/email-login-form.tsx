"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z.email("이메일 형식이 올바르지 않아요."),
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
});
const signupSchema = z.object({
  email: z.email("이메일 형식이 올바르지 않아요."),
  password: z.string().min(8, "비밀번호는 8자 이상으로 정해 주세요.").max(72, "비밀번호는 72자 이하로 정해 주세요."),
});

/** 이메일 로그인/가입 (보조 수단). 성공하면 next 로 이동한다. */
export function EmailLoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const parsed = (mode === "login" ? loginSchema : signupSchema).safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      const fe: typeof fieldErrors = {};
      for (const i of parsed.error.issues) {
        const k = i.path[0];
        if ((k === "email" || k === "password") && !fe[k]) fe[k] = i.message;
      }
      setFieldErrors(fe);
      return;
    }
    setFieldErrors({});
    setPending(true);
    try {
      const supabase = createClient();
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) {
          if (/invalid login credentials/i.test(error.message)) setMessage({ kind: "error", text: "이메일 또는 비밀번호가 올바르지 않아요." });
          else if (/email not confirmed/i.test(error.message)) setMessage({ kind: "error", text: "메일함의 인증 링크를 먼저 눌러 주세요." });
          else setMessage({ kind: "error", text: "로그인하지 못했어요. 잠시 후 다시 시도해 주세요." });
          return;
        }
        router.replace(next);
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          ...parsed.data,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
        });
        if (error) {
          if (/already registered|already exists/i.test(error.message)) setMessage({ kind: "error", text: "이미 가입된 이메일이에요. 로그인해 주세요." });
          else if (/password/i.test(error.message)) setMessage({ kind: "error", text: "더 안전한 비밀번호로 정해 주세요." });
          else setMessage({ kind: "error", text: "가입하지 못했어요. 잠시 후 다시 시도해 주세요." });
          return;
        }
        if (data.session) {
          router.replace(next);
          router.refresh();
        } else {
          setMessage({ kind: "info", text: `${parsed.data.email} 로 인증 메일을 보냈어요. 메일의 링크를 이 브라우저에서 눌러 주세요.` });
        }
      }
    } catch {
      setMessage({ kind: "error", text: "서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <div role="tablist" aria-label="이메일 로그인 방식" className="grid grid-cols-2 rounded-full bg-gray-100 p-0.5">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setMessage(null);
              setFieldErrors({});
            }}
            className="min-h-11 rounded-full text-sm font-semibold text-gray-700 aria-selected:bg-white aria-selected:text-primary-strong aria-selected:shadow"
          >
            {m === "login" ? "이메일 로그인" : "처음이에요 (가입)"}
          </button>
        ))}
      </div>
      <div>
        <label htmlFor="login-email" className="block text-sm font-medium">
          이메일
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          className="input mt-1"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!fieldErrors.email || undefined}
          aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
        />
        {fieldErrors.email ? (
          <p id="login-email-error" className="field-error">
            {fieldErrors.email}
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor="login-password" className="block text-sm font-medium">
          비밀번호{mode === "signup" ? " (8자 이상)" : ""}
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className="input mt-1"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!fieldErrors.password || undefined}
          aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
        />
        {fieldErrors.password ? (
          <p id="login-password-error" className="field-error">
            {fieldErrors.password}
          </p>
        ) : null}
      </div>
      {message ? (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={
            message.kind === "error"
              ? "rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              : "rounded-lg border border-primary/30 bg-primary-soft p-3 text-sm text-primary-strong"
          }
        >
          {message.text}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="btn-secondary w-full">
        {pending ? "처리 중…" : mode === "login" ? "이메일로 로그인" : "이메일로 가입하기"}
      </button>
    </form>
  );
}
