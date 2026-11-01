"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/features/admin/guard";
import { restaurantFormSchema } from "@/features/restaurants/schema";
import { ALL_RESEARCH } from "@/features/admin/import/all-research";

export type ImportResult = { ok: true; status: "created" } | { ok: false; status: "exists" | "error"; message: string };

/** 브라우저가 카카오 검색으로 찾은 장소 (관리자가 눈으로 확인한 것) */
const placeSchema = z.object({
  id: z.string().regex(/^\d{1,20}$/),
  name: z.string().trim().min(1).max(100),
  address: z.string().trim().min(1).max(200),
  latitude: z.number(),
  longitude: z.number(),
  phone: z.string().trim().max(20),
});

/**
 * 조사 목록의 식당 하나를 등록한다.
 * 메뉴·가격·시간 규칙은 서버의 조사 목록(ALL_RESEARCH)에서 key 로 가져오고,
 * 클라이언트에서는 위치 정보(카카오 장소)만 받는다. 저장은 기존 admin_save_restaurant 로(출처 = 관리자 확인).
 */
export async function importResearchItemAction(key: string, place: unknown): Promise<ImportResult> {
  const { supabase } = await requireAdmin();

  const item = ALL_RESEARCH.find((x) => x.key === key);
  if (!item) return { ok: false, status: "error", message: "조사 목록에 없는 식당이에요." };
  const p = placeSchema.safeParse(place);
  if (!p.success) return { ok: false, status: "error", message: "카카오 장소 정보가 올바르지 않아요." };

  const parsed = restaurantFormSchema.safeParse({
    name: p.data.name,
    address: p.data.address,
    latitude: p.data.latitude,
    longitude: p.data.longitude,
    phone: /^[0-9+\-() ]{7,20}$/.test(p.data.phone) ? p.data.phone : "",
    category: item.category,
    menus: item.menus.map((m) => ({
      name: m.name,
      solo_price: String(m.solo_price),
      regular_price_per_person: m.regular_price_per_person ? String(m.regular_price_per_person) : "",
      normal_min_servings: String(m.normal_min_servings),
      note: m.note ?? "",
    })),
    time_rules: (item.time_rules ?? []).map((r) => ({ ...r, note: r.note ?? "" })),
    time_slot: "all_day",
    time_slot_note: "",
    extra_fee: false,
    extra_fee_note: "",
    business_hours: null,
    kakao_place_id: p.data.id,
  });
  if (!parsed.success) {
    return { ok: false, status: "error", message: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않아요." };
  }
  const v = parsed.data;

  const { error } = await supabase.rpc("admin_save_restaurant", {
    p_id: null,
    p_name: v.name,
    p_address: v.address,
    p_latitude: v.latitude,
    p_longitude: v.longitude,
    p_phone: v.phone,
    p_category: v.category,
    p_business_hours: v.business_hours,
    p_time_slot: v.time_slot,
    p_time_slot_note: v.time_slot_note,
    p_extra_fee: v.extra_fee,
    p_extra_fee_note: v.extra_fee_note,
    p_menus: v.menus,
    p_time_rules: v.time_rules,
    p_kakao_place_id: v.kakao_place_id,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, status: "exists", message: "이미 등록된 식당이에요." };
    console.error("[import admin_save_restaurant]", error.code);
    return { ok: false, status: "error", message: "저장하지 못했어요." };
  }

  revalidatePath("/admin/restaurants");
  revalidatePath("/");
  return { ok: true, status: "created" };
}
