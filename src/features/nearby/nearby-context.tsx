"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_RADIUS_M } from "@/lib/constants";
import { useUserLocation, type LatLng, type UserLocationState } from "@/features/location/use-user-location";
import { useNearbyRestaurants, type NearbyState } from "@/features/restaurants/use-nearby-restaurants";
import { EMPTY_FILTERS, type RestaurantFilters, type SortKey } from "@/features/restaurants/filters";
import { useAuth, type AuthState } from "@/features/auth/use-auth";
import { useFavorites } from "@/features/favorites/use-favorites";
import { LoginPromptSheet } from "@/features/auth/login-prompt-sheet";
import { loadKakaoSdk } from "@/features/map/load-kakao-sdk";

export type NearbyOrigin = { kind: "me" | "search"; coords: LatLng; label: string };
type LoginPrompt = { title: string; description?: string; next: string } | null;

type NearbyContextValue = {
  kakaoAppKey: string | null;
  /** 위치 */
  location: UserLocationState;
  findMe: () => void;
  pickArea: (coords: LatLng, label: string) => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  origin: NearbyOrigin | null;
  /** 조회 */
  radiusM: number;
  setRadiusM: (m: number) => void;
  nearby: NearbyState;
  retry: () => void;
  /** 지도 필터·정렬 (홈의 음식 종류 버튼이 바꾼다) */
  filters: RestaurantFilters;
  setFilters: (f: RestaurantFilters) => void;
  sort: SortKey;
  setSort: (s: SortKey) => void;
  /** 홈 카드를 누르면 지도에서 이 식당을 고른다 */
  pendingFocusId: string | null;
  setPendingFocusId: (id: string | null) => void;
  /** 로그인 */
  auth: AuthState;
  favorites: ReturnType<typeof useFavorites>;
  /** 로그인이 필요한 행동에서 호출: 로그인했으면 true, 아니면 유도 시트를 띄우고 false */
  requireLogin: (prompt: Exclude<LoginPrompt, null>) => boolean;
};

const NearbyContext = createContext<NearbyContextValue | null>(null);

/**
 * 홈·지도·요청 탭이 함께 쓰는 상태. 탭을 옮겨도 위치를 다시 묻거나 다시 조회하지 않는다.
 * 손님 좌표는 이 메모리 상태에만 있고, 서버·localStorage·쿠키·로그 어디에도 저장하지 않는다.
 */
export function NearbyProvider({ kakaoAppKey, children }: { kakaoAppKey: string | null; children: React.ReactNode }) {
  const { state: location, request } = useUserLocation();
  const [mode, setMode] = useState<"me" | "search">("me");
  const [searchOrigin, setSearchOrigin] = useState<{ coords: LatLng; label: string } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [radiusM, setRadiusM] = useState<number>(DEFAULT_RADIUS_M);
  const [filters, setFilters] = useState<RestaurantFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("distance");
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [loginPrompt, setLoginPrompt] = useState<LoginPrompt>(null);
  const auth = useAuth();
  const favorites = useFavorites(auth.status === "user" ? auth.userId : null);

  const me = location.status === "success" ? location.coords : null;

  // 내 위치 → "안산시 상록구" 같은 동네 이름 (카카오 지도 SDK, 화면 표시용으로만)
  useEffect(() => {
    setRegion(null);
    if (!me || !kakaoAppKey) return;
    let active = true;
    loadKakaoSdk(kakaoAppKey)
      .then((kakao) => {
        new kakao.maps.services.Geocoder().coord2RegionCode(me.lng, me.lat, (result, status) => {
          if (!active || status !== kakao.maps.services.Status.OK) return;
          const r = result.find((x) => x.region_type === "H") ?? result[0];
          if (r) setRegion(r.region_2depth_name || r.region_1depth_name);
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [me?.lat, me?.lng, kakaoAppKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const origin: NearbyOrigin | null =
    mode === "me" && me
      ? { kind: "me", coords: me, label: region ?? "내 위치" }
      : searchOrigin
        ? { kind: "search", coords: searchOrigin.coords, label: searchOrigin.label }
        : null;

  const { state: nearby, retry } = useNearbyRestaurants(origin?.coords ?? null, radiusM);

  const findMe = useCallback(() => {
    setMode("me");
    setSearchOpen(false);
    request();
  }, [request]);

  const pickArea = useCallback((coords: LatLng, label: string) => {
    setSearchOrigin({ coords, label });
    setMode("search");
    setSearchOpen(false);
  }, []);

  const requireLogin = useCallback(
    (prompt: Exclude<LoginPrompt, null>) => {
      if (auth.status === "user") return true;
      setLoginPrompt(prompt);
      return false;
    },
    [auth.status],
  );

  const value = useMemo<NearbyContextValue>(
    () => ({
      kakaoAppKey,
      location,
      findMe,
      pickArea,
      searchOpen,
      setSearchOpen,
      origin,
      radiusM,
      setRadiusM,
      nearby,
      retry,
      filters,
      setFilters,
      sort,
      setSort,
      pendingFocusId,
      setPendingFocusId,
      auth,
      favorites,
      requireLogin,
    }),
    // origin 은 매번 새 객체이므로 구성 값으로 비교한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kakaoAppKey, location, findMe, pickArea, searchOpen, origin?.kind, origin?.coords.lat, origin?.coords.lng, origin?.label, radiusM, nearby, retry, filters, sort, pendingFocusId, auth, favorites, requireLogin],
  );

  return (
    <NearbyContext.Provider value={value}>
      {children}
      <LoginPromptSheet
        open={loginPrompt !== null}
        onClose={() => setLoginPrompt(null)}
        title={loginPrompt?.title}
        description={loginPrompt?.description}
        next={loginPrompt?.next ?? "/"}
      />
    </NearbyContext.Provider>
  );
}

export function useNearby(): NearbyContextValue {
  const ctx = useContext(NearbyContext);
  if (!ctx) throw new Error("useNearby 는 NearbyProvider 안에서만 쓸 수 있어요.");
  return ctx;
}
