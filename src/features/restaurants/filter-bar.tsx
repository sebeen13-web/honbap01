"use client";

import { CATEGORIES } from "@/lib/constants";
import {
  EMPTY_FILTERS,
  PRICE_BANDS,
  PRICE_BAND_LABEL,
  countActiveFilters,
  type RestaurantFilters,
} from "@/features/restaurants/filters";

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

const CHIP =
  "inline-flex min-h-11 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors border-gray-300 bg-white text-gray-800 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-white";

/** 가로로 스크롤되는 필터 칩. 음식 종류·가격대는 여러 개 고를 수 있다. */
export function FilterBar({ filters, onChange }: { filters: RestaurantFilters; onChange: (f: RestaurantFilters) => void }) {
  const count = countActiveFilters(filters);

  return (
    <div role="group" aria-label="필터" className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-2">
      <span className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-gray-100 px-3 text-sm font-semibold text-gray-800" aria-live="polite">
        필터
        <span
          className={`grid min-w-5 place-items-center rounded-full px-1 text-xs ${count > 0 ? "bg-primary text-white" : "bg-gray-300 text-gray-800"}`}
          aria-label={`${count}개 적용됨`}
        >
          {count}
        </span>
      </span>
      {count > 0 ? (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="inline-flex min-h-11 shrink-0 items-center rounded-full px-2 text-sm font-medium text-primary-strong underline underline-offset-2"
        >
          필터 초기화
        </button>
      ) : null}

      <span className="h-6 w-px shrink-0 bg-gray-300" aria-hidden />
      <button
        type="button"
        aria-pressed={filters.availableNow}
        onClick={() => onChange({ ...filters, availableNow: !filters.availableNow })}
        className={CHIP}
      >
        지금 1인분 가능
      </button>

      <span className="h-6 w-px shrink-0 bg-gray-300" aria-hidden />
      {CATEGORIES.map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={filters.categories.includes(c)}
          onClick={() => onChange({ ...filters, categories: toggle(filters.categories, c) })}
          className={CHIP}
        >
          {c}
        </button>
      ))}

      <span className="h-6 w-px shrink-0 bg-gray-300" aria-hidden />
      {PRICE_BANDS.map((b) => (
        <button
          key={b}
          type="button"
          aria-pressed={filters.priceBands.includes(b)}
          onClick={() => onChange({ ...filters, priceBands: toggle(filters.priceBands, b) })}
          className={CHIP}
          title="가장 싼 1인분 메뉴 가격 기준"
        >
          {PRICE_BAND_LABEL[b]}
        </button>
      ))}
    </div>
  );
}
