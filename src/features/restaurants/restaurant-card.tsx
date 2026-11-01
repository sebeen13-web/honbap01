"use client";

import Link from "next/link";
import { forwardRef } from "react";
import { SOURCE_LABEL, TIME_SLOT_LABEL } from "@/lib/constants";
import { formatDistance } from "@/features/restaurants/format";
import type { NearbyRestaurant } from "@/types/database";

const MENU_PREVIEW = 2;

function timeSlotText(r: NearbyRestaurant) {
  if (r.time_slot === "custom") return r.time_slot_note ?? TIME_SLOT_LABEL.custom;
  return r.time_slot_note ? `${TIME_SLOT_LABEL[r.time_slot]} (${r.time_slot_note})` : TIME_SLOT_LABEL[r.time_slot];
}

/**
 * 목록 카드. 카드 본문을 누르면 지도에서 그 식당으로 이동하고,
 * "자세히 보기"는 상세 화면(/restaurants/[id], 4단계)으로 가는 링크다.
 */
export const RestaurantCard = forwardRef<
  HTMLLIElement,
  { restaurant: NearbyRestaurant; selected: boolean; onSelect: () => void }
>(function RestaurantCard({ restaurant: r, selected, onSelect }, ref) {
  // 가격·인분 표시는 docs/ROADMAP.md 의 [3단계 손님 메인] 명세로 다음 개편 때 바꾼다. 지금은 메뉴 이름만.
  const menus = r.menus.slice(0, MENU_PREVIEW).map((m) => m.name).join(" · ");
  const more = r.menus.length - MENU_PREVIEW;

  return (
    <li
      ref={ref}
      className={`scroll-my-3 rounded-xl border-2 bg-white transition-colors ${
        selected ? "border-primary bg-primary-soft" : "border-gray-200"
      }`}
    >
      <button type="button" onClick={onSelect} aria-pressed={selected} className="block w-full rounded-xl p-3 text-left">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 text-base font-semibold text-gray-900">{r.name}</span>
          <span className="shrink-0 text-sm font-semibold text-gray-800">{formatDistance(r.distance_m)}</span>
        </span>

        <span className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-800">{r.category}</span>
          <span className="rounded bg-primary-soft px-1.5 py-0.5 font-medium text-primary-strong ring-1 ring-primary/20">
            {SOURCE_LABEL[r.source]}
          </span>
          {r.is_open_now === true ? (
            <span className="rounded bg-green-50 px-1.5 py-0.5 font-medium text-green-800 ring-1 ring-green-200">영업 중</span>
          ) : r.is_open_now === false ? (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">영업 시간 아님</span>
          ) : null}
        </span>

        <span className="mt-2 block text-sm text-gray-700">
          <span className="text-gray-600">1인분 가능: </span>
          {timeSlotText(r)}
        </span>
        <span className="mt-0.5 block text-sm text-gray-900">
          {menus}
          {more > 0 ? <span className="text-gray-600"> 외 {more}개</span> : null}
        </span>
      </button>
      <div className="flex justify-end border-t border-gray-100 px-1">
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
