"use client";

import Link from "next/link";
import { forwardRef } from "react";
import { SOURCE_LABEL } from "@/lib/constants";
import { formatDiff, formatDistance, formatKstTime, formatVerifiedDate, formatWon } from "@/features/restaurants/format";
import type { NearbyRestaurant } from "@/types/database";

const MENU_PREVIEW = 2;

/** 시간 배지: true → 지금 1인분 가능 / false → "17:00부터 가능" 또는 "지금은 불가" / null → 없음 */
export function TimeBadge({ r }: { r: NearbyRestaurant }) {
  if (r.is_solo_available_now === true) {
    return (
      <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white">지금 1인분 가능</span>
    );
  }
  if (r.is_solo_available_now === false) {
    return (
      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-800">
        {r.next_available_at ? `${formatKstTime(r.next_available_at)}부터 가능` : "지금은 불가"}
      </span>
    );
  }
  return null;
}

function servingsLine(n: number | null): string | null {
  if (n === null) return null;
  return n >= 2 ? `보통 ${n}인분부터 → 1인분 가능` : "1인분 주문 가능";
}

/**
 * 목록 카드. 카드 본문을 누르면 지도에서 그 식당으로 이동하고,
 * "자세히 보기"는 상세 화면(/restaurants/[id], 4단계)으로 가는 링크다.
 */
export const RestaurantCard = forwardRef<
  HTMLLIElement,
  {
    restaurant: NearbyRestaurant;
    selected: boolean;
    onSelect: () => void;
    favorite: boolean;
    onToggleFavorite: () => void;
    /** 목록 안에서의 너비 등 */
    className?: string;
  }
>(function RestaurantCard({ restaurant: r, selected, onSelect, favorite, onToggleFavorite, className = "" }, ref) {
  const preview = r.menus.slice(0, MENU_PREVIEW);
  const more = r.menus.length - preview.length;
  const servings = servingsLine(r.normal_min_servings);

  return (
    <li
      ref={ref}
      className={`scroll-my-3 rounded-xl border-2 bg-white transition-colors ${selected ? "border-primary" : "border-gray-200"} ${className}`}
    >
      <button type="button" onClick={onSelect} aria-pressed={selected} className="block w-full rounded-t-xl p-3 text-left">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 text-base font-bold text-gray-900">{r.name}</span>
          <span className="shrink-0 text-sm font-semibold text-gray-800">{formatDistance(r.distance_m)}</span>
        </span>

        <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-800">{r.category}</span>
          <span className="rounded bg-primary-soft px-1.5 py-0.5 font-medium text-primary-strong ring-1 ring-primary/25">
            {SOURCE_LABEL[r.source]}
          </span>
          <span className="text-gray-700">{formatVerifiedDate(r.last_verified_at)} 확인</span>
        </span>

        {r.is_solo_available_now !== null || r.needs_review ? (
          <span className="mt-2 flex flex-wrap gap-1.5">
            <TimeBadge r={r} />
            {r.needs_review ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-300">
                ⚠ 최근 안 된다는 확인이 있어요
              </span>
            ) : null}
          </span>
        ) : null}

        {servings ? <span className="mt-2 block text-sm font-semibold text-primary-strong">{servings}</span> : null}

        {preview.length > 0 ? (
          <span className="mt-1 block space-y-0.5">
            {preview.map((m) => (
              <span key={`${m.sort_order}-${m.name}`} className="block text-sm text-gray-900">
                {m.name} <span className="font-semibold">1인 {formatWon(m.solo_price)}</span>
                {m.regular_price_per_person !== null ? (
                  <span className="text-xs text-gray-700">
                    {" "}
                    (보통 1인당 {formatWon(m.regular_price_per_person)}, {formatDiff(m.solo_price, m.regular_price_per_person)})
                  </span>
                ) : null}
              </span>
            ))}
            {more > 0 ? <span className="block text-sm text-gray-700">외 {more}개</span> : null}
          </span>
        ) : (
          <span className="mt-1 block text-sm text-gray-700">메뉴 정보를 준비 중이에요</span>
        )}

        {r.ok_30d > 0 ? (
          <span className="mt-2 block text-sm text-gray-800">최근 30일 {r.ok_30d}명이 됐다고 확인</span>
        ) : null}
        <span className="mt-1 block text-xs text-gray-600">확인 당시 가격이에요</span>
      </button>

      <div className="flex items-center justify-between border-t border-gray-100 px-1">
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={favorite}
          aria-label={favorite ? `${r.name} 즐겨찾기에서 빼기` : `${r.name} 즐겨찾기에 저장`}
          className="inline-flex min-h-11 min-w-11 items-center gap-1 px-2 text-sm font-medium text-gray-800"
        >
          <svg aria-hidden viewBox="0 0 24 24" className={`size-5 ${favorite ? "fill-primary text-primary" : "fill-none text-gray-700"}`} stroke="currentColor" strokeWidth="2">
            <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" strokeLinejoin="round" />
          </svg>
          {favorite ? "저장됨" : "저장"}
        </button>
        <Link
          href={`/restaurants/${r.id}`}
          prefetch={false}
          className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-primary-strong underline-offset-2 hover:underline"
          aria-label={`${r.name} 자세히 보기`}
        >
          자세히 보기 →
        </Link>
      </div>
    </li>
  );
});
