import type { Category, NearbyRestaurant, TimeSlot } from "@/types/database";

/** 필터 칩의 시간대 선택지 (별도 안내(custom)는 칩으로 고르지 않는다) */
export const TIME_SLOT_FILTERS = ["lunch", "dinner", "all_day"] as const satisfies readonly TimeSlot[];
export type TimeSlotFilter = (typeof TIME_SLOT_FILTERS)[number];

export type RestaurantFilters = {
  categories: Category[];
  openNow: boolean;
  timeSlots: TimeSlotFilter[];
};

export const EMPTY_FILTERS: RestaurantFilters = { categories: [], openNow: false, timeSlots: [] };

export function countActiveFilters(f: RestaurantFilters): number {
  return f.categories.length + (f.openNow ? 1 : 0) + f.timeSlots.length;
}

/**
 * 시간대 칩 의미
 *  - 점심 / 저녁: 그 시간에 1인분이 되는 곳 → 해당 시간대 + 종일 가능한 곳
 *  - 종일: 종일 가능한 곳만
 * 여러 칩을 고르면 하나라도 맞으면 보여준다(OR). 음식 종류도 OR, 그룹끼리는 AND.
 */
function matchesTimeSlot(slot: TimeSlot, selected: TimeSlotFilter[]): boolean {
  if (selected.length === 0) return true;
  if (selected.includes(slot as TimeSlotFilter)) return true;
  return slot === "all_day" && (selected.includes("lunch") || selected.includes("dinner"));
}

export type FilterResult = {
  rows: NearbyRestaurant[];
  /** '지금 영업 중'을 켰을 때 영업시간 정보가 없어 빠진 식당 수 */
  excludedUnknownHours: number;
};

/** 조회된 결과에 클라이언트에서 필터를 적용한다 (거리순 유지). */
export function applyFilters(rows: NearbyRestaurant[], f: RestaurantFilters): FilterResult {
  let excludedUnknownHours = 0;
  const out = rows.filter((r) => {
    if (f.categories.length > 0 && !f.categories.includes(r.category)) return false;
    if (!matchesTimeSlot(r.time_slot, f.timeSlots)) return false;
    if (f.openNow) {
      if (r.is_open_now === null) {
        excludedUnknownHours += 1;
        return false;
      }
      if (!r.is_open_now) return false;
    }
    return true;
  });
  return { rows: out, excludedUnknownHours };
}
