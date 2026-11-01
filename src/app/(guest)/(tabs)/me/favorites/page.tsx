import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/features/auth/guard";
import { RemoveFavoriteButton } from "@/features/favorites/remove-favorite-button";

export const metadata: Metadata = { title: "즐겨찾기 - 혼밥 지도" };
export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const { supabase, user } = await requireUser("/me/favorites");
  const { data, error } = await supabase
    .from("favorites")
    .select("restaurant_id, created_at, restaurants(id, name, category, address)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const rows = data ?? [];

  return (
    <main className="mx-auto max-w-md px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-8">
      <Link href="/me" className="text-sm text-gray-700 underline underline-offset-2">
        ← 내 정보
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">즐겨찾기</h1>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          즐겨찾기를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      ) : rows.length === 0 ? (
        <div className="mt-6 rounded-xl bg-gray-50 p-6 text-center text-sm text-gray-700">
          <p>아직 저장한 식당이 없어요.</p>
          <p className="mt-1">지도에서 식당 카드의 ♡ 를 눌러 저장해 보세요.</p>
          <Link href="/map" className="btn-primary mt-4">
            지도로 가기
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((f) => {
            const r = f.restaurants;
            return (
              <li key={f.restaurant_id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3">
                {r ? (
                  <Link href={`/restaurants/${r.id}`} prefetch={false} className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-gray-900">{r.name}</span>
                    <span className="block truncate text-sm text-gray-700">
                      {r.category} · {r.address}
                    </span>
                  </Link>
                ) : (
                  <p className="min-w-0 flex-1 text-sm text-gray-700">지금은 볼 수 없는 식당이에요 (숨김 또는 일시중단)</p>
                )}
                <RemoveFavoriteButton restaurantId={f.restaurant_id} name={r?.name ?? "이 식당"} />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
