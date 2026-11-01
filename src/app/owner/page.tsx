import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOwner } from "@/features/auth/guard";
import { setOwnerActiveAction } from "@/features/owner/actions";
import { SOURCE_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { formatVerifiedDate } from "@/features/restaurants/format";

export const metadata: Metadata = { title: "사장님 대시보드 - 혼밥 지도" };
export const dynamic = "force-dynamic";

const NOTICE: Record<string, string> = {
  created: "등록을 마쳤어요! 지금부터 지도에 ‘사장님 등록’ 식당으로 보여요.",
  updated: "저장했어요. 마지막 확인일이 오늘로 바뀌었어요.",
  paused: "1인분 안내를 잠시 멈췄어요. 손님 화면에 보이지 않아요.",
  resumed: "다시 손님 화면에 보여요.",
};
const CLAIM_LABEL = { pending: "검토 중", approved: "승인됨", rejected: "승인되지 않음" } as const;

/** 한국 날짜 기준 n일 전 (YYYY-MM-DD) */
function kstDaysAgo(n: number) {
  const d = new Date(Date.now() + 9 * 3600 * 1000 - n * 86400 * 1000);
  return d.toISOString().slice(0, 10);
}

export default async function OwnerDashboardPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { supabase, user } = await requireOwner("/owner");
  const { saved, error: errorKey } = await searchParams;

  const { data: r } = await supabase
    .from("restaurants")
    .select("id, name, address, kakao_place_id, solo_policies(is_active, source, last_verified_at), solo_menu_items(id)")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!r) redirect("/owner/register");
  const p = r.solo_policies;

  const [{ data: stats }, { data: sums }, { data: requests }, { data: claims }] = await Promise.all([
    supabase.from("restaurant_daily_stats").select("day, views, directions_clicks, phone_taps").eq("restaurant_id", r.id).gte("day", kstDaysAgo(29)),
    supabase.rpc("confirmation_summaries", { rids: [r.id] }),
    supabase.from("restaurant_requests").select("vote_count").eq("restaurant_id", r.id),
    supabase.from("restaurant_claims").select("status, created_at, decided_at, restaurants(name)").eq("owner_id", user.id).order("created_at", { ascending: false }),
  ]);

  const since7 = kstDaysAgo(6);
  const total = (from: string) =>
    (stats ?? [])
      .filter((s) => s.day >= from)
      .reduce((a, s) => ({ views: a.views + s.views, directions: a.directions + s.directions_clicks, phone: a.phone + s.phone_taps }), {
        views: 0,
        directions: 0,
        phone: 0,
      });
  const w = total(since7);
  const m = total(kstDaysAgo(29));
  const summary = sums?.[0];
  const requestVotes = (requests ?? []).reduce((a, q) => a + q.vote_count, 0);

  return (
    <main className="space-y-5">
      <div aria-live="polite">
        {saved && NOTICE[saved] ? (
          <p className="rounded-lg border border-primary/30 bg-primary-soft p-3 text-sm text-primary-strong">{NOTICE[saved]}</p>
        ) : null}
        {errorKey ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            처리하지 못했어요. 잠시 후 다시 시도해 주세요.
          </p>
        ) : null}
      </div>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-sm text-gray-600">내 식당</p>
        <h1 className="text-xl font-bold text-gray-900">{r.name}</h1>
        <p className="text-sm text-gray-700">{r.address}</p>
        {p ? (
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className={p.is_active ? "rounded bg-primary px-1.5 py-0.5 font-semibold text-white" : "rounded bg-gray-200 px-1.5 py-0.5 font-semibold text-gray-800"}>
              {p.is_active ? "손님에게 보이는 중" : "일시중단"}
            </span>
            <span className="rounded bg-primary-soft px-1.5 py-0.5 text-primary-strong">{SOURCE_LABEL[p.source]}</span>
            <span className="text-gray-700">{formatVerifiedDate(p.last_verified_at)} 확인</span>
          </p>
        ) : null}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Link href={`/restaurants/${r.id}`} className="btn-secondary">
            손님 화면
          </Link>
          <Link href="/owner/edit" className="btn-primary">
            메뉴·시간 수정
          </Link>
          <Link href="/owner/sticker" className="btn-secondary">
            스티커
          </Link>
        </div>
        {p ? (
          <form action={setOwnerActiveAction} className="mt-2">
            <input type="hidden" name="active" value={String(!p.is_active)} />
            <button type="submit" className="inline-flex min-h-11 items-center text-sm font-medium text-gray-700 underline underline-offset-2">
              {p.is_active ? "오늘은 1인분이 어려워요 (일시중단)" : "다시 손님에게 보이기"}
            </button>
          </form>
        ) : null}
      </section>

      {/* 요청 */}
      <section className="rounded-2xl bg-primary p-4 text-white" aria-label="내 식당 요청">
        <p className="text-sm opacity-90">내 식당 요청</p>
        <p className="text-3xl font-bold">{requestVotes}명</p>
        <p className="mt-1 text-sm opacity-90">
          {requestVotes > 0 ? "손님들이 ‘여기도 1인분 되면 좋겠어요’라고 요청했던 식당이에요." : "아직 이 식당에 대한 손님 요청은 없어요."}
        </p>
      </section>

      {/* 통계 */}
      <section className="rounded-2xl bg-white p-4 shadow-sm" aria-labelledby="stat-title">
        <h2 id="stat-title" className="text-base font-bold text-gray-900">
          손님 반응
        </h2>
        <table className="mt-2 w-full text-sm">
          <thead className="text-xs text-gray-600">
            <tr>
              <th scope="col" className="py-1 text-left font-medium"></th>
              <th scope="col" className="py-1 text-right font-medium">최근 7일</th>
              <th scope="col" className="py-1 text-right font-medium">최근 30일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(
              [
                ["상세 조회", w.views, m.views],
                ["길찾기", w.directions, m.directions],
                ["전화", w.phone, m.phone],
              ] as const
            ).map(([label, a, b]) => (
              <tr key={label}>
                <th scope="row" className="py-2 text-left font-medium text-gray-800">
                  {label}
                </th>
                <td className="py-2 text-right text-lg font-bold text-gray-900">{a}</td>
                <td className="py-2 text-right text-gray-800">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-xs text-gray-600">손님 개인 정보 없이 숫자만 세요. (한국 날짜 기준)</p>
      </section>

      {/* 확인 */}
      <section className="rounded-2xl bg-white p-4 shadow-sm" aria-labelledby="confirm-stat-title">
        <h2 id="confirm-stat-title" className="text-base font-bold text-gray-900">
          ‘오늘도 됐어요’ 확인 (최근 30일)
        </h2>
        <p className="mt-2 text-sm text-gray-800">
          됐어요 <strong className="text-lg text-primary-strong">{summary?.ok_30d ?? 0}</strong> · 안 됐어요{" "}
          <strong className="text-lg text-gray-900">{summary?.not_ok_30d ?? 0}</strong>
        </p>
        {summary?.needs_review ? (
          <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-300">
            ⚠ 최근 2주 동안 ‘안 됐어요’가 3건 이상이에요. 손님 화면에 경고가 보이고 있어요. 1인분 메뉴·시간이 맞는지 확인하고 저장해 주세요.
          </p>
        ) : null}
        {r.solo_menu_items.length === 0 ? (
          <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-300">
            아직 1인분 메뉴가 없어요. ‘메뉴·시간 수정’에서 넣어 주세요.
          </p>
        ) : null}
      </section>

      {/* 연결 요청 */}
      {claims && claims.length > 0 ? (
        <section className="rounded-2xl bg-white p-4 shadow-sm" aria-labelledby="claim-title">
          <h2 id="claim-title" className="text-base font-bold text-gray-900">
            연결 요청
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {claims.map((c, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>{c.restaurants?.name ?? "식당"}</span>
                <span className="text-gray-700">
                  {CLAIM_LABEL[c.status]} · {formatDate(c.decided_at ?? c.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
