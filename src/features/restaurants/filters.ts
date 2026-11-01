import type { Category, NearbyRestaurant } from "@/types/database";

/** 가격대 (min_solo_price 기준): 1만원 이하 / 1만원 초과~2만원 미만 / 2만원 이상 */
export const PRICE_BANDS = ["under10k", "10to20k", "over20k"] as const;
export type PriceBand = (typeof PRICE_BANDS)[number];
export const PRICE_BAND_LABEL: Record<PriceBand, string> = {
  under10k: "1만원 이하",
  "10to20k": "1~2만원",
  over20k: "2만원 이상",
};

export function priceBandOf(price: number): PriceBand {
  if (price <= 10000) return "under10k";
  if (price < 20000) return "10to20k";
  return "over20k";
}

export type SortKey = "distance" | "price";

export type RestaurantFilters = {
  categories: Category[];
  /** '지금 1인분 가능' (is_solo_available_now === true 만) */
  availableNow: boolean;
  priceBands: PriceBand[];
};

export const EMPTY_FILTERS: RestaurantFilters = { categories: [], availableNow: false, priceBands: [] };

export function countActiveFilters(f: RestaurantFilters): number {
  return f.categories.length + (f.availableNow ? 1 : 0) + f.priceBands.length;
}

export type FilterResult = {
  rows: NearbyRestaurant[];
  /** '지금 1인분 가능'을 켰을 때 시간 정보(규칙)가 없어 빠진 식당 수 */
  excludedUnknownTime: number;
};

/**
 * 조회 결과에 클라이언트에서 필터·정렬을 적용한다.
 *  - 같은 그룹 안에서는 OR, 그룹끼리는 AND
 *  - needs_review 식당은 숨기거나 뒤로 미루지 않는다
 *  - 낮은 가격순: min_solo_price 오름차순, 가격 없는 곳은 뒤로, 같으면 가까운 순
 */
export function applyFilters(rows: NearbyRestaurant[], f: RestaurantFilters, sort: SortKey): FilterResult {
  let excludedUnknownTime = 0;
  const out = rows.filter((r) => {
    if (f.categories.length > 0 && !f.categories.includes(r.category)) return false;
    if (f.priceBands.length > 0) {
      if (r.min_solo_price === null || !f.priceBands.includes(priceBandOf(r.min_solo_price))) return false;
    }
    if (f.availableNow) {
      if (r.is_solo_available_now === null) {
        excludedUnknownTime += 1;
        return false;
      }
      if (!r.is_solo_available_now) return false;
    }
    return true;
  });
  if (sort === "price") {
    out.sort((a, b) => {
      const pa = a.min_solo_price ?? Number.POSITIVE_INFINITY;
      const pb = b.min_solo_price ?? Number.POSITIVE_INFINITY;
      return pa === pb ? a.distance_m - b.distance_m : pa - pb;
    });
  }
  return { rows: out, excludedUnknownTime };
}
