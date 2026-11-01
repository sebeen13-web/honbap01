"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { KakaoLoginButton } from "@/features/auth/kakao-button";
import { loginPath } from "@/lib/safe-redirect";

/**
 * 로그인이 필요한 행동(즐겨찾기, 4단계 확인 버튼·제보)에서 비로그인일 때 띄우는 시트.
 * 로그인 후에는 next 로 돌아온다.
 */
export function LoginPromptSheet({
  open,
  onClose,
  title = "로그인이 필요해요",
  description,
  next,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  next: string;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("button, a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panelRef.current) {
        // 시트 안에서만 포커스가 돌도록
        const items = [...panelRef.current.querySelectorAll<HTMLElement>("button, a")].filter((el) => !el.hasAttribute("disabled"));
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      lastFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-t-2xl bg-white px-5 pt-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-bold text-gray-900">
          {title}
        </h2>
        <p className="mt-1 text-sm text-gray-700">
          {description ?? "둘러보기는 로그인 없이 가능해요. 저장·확인·제보할 때만 로그인이 필요해요."}
        </p>
        <div className="mt-4 space-y-2">
          <KakaoLoginButton next={next} size="md" />
          <Link href={loginPath(next)} className="btn-secondary w-full">
            이메일로 로그인
          </Link>
          <button type="button" onClick={onClose} className="inline-flex min-h-11 w-full items-center justify-center text-sm font-medium text-gray-700 underline underline-offset-2">
            나중에 할게요
          </button>
        </div>
      </div>
    </div>
  );
}
