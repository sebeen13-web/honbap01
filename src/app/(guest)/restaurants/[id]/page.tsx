import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { SOURCE_LABEL } from "@/lib/constants";
import { DAY_KEYS, DAY_LABEL, DAY_TYPE_LABEL, businessHoursSchema } from "@/features/restaurants/schema";
import { formatDiff, formatVerifiedDate, formatWon } from "@/features/restaurants/format";
import { TimeBadge } from "@/features/restaurants/restaurant-card";
import { DetailTopBar } from "@/features/detail/detail-top-bar";
import { DetailActions } from "@/features/detail/detail-actions";
import { ConfirmBox } from "@/features/detail/confirm-box";
import { ReportButton } from "@/features/detail/report-sheet";
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!z.guid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("restaurants")
    .select(
      "id, name, address, latitude, longitude, phone, category, business_hours, kakao_place_id, solo_policies(time_slot, time_slot_note, extra_fee, extra_fee_note, is_active, source, last_verified_at), solo_menu_items(name, solo_price, regular_price_per_person, normal_min_servings, note, sort_order), solo_time_rules(day_type, start_time, end_time, available, note, sort_order)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!r || !r.solo_policies) return null;
  return { supabase, r, p: r.solo_policies };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id);
  return { title: data ? `${data.r.name} - 혼밥 지도` : "식당을 찾을 수 없어요 - 혼밥 지도" };
}

const hhmm = (t: string) => t.slice(0, 5);
function ruleTime(start: string, end: string) {
  if (start === end) return "하루 종일";
  return end < start ? `${start}~다음날 ${end}` : `${start}~${end}`;
}

