import { z } from "zod";
import { CATEGORIES } from "@/lib/constants";
import { MAX_SOLO_MENUS, MAX_TIME_RULES, menuItemSchema, timeRuleSchema } from "@/features/restaurants/schema";
import type { Category } from "@/types/database";

const PHONE_RE = /^[0-9+\-() ]{7,20}$/;
const pickPlace = "가게 이름으로 검색해서 골라 주세요.";

/** 1단계: 식당 (카카오 장소에서 고른 값 + 이름·전화·종류는 고칠 수 있음) */
export const ownerPlaceSchema = z.object({
  kakao_place_id: z
    .string()
    .regex(/^\d{1,20}$/)
    .nullable(),
  name: z.string().trim().min(1, "가게 이름을 입력해 주세요.").max(100, "가게 이름은 100자 이하로 입력해 주세요."),
  address: z.string().trim().min(1, pickPlace).max(200, "주소가 너무 길어요."),
  latitude: z.number({ error: pickPlace }).min(33, "대한민국 안의 가게만 등록할 수 있어요.").max(39, "대한민국 안의 가게만 등록할 수 있어요."),
  longitude: z.number({ error: pickPlace }).min(124, "대한민국 안의 가게만 등록할 수 있어요.").max(132, "대한민국 안의 가게만 등록할 수 있어요."),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || PHONE_RE.test(v), "전화번호는 숫자와 - 로 입력해 주세요. (예: 031-123-4567)")
    .transform((v) => (v === "" ? null : v)),
  category: z.enum(CATEGORIES as [Category, ...Category[]], { error: "음식 종류를 골라 주세요." }),
});

export const ownerMenusSchema = z
  .array(menuItemSchema)
  .min(1, "1인분 메뉴를 하나 이상 입력해 주세요.")
  .max(MAX_SOLO_MENUS, `메뉴는 최대 ${MAX_SOLO_MENUS}개까지 등록할 수 있어요.`)
  .superRefine((menus, ctx) => {
    const seen = new Set<string>();
    menus.forEach((m, i) => {
      if (seen.has(m.name)) ctx.addIssue({ code: "custom", path: [i, "name"], message: "같은 이름의 메뉴가 이미 있어요." });
      seen.add(m.name);
    });
  });

export const ownerRulesSchema = z
  .array(timeRuleSchema)
  .min(1, "1인분 되는 시간을 하나 이상 입력해 주세요.")
  .max(MAX_TIME_RULES, `시간대 규칙은 최대 ${MAX_TIME_RULES}개까지 등록할 수 있어요.`);

/** 사장님 등록·수정 전체 (클라이언트 단계별 검사 + 서버 최종 검사에 같이 쓴다) */
export const ownerFormSchema = z.object({
  place: ownerPlaceSchema,
  menus: ownerMenusSchema,
  time_rules: ownerRulesSchema,
});
export type OwnerFormInput = z.input<typeof ownerFormSchema>;
