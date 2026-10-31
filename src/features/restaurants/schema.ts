import { z } from "zod";
import { CATEGORIES } from "@/lib/constants";
import type { Category, TimeSlot } from "@/types/database";

/**
 * 식당 + 1인분 정책 입력 검증 (클라이언트 폼과 서버 액션이 같은 스키마를 쓴다).
 * DB 의 check 제약(supabase/migrations)과 범위를 맞춰 둔다.
 * source / last_verified_at / is_active 는 입력받지 않는다 — 서버가 결정한다.
 */

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];
export const DAY_LABEL: Record<DayKey, string> = {
  mon: "월",
  tue: "화",
  wed: "수",
  thu: "목",
  fri: "금",
  sat: "토",
  sun: "일",
};

export const TIME_SLOTS = ["all_day", "lunch", "dinner", "custom"] as const satisfies readonly TimeSlot[];

export const MAX_SOLO_MENUS = 20;
const NOTE_MAX = 200;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE_RE = /^[0-9+\-() ]{7,20}$/;

/** 빈 문자열/공백 → null */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}은(는) ${max}자 이하로 입력해 주세요.`)
    .transform((v) => (v === "" ? null : v));

const dayHoursSchema = z
  .object({
    open: z.string().regex(TIME_RE, "여는 시간을 HH:MM 형식으로 입력해 주세요."),
    close: z.string().regex(TIME_RE, "닫는 시간을 HH:MM 형식으로 입력해 주세요."),
  })
  .nullable(); // null = 휴무

export const businessHoursSchema = z.object({
  mon: dayHoursSchema,
  tue: dayHoursSchema,
  wed: dayHoursSchema,
  thu: dayHoursSchema,
  fri: dayHoursSchema,
  sat: dayHoursSchema,
  sun: dayHoursSchema,
});
export type BusinessHours = z.infer<typeof businessHoursSchema>;

export const restaurantFormSchema = z
  .object({
    name: z.string().trim().min(1, "식당 이름을 입력해 주세요.").max(100, "식당 이름은 100자 이하로 입력해 주세요."),
    address: z.string().trim().min(1, "주소 검색으로 주소를 선택해 주세요.").max(200, "주소가 너무 깁니다."),
    latitude: z
      .number({ error: "주소 검색으로 주소를 선택하면 위도·경도가 자동으로 들어갑니다." })
      .min(33, "대한민국 안의 주소만 등록할 수 있어요.")
      .max(39, "대한민국 안의 주소만 등록할 수 있어요."),
    longitude: z
      .number({ error: "주소 검색으로 주소를 선택하면 위도·경도가 자동으로 들어갑니다." })
      .min(124, "대한민국 안의 주소만 등록할 수 있어요.")
      .max(132, "대한민국 안의 주소만 등록할 수 있어요."),
    phone: z
      .string()
      .trim()
      .refine((v) => v === "" || PHONE_RE.test(v), "전화번호는 숫자와 - 로 7~20자 입력해 주세요. (예: 031-123-4567)")
      .transform((v) => (v === "" ? null : v)),
    category: z.enum(CATEGORIES as [Category, ...Category[]], { error: "음식 종류를 선택해 주세요." }),
    solo_menus: z
      .array(z.string().trim().min(1, "메뉴 이름을 입력하거나 이 칸을 삭제해 주세요.").max(50, "메뉴 이름은 50자 이하로 입력해 주세요."))
      .min(1, "1인분 가능 메뉴를 하나 이상 입력해 주세요.")
      .max(MAX_SOLO_MENUS, `메뉴는 최대 ${MAX_SOLO_MENUS}개까지 등록할 수 있어요.`),
    time_slot: z.enum(TIME_SLOTS, { error: "가능 시간대를 선택해 주세요." }),
    time_slot_note: optionalText(NOTE_MAX, "시간대 메모"),
    extra_fee: z.boolean(),
    extra_fee_note: optionalText(NOTE_MAX, "추가 요금 설명"),
    /** null = 영업시간 정보 없음 (선택 항목) */
    business_hours: businessHoursSchema.nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.time_slot === "custom" && !v.time_slot_note) {
      ctx.addIssue({ code: "custom", path: ["time_slot_note"], message: "‘별도 안내’를 고르면 시간대 메모를 입력해 주세요." });
    }
    if (v.extra_fee && !v.extra_fee_note) {
      ctx.addIssue({ code: "custom", path: ["extra_fee_note"], message: "추가 요금이 있으면 금액이나 조건을 적어 주세요." });
    }
    const seen = new Set<string>();
    v.solo_menus.forEach((m, i) => {
      if (seen.has(m)) ctx.addIssue({ code: "custom", path: ["solo_menus", i], message: "같은 메뉴가 이미 있어요." });
      seen.add(m);
    });
  })
  .transform((v) => ({
    ...v,
    // 추가 요금이 없으면 설명은 저장하지 않는다
    extra_fee_note: v.extra_fee ? v.extra_fee_note : null,
  }));

export type RestaurantFormInput = z.input<typeof restaurantFormSchema>;
export type RestaurantFormOutput = z.output<typeof restaurantFormSchema>;

/** "solo_menus.0" 같은 경로 → 첫 번째 오류 메시지 */
export type FieldErrors = Record<string, string>;

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
