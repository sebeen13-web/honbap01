"use client";

import { useState } from "react";
import { bumpStat } from "@/features/detail/stats";
import { useNearby } from "@/features/nearby/nearby-context";
import type { LatLng } from "@/features/location/use-user-location";

/** 카카오맵 링크의 이름 칸은 쉼표·슬래시를 구분자로 쓰므로 뺀다 */
const linkName = (s: string) => encodeURIComponent(s.replace(/[,/]/g, " ").trim() || "도착");

/**
 * 카카오맵 길찾기 링크.
 * - 출발지(내 위치)가 있으면: 출발 = 내 위치, 도착 = 식당 → 바로 경로 화면
 * - 없으면: 도착만 식당으로 (카카오맵에서 출발지를 고른다)
 */
export function kakaoDirectionsUrl(dest: { name: string; latitude: number; longitude: number }, from: LatLng | null): string {
  const to = `${linkName(dest.name)},${dest.latitude},${dest.longitude}`;
  return from ? `https://map.kakao.com/link/from/${linkName("내 위치")},${from.lat},${from.lng}/to/${to}` : `https://map.kakao.com/link/to/${to}`;
}

/** 지금 위치를 한 번 받아 온다 (권한 거부·실패·시간 초과면 null). 좌표는 길찾기 링크에만 쓰고 저장하지 않는다. */
function currentPosition(): Promise<LatLng | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator) || !window.isSecureContext) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  });
}

/** 길찾기(카카오맵) / 전화. 누르면 사장님 통계에 숫자만 1 올린다. */
export function DetailActions({
  restaurantId,
  name,
  latitude,
  longitude,
  phone,
}: {
  restaurantId: string;
  name: string;
  latitude: number;
  longitude: number;
  phone: string | null;
}) {
  const { location } = useNearby();
  const [locating, setLocating] = useState(false);
  const dest = { name, latitude, longitude };
  // 이미 '내 위치로 찾기'를 했다면 그 좌표를 바로 출발지로 쓴다 (동네 검색으로 고른 지점은 출발지로 쓰지 않는다)
  const known = location.status === "success" ? location.coords : null;

  async function onDirections(e: React.MouseEvent<HTMLAnchorElement>) {
    bumpStat(restaurantId, "directions");
    if (known) return; // href 에 이미 출발지가 들어 있다
    e.preventDefault();
    if (locating) return;
    setLocating(true);
    const from = await currentPosition();
    setLocating(false);
    const url = kakaoDirectionsUrl(dest, from);
    // 위치를 기다리는 동안 클릭 제스처가 끝나 새 창이 막히면 이 창에서 연다
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = url;
  }

  return (
    <div className="space-y-1.5">
      <div className={`grid gap-2 ${phone ? "grid-cols-2" : "grid-cols-1"}`}>
        <a
          href={kakaoDirectionsUrl(dest, known)}
          target="_blank"
          rel="noreferrer"
          onClick={onDirections}
          aria-busy={locating}
          className="btn-primary"
        >
          {locating ? "내 위치 확인 중…" : "길찾기"}
        </a>
        {phone ? (
          <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} onClick={() => bumpStat(restaurantId, "phone")} className="btn-secondary min-h-11 text-base">
            전화 {phone}
          </a>
        ) : null}
      </div>
      <p className="text-xs text-gray-500">길찾기: 출발 내 위치 → 도착 이 식당 (카카오맵). 위치를 허용하지 않으면 출발지는 카카오맵에서 골라요.</p>
    </div>
  );
}
