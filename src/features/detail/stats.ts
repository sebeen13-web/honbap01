"use client";

import { createClient } from "@/lib/supabase/client";
import type { StatKind } from "@/types/database";

/** 사장님 통계: 숫자만 1 올린다(개인 정보 없음). 실패해도 화면에는 영향 없게 조용히 무시한다. */
export function bumpStat(restaurantId: string, kind: StatKind) {
  try {
    void createClient()
      .rpc("increment_restaurant_stat", { p_restaurant_id: restaurantId, p_kind: kind })
      .then(() => undefined, () => undefined);
  } catch {
    // 환경변수 누락 등: 무시
  }
}
