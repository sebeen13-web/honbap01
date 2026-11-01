"use client";

import { bumpStat } from "@/features/detail/stats";

/** 길찾기(카카오맵) / 전화. 누르면 사장님 통계에 숫자만 1 올린다. */
export function DetailActions({
  restaurantId,
  name,
  latitude,
  longitude,
  phone,
  kakaoPlaceId,
}: {
  restaurantId: string;
  name: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  kakaoPlaceId: string | null;
}) {
  const directions = kakaoPlaceId
    ? `https://map.kakao.com/link/to/${kakaoPlaceId}`
    : `https://map.kakao.com/link/to/${encodeURIComponent(name)},${latitude},${longitude}`;
  return (
    <div className={`grid gap-2 ${phone ? "grid-cols-2" : "grid-cols-1"}`}>
      <a href={directions} target="_blank" rel="noreferrer" onClick={() => bumpStat(restaurantId, "directions")} className="btn-primary">
        길찾기
      </a>
      {phone ? (
        <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} onClick={() => bumpStat(restaurantId, "phone")} className="btn-secondary min-h-11 text-base">
          전화 {phone}
        </a>
      ) : null}
    </div>
  );
}
