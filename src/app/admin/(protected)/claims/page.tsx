import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/features/admin/guard";
import { decideClaimAction } from "@/features/admin/claim-actions";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "연결 요청 - 혼밥 지도 관리자" };

const STATUS = { pending: "검토 중", approved: "승인", rejected: "거절" } as const;

/** 사장님의 "내 식당으로 연결 요청" 승인/거절 */
export default async function AdminClaimsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { supabase } = await requireAdmin();
  const { saved, error } = await searchParams;

  const { data: claims } = await supabase
    .from("restaurant_claims")
    .select("id, status, created_at, decided_at, owner_id, restaurant_id, restaurants(name, address, phone, owner_id)")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = claims ?? [];
  const ownerIds = [...new Set(rows.map((c) => c.owner_id))];
  const { data: profiles } = ownerIds.length
    ? await supabase.from("profiles").select("id, nickname").in("id", ownerIds)
    : { data: [] as { id: string; nickname: string | null }[] };
  const nick = new Map((profiles ?? []).map((p) => [p.id, p.nickname ?? "익명의 혼밥러"]));
  const pending = rows.filter((c) => c.status === "pending");
  const done = rows.filter((c) => c.status !== "pending");

  return (
    <main>
      <h1 className="text-xl font-bold">연결 요청</h1>
      <p className="mt-1 text-sm text-gray-700">
        사장님이 ‘이미 조사된 식당’을 내 식당으로 연결해 달라고 요청한 목록이에요. <strong>가게 전화로 본인 여부를 확인한 뒤</strong> 승인해 주세요.
      </p>
      <div aria-live="polite">
        {saved ? (
          <p className="mt-4 rounded-lg border border-primary/30 bg-primary-soft p-3 text-sm text-primary-strong">
            {saved === "approved" ? "승인했어요. 이제 그 사장님이 메뉴·시간을 직접 고칠 수 있어요." : "거절했어요."}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}
      </div>

      <h2 className="mt-6 font-semibold">검토 중 {pending.length}건</h2>
      {pending.length === 0 ? (
        <p className="mt-2 rounded-xl bg-white p-4 text-sm text-gray-600">검토할 연결 요청이 없어요.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {pending.map((c) => (
            <li key={c.id} className="rounded-xl bg-white p-4 shadow-sm">
              <p className="font-semibold">{c.restaurants?.name ?? "식당"}</p>
              <p className="text-sm text-gray-700">{c.restaurants?.address}</p>
              <p className="mt-1 text-sm">
                요청한 사람: <strong>{nick.get(c.owner_id) ?? "익명의 혼밥러"}</strong> · {formatDateTime(c.created_at)}
              </p>
              {c.restaurants?.phone ? (
                <p className="text-sm">
                  가게 전화:{" "}
                  <a href={`tel:${c.restaurants.phone}`} className="font-semibold text-primary-strong underline">
                    {c.restaurants.phone}
                  </a>
                </p>
              ) : null}
              {c.restaurants?.owner_id ? (
                <p className="mt-1 text-sm text-red-700">이미 다른 사장님이 연결돼 있어 승인할 수 없어요.</p>
              ) : null}
              <div className="mt-3 flex gap-2">
                <form action={decideClaimAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="status" value="approved" />
                  <button type="submit" className="btn-primary min-h-9 py-1" disabled={!!c.restaurants?.owner_id}>
                    승인
                  </button>
                </form>
                <form action={decideClaimAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="status" value="rejected" />
                  <button type="submit" className="btn-secondary min-h-9 py-1">
                    거절
                  </button>
                </form>
                <Link href={`/admin/restaurants/${c.restaurant_id}/edit`} className="btn-secondary min-h-9 py-1">
                  식당 보기
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 ? (
        <>
          <h2 className="mt-8 font-semibold">처리한 요청</h2>
          <ul className="mt-2 divide-y divide-gray-100 rounded-xl bg-white text-sm shadow-sm">
            {done.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                <span>
                  {c.restaurants?.name ?? "식당"} · {nick.get(c.owner_id) ?? "익명의 혼밥러"}
                </span>
                <span className="text-gray-700">
                  {STATUS[c.status]} {c.decided_at ? `· ${formatDateTime(c.decided_at)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </main>
  );
}
