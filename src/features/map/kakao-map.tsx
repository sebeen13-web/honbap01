"use client";

import { useEffect, useRef, useState } from "react";
import { loadKakaoSdk } from "@/features/map/load-kakao-sdk";
import type { KakaoCircle, KakaoCustomOverlay, KakaoMap as KakaoMapInstance, KakaoNamespace } from "@/features/map/kakao-types";
import type { LatLng } from "@/features/location/use-user-location";
import { formatDistance } from "@/features/restaurants/format";
import type { NearbyRestaurant } from "@/types/database";

export type MapOrigin = { kind: "me" | "search"; coords: LatLng };
export type MapInsets = { top: number; bottom: number };

const PRIMARY = "#c2410c";

// 마커 스타일. 오버레이는 SDK 가 DOM 으로 그리므로 Tailwind 클래스를 문자열로 둔다.
const MARKER_BUTTON =
  "group flex min-h-11 flex-col items-center px-1.5 pt-1.5 focus-visible:outline-none";
const MARKER_PILL =
  "block max-w-36 truncate rounded-full border-2 border-primary bg-white px-2.5 py-1 text-xs font-bold text-primary-strong shadow-md transition-transform group-focus-visible:ring-4 group-focus-visible:ring-primary/40 group-data-[selected=true]:scale-110 group-data-[selected=true]:bg-primary group-data-[selected=true]:text-white";
const MARKER_TAIL =
  "-mt-0.5 block size-2.5 rotate-45 border-r-2 border-b-2 border-primary bg-white group-data-[selected=true]:bg-primary";

/**
 * 카카오맵. SDK 는 loadKakaoSdk() 로 한 번만 불러오고, 지도 인스턴스도 한 번만 만든다.
 * 식당 마커는 CustomOverlay(버튼)로 그려서 키보드·스크린리더로도 누를 수 있다.
 */
