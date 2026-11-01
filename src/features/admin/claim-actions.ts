"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/features/admin/guard";

/** 연결 요청 승인/거절. 승인하면 트리거가 식당에 사장님을 연결하고 owner 로 승격, 같은 식당의 다른 대기 요청은 거절한다. */
export async function decideClaimAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = z
    .object({ id: z.guid(), status: z.enum(["approved", "rejected"]) })
    .safeParse({ id: formData.get("id"), status: formData.get("status") });
  if (!parsed.success) redirect("/admin/claims?error=invalid");
  const { error } = await supabase.from("restaurant_claims").update({ status: parsed.data.status }).eq("id", parsed.data.id);
  if (error) {
    console.error("[claim decide]", error.code, error.message);
    redirect(`/admin/claims?error=${encodeURIComponent(/[가-힣]/.test(error.message) ? error.message : "처리하지 못했어요.")}`);
  }
  revalidatePath("/admin/claims");
  revalidatePath("/admin/restaurants");
  redirect(`/admin/claims?saved=${parsed.data.status}`);
}

/** 제보 처리 완료 표시 */
export async function markReportHandledAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = z.guid().safeParse(formData.get("id"));
  if (!id.success) redirect("/admin/review?error=invalid");
  const { error } = await supabase.from("reports").update({ handled: true }).eq("id", id.data);
  if (error) redirect("/admin/review?error=report");
  revalidatePath("/admin/review");
  redirect("/admin/review?saved=handled");
}
