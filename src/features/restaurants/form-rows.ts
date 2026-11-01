import type { DayType } from "@/types/database";

/**
 * 폼의 메뉴·시간대 규칙 행. 서버 컴포넌트(수정 화면 초기값)와 클라이언트 폼이 함께 쓰므로
 * "use client" 가 없는 일반 모듈에 둔다.
 * key 는 React 목록용. 서버에서 만든 행과 브라우저에서 추가한 행이 겹치지 않도록 임의 문자열을 쓴다.
 */
const randomKey = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

export type MenuRow = {
  key: string;
  name: string;
  /** 숫자 문자열 ("18000") */
  solo_price: string;
  regular_price_per_person: string;
  normal_min_servings: string;
  note: string;
};

export const newMenuRow = (init?: Partial<Omit<MenuRow, "key">>): MenuRow => ({
  key: randomKey("menu"),
  name: "",
  solo_price: "",
  regular_price_per_person: "",
  normal_min_servings: "2",
  note: "",
  ...init,
});

export type TimeRuleRow = {
  key: string;
  day_type: DayType;
  start_time: string;
  end_time: string;
  available: boolean;
  note: string;
};

export const newTimeRuleRow = (init?: Partial<Omit<TimeRuleRow, "key">>): TimeRuleRow => ({
  key: randomKey("rule"),
  day_type: "all",
  start_time: "11:00",
  end_time: "21:00",
  available: true,
  note: "",
  ...init,
});
