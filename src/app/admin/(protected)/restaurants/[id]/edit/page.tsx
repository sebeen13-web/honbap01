import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/features/admin/guard";
import { RestaurantForm } from "@/features/admin/restaurant-form";
import type { RestaurantFormInitial } from "@/features/admin/restaurant-form-values";
import { newMenuRow, newTimeRuleRow } from "@/features/restaurants/form-rows";
import { businessHoursSchema } from "@/features/restaurants/schema";
import { SOURCE_LABEL } from "@/lib/constants";
import { getKakaoAppKey } from "@/lib/env";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "식당 수정 - 혼밥 지도 관리자" };

export default async function EditRestaurantPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  if (!z.guid().safeParse(id).success) notFound();

  const { data: r, error } = await supabase
    .from("restaurants")
    .select(
      // 타입 추론을 위해 한 줄 문자열로 둔다
      "id, name, address, latitude, longitude, phone, category, business_hours, owner_id, solo_policies(time_slot, time_slot_note, extra_fee, extra_fee_note, is_active, source, last_verified_at), solo_menu_items(name, solo_price, regular_price_per_person, normal_min_servings, note, sort_order), solo_time_rules(day_type, start_time, end_time, available, note, sort_order)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error("식당 정보를 불러오지 못했어요.");
  if (!r) notFound();

  const p = r.solo_policies;
  // 저장된 영업시간 형식이 어긋나 있으면 비워서 보여준다(다시 입력하도록)
  const hours = businessHoursSchema.safeParse(r.business_hours);

  const initial: RestaurantFormInitial = {
    name: r.name,
    address: r.address,
    latitude: r.latitude,
    longitude: r.longitude,
    phone: r.phone ?? "",
    category: r.category,
    menus: r.solo_menu_items.length
      ? [...r.solo_menu_items]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((m) =>
            newMenuRow({
              name: m.name,
              solo_price: String(m.solo_price),
              regular_price_per_person: m.regular_price_per_person === null ? "" : String(m.regular_price_per_person),
              normal_min_servings: String(m.normal_min_servings),
              note: m.note ?? "",
            }),
          )
      : [newMenuRow()],
    time_rules: [...r.solo_time_rules]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((t) =>
        newTimeRuleRow({
          day_type: t.day_type,
          start_time: t.start_time.slice(0, 5),
          end_time: t.end_time.slice(0, 5),
          available: t.available,
          note: t.note ?? "",
        }),
      ),
    time_slot: p?.time_slot ?? "all_day",
    time_slot_note: p?.time_slot_note ?? "",
    extra_fee: p?.extra_fee ?? false,
    extra_fee_note: p?.extra_fee_note ?? "",
    business_hours: hours.success ? hours.data : null,
  };

  return (
    <main className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
      <Link href="/admin/restaurants" className="text-sm text-gray-600 underline">
        ← 목록으로
      </Link>
      <h1 className="mt-2 text-xl font-bold">식당 수정</h1>
      <p className="mt-1 mb-6 text-sm text-gray-600">
        {p ? (
          <>
            현재 출처: {SOURCE_LABEL[p.source]} · 마지막 확인: {formatDateTime(p.last_verified_at)} ·{" "}
            {p.is_active ? "공개 중" : "숨김"}
          </>
        ) : (
          "아직 1인분 정책이 없는 식당이에요. 저장하면 정책이 함께 만들어집니다."
        )}
        {r.owner_id ? " · 사장님이 등록한 식당" : null}
      </p>
      <RestaurantForm restaurantId={r.id} initial={initial} kakaoAppKey={getKakaoAppKey()} />
    </main>
  );
}
