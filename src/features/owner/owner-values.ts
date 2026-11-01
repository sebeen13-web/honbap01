import { newMenuRow, newTimeRuleRow, type MenuRow, type TimeRuleRow } from "@/features/restaurants/form-rows";
import type { Category } from "@/types/database";

/** 사장님 등록·수정 폼 값 (서버 페이지와 클라이언트 폼이 함께 쓰므로 "use client" 없는 모듈) */
export type OwnerPlace = {
  kakao_place_id: string | null;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  category: Category | "";
};

export type OwnerWizardInitial = { place: OwnerPlace; menus: MenuRow[]; time_rules: TimeRuleRow[] };

export const emptyOwnerInitial = (): OwnerWizardInitial => ({
  place: { kakao_place_id: null, name: "", address: "", latitude: null, longitude: null, phone: "", category: "" },
  menus: [newMenuRow()],
  time_rules: [newTimeRuleRow()],
});

