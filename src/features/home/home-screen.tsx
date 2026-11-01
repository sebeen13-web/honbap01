"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CATEGORIES } from "@/lib/constants";
import { EMPTY_FILTERS } from "@/features/restaurants/filters";
import { RestaurantCard } from "@/features/restaurants/restaurant-card";
import { LocationBar } from "@/features/nearby/location-bar";
import { useNearby } from "@/features/nearby/nearby-context";
import { searchMenus } from "@/features/home/menu-search";
import { MenuResultCard } from "@/features/home/menu-result-card";
import type { Category, NearbyRestaurant } from "@/types/database";

const SECTION_MAX = 8;
const NEW_DAYS = 14;
const CATEGORY_ICON: Record<Category, string> = { 고깃집: "🥩", 샤브샤브: "🍲", 회: "🐟", 기타: "🍚" };

type Section = { key: string; title: string; rows: NearbyRestaurant[] };

function buildSections(rows: NearbyRestaurant[], now = Date.now()): Section[] {
  const byDistance = [...rows].sort((a, b) => a.distance_m - b.distance_m);
  const cut = now - NEW_DAYS * 24 * 60 * 60 * 1000;
  return [
    { key: "now", title: "지금 1인분 가능한 곳", rows: byDistance.filter((r) => r.is_solo_available_now === true) },
    {
      key: "cheap",
      title: "만원 이하로 먹을 수 있어요",
      rows: byDistance.filter((r) => r.min_solo_price !== null && r.min_solo_price <= 10000),
    },
    {
      key: "confirmed",
      title: "최근 확인된 곳",
      rows: rows
        .filter((r) => r.last_ok_at !== null)
        .sort((a, b) => Date.parse(b.last_ok_at!) - Date.parse(a.last_ok_at!)),
    },
    {
      key: "new",
      title: "새로 등록된 곳",
      rows: rows.filter((r) => Date.parse(r.created_at) >= cut).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
    },
  ]
    .map((s) => ({ ...s, rows: s.rows.slice(0, SECTION_MAX) }))
    .filter((s) => s.rows.length > 0);
}

