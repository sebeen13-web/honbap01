"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/features/admin/guard";

const id = z.guid();

/** 조사 완료(closed) / 다시 열기(open) */
export async function setRequestStatusAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = z
    .object({ id, status: z.enum(["open", "closed"]) })
    .safeParse({ id: formData.get("id"), status: formData.get("status") });
  if (!parsed.success) redirect("/admin/requests?error=invalid");
  const { error } = await supabase.from("restaurant_requests").update({ status: parsed.data.status }).eq("id", parsed.data.id);
  if (error) {
    console.error("[setRequestStatus]", error);
    redirect("/admin/requests?error=status");
  }
  revalidatePath("/admin/requests");
  redirect(`/admin/requests?saved=${parsed.data.status}`);
}

/** 요청을 이미 등록된 식당에 연결 → 요청 '등록됨' */
export async function linkRequestAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = z
    .object({ request_id: id, restaurant_id: id })
    .safeParse({ request_id: formData.get("request_id"), restaurant_id: formData.get("restaurant_id") });
  if (!parsed.success) redirect("/admin/requests?error=pick");
  const { error } = await supabase.rpc("admin_link_request", {
    p_request_id: parsed.data.request_id,
    p_restaurant_id: parsed.data.restaurant_id,
  });
  if (error) {
    console.error("[admin_link_request]", error);
    redirect(`/admin/requests?error=${error.code === "23505" ? "duplicate" : "link"}`);
  }
  revalidatePath("/admin/requests");
  revalidatePath("/admin/restaurants");
  redirect("/admin/requests?saved=linked");
}
