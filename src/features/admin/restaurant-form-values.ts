import type { BusinessHours } from "@/features/restaurants/schema";
import { newMenuRow, type MenuRow, type TimeRuleRow } from "@/features/restaurants/form-rows";
import type { Category, TimeSlot } from "@/types/database";

/** 관리자 식당 폼의 값. 서버 컴포넌트(초기값 생성)와 클라이언트 폼이 함께 쓴다. */
export type RestaurantFormInitial = {
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  category: Category | "";
  menus: MenuRow[];
  time_rules: TimeRuleRow[];
  time_slot: TimeSlot;
  time_slot_note: string;
  extra_fee: boolean;
  extra_fee_note: string;
  business_hours: BusinessHours | null;
  /** 카카오 장소 id ("" = 없음) */
  kakao_place_id: string;
};

/** 새 등록 폼의 초기값 (행 key 가 매번 새로 만들어지도록 함수로 둔다) */
export const emptyRestaurant = (): RestaurantFormInitial => ({
  name: "",
  address: "",
  latitude: null,
  longitude: null,
  phone: "",
  category: "",
  menus: [newMenuRow()],
  time_rules: [],
  time_slot: "all_day",
  time_slot_note: "",
  extra_fee: false,
  extra_fee_note: "",
  business_hours: null,
  kakao_place_id: "",
});

