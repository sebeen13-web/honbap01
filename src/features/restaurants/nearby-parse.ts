import type { DayType, NearbyRestaurant, SoloMenu, TimeRule } from "@/types/database";

/**
 * nearby_restaurants() 응답의 jsonb 칸(menus, time_rules)을 화면에서 믿고 쓸 수 있게 정리한다.
 * DB 함수가 만든 값이라 보통은 그대로지만, 형식이 어긋난 항목은 버린다.
 */
const DAY_TYPES: readonly DayType[] = ["weekday", "weekend", "all"];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

export function parseMenus(raw: unknown): SoloMenu[] {
  if (!Array.isArray(raw)) return [];
  const out: SoloMenu[] = [];
  for (const m of raw) {
    if (!isObj(m)) continue;
    const name = str(m.name);
    const solo = num(m.solo_price);
    if (!name || solo === null) continue;
    out.push({
      name,
      solo_price: solo,
      regular_price_per_person: num(m.regular_price_per_person),
      normal_min_servings: num(m.normal_min_servings) ?? 2,
      note: str(m.note),
      sort_order: num(m.sort_order) ?? 0,
    });
  }
  return out.sort((a, b) => a.sort_order - b.sort_order);
}

export function parseTimeRules(raw: unknown): TimeRule[] {
  if (!Array.isArray(raw)) return [];
  const out: TimeRule[] = [];
  for (const r of raw) {
    if (!isObj(r)) continue;
    const day = str(r.day_type) as DayType | null;
    const start = str(r.start_time);
    const end = str(r.end_time);
    if (!day || !DAY_TYPES.includes(day) || !start || !end || typeof r.available !== "boolean") continue;
    out.push({ day_type: day, start_time: start, end_time: end, available: r.available, note: str(r.note) });
  }
  return out;
}

export function normalizeNearbyRows(rows: NearbyRestaurant[] | null | undefined): NearbyRestaurant[] {
  return (rows ?? []).map((r) => ({
    ...r,
    menus: parseMenus(r.menus as unknown),
    time_rules: parseTimeRules(r.time_rules as unknown),
    ok_30d: r.ok_30d ?? 0,
    not_ok_30d: r.not_ok_30d ?? 0,
    needs_review: r.needs_review === true,
  }));
}
