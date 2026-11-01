import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/features/admin/guard";
import { RestaurantForm } from "@/features/admin/restaurant-form";
import { emptyRestaurant } from "@/features/admin/restaurant-form-values";
import { getKakaoAppKey } from "@/lib/env";

export const metadata: Metadata = { title: "식당 등록 - 혼밥 지도 관리자" };

export default async function NewRestaurantPage() {
  await requireAdmin();
  return (
    <main className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
      <Link href="/admin/restaurants" className="text-sm text-gray-600 underline">
        ← 목록으로
      </Link>
      <h1 className="mt-2 mb-6 text-xl font-bold">식당 직접 등록</h1>
      <RestaurantForm restaurantId={null} initial={emptyRestaurant()} kakaoAppKey={getKakaoAppKey()} />
    </main>
  );
}
