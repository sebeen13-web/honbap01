import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/features/admin/guard";
import { markReportHandledAction } from "@/features/admin/claim-actions";
import { SOURCE_LABEL } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "확인 필요 - 혼밥 지도 관리자" };

/** needs_review(최근 14일 '안 됐어요' 3건 이상) 식당 + 아직 처리 안 한 제보 */
export default async function AdminReviewPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { supabase } = await requireAdmin();
  const { saved } = await searchParams;

  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("id, name, address, phone, solo_policies(is_active, source, last_verified_at)")
    .order("name");
  const ids = (restaurants ?? []).map((r) => r.id);
  const [{ data: sums }, { data: reports }] = await Promise.all([
    ids.length ? supabase.rpc("confirmation_summaries", { rids: ids }) : Promise.resolve({ data: [] }),
    supabase.from("reports").select("id, restaurant_id, reason, created_at").eq("handled", false).order("created_at", { ascending: false }).limit(200),
  ]);
  const sumBy = new Map((sums ?? []).map((s) => [s.restaurant_id, s]));
  const reportsBy = new Map<string, { id: string; reason: string; created_at: string }[]>();
  for (const rep of reports ?? []) reportsBy.set(rep.restaurant_id, [...(reportsBy.get(rep.restaurant_id) ?? []), rep]);

  const review = (restaurants ?? []).filter((r) => sumBy.get(r.id)?.needs_review);
  const reportOnly = (restaurants ?? []).filter((r) => !sumBy.get(r.id)?.needs_review && reportsBy.has(r.id));

  const Card = ({ r }: { r: NonNullable<typeof restaurants>[number] }) => {
    const s = sumBy.get(r.id);
    const reps = reportsBy.get(r.id) ?? [];
    return (
      <li className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold">{r.name}</p>
            <p className="text-sm text-gray-700">{r.address}</p>
            <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
              {s?.needs_review ? <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900">확인 필요</span> : null}
              <span className="text-gray-700">
                최근 30일 됐어요 {s?.ok_30d ?? 0} · 안 됐어요 {s?.not_ok_30d ?? 0}
              </span>
              {r.solo_policies ? (
                <span className="text-gray-600">
                  · {SOURCE_LABEL[r.solo_policies.source]} {formatDate(r.solo_policies.last_verified_at)}
                </span>
              ) : null}
            </p>
            {r.phone ? (
              <a href={`tel:${r.phone}`} className="text-sm font-semibold text-primary-strong underline">
                {r.phone}
              </a>
            ) : null}
          </div>
          <Link href={`/admin/restaurants/${r.id}/edit`} className="btn-secondary min-h-9 py-1">
            수정·다시 확인
          </Link>
        </div>
        {reps.length > 0 ? (
          <ul className="mt-3 space-y-1 border-t border-gray-100 pt-2 text-sm">
            {reps.map((rep) => (
              <li key={rep.id} className="flex items-start justify-between gap-2">
                <span>
                  “{rep.reason}” <span className="text-xs text-gray-600">{formatDateTime(rep.created_at)}</span>
                </span>
                <form action={markReportHandledAction}>
                  <input type="hidden" name="id" value={rep.id} />
                  <button type="submit" className="btn-secondary min-h-9 shrink-0 px-2 py-1 text-xs">
                    처리 완료
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
      </li>
    );
  };

  return (
    <main>
      <h1 className="text-xl font-bold">확인 필요</h1>
      <p className="mt-1 text-sm text-gray-700">
        최근 14일 ‘안 됐어요’가 3건 이상인 식당과, 아직 처리하지 않은 제보예요. 전화로 확인한 뒤 수정 화면에서 저장하면 마지막 확인일이 갱신돼요.
      </p>
      {saved === "handled" ? (
        <p className="mt-4 rounded-lg border border-primary/30 bg-primary-soft p-3 text-sm text-primary-strong">제보를 처리 완료로 표시했어요.</p>
      ) : null}
      <h2 className="mt-6 font-semibold">확인 필요 식당 {review.length}곳</h2>
      {review.length === 0 ? (
        <p className="mt-2 rounded-xl bg-white p-4 text-sm text-gray-600">지금은 없어요.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {review.map((r) => (
            <Card key={r.id} r={r} />
          ))}
        </ul>
      )}
      {reportOnly.length > 0 ? (
        <>
          <h2 className="mt-8 font-semibold">제보가 들어온 식당 {reportOnly.length}곳</h2>
          <ul className="mt-2 space-y-2">
            {reportOnly.map((r) => (
              <Card key={r.id} r={r} />
            ))}
          </ul>
        </>
      ) : null}
    </main>
  );
}
