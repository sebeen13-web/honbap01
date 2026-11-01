import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { requireAdmin } from "@/features/admin/guard";
import { RestaurantForm } from "@/features/admin/restaurant-form";
import { emptyRestaurant } from "@/features/admin/restaurant-form-values";
import { getKakaoAppKey } from "@/lib/env";

export const metadata: Metadata = { title: "식당 등록 - 혼밥 지도 관리자" };

export default async function NewRestaurantPage({ searchParams }: { searchParams: Promise<{ request?: string }> }) {
  const { supabase } = await requireAdmin();
  const { request } = await searchParams;

  // 요청 목록의 "이 정보로 식당 등록": 이름·주소·좌표·카카오 장소를 미리 채운다
  const initial = emptyRestaurant();
  let fromRequest: string | null = null;
  if (request && z.guid().safeParse(request).success) {
    const { data: q } = await supabase
      .from("restaurant_requests")
      .select("name, address, latitude, longitude, category, kakao_place_id, vote_count")
      .eq("id", request)
      .maybeSingle();
    if (q) {
      Object.assign(initial, {
        name: q.name,
        address: q.address,
        latitude: q.latitude,
        longitude: q.longitude,
        category: q.category ?? "",
        kakao_place_id: q.kakao_place_id,
      });
      fromRequest = `요청 ${q.vote_count}명이 모인 ‘${q.name}’ 정보를 채워 두었어요. 저장하면 요청이 ‘등록됨’으로 바뀌어요.`;
    }
  }
  return (
    <main className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
      <Link href="/admin/restaurants" className="text-sm text-gray-600 underline">
        ← 목록으로
      </Link>
      <h1 className="mt-2 mb-6 text-xl font-bold">식당 직접 등록</h1>
      {fromRequest ? (
        <p className="-mt-3 mb-6 rounded-lg border border-primary/30 bg-primary-soft p-3 text-sm text-primary-strong">{fromRequest}</p>
      ) : null}
      <RestaurantForm restaurantId={null} initial={initial} kakaoAppKey={getKakaoAppKey()} />
    </main>
  );
}