/** 홈 탭: 위치 한 줄, 메뉴 검색, 음식 종류 버튼, 가로 스크롤 섹션 */
export function HomeScreen() {
  const router = useRouter();
  const { origin, nearby, retry, setFilters, setPendingFocusId, favorites, requireLogin } = useNearby();
  const [query, setQuery] = useState("");

  const sections = useMemo(() => buildSections(nearby.rows), [nearby.rows]);
  const hits = useMemo(() => searchMenus(nearby.rows, query), [nearby.rows, query]);
  const searching = query.trim().length > 0;

  const goMapWithCategory = (c: Category) => {
    setFilters({ ...EMPTY_FILTERS, categories: [c] });
    router.push("/map");
  };
  const openOnMap = (id: string) => {
    setPendingFocusId(id);
    router.push("/map");
  };
  const toggleFavorite = (id: string) => {
    if (
      requireLogin({
        title: "로그인하면 저장할 수 있어요",
        description: "즐겨찾기한 식당은 ‘내 정보’에서 다시 볼 수 있어요. 둘러보기는 로그인 없이 가능해요.",
        next: "/",
      })
    )
      void favorites.toggle(id);
  };

  return (
    <main className="mx-auto max-w-xl px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-8">
      <header>
        <h1 className="text-2xl font-bold text-primary-strong">혼밥 지도</h1>
        <p className="mt-0.5 text-sm text-gray-700">2인분부터 파는 식당에서, 1인분이 되는 메뉴와 가격을 미리 알려 드려요.</p>
      </header>

      <div className="mt-4">
        <LocationBar intro="내 주변에서 1인분 되는 식당을 찾아드려요" />
      </div>

      {/* 메뉴 검색 */}
      <div className="mt-4">
        <label htmlFor="menu-search" className="sr-only">
          메뉴 이름으로 검색
        </label>
        <div className="relative">
          <input
            id="menu-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="메뉴 이름으로 검색 (예: 삼겹살, 샤브샤브)"
            className="input min-h-12 pl-10"
            autoComplete="off"
          />
          <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {searching ? (
        <section className="mt-4" aria-live="polite">
          {!origin ? (
            <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700">먼저 위치나 동네를 정하면 근처 식당의 메뉴에서 찾아 드려요.</p>
          ) : nearby.status === "loading" ? (
            <p className="text-sm text-gray-700">찾는 중…</p>
          ) : hits.length === 0 ? (
            <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
              ‘{query.trim()}’ 메뉴를 1인분으로 파는 곳을 근처에서 찾지 못했어요. 반경을 넓히거나 다른 이름으로 찾아보세요.
            </p>
          ) : (
            <>
              <h2 className="text-base font-bold text-gray-900">‘{query.trim()}’ 1인분 메뉴 {hits.length}개</h2>
              <ul className="mt-2 space-y-2">
                {hits.map((h) => (
                  <MenuResultCard key={`${h.restaurant.id}-${h.menu.sort_order}-${h.menu.name}`} hit={h} />
                ))}
              </ul>
            </>
          )}
        </section>
      ) : (
        <>
          {/* 음식 종류 */}
          <nav aria-label="음식 종류로 지도 보기" className="mt-5 grid grid-cols-4 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => goMapWithCategory(c)}
                className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border border-gray-200 bg-white text-sm font-semibold text-gray-900 hover:border-primary hover:bg-primary-soft"
              >
                <span aria-hidden className="text-2xl">
                  {CATEGORY_ICON[c]}
                </span>
                {c}
              </button>
            ))}
          </nav>

          {/* 섹션 */}
          {!origin ? null : nearby.status === "loading" || nearby.status === "idle" ? (
            <div className="mt-6 space-y-3" aria-busy="true" aria-label="식당 불러오는 중">
              <div className="h-5 w-40 animate-pulse rounded bg-gray-100" />
              <div className="flex gap-3 overflow-hidden">
                <div className="h-56 w-72 shrink-0 animate-pulse rounded-xl bg-gray-100" />
                <div className="h-56 w-72 shrink-0 animate-pulse rounded-xl bg-gray-100" />
              </div>
            </div>
          ) : nearby.status === "error" ? (
            <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p>{nearby.message}</p>
              <button type="button" onClick={retry} className="btn-secondary mt-3 w-full">
                다시 시도
              </button>
            </div>
          ) : nearby.rows.length === 0 ? (
            <div className="mt-6 rounded-xl bg-gray-50 p-5 text-center text-sm text-gray-800">
              <p className="font-medium">이 근처엔 아직 등록된 식당이 없어요. 요청 탭에서 가고 싶은 식당을 요청해 보세요.</p>
              <Link href="/request" className="btn-primary mt-3">
                식당 요청하러 가기
              </Link>
            </div>
          ) : (
            sections.map((s) => (
              <section key={s.key} className="mt-6" aria-labelledby={`sec-${s.key}`}>
                <div className="flex items-center justify-between">
                  <h2 id={`sec-${s.key}`} className="text-lg font-bold text-gray-900">
                    {s.title}
                  </h2>
                  <Link href="/map" className="inline-flex min-h-11 items-center text-sm font-medium text-primary-strong">
                    지도에서 보기
                  </Link>
                </div>
                <ul className="no-scrollbar -mx-4 mt-1 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
                  {s.rows.map((r) => (
                    <RestaurantCard
                      key={r.id}
                      className="w-[min(20rem,85vw)] shrink-0 snap-start"
                      restaurant={r}
                      selected={false}
                      onSelect={() => openOnMap(r.id)}
                      favorite={favorites.ids.has(r.id)}
                      onToggleFavorite={() => toggleFavorite(r.id)}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
          {favorites.error ? (
            <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {favorites.error}
            </p>
          ) : null}
        </>
      )}
    </main>
  );
}
