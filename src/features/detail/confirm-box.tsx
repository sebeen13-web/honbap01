"use client";

import { useState } from "react";
import { useNearby } from "@/features/nearby/nearby-context";
import { formatVerifiedDate } from "@/features/restaurants/format";
import type { ConfirmResponse } from "@/app/api/restaurants/[id]/confirm/route";
import type { ConfirmationSummary } from "@/types/database";

/**
 * "오늘도 됐어요 / 안 됐어요" — 로그인 사용자, 같은 식당 하루 1회. 위치 권한은 묻지 않는다. 글은 받지 않는다.
 */
export function ConfirmBox({ restaurantId, initial }: { restaurantId: string; initial: ConfirmationSummary | null }) {
  const { requireLogin } = useNearby();
  const [summary, setSummary] = useState(initial);
  const [pending, setPending] = useState<"ok" | "not_ok" | null>(null);
  const [done, setDone] = useState<"ok" | "not_ok" | "already" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(result: "ok" | "not_ok") {
    if (
      !requireLogin({
        title: "로그인하면 확인을 남길 수 있어요",
        description: "한 사람이 하루에 한 번만 남길 수 있게 로그인이 필요해요. 위치는 묻지 않아요.",
        next: `/restaurants/${restaurantId}`,
      })
    )
      return;
    setPending(result);
    setError(null);
    try {
      const res = await fetch(`/api/restaurants/${restaurantId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      const body = (await res.json()) as ConfirmResponse;
      if (body.ok) {
        setSummary(body.summary);
        setDone(result);
      } else if (body.code === "already") {
        if (body.summary) setSummary(body.summary);
        setDone("already");
      } else {
        setError(body.message);
      }
    } catch {
      setError("서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.");
    } finally {
      setPending(null);
    }
  }

  const ok30 = summary?.ok_30d ?? 0;
  const notOk30 = summary?.not_ok_30d ?? 0;

  return (
    <section aria-labelledby="confirm-title" className="rounded-2xl border border-gray-200 p-4">
      <h2 id="confirm-title" className="text-base font-bold text-gray-900">
        오늘도 1인분 됐나요?
      </h2>
      <p className="mt-0.5 text-sm text-gray-700">다녀오셨다면 눌러 주세요. 다른 혼밥러에게 큰 도움이 돼요.</p>

      {done ? (
        <p role="status" className="mt-3 rounded-lg border border-primary/30 bg-primary-soft p-3 text-sm text-primary-strong">
          {done === "already"
            ? "오늘은 이미 확인을 남겼어요. 내일 다시 남길 수 있어요."
            : `확인 고마워요! ‘${done === "ok" ? "오늘도 됐어요" : "안 됐어요"}’로 남겼어요.`}
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" disabled={pending !== null} onClick={() => void send("ok")} className="btn-primary min-h-14 text-base">
            {pending === "ok" ? "남기는 중…" : "😊 오늘도 됐어요"}
          </button>
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => void send("not_ok")}
            className="inline-flex min-h-14 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-base font-semibold text-gray-800 disabled:opacity-60"
          >
            {pending === "not_ok" ? "남기는 중…" : "😥 안 됐어요"}
          </button>
        </div>
      )}
      {error ? (
        <p role="alert" className="field-error">
          {error}
        </p>
      ) : null}

      <p className="mt-3 text-sm text-gray-800" aria-live="polite">
        최근 30일 <strong>됐어요 {ok30}</strong> · 안 됐어요 {notOk30}
        {summary?.last_ok_at ? <span className="text-gray-600"> · 마지막 ‘됐어요’ {formatVerifiedDate(summary.last_ok_at)}</span> : null}
      </p>
      {summary?.needs_review ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 ring-1 ring-amber-300">
          ⚠ 최근 안 된다는 확인이 있어요. 방문 전에 전화로 확인해 보세요.
        </p>
      ) : null}
    </section>
  );
}