export function KakaoMap({
  appKey,
  defaultCenter,
  origin,
  radiusM,
  restaurants,
  selectedId,
  onSelect,
  insets,
  fitKey,
  focus,
}: {
  appKey: string | null;
  defaultCenter: LatLng;
  origin: MapOrigin | null;
  radiusM: number;
  restaurants: NearbyRestaurant[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 위(필터 바)·아래(목록 시트)에 가려지는 높이(px). 지도 맞춤/이동 때 보이는 영역 기준으로 계산한다. */
  insets: MapInsets;
  /** 값이 바뀌면 origin + 반경이 보이도록 지도를 다시 맞춘다 */
  fitKey: string;
  /** token 이 바뀌면 해당 좌표로 지도를 옮긴다 */
  focus: { coords: LatLng; token: number } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMapInstance | null>(null);
  const kakaoRef = useRef<KakaoNamespace | null>(null);
  const markersRef = useRef(new Map<string, { overlay: KakaoCustomOverlay; el: HTMLElement }>());
  const originOverlayRef = useRef<KakaoCustomOverlay | null>(null);
  const circleRef = useRef<KakaoCircle | null>(null);
  const insetsRef = useRef(insets);
  const onSelectRef = useRef(onSelect);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(appKey ? "loading" : "error");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    insetsRef.current = insets;
    onSelectRef.current = onSelect;
  });

  // 1) SDK 로드 + 지도 생성 (한 번)
  useEffect(() => {
    if (!appKey) return;
    let cancelled = false;
    setStatus("loading");
    loadKakaoSdk(appKey)
      .then((kakao) => {
        if (cancelled || !containerRef.current) return;
        kakaoRef.current = kakao;
        if (!mapRef.current) {
          mapRef.current = new kakao.maps.Map(containerRef.current, {
            center: new kakao.maps.LatLng(defaultCenter.lat, defaultCenter.lng),
            level: 7,
          });
        }
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // defaultCenter 는 처음 한 번만 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appKey, attempt]);

  // 화면 크기가 바뀌면 지도 크기 다시 계산
  useEffect(() => {
    const onResize = () => mapRef.current?.relayout();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 2) 기준점(내 위치/검색 위치) 마커 + 반경 원
  const oLat = origin?.coords.lat;
  const oLng = origin?.coords.lng;
  const oKind = origin?.kind;
  useEffect(() => {
    const kakao = kakaoRef.current;
    const map = mapRef.current;
    if (status !== "ready" || !kakao || !map) return;

    originOverlayRef.current?.setMap(null);
    circleRef.current?.setMap(null);
    originOverlayRef.current = null;
    circleRef.current = null;
    if (oLat === undefined || oLng === undefined) return;

    const pos = new kakao.maps.LatLng(oLat, oLng);
    circleRef.current = new kakao.maps.Circle({
      center: pos,
      radius: radiusM,
      strokeWeight: 2,
      strokeColor: PRIMARY,
      strokeOpacity: 0.6,
      strokeStyle: "shortdash",
      fillColor: PRIMARY,
      fillOpacity: 0.05,
    });
    circleRef.current.setMap(map);

    const el = document.createElement("div");
    if (oKind === "me") {
      el.className = "relative grid size-10 place-items-center";
      el.innerHTML =
        '<span class="absolute inset-0 rounded-full bg-gray-900/15"></span><span class="relative size-4 rounded-full bg-gray-900 ring-4 ring-white shadow"></span>';
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", "내 위치");
    } else {
      el.className = "rounded-md bg-gray-900 px-2 py-1 text-xs font-semibold text-white shadow";
      el.textContent = "검색 위치";
    }
    originOverlayRef.current = new kakao.maps.CustomOverlay({
      position: pos,
      content: el,
      yAnchor: oKind === "me" ? 0.5 : 1.2,
      zIndex: 1,
    });
    originOverlayRef.current.setMap(map);
  }, [status, oLat, oLng, oKind, radiusM]);

  // 3) 식당 마커
  useEffect(() => {
    const kakao = kakaoRef.current;
    const map = mapRef.current;
    if (status !== "ready" || !kakao || !map) return;
    const markers = markersRef.current;

    for (const r of restaurants) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = MARKER_BUTTON;
      button.dataset.restaurantId = r.id;
      button.setAttribute("aria-label", `${r.name}, ${formatDistance(r.distance_m)}`);
      const pill = document.createElement("span");
      pill.className = MARKER_PILL;
      pill.textContent = r.name;
      const tail = document.createElement("span");
      tail.className = MARKER_TAIL;
      tail.setAttribute("aria-hidden", "true");
      button.append(pill, tail);
      button.addEventListener("click", () => onSelectRef.current(r.id));

      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(r.latitude, r.longitude),
        content: button,
        yAnchor: 1,
        zIndex: 2,
        clickable: true,
      });
      overlay.setMap(map);
      markers.set(r.id, { overlay, el: button });
    }

    return () => {
      markers.forEach(({ overlay }) => overlay.setMap(null));
      markers.clear();
    };
  }, [status, restaurants]);

  // 4) 선택된 마커 강조
  useEffect(() => {
    markersRef.current.forEach(({ overlay, el }, id) => {
      const selected = id === selectedId;
      el.dataset.selected = String(selected);
      el.setAttribute("aria-pressed", String(selected));
      overlay.setZIndex(selected ? 10 : 2);
    });
  }, [selectedId, restaurants, status]);

  // 5) 기준점 + 반경이 보이도록 맞추기 (가려지는 위·아래 영역은 여백으로 뺀다)
  useEffect(() => {
    const kakao = kakaoRef.current;
    const map = mapRef.current;
    if (status !== "ready" || !kakao || !map) return;
    if (oLat === undefined || oLng === undefined) {
      map.setCenter(new kakao.maps.LatLng(defaultCenter.lat, defaultCenter.lng));
      return;
    }
    const dLat = radiusM / 111_320;
    const dLng = radiusM / (111_320 * Math.cos((oLat * Math.PI) / 180));
    const bounds = new kakao.maps.LatLngBounds(
      new kakao.maps.LatLng(oLat - dLat, oLng - dLng),
      new kakao.maps.LatLng(oLat + dLat, oLng + dLng),
    );
    const { top, bottom } = insetsRef.current;
    map.setBounds(bounds, top + 12, 12, bottom + 12, 12);
    // fitKey 가 바뀔 때만 맞춘다 (시트를 움직일 때마다 다시 맞추지 않음)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, fitKey]);

  // 6) 목록에서 고른 식당으로 이동 (보이는 영역의 가운데로)
  const focusToken = focus?.token;
  useEffect(() => {
    const kakao = kakaoRef.current;
    const map = mapRef.current;
    if (status !== "ready" || !kakao || !map || !focus) return;
    const { top, bottom } = insetsRef.current;
    const proj = map.getProjection();
    const p = proj.pointFromCoords(new kakao.maps.LatLng(focus.coords.lat, focus.coords.lng));
    // 보이는 영역의 가운데에 오도록 지도 중심을 (아래 가림 - 위 가림)/2 만큼 내린다
    const target = proj.coordsFromPoint(new kakao.maps.Point(p.x, p.y + (bottom - top) / 2));
    map.panTo(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, focusToken]);

  return (
    <div className="absolute inset-0 bg-gray-100">
      <div ref={containerRef} className="size-full" aria-label="혼밥 가능 식당 지도" role="region" />

      {status !== "ready" ? (
        <div
          className="absolute inset-x-0 flex justify-center px-4"
          style={{ top: insets.top + 16 }}
          aria-live="polite"
        >
          {status === "loading" ? (
            <p className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-gray-700 shadow">
              <span className="size-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary" aria-hidden />
              지도를 불러오는 중…
            </p>
          ) : (
            <div role="alert" className="w-full max-w-sm rounded-xl bg-white p-4 text-sm text-gray-800 shadow-lg">
              <p className="font-semibold text-red-700">지도를 표시할 수 없어요</p>
              {!appKey ? (
                <p className="mt-1">
                  카카오 지도 키(<code>NEXT_PUBLIC_KAKAO_MAP_APP_KEY</code>)가 설정되지 않았어요. 키를 넣고 서버를 다시 시작한
                  뒤 다시 시도해 주세요. 목록은 지도 없이도 볼 수 있어요.
                </p>
              ) : (
                <p className="mt-1">
                  카카오 지도를 불러오지 못했어요. 인터넷 연결, JavaScript 키, 카카오 개발자 콘솔의 [플랫폼 &gt; Web 사이트
                  도메인]에 현재 주소({typeof window !== "undefined" ? window.location.origin : "이 사이트 주소"})가 등록됐는지,
                  카카오맵 사용 설정이 켜져 있는지 확인해 주세요.
                </p>
              )}
              <button
                type="button"
                className="btn-secondary mt-3 w-full"
                onClick={() => (appKey ? setAttempt((n) => n + 1) : window.location.reload())}
              >
                다시 시도
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
