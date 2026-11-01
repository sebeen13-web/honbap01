"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/features/auth/guard";
import { ownerFormSchema } from "@/features/owner/owner-schema";
import { toFieldErrors, type FieldErrors } from "@/features/restaurants/schema";

export type OwnerSaveResult = { ok: false; message: string; fieldErrors?: FieldErrors; code?: string };

/**
 * 사장님 식당 저장. id = null 이면 새로 등록(손님 → 사장님 승격), 아니면 내 식당 수정.
 * 출처(owner_registered)·확인일은 DB 트리거가 정한다.
 */
export async function saveOwnerRestaurantAction(id: string | null, input: unknown): Promise<OwnerSaveResult> {
  const { supabase } = await requireUser(id ? "/owner/edit" : "/owner/register");
  if (id !== null && !z.guid().safeParse(id).success) return { ok: false, message: "잘못된 요청이에요." };

  const parsed = ownerFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "입력값을 확인해 주세요.", fieldErrors: toFieldErrors(parsed.error) };
  const { place, menus, time_rules } = parsed.data;

  const { error } = await supabase.rpc("owner_save_restaurant", {
    p_id: id,
    p_kakao_place_id: place.kakao_place_id,
    p_name: place.name,
    p_address: place.address,
    p_latitude: place.latitude,
    p_longitude: place.longitude,
    p_phone: place.phone,
    p_category: place.category,
    p_menus: menus,
    p_time_rules: time_rules,
  });
  if (error) {
    console.error("[owner_save_restaurant]", error.code, error.message);
    if (error.hint === "already_owner" || error.hint === "place_taken") return { ok: false, message: error.message, code: error.hint };
    if (error.code === "42501") return { ok: false, message: "내 식당만 수정할 수 있어요." };
    if (error.code === "23514" && /[가-힣]/.test(error.message)) return { ok: false, message: error.message };
    return { ok: false, message: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/owner");
  revalidatePath("/me");
  redirect(`/owner?saved=${id ? "updated" : "created"}`);
}

export type ClaimResult = { ok: true } | { ok: false; message: string };

/** 이미 조사된 식당을 "내 식당으로 연결 요청" (관리자가 승인하면 사장님이 된다) */
export async function requestClaimAction(restaurantId: string): Promise<ClaimResult> {
  const { supabase, user } = await requireUser("/owner/register");
  if (!z.guid().safeParse(restaurantId).success) return { ok: false, message: "잘못된 요청이에요." };
  const { error } = await supabase.from("restaurant_claims").insert({ restaurant_id: restaurantId, owner_id: user.id });
  if (error) {
    console.error("[claim]", error.code, error.message);
    if (error.code === "23505") return { ok: false, message: "이미 검토 중인 연결 요청이 있어요. 처리될 때까지 기다려 주세요." };
    if (error.code === "42501") {
      return { ok: false, message: "연결 요청을 보낼 수 없어요. 이미 다른 사장님과 연결된 식당이거나, 이미 등록한 식당이 있어요." };
    }
    return { ok: false, message: "연결 요청을 보내지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  revalidatePath("/owner/register");
  revalidatePath("/me");
  return { ok: true };
}

/** 일시중단 / 다시 열기 (is_active). 출처·확인일은 그대로 유지된다. */
export async function setOwnerActiveAction(formData: FormData) {
  const { supabase, user } = await requireUser("/owner");
  const active = formData.get("active") === "true";
  const { data: r } = await supabase.from("restaurants").select("id").eq("owner_id", user.id).maybeSingle();
  if (!r) redirect("/owner/register");
  const { error } = await supabase.from("solo_policies").update({ is_active: active }).eq("restaurant_id", r.id);
  if (error) {
    console.error("[owner active]", error);
    redirect("/owner?error=active");
  }
  revalidatePath("/owner");
  redirect(`/owner?saved=${active ? "resumed" : "paused"}`);
}