/** 식당 상세 (로그인 없이 보기. 확인·제보·저장만 로그인) */
export default async function RestaurantDetailPage({ params }: Params) {
  const { id } = await params;
  const data = await load(id);
  if (!data) notFound();
  const { supabase, r, p } = data;

  const menus = [...r.solo_menu_items].sort((a, b) => a.sort_order - b.sort_order);
  const rules = [...r.solo_time_rules]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((t) => ({ ...t, start_time: hhmm(t.start_time), end_time: hhmm(t.end_time) }));
  const rulesJson = rules.map((t) => ({
    day_type: t.day_type,
    start_time: t.start_time,
    end_time: t.end_time,
    available: t.available,
    note: t.note,
  })) as unknown as Json;

  const [{ data: availableNow }, { data: nextAt }, { data: sums }] = await Promise.all([
    supabase.rpc("solo_available_at", { rules: rulesJson }),
    supabase.rpc("solo_next_available_at", { rules: rulesJson }),
    supabase.rpc("confirmation_summaries", { rids: [r.id] }),
  ]);
  const summary = sums?.[0] ?? null;
  const maxServings = menus.length ? Math.max(...menus.map((m) => m.normal_min_servings)) : null;
  const hours = businessHoursSchema.safeParse(r.business_hours);

  return (
    <div className="min-h-dvh bg-white">
      <DetailTopBar restaurantId={r.id} name={r.name} isPublic={p.is_active} />

      <main className="mx-auto max-w-xl space-y-6 px-4 pt-4 pb-[max(env(safe-area-inset-bottom),2rem)]">
        {!p.is_active ? (
          <p role="status" className="rounded-lg bg-gray-100 p-3 text-sm text-gray-800">
            지금은 숨김(또는 일시중단) 상태라 손님에게 보이지 않는 식당이에요. 관리자·사장님에게만 보여요.
          </p>
        ) : null}

        {/* 기본 정보 */}
        <section>
          <h1 className="text-2xl font-bold text-gray-900">{r.name}</h1>
          <p className="mt-1 text-sm text-gray-700">
            {r.category} · {r.address}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded bg-primary-soft px-1.5 py-0.5 font-medium text-primary-strong ring-1 ring-primary/25">
              {SOURCE_LABEL[p.source]}
            </span>
            <span className="text-gray-700">{formatVerifiedDate(p.last_verified_at)} 확인</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <TimeBadge r={{ is_solo_available_now: availableNow ?? null, next_available_at: nextAt ?? null }} />
            {summary?.needs_review ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-300">
                ⚠ 최근 안 된다는 확인이 있어요
              </span>
            ) : null}
          </div>
          {maxServings !== null ? (
            <p className="mt-3 text-base font-semibold text-primary-strong">
              {maxServings >= 2 ? `보통 ${maxServings}인분부터 → 1인분 가능` : "1인분 주문 가능"}
            </p>
          ) : null}
        </section>

        <DetailActions
          restaurantId={r.id}
          name={r.name}
          latitude={r.latitude}
          longitude={r.longitude}
          phone={r.phone}
          kakaoPlaceId={r.kakao_place_id}
        />

        {/* 메뉴 표 */}
        <section aria-labelledby="menu-title">
          <h2 id="menu-title" className="text-lg font-bold text-gray-900">
            1인분 메뉴와 가격
          </h2>
          {menus.length === 0 ? (
            <p className="mt-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">메뉴 정보를 준비 중이에요.</p>
          ) : (
            <div className="mt-2 overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <caption className="sr-only">1인분 메뉴, 1인분 가격, 보통 1인당 가격, 차액</caption>
                <thead className="bg-gray-50 text-left text-xs text-gray-700">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold">메뉴</th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">1인분</th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">보통 1인당</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">차액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {menus.map((m) => (
                    <tr key={`${m.sort_order}-${m.name}`}>
                      <th scope="row" className="px-3 py-2.5 text-left font-medium text-gray-900">
                        {m.name}
                        {m.normal_min_servings >= 2 ? (
                          <span className="block text-xs font-normal text-gray-600">보통 {m.normal_min_servings}인분부터</span>
                        ) : null}
                        {m.note ? <span className="block text-xs font-normal text-gray-600">{m.note}</span> : null}
                      </th>
                      <td className="px-2 py-2.5 text-right font-bold whitespace-nowrap text-primary-strong">{formatWon(m.solo_price)}</td>
                      <td className="px-2 py-2.5 text-right whitespace-nowrap text-gray-800">
                        {m.regular_price_per_person !== null ? formatWon(m.regular_price_per_person) : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap text-gray-800">
                        {m.regular_price_per_person !== null ? formatDiff(m.solo_price, m.regular_price_per_person) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-1 text-xs text-gray-600">
            확인 당시 가격이에요.{p.extra_fee && p.extra_fee_note ? ` 1인 주문 시: ${p.extra_fee_note}` : ""}
          </p>
        </section>

        {/* 시간대 규칙 */}
        <section aria-labelledby="rule-title">
          <h2 id="rule-title" className="text-lg font-bold text-gray-900">
            1인분 되는 시간
          </h2>
          {rules.length === 0 ? (
            <p className="mt-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
              시간 정보가 아직 없어요{p.time_slot_note ? ` (참고: ${p.time_slot_note})` : ""}. 방문 전에 전화로 확인해 보세요.
            </p>
          ) : (
            <div className="mt-2 overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <caption className="sr-only">요일, 시간, 1인분 가능 여부, 메모</caption>
                <thead className="bg-gray-50 text-left text-xs text-gray-700">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold">요일</th>
                    <th scope="col" className="px-2 py-2 font-semibold">시간</th>
                    <th scope="col" className="px-3 py-2 font-semibold">1인분</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rules.map((t, i) => (
                    <tr key={i}>
                      <th scope="row" className="px-3 py-2.5 text-left font-medium whitespace-nowrap text-gray-900">
                        {DAY_TYPE_LABEL[t.day_type]}
                      </th>
                      <td className="px-2 py-2.5 text-gray-800">
                        {ruleTime(t.start_time, t.end_time)}
                        {t.note ? <span className="block text-xs text-gray-600">{t.note}</span> : null}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={
                            t.available
                              ? "rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-strong"
                              : "rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-800"
                          }
                        >
                          {t.available ? "가능" : "불가"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-1 text-xs text-gray-600">한국 시간 기준. 시간이 겹치면 ‘불가’가 우선이에요. 표에 없는 시간은 1인분이 어려워요.</p>
        </section>

        {/* 영업시간 (있을 때만) */}
        {hours.success && hours.data ? (
          <section aria-labelledby="hours-title">
            <h2 id="hours-title" className="text-lg font-bold text-gray-900">
              영업시간
            </h2>
            <dl className="mt-2 grid grid-cols-[2rem_1fr] gap-y-1 text-sm">
              {DAY_KEYS.map((d) => {
                const h = hours.data?.[d];
                return (
                  <div key={d} className="contents">
                    <dt className="text-gray-600">{DAY_LABEL[d]}</dt>
                    <dd className="text-gray-900">
                      {!h ? "휴무" : h.open === h.close ? "24시간" : h.close < h.open ? `${h.open}~다음날 ${h.close}` : `${h.open}~${h.close}`}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ) : null}

        {p.is_active ? <ConfirmBox restaurantId={r.id} initial={summary} /> : null}

        {p.is_active ? <ReportButton restaurantId={r.id} /> : null}
      </main>
    </div>
  );
}
