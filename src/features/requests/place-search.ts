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

/** 카카오 분류(예: "음식점 > 한식 > 육류,고기 > 삼겹살")와 가게 이름으로 음식 종류를 추정한다. 사용자가 바꿀 수 있다. */
const GUESS: [RegExp, Category][] = [
  [/샤브/, "샤브샤브"],
  [/곱창|막창|대창/, "곱창·막창"],
  [/닭갈비|찜닭/, "닭갈비·찜닭"],
  [/족발|보쌈/, "족발·보쌈"],
  [/(^|>|\s|,)회($|\s|,)|횟집|참치|생선회/, "회"],
  [/해물|해산물|조개|대게|킹크랩|랍스터|새우|생선구이|장어/, "해산물·조개구이"],
  [/중식|중국요리|중화요리|짬뽕|양꼬치|마라/, "중식 요리"],
  [/국밥|순대|해장국|설렁탕|곰탕|순댓국/, "국밥·순대"],
  [/전골|찜|감자탕|부대찌개|아구|아귀|매운탕|탕/, "전골·찜·탕"],
  [/돈가스|돈까스|경양식|카츠|커틀릿/, "돈가스·경양식"],
  [/국수|칼국수|냉면|막국수|우동|라멘|쌀국수/, "국수·칼국수"],
  [/찌개|백반|한정식|가정식|순두부|기사식당/, "찌개·백반"],
  [/분식|김밥|떡볶이|만두|라면/, "분식"],
  [/육류|고기|삼겹|갈비|돼지|소고기|한우|오리|구이/, "고깃집"],
];
export function guessCategory(categoryName: string | undefined, placeName = ""): Category {
  const s = `${categoryName ?? ""} ${placeName}`;
  return GUESS.find(([re]) => re.test(s))?.[1] ?? "기타";
}

/** "음식점 > 한식 > 육류,고기" → "육류,고기" */
export function lastCategory(categoryName: string | undefined): string {
  const parts = (categoryName ?? "").split(">").map((x) => x.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? "";
}
