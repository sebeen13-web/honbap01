import type { NearbyRestaurant, SoloMenu } from "@/types/database";

export type MenuHit = { menu: SoloMenu; restaurant: NearbyRestaurant };

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/** 조회된 근처 식당의 메뉴를 이름으로 찾는다 (클라이언트). 가까운 순, 같은 식당 안에서는 싼 순. */
export function searchMenus(rows: NearbyRestaurant[], query: string, limit = 30): MenuHit[] {
  const q = norm(query);
  if (!q) return [];
  const hits: MenuHit[] = [];
  for (const r of rows) {
    for (const m of r.menus) {
      if (norm(m.name).includes(q)) hits.push({ menu: m, restaurant: r });
    }
  }
  hits.sort((a, b) => a.restaurant.distance_m - b.restaurant.distance_m || a.menu.solo_price - b.menu.solo_price);
  return hits.slice(0, limit);
}
