import { ANSAN_RESEARCH } from "@/features/admin/import/ansan-research";
import { ANSAN_RESEARCH_2 } from "@/features/admin/import/ansan-research-2";

/** 일괄 등록 화면에서 쓰는 전체 조사 목록 (1차 + 2차) */
export const ALL_RESEARCH = [...ANSAN_RESEARCH, ...ANSAN_RESEARCH_2];
