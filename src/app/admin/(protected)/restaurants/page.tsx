import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/features/admin/guard";
import { setRestaurantActiveAction } from "@/features/admin/restaurant-actions";
import { ToggleActiveButton } from "@/features/admin/toggle-active-button";
import { SOURCE_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "식당 목록 - 혼밥 지도 관리자" };

const NOTICE: Record<string, string> = {
  created: "식당을 등록했어요.",
  updated: "수정 내용을 저장했어요.",
  hidden: "식당을 숨겼어요. 손님 화면에 보이지 않아요.",
  shown: "숨김을 해제했어요. 손님 화면에 다시 보여요.",
};
const ERROR: Record<string, string> = {
  toggle: "숨김 상태를 바꾸지 못했어요. 1인분 정책이 없는 식당이면 먼저 수정 화면에서 저장해 주세요.",
  invalid: "잘못된 요청이에요.",
};

export default async function AdminRestaurantsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const { saved, error: errorKey } = await searchParams;

  const { data, error } = await supabase
    .from("restaurants")
    .select("id, name, category, owner_id, created_at, solo_policies(is_active, source, last_verified_at)")
    .order("created_at", { ascending: false });

  const rows = data ?? [];

  return (
    <main>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">식당 목록</h1>
        <Link href="/admin/restaurants/new" className="btn-primary">
          + 식당 등록
        </Link>
      </div>

      <div aria-live="polite">
        {saved && NOTICE[saved] ? (
          <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">{NOTICE[saved]}</p>
        ) : null}
        {errorKey && ERROR[errorKey] ? (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {ERROR[errorKey]}
          </p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          목록을 불러오지 못했어요: {error.message}
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-6 rounded-xl bg-white p-6 text-center text-gray-600">아직 등록된 식당이 없어요.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((r) => {
            const p = r.solo_policies;
            const active = p?.is_active ?? false;
            return (
              <li key={r.id} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`font-semibold ${active ? "" : "text-gray-500"}`}>{r.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-800">{r.category}</span>
                      {p ? (
                        <span className="rounded bg-primary-soft px-1.5 py-0.5 text-primary-strong">
                          {SOURCE_LABEL[p.source]} · {formatDate(p.last_verified_at)}
                        </span>
                      ) : (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-900">정책 없음</span>
                      )}
                      <span
                        className={
                          active
                            ? "rounded bg-green-50 px-1.5 py-0.5 text-green-800"
                            : "rounded bg-gray-200 px-1.5 py-0.5 text-gray-700"
                        }
                      >
                        {active ? "공개 중" : "숨김"}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link href={`/admin/restaurants/${r.id}/edit`} className="btn-secondary min-h-9 py-1" aria-label={`${r.name} 수정`}>
                      수정
                    </Link>
                    {p ? (
                      <form action={setRestaurantActiveAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="active" value={String(!active)} />
                        <ToggleActiveButton active={active} name={r.name} />
                      </form>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
