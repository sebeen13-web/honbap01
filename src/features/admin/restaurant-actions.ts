"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/features/admin/guard";
import { restaurantFormSchema, toFieldErrors, type FieldErrors } from "@/features/restaurants/schema";

export type SaveRestaurantResult = { ok: false; message: string; fieldErrors?: FieldErrors };

// 시드 데이터의 0000... 형식 id 도 받도록 RFC 버전 검사를 하지 않는 guid 를 쓴다.
const idSchema = z.guid("잘못된 식당 id 입니다.");

/**
 * 관리자 식당 등록(id = null) / 수정.
 * - 클라이언트에서 검증했더라도 서버에서 같은 zod 스키마로 다시 검증한다.
 * - source(admin_checked)·last_verified_at(now) 은 클라이언트에서 받지 않고
 *   DB 함수(admin_save_restaurant)와 트리거가 결정한다.
 * - 메뉴·시간대 규칙은 저장할 때마다 폼의 목록으로 통째로 교체된다.
 * 성공하면 목록으로 이동하고, 실패하면 메시지를 돌려준다.
 */
export async function saveRestaurantAction(id: string | null, input: unknown): Promise<SaveRestaurantResult> {
  const { supabase } = await requireAdmin();

  let restaurantId: string | null = null;
  if (id !== null) {
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) return { ok: false, message: "잘못된 식당 id 입니다." };
    restaurantId = parsedId.data;
  }

  const parsed = restaurantFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "입력값을 확인해 주세요.", fieldErrors: toFieldErrors(parsed.error) };
  }
  const v = parsed.data;

  const { error } = await supabase.rpc("admin_save_restaurant", {
    p_id: restaurantId,
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
    // 순서대로 sort_order 가 매겨진다
    p_menus: v.menus,
    p_time_rules: v.time_rules,
    p_kakao_place_id: v.kakao_place_id,
  });

  if (error) {
    console.error("[admin_save_restaurant]", error);
    if (error.code === "42501") return { ok: false, message: "관리자 권한이 없어 저장하지 못했어요. 다시 로그인해 주세요." };
    if (error.code === "23505" && /kakao_place_id/.test(error.message)) {
      return { ok: false, message: "이미 같은 카카오 장소로 등록된 식당이 있어요. 목록에서 그 식당을 수정해 주세요." };
    }
    if (error.code === "P0002") return { ok: false, message: "식당을 찾을 수 없어요. 이미 삭제되었을 수 있어요." };
    if (error.code === "23514") {
      // DB 가 보낸 한국어 안내(개수 제한 등)는 그대로 보여준다
      const friendly = /[가-힣]/.test(error.message) ? error.message : "저장 규칙에 맞지 않는 값이 있어요. 입력값을 다시 확인해 주세요.";
      return { ok: false, message: friendly };
    }
    return { ok: false, message: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/admin/restaurants");
  revalidatePath("/admin/requests");
  revalidatePath("/");
  redirect(`/admin/restaurants?saved=${restaurantId ? "updated" : "created"}`);
}

const toggleSchema = z.object({
  id: idSchema,
  active: z.enum(["true", "false"]).transform((v) => v === "true"),
});

/** 숨김 / 숨김 해제 (solo_policies.is_active). 출처·확인일은 트리거가 그대로 유지한다. */
export async function setRestaurantActiveAction(formData: FormData) {
  const { supabase } = await requireAdmin();

  const parsed = toggleSchema.safeParse({ id: formData.get("id"), active: formData.get("active") });
  if (!parsed.success) redirect("/admin/restaurants?error=invalid");

  const { data, error } = await supabase
    .from("solo_policies")
    .update({ is_active: parsed.data.active })
    .eq("restaurant_id", parsed.data.id)
    .select("id");

  if (error || !data?.length) {
    if (error) console.error("[setRestaurantActive]", error);
    redirect("/admin/restaurants?error=toggle");
  }

  revalidatePath("/admin/restaurants");
  revalidatePath("/");
  redirect(`/admin/restaurants?saved=${parsed.data.active ? "shown" : "hidden"}`);
}
