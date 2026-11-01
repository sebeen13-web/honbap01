"use client";

import { useState } from "react";
import { signInWithKakao } from "@/features/auth/kakao";

/** 카카오 로그인 버튼 (카카오 브랜드 가이드: 노란 배경 + 말풍선 + 검정 글자) */
export function KakaoLoginButton({ next, size = "lg" }: { next: string; size?: "lg" | "md" }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setError(null);
          setPending(true);
          try {
            await signInWithKakao(next);
          } catch {
            setPending(false);
            setError("카카오 로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
          }
        }}
        className={`flex w-full items-center justify-center gap-2 rounded-xl bg-kakao font-semibold text-black/85 disabled:opacity-60 ${
          size === "lg" ? "min-h-14 text-lg" : "min-h-12 text-base"
        }`}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="currentColor">
          <path d="M12 3C6.48 3 2 6.58 2 11c0 2.85 1.86 5.35 4.66 6.77l-.95 3.5a.4.4 0 0 0 .61.44l4.13-2.74c.51.06 1.03.09 1.55.09 5.52 0 10-3.58 10-8S17.52 3 12 3z" />
        </svg>
        {pending ? "카카오로 이동 중…" : "카카오로 시작하기"}
      </button>
      {error ? (
        <p role="alert" className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
