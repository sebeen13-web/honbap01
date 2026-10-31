import type { Category, PolicySource, TimeSlot } from "@/types/database";

export const CATEGORIES: readonly Category[] = ["고깃집", "샤브샤브", "회", "기타"];

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
