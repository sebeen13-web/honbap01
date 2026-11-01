import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireOwner } from "@/features/auth/guard";
import { OwnerWizard } from "@/features/owner/owner-wizard";
import { newMenuRow, newTimeRuleRow } from "@/features/restaurants/form-rows";
import { getKakaoAppKey } from "@/lib/env";

export const metadata: Metadata = { title: "내 식당 수정 - 혼밥 지도" };
export const dynamic = "force-dynamic";

export default async function OwnerEditPage() {
  const { supabase, user } = await requireOwner("/owner/edit");
  const { data: r } = await supabase
    .from("restaurants")
    .select(
      "id, name, address, latitude, longitude, phone, category, kakao_place_id, solo_menu_items(name, solo_price, regular_price_per_person, normal_min_servings, note, sort_order), solo_time_rules(day_type, start_time, end_time, available, note, sort_order)",
    )
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!r) redirect("/owner/register");

  const menus = [...r.solo_menu_items].sort((a, b) => a.sort_order - b.sort_order);
  const rules = [...r.solo_time_rules].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <main>
      <h1 className="mb-5 text-2xl font-bold text-gray-900">내 식당 수정</h1>
      <OwnerWizard
        mode="edit"
        restaurantId={r.id}
        userId={user.id}
        kakaoAppKey={getKakaoAppKey()}
        pendingClaim={null}
        initial={{
          place: {
            kakao_place_id: r.kakao_place_id,
            name: r.name,
            address: r.address,
            latitude: r.latitude,
            longitude: r.longitude,
            phone: r.phone ?? "",
            category: r.category,
          },
          menus: menus.length
            ? menus.map((m) =>
                newMenuRow({
                  name: m.name,
                  solo_price: String(m.solo_price),
                  regular_price_per_person: m.regular_price_per_person === null ? "" : String(m.regular_price_per_person),
                  normal_min_servings: String(m.normal_min_servings),
                  note: m.note ?? "",
                }),
              )
            : [newMenuRow()],
          time_rules: rules.length
            ? rules.map((t) =>
                newTimeRuleRow({
                  day_type: t.day_type,
                  start_time: t.start_time.slice(0, 5),
                  end_time: t.end_time.slice(0, 5),
                  available: t.available,
                  note: t.note ?? "",
                }),
              )
            : [newTimeRuleRow()],
        }}
      />
    </main>
  );
}
