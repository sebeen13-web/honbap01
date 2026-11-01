import type { Category, PolicySource, TimeSlot } from "@/types/database";

/** 음식 종류 (표시 순서). DB 의 valid_categories() 와 같게 유지한다 */
export const CATEGORIES: readonly Category[] = [
  "고깃집",
  "곱창·막창",
  "닭갈비·찜닭",
  "족발·보쌈",
  "샤브샤브",
  "전골·찜·탕",
  "회",
  "해산물·조개구이",
  "중식 요리",
  "국밥·순대",
  "돈가스·경양식",
  "국수·칼국수",
  "찌개·백반",
  "분식",
  "기타",
];

/** 홈의 음식 종류 버튼 아이콘 */
export const CATEGORY_ICON: Record<Category, string> = {
  고깃집: "🥩",
  "곱창·막창": "🔥",
  "닭갈비·찜닭": "🍗",
  "족발·보쌈": "🐷",
  샤브샤브: "🍲",
  "전골·찜·탕": "🥘",
  회: "🐟",
  "해산물·조개구이": "🦪",
  "중식 요리": "🥡",
  "국밥·순대": "🥣",
  "돈가스·경양식": "🍛",
  "국수·칼국수": "🍜",
  "찌개·백반": "🍚",
  분식: "🍢",
  기타: "🍴",
};

export const TIME_SLOT_LABEL: Record<TimeSlot, string> = {
  all_day: "종일",
  lunch: "점심",
  dinner: "저녁",
  custom: "별도 안내",
};

export const SOURCE_LABEL: Record<PolicySource, string> = {
  admin_checked: "직접 확인함",
  owner_registered: "사장님 등록",
};

export const RADIUS_OPTIONS_M = [1000, 3000, 5000] as const;
export const DEFAULT_RADIUS_M = 3000;

/** 위치를 못 받았을 때의 기본 지도 중심: 경기도 안산시청 */
export const DEFAULT_CENTER = { lat: 37.3219, lng: 126.8309 } as const;
