"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useNearby } from "@/features/nearby/nearby-context";

const QUICK = ["1인분 주문이 안 됐어요", "가격이 달라요", "가능 시간이 달라요", "문을 닫았어요(폐업)"];

/** 정보가 다를 때 자유 텍스트 제보 (로그인 사용자, 관리자만 읽음) */
export function ReportButton({ restaurantId }: { restaurantId: string }) {
  const { auth, requireLogin } = useNearby();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const titleId = useId();
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    areaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const reason = text.trim();
    if (reason.length < 2) return setError("무엇이 달랐는지 두 글자 이상 적어 주세요.");
    if (reason.length > 500) return setError("500자 이하로 적어 주세요.");
    if (auth.status !== "user") return;
    setPending(true);
    setError(null);
    const { error } = await createClient().from("reports").insert({ restaurant_id: restaurantId, reason, user_id: auth.userId });
    setPending(false);
    if (error) return setError("제보를 보내지 못했어요. 잠시 후 다시 시도해 주세요.");
    setSent(true);
    setOpen(false);
    setText("");
  }

  return (
    <div>
      {sent ? (
        <p role="status" className="mb-2 rounded-lg border border-primary/30 bg-primary-soft p-3 text-sm text-primary-strong">
          제보 고마워요. 확인한 뒤 고칠게요.
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => {
          if (
            requireLogin({
              title: "로그인하면 제보할 수 있어요",
              description: "정보가 다르면 알려 주세요. 둘러보기는 로그인 없이 가능해요.",
              next: `/restaurants/${restaurantId}`,
            })
          )
            setOpen(true);
        }}
        className="inline-flex min-h-11 items-center text-sm font-medium text-gray-700 underline underline-offset-2"
      >
        정보가 달라요 · 제보하기
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setOpen(false)}>
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-2xl bg-white px-5 pt-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-xl"
          >
            <h2 id={titleId} className="text-lg font-bold text-gray-900">
              무엇이 달랐나요?
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setText((t) => (t ? `${t} / ${q}` : q))}
                  className="inline-flex min-h-11 items-center rounded-full border border-gray-300 px-3 text-sm text-gray-800"
                >
                  {q}
                </button>
              ))}
            </div>
            <label htmlFor="report-text" className="sr-only">
              제보 내용
            </label>
            <textarea
              id="report-text"
              ref={areaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="예: 저녁 7시에 갔는데 2인분부터만 된다고 했어요"
              className="input mt-3 resize-none"
              aria-invalid={!!error || undefined}
              aria-describedby={error ? "report-error" : undefined}
            />
            <p className="mt-1 text-right text-xs text-gray-600">{text.length}/500</p>
            {error ? (
              <p id="report-error" role="alert" className="field-error">
                {error}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-gray-600">제보는 운영자만 봐요. 다른 사람의 개인정보는 적지 말아 주세요.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
                취소
              </button>
              <button type="submit" disabled={pending} className="btn-primary">
                {pending ? "보내는 중…" : "제보 보내기"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
