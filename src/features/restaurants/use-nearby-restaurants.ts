"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NearbyRestaurant } from "@/types/database";
import type { LatLng } from "@/features/location/use-user-location";
import { normalizeNearbyRows } from "@/features/restaurants/nearby-parse";

export type NearbyState =
  | { status: "idle"; rows: NearbyRestaurant[] }
  | { status: "loading"; rows: NearbyRestaurant[] }
  | { status: "success"; rows: NearbyRestaurant[] }
  | { status: "error"; rows: NearbyRestaurant[]; message: string };

/**
 * origin 주변 radiusM 안의 혼밥 가능 식당을 거리순으로 조회한다 (nearby_restaurants RPC).
 * - 브라우저에서 Supabase 로 바로 요청한다. 좌표는 POST 본문으로만 보내고(주소창·URL 에 남지 않음)
 *   서버에 저장하지도, 콘솔에 찍지도 않는다.
 * - origin 이나 반경이 빠르게 바뀌면 마지막 요청의 결과만 반영한다.
 */
export function useNearbyRestaurants(origin: LatLng | null, radiusM: number) {
  const [state, setState] = useState<NearbyState>({ status: "idle", rows: [] });
  const [attempt, setAttempt] = useState(0);
  const lat = origin?.lat ?? null;
  const lng = origin?.lng ?? null;

  useEffect(() => {
    if (lat === null || lng === null) return;
    let cancelled = false;
    setState((prev) => ({ status: "loading", rows: prev.rows }));

    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc("nearby_restaurants", {
          user_lat: lat,
          user_lng: lng,
          radius_m: radiusM,
        });
        if (cancelled) return;
        if (error) {
          setState({ status: "error", rows: [], message: "식당 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요." });
          return;
        }
        setState({ status: "success", rows: normalizeNearbyRows(data) });
      } catch {
        if (cancelled) return;
        setState({
          status: "error",
          rows: [],
          message: "서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lat, lng, radiusM, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}
