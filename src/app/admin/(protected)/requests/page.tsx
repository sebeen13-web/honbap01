import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/features/admin/guard";
import { linkRequestAction, setRequestStatusAction } from "@/features/admin/request-actions";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "식당 요청 - 혼밥 지도 관리자" };

const STATUS_LABEL = { open: "요청 중", registered: "등록됨", closed: "조사 완료" } as const;
const NOTICE: Record<string, string> = {
  closed: "조사 완료로 바꿨어요.",
  open: "다시 요청 중으로 바꿨어요.",
  linked: "식당과 연결했어요. 요청한 손님들의 ‘내 요청’에 등록됨으로 표시돼요.",
};
const ERROR: Record<string, string> = {
  pick: "연결할 식당을 골라 주세요.",
  link: "연결하지 못했어요.",
  duplicate: "그 카카오 장소는 이미 다른 식당에 연결돼 있어요.",
  status: "상태를 바꾸지 못했어요.",
  invalid: "잘못된 요청이에요.",
};

/** 요청 목록: 요청 수가 많은 순 → 전화 조사 우선순위 */
export default async function AdminRequestsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { supabase } = await requireAdmin();
  const { saved, error: errorKey } = await searchParams;

  const [{ data: requests, error }, { data: restaurants }] = await Promise.all([
    supabase
      .from("restaurant_requests")
      .select("id, kakao_place_id, name, address, category, status, vote_count, restaurant_id, created_at")
      .order("vote_count", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("restaurants").select("id, name, kakao_place_id").order("name"),
  ]);
  const rows = requests ?? [];
  const restaurantName = new Map((restaurants ?? []).map((r) => [r.id, r.name]));

  return (
    <main>
      <h1 className="text-xl font-bold">식당 요청</h1>
      <p className="mt-1 text-sm text-gray-700">요청 수가 많은 순이에요. 전화로 1인분 가능 여부를 조사할 순서로 쓰세요.</p>

      <div aria-live="polite">
        {saved && NOTICE[saved] ? (
          <p className="mt-4 rounded-lg border border-primary/30 bg-primary-soft p-3 text-sm text-primary-strong">{NOTICE[saved]}</p>
        ) : null}
        {errorKey && ERROR[errorKey] ? (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {ERROR[errorKey]}
          </p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          요청을 불러오지 못했어요: {error.message}
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-6 rounded-xl bg-white p-6 text-center text-gray-600">아직 요청이 없어요.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((q) => (
            <li key={q.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">
                    <span className="mr-2 rounded bg-primary px-1.5 py-0.5 text-sm text-white">{q.vote_count}명</span>
                    {q.name}
                  </p>
                  <p className="mt-1 text-sm text-gray-700">{q.address}</p>
                  <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                    {q.category ? <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-800">{q.category}</span> : null}
                    <span
                      className={
                        q.status === "open"
                          ? "rounded bg-primary-soft px-1.5 py-0.5 text-primary-strong"
                          : q.status === "registered"
                            ? "rounded bg-primary px-1.5 py-0.5 text-white"
                            : "rounded bg-gray-200 px-1.5 py-0.5 text-gray-800"
                      }
                    >
                      {STATUS_LABEL[q.status]}
                    </span>
                    <span className="text-gray-600">{formatDate(q.created_at)} 요청</span>
                  </p>
                </div>
                <a
                  href={`https://place.map.kakao.com/${q.kakao_place_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary min-h-9 py-1"
                >
                  카카오맵(전화번호)
                </a>
              </div>

              {q.status === "registered" ? (
                <p className="mt-3 text-sm">
                  연결된 식당:{" "}
                  {q.restaurant_id ? (
                    <Link href={`/admin/restaurants/${q.restaurant_id}/edit`} className="font-semibold text-primary-strong underline">
                      {restaurantName.get(q.restaurant_id) ?? "식당"}
                    </Link>
                  ) : (
                    "없음"
                  )}
                </p>
              ) : (
                <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <Link href={`/admin/restaurants/new?request=${q.id}`} className="btn-primary min-h-9 py-1">
                    이 정보로 식당 등록
                  </Link>
                  <form action={linkRequestAction} className="flex gap-2">
                    <input type="hidden" name="request_id" value={q.id} />
                    <label className="sr-only" htmlFor={`link-${q.id}`}>
                      연결할 식당
                    </label>
                    <select id={`link-${q.id}`} name="restaurant_id" className="input min-w-0 py-1.5 text-sm" defaultValue="">
                      <option value="">등록된 식당에 연결…</option>
                      {(restaurants ?? []).map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                          {r.kakao_place_id && r.kakao_place_id !== q.kakao_place_id ? " (다른 장소 연결됨)" : ""}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="btn-secondary min-h-9 shrink-0 py-1">
                      연결
                    </button>
                  </form>
                  <form action={setRequestStatusAction}>
                    <input type="hidden" name="id" value={q.id} />
                    <input type="hidden" name="status" value={q.status === "closed" ? "open" : "closed"} />
                    <button type="submit" className="btn-secondary min-h-9 py-1">
                      {q.status === "closed" ? "다시 열기" : "조사 완료"}
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
