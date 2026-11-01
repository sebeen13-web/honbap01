"use client";

import { formatRadius } from "@/features/restaurants/format";
import { AddressSearch } from "@/features/map/address-search";
import { useNearby } from "@/features/nearby/nearby-context";

/**
 * 위치 상태 한 줄 (홈·요청 탭).
 *  - 처음: "내 위치로 찾기" + "동네 검색"
 *  - 위치/동네가 정해짐: "안산시 상록구 기준 · 3km"
 *  - 거부/오류: 안내 + 동네 검색
 */
export function LocationBar({ intro }: { intro?: string }) {
  const { location, origin, findMe, pickArea, searchOpen, setSearchOpen, radiusM, kakaoAppKey } = useNearby();
  const failed = location.status === "denied" || location.status === "error";
  const showSearch = searchOpen || (failed && !origin);

  return (
    <div className="space-y-2">
      {location.status === "loading" ? (
        <p className="flex min-h-11 items-center gap-2 text-sm text-gray-700" role="status">
          <span className="size-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary" aria-hidden />
          현재 위치를 확인하고 있어요… 위치 권한을 물으면 ‘허용’을 눌러 주세요.
        </p>
      ) : origin ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900">
            <span aria-hidden>📍 </span>
            {origin.label} 기준 <span className="font-normal text-gray-700">· 반경 {formatRadius(radiusM)}</span>
          </p>
          <div className="flex gap-1">
            <button type="button" onClick={findMe} className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-primary-strong underline underline-offset-2">
              내 위치
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(!searchOpen)}
              aria-expanded={searchOpen}
              className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-primary-strong underline underline-offset-2"
            >
              동네 바꾸기
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-primary-soft p-3">
          {intro ? <p className="text-sm font-semibold text-gray-900">{intro}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={findMe} className="btn-primary">
              내 위치로 찾기
            </button>
            {!showSearch ? (
              <button type="button" onClick={() => setSearchOpen(true)} className="btn-secondary">
                동네 검색
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-gray-700">위치는 근처 식당을 찾는 데만 쓰고 저장하지 않아요.</p>
        </div>
      )}

      {failed ? (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">{location.message}</p>
          {location.status === "denied" ? (
            <p className="mt-1">다시 허용하려면 주소창 왼쪽의 자물쇠(사이트 정보) 아이콘 → 위치 → ‘허용’으로 바꾼 뒤 ‘내 위치’를 눌러 주세요.</p>
          ) : null}
        </div>
      ) : null}

      {showSearch ? (
        <AddressSearch
          appKey={kakaoAppKey}
          label="동네 또는 장소 검색"
          placeholder="동네 검색 (예: 고잔동, 안산 중앙역)"
          onSelect={(s) => pickArea({ lat: s.latitude, lng: s.longitude }, s.placeName ?? s.address)}
        />
      ) : null}
    </div>
  );
}
