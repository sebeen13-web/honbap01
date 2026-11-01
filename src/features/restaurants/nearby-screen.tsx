"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_CENTER, DEFAULT_RADIUS_M, RADIUS_OPTIONS_M } from "@/lib/constants";
import { useUserLocation, type LatLng } from "@/features/location/use-user-location";
import { KakaoMap, type MapOrigin } from "@/features/map/kakao-map";
import { AddressSearch } from "@/features/map/address-search";
import { BottomSheet, type SheetSnap } from "@/features/restaurants/bottom-sheet";
import { FilterBar } from "@/features/restaurants/filter-bar";
import { RestaurantCard } from "@/features/restaurants/restaurant-card";
import { applyFilters, EMPTY_FILTERS, type RestaurantFilters, type SortKey } from "@/features/restaurants/filters";
import { useAuth } from "@/features/auth/use-auth";
import { AuthButton } from "@/features/auth/auth-button";
import { LoginPromptSheet } from "@/features/auth/login-prompt-sheet";
import { useFavorites } from "@/features/favorites/use-favorites";
import { formatRadius } from "@/features/restaurants/format";
import { useNearbyRestaurants } from "@/features/restaurants/use-nearby-restaurants";

type SearchOrigin = { coords: LatLng; label: string };

/**
 * 손님 메인 화면: 지도(위) + 필터 칩(위) + 목록 바텀시트(아래). 로그인 없이 쓴다(즐겨찾기만 로그인 필요).
 * 손님 좌표는 이 컴포넌트의 메모리에만 있고, 조회 요청 외에는 어디에도 보내거나 저장하지 않는다.
 */
