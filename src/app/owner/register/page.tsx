import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/features/auth/guard";
import { OwnerWizard } from "@/features/owner/owner-wizard";
import { emptyOwnerInitial } from "@/features/owner/owner-values";
import { getKakaoAppKey } from "@/lib/env";

export const metadata: Metadata = { title: "내 식당 등록하기 - 혼밥 지도" };
export const dynamic = "force-dynamic";

/** 손님 계정에서 "내 식당 등록하기" (사장님 승격). 이미 식당이 있으면 대시보드로. */
export default async function OwnerRegisterPage() {
  const { supabase, user } = await requireUser("/owner/register");
  const [{ data: mine }, { data: claim }] = await Promise.all([
    supabase.from("restaurants").select("id").eq("owner_id", user.id).maybeSingle(),
    supabase
      .from("restaurant_claims")
      .select("status, restaurants(name)")
      .eq("owner_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (mine) redirect("/owner");

  return (
    <main>
      <h1 className="text-2xl font-bold text-gray-900">내 식당 등록하기</h1>
      <p className="mt-1 mb-5 text-sm text-gray-700">
        3단계, 5분이면 끝나요. 등록하면 지도에 ‘사장님 등록’ 식당으로 바로 보여요.
      </p>
      <OwnerWizard
        mode="create"
        restaurantId={null}
        userId={user.id}
        kakaoAppKey={getKakaoAppKey()}
        initial={emptyOwnerInitial()}
        pendingClaim={claim ? (claim.restaurants?.name ?? "식당") : null}
      />
    </main>
  );
}
