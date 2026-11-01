"use client";

import { loadKakaoSdk } from "@/features/map/load-kakao-sdk";
import type { KakaoPlaceResult } from "@/features/map/kakao-types";
import type { LatLng } from "@/features/location/use-user-location";
import type { Category } from "@/types/database";

/**
 * 카카오 장소(키워드) 검색. 음식점(FD6)만, 기준점이 있으면 그 근처(최대 20km) 우선.
 * 기준점 좌표는 카카오 검색 요청에만 쓰고 저장하지 않는다.
 */
export async function searchRestaurantsOnKakao(
  appKey: string,
  query: string,
  near: LatLng | null,
  opts: { onlyRestaurants?: boolean } = { onlyRestaurants: true },
): Promise<KakaoPlaceResult[]> {
  const kakao = await loadKakaoSdk(appKey);
  const { services } = kakao.maps;
  return new Promise((resolve, reject) => {
    new services.Places().keywordSearch(
      query,
      (result, status) => {
        if (status === services.Status.ERROR) return reject(new Error("장소 검색 중 오류가 났어요."));
        resolve(result ?? []);
      },
      {
        size: 15,
        ...(opts.onlyRestaurants ? { category_group_code: "FD6" } : {}),
        ...(near ? { location: new kakao.maps.LatLng(near.lat, near.lng), radius: 20000 } : {}),
      },
    );
  });
}

/** "음식점 > 한식 > 육류,고기 > 삼겹살" → 고깃집 / 샤브샤브 / 회 / 기타 */
export function guessCategory(categoryName: string | undefined): Category {
  const s = categoryName ?? "";
  if (/샤브/.test(s)) return "샤브샤브";
  if (/육류|고기|삼겹|갈비|곱창|막창|양꼬치|돼지|소고기|오리/.test(s)) return "고깃집";
  if (/회|횟집|해산물|생선|참치|해물/.test(s)) return "회";
  return "기타";
}

/** "음식점 > 한식 > 육류,고기" → "육류,고기" */
export function lastCategory(categoryName: string | undefined): string {
  const parts = (categoryName ?? "").split(">").map((x) => x.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? "";
}
