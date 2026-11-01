"use client";

import { CATEGORIES, TIME_SLOT_LABEL } from "@/lib/constants";
import {
  TIME_SLOT_FILTERS,
  countActiveFilters,
  EMPTY_FILTERS,
  type RestaurantFilters,
} from "@/features/restaurants/filters";

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

const CHIP =
  "inline-flex min-h-11 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-white border-gray-300 bg-white text-gray-800";

/** 가로로 스크롤되는 필터 칩. 음식 종류·시간대는 여러 개 고를 수 있다. */
export function FilterBar({
  filters,
  onChange,
}: {
  filters: RestaurantFilters;
  onChange: (f: RestaurantFilters) => void;
}) {
  const count = countActiveFilters(filters);

  return (
    <div role="group" aria-label="필터" className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-2">
      <span
        className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-gray-100 px-3 text-sm font-semibold text-gray-800"
        aria-live="polite"
      >
        필터
        <span
          className={`grid min-w-5 place-items-center rounded-full px-1 text-xs ${
            count > 0 ? "bg-primary text-white" : "bg-gray-300 text-gray-800"
          }`}
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
      <button
        type="button"
        aria-pressed={filters.openNow}
        onClick={() => onChange({ ...filters, openNow: !filters.openNow })}
        className={CHIP}
      >
        지금 영업 중
      </button>

      <span className="h-6 w-px shrink-0 bg-gray-300" aria-hidden />
      {TIME_SLOT_FILTERS.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={filters.timeSlots.includes(s)}
          onClick={() => onChange({ ...filters, timeSlots: toggle(filters.timeSlots, s) })}
          className={CHIP}
          title={s === "all_day" ? "종일 1인분 가능한 곳" : `${TIME_SLOT_LABEL[s]}에 1인분 가능한 곳(종일 포함)`}
        >
          {TIME_SLOT_LABEL[s]}
        </button>
      ))}
    </div>
  );
}
