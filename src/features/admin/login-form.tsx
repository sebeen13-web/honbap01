"use client";

import { useActionState } from "react";
import { adminLoginAction, type LoginState } from "@/features/admin/auth-actions";

export function AdminLoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(adminLoginAction, {});

  return (
    <form action={formAction} className="mt-6 space-y-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          aria-invalid={!!state.fieldErrors?.email}
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
          className="input mt-1"
        />
        {state.fieldErrors?.email ? (
          <p id="email-error" className="field-error">
            {state.fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={!!state.fieldErrors?.password}
          aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
          className="input mt-1"
        />
        {state.fieldErrors?.password ? (
          <p id="password-error" className="field-error">
            {state.fieldErrors.password}
          </p>
        ) : null}
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "로그인 중…" : "로그인"}
      </button>
    </form>
  );
}