export function NearbyScreen({ kakaoAppKey }: { kakaoAppKey: string | null }) {
  const location = useUserLocation();
  const [mode, setMode] = useState<"me" | "search">("me");
  const [searchOrigin, setSearchOrigin] = useState<SearchOrigin | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [radiusM, setRadiusM] = useState<number>(DEFAULT_RADIUS_M);
  const [filters, setFilters] = useState<RestaurantFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("distance");
  const [loginPrompt, setLoginPrompt] = useState(false);
  const auth = useAuth();
  const favorites = useFavorites(auth.status === "user" ? auth.userId : null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snap, setSnap] = useState<SheetSnap>("mid");
  const [sheetH, setSheetH] = useState(0);
  const [topH, setTopH] = useState(0);
  const [focus, setFocus] = useState<{ coords: LatLng; token: number } | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLLIElement>());

  const loc = location.state;
  const me = loc.status === "success" ? loc.coords : null;

  // 기준점: 마지막으로 고른 방법(내 위치 / 동네 검색)
  const origin: (MapOrigin & { label: string }) | null =
    mode === "me" && me
      ? { kind: "me", coords: me, label: "내 위치" }
      : searchOrigin
        ? { kind: "search", coords: searchOrigin.coords, label: searchOrigin.label }
        : null;

  const { state: nearby, retry } = useNearbyRestaurants(origin?.coords ?? null, radiusM);
  const { rows: visible, excludedUnknownTime } = useMemo(() => applyFilters(nearby.rows, filters, sort), [nearby.rows, filters, sort]);
  const locationFailed = loc.status === "denied" || loc.status === "error";
  const showSearch = searchOpen || locationFailed || mode === "search";

  // 위쪽 바(제목+필터) 높이 측정 → 시트 최대 높이·지도 여백
  useEffect(() => {
    const el = topRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTopH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 위치를 못 받으면 검색창이 보이도록 시트를 올린다
  useEffect(() => {
    if (locationFailed) setSnap((s) => (s === "min" ? "mid" : s));
  }, [locationFailed]);

  // 새 조회 결과가 오면 선택 해제
  useEffect(() => {
    setSelectedId(null);
  }, [nearby.rows]);

  const findMe = useCallback(() => {
    setMode("me");
    setSearchOpen(false);
    location.request();
  }, [location]);

  const onPickArea = useCallback((coords: LatLng, label: string) => {
    setSearchOrigin({ coords, label });
    setMode("search");
  }, []);

  // 지도 마커 → 카드 강조 + 시트 올리기 + 카드가 보이게 스크롤
  const onMarkerSelect = useCallback((id: string) => {
    setSelectedId(id);
    setSnap((s) => (s === "min" ? "mid" : s));
    requestAnimationFrame(() =>
      cardRefs.current.get(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
    );
  }, []);

  // 목록 카드 → 지도에서 그 식당으로 이동 (시트가 지도를 다 가리고 있으면 중간으로 내림)
  const onCardSelect = useCallback(
    (id: string) => {
      const r = visible.find((x) => x.id === id);
      if (!r) return;
      setSelectedId(id);
      setSnap((s) => (s === "max" ? "mid" : s));
      setFocus((f) => ({ coords: { lat: r.latitude, lng: r.longitude }, token: (f?.token ?? 0) + 1 }));
    },
    [visible],
  );

  const nextRadius = RADIUS_OPTIONS_M.find((r) => r > radiusM);
  const fitKey = origin ? `${origin.coords.lat},${origin.coords.lng},${radiusM}` : "none";
  const showFab = (loc.status !== "idle" || searchOrigin !== null) && snap !== "max";

  const header = (
    <div className="px-4 pb-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="min-w-0 text-base font-bold text-gray-900">
          {origin ? (
            <>
              <span className="block truncate">
                {origin.label} 기준 {formatRadius(radiusM)}
              </span>
              <span className="block text-sm font-medium text-gray-600" aria-live="polite">
                {nearby.status === "loading"
                  ? "찾는 중…"
                  : nearby.status === "success"
                    ? `혼밥 가능 식당 ${visible.length}곳${visible.length !== nearby.rows.length ? ` (전체 ${nearby.rows.length}곳)` : ""}`
                    : nearby.status === "error"
                      ? "불러오지 못했어요"
                      : ""}
              </span>
            </>
          ) : (
            "내 주변 혼밥 식당"
          )}
        </h2>
        <div role="radiogroup" aria-label="검색 반경" className="flex shrink-0 rounded-full bg-gray-100 p-0.5">
          {RADIUS_OPTIONS_M.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={radiusM === r}
              onClick={() => setRadiusM(r)}
              className="min-h-11 min-w-12 rounded-full px-2 text-sm font-semibold text-gray-700 aria-checked:bg-white aria-checked:text-primary-strong aria-checked:shadow"
            >
              {formatRadius(r)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <main className="relative h-dvh overflow-hidden">
      <KakaoMap
        appKey={kakaoAppKey}
        defaultCenter={DEFAULT_CENTER}
        origin={origin}
        radiusM={radiusM}
        restaurants={visible}
        selectedId={selectedId}
        onSelect={onMarkerSelect}
        insets={{ top: topH, bottom: sheetH }}
        fitKey={fitKey}
        focus={focus}
      />

      {/* 위: 제목 + 필터 칩 */}
      <div
        ref={topRef}
        className="absolute inset-x-0 top-0 z-30 bg-white/95 px-4 pt-[max(env(safe-area-inset-top),0.5rem)] shadow-sm backdrop-blur"
      >
        <div className="flex items-center justify-between gap-2 py-1">
          <h1 className="text-lg font-bold text-primary-strong">혼밥 지도</h1>
          <AuthButton auth={auth} />
        </div>
        <FilterBar filters={filters} onChange={setFilters} />
      </div>

      {/* 지도 위 떠 있는 버튼: 내 위치로 다시 찾기 */}
      {showFab ? (
        <button
          type="button"
          onClick={findMe}
          disabled={loc.status === "loading"}
          className="absolute right-3 z-10 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-gray-900 shadow-lg ring-1 ring-gray-200 transition-[bottom] duration-200 disabled:opacity-60"
          style={{ bottom: sheetH + 12 }}
        >
          <span aria-hidden>◎</span>
          {loc.status === "loading" ? "위치 확인 중…" : "내 위치로 다시 찾기"}
        </button>
      ) : null}

      <BottomSheet snap={snap} onSnapChange={setSnap} topInset={topH} onHeightChange={setSheetH} header={header}>
        <div className="space-y-4 px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          {/* 첫 진입: 안내 + 버튼 (이때까지는 권한 팝업을 띄우지 않는다) */}
          {loc.status === "idle" && !showSearch ? (
            <div className="rounded-xl bg-primary-soft p-4 text-center">
              <p className="text-lg font-bold text-gray-900">내 주변에서 1인분 되는 식당을 찾아드려요</p>
              <p className="mt-1 text-sm text-gray-700">
                2인분부터 파는 식당에서 1인분이 되는 메뉴와 가격을 미리 알려 드려요. 위치는 주변 식당을 찾는 데만 쓰고
                저장하지 않아요.
              </p>
              <button type="button" onClick={findMe} className="btn-primary mt-4 w-full">
                내 위치로 찾기
              </button>
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="mt-1 inline-flex min-h-11 items-center px-2 text-sm font-medium text-gray-700 underline underline-offset-2"
              >
                위치 없이 동네 검색하기
              </button>
            </div>
          ) : null}

          {loc.status === "loading" && mode === "me" ? (
            <p className="flex items-center gap-2 rounded-xl bg-gray-50 p-4 text-sm text-gray-700" role="status">
              <span className="size-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary" aria-hidden />
              현재 위치를 확인하고 있어요… 브라우저가 위치 권한을 물으면 ‘허용’을 눌러 주세요.
            </p>
          ) : null}

          {/* 위치 거부/오류 또는 직접 검색: 안내 + 동네 검색 */}
          {showSearch ? (
            <div className="space-y-2">
              {locationFailed && mode === "me" ? (
                <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-semibold">{loc.message}</p>
                  {loc.status === "denied" ? (
                    <p className="mt-1">
                      다시 허용하려면 주소창 왼쪽의 자물쇠(사이트 정보) 아이콘 → 위치 → ‘허용’으로 바꾼 뒤 ‘내 위치로 다시
                      찾기’를 눌러 주세요.
                    </p>
                  ) : null}
                </div>
              ) : null}
              <p className="text-sm font-semibold text-gray-900">동네 검색</p>
              <AddressSearch
                appKey={kakaoAppKey}
                label="동네 또는 장소 검색"
                placeholder="예: 고잔동, 안산 중앙역"
                onSelect={(s) => onPickArea({ lat: s.latitude, lng: s.longitude }, s.placeName ?? s.address)}
              />
            </div>
          ) : null}

          {/* 조회 결과 */}
          {origin ? (
            nearby.status === "loading" || nearby.status === "idle" ? (
              <ul className="space-y-2" aria-busy="true" aria-label="식당 목록 불러오는 중">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="h-32 animate-pulse rounded-xl bg-gray-100" />
                ))}
              </ul>
            ) : nearby.status === "error" ? (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <p>{nearby.message}</p>
                <button type="button" onClick={retry} className="btn-secondary mt-3 w-full">
                  다시 시도
                </button>
              </div>
            ) : nearby.rows.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-700">
                <p className="font-medium text-gray-900">이 반경 안에는 아직 등록된 식당이 없어요. 반경을 넓혀 보세요.</p>
                {nextRadius ? (
                  <button type="button" onClick={() => setRadiusM(nextRadius)} className="btn-primary mt-3 w-full">
                    반경 {formatRadius(nextRadius)}로 넓히기
                  </button>
                ) : (
                  <p className="mt-2">가장 넓은 반경({formatRadius(radiusM)})이에요. 다른 동네를 검색해 보세요.</p>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-gray-700">{sort === "distance" ? "가까운 순" : "1인분 가격이 낮은 순"}</p>
                  <div role="radiogroup" aria-label="정렬" className="flex rounded-full bg-gray-100 p-0.5">
                    {(
                      [
                        ["distance", "거리순"],
                        ["price", "낮은 가격순"],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={sort === key}
                        onClick={() => setSort(key)}
                        className="min-h-11 rounded-full px-3 text-sm font-semibold text-gray-700 aria-checked:bg-white aria-checked:text-primary-strong aria-checked:shadow"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {filters.availableNow && excludedUnknownTime > 0 ? (
                  <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700" role="status">
                    시간 정보 없는 식당 {excludedUnknownTime}곳은 제외됨
                  </p>
                ) : null}
                {favorites.error ? (
                  <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    {favorites.error}
                  </p>
                ) : null}
                {visible.length === 0 ? (
                  <div className="rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-700">
                    <p className="font-medium text-gray-900">필터 조건에 맞는 식당이 없어요.</p>
                    <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="btn-secondary mt-3 w-full">
                      필터 초기화
                    </button>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {visible.map((r) => (
                      <RestaurantCard
                        key={r.id}
                        ref={(el) => {
                          if (el) cardRefs.current.set(r.id, el);
                          else cardRefs.current.delete(r.id);
                        }}
                        restaurant={r}
                        selected={r.id === selectedId}
                        onSelect={() => onCardSelect(r.id)}
                        favorite={favorites.ids.has(r.id)}
                        onToggleFavorite={() => {
                          if (auth.status === "user") void favorites.toggle(r.id);
                          else setLoginPrompt(true);
                        }}
                      />
                    ))}
                  </ul>
                )}
              </>
            )
          ) : null}
        </div>
      </BottomSheet>

      <LoginPromptSheet
        open={loginPrompt}
        onClose={() => setLoginPrompt(false)}
        title="로그인하면 저장할 수 있어요"
        description="즐겨찾기한 식당은 ‘내 정보 > 즐겨찾기’에서 다시 볼 수 있어요. 둘러보기는 로그인 없이 가능해요."
        next="/"
      />
    </main>
  );
}
