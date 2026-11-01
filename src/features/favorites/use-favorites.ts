"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 로그인 사용자의 즐겨찾기(식당 id 목록). RLS 로 본인 것만 읽고 쓸 수 있다.
 * nearby_restaurants 와 섞지 않고 따로 조회한다(함수에 개인 정보를 넣지 않음).
 */
export function useFavorites(userId: string | null) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIds(new Set());
    if (!userId) return;
    let active = true;
    (async () => {
      const { data, error } = await createClient().from("favorites").select("restaurant_id").eq("user_id", userId);
      if (!active) return;
      if (error) setError("즐겨찾기를 불러오지 못했어요.");
      else setIds(new Set((data ?? []).map((r) => r.restaurant_id)));
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  /** 즉시 화면에 반영하고, 실패하면 되돌린다 */
  const toggle = useCallback(
    async (restaurantId: string) => {
      if (!userId) return;
      const wasSaved = ids.has(restaurantId);
      setError(null);
      setIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.delete(restaurantId);
        else next.add(restaurantId);
        return next;
      });
      const supabase = createClient();
      const { error } = wasSaved
        ? await supabase.from("favorites").delete().eq("user_id", userId).eq("restaurant_id", restaurantId)
        : await supabase.from("favorites").insert({ user_id: userId, restaurant_id: restaurantId });
      if (error) {
        setIds((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(restaurantId);
          else next.delete(restaurantId);
          return next;
        });
        setError(wasSaved ? "즐겨찾기에서 빼지 못했어요. 다시 시도해 주세요." : "즐겨찾기에 저장하지 못했어요. 다시 시도해 주세요.");
      }
    },
    [ids, userId],
  );

  return { ids, toggle, error };
}
