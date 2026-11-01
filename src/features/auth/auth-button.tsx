"use client";

import Link from "next/link";
import type { AuthState } from "@/features/auth/use-auth";

/** 상단 헤더의 로그인 상태: 비로그인 → "로그인", 로그인 → 프로필 아이콘(내 정보) */
export function AuthButton({ auth, next = "/" }: { auth: AuthState; next?: string }) {
  if (auth.status === "loading") return <span className="inline-block size-11" aria-hidden />;
  if (auth.status === "guest") {
    return (
      <Link
        href={next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`}
        className="inline-flex min-h-11 items-center rounded-full border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-900"
      >
        로그인
      </Link>
    );
  }
  return (
    <Link
      href="/me"
      aria-label="내 정보"
      className="grid size-11 place-items-center rounded-full bg-primary-soft text-primary-strong ring-1 ring-primary/30"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
      </svg>
    </Link>
  );
}
