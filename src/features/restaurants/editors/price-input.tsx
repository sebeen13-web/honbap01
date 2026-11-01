"use client";

import { formatThousands, onlyDigits } from "@/features/restaurants/schema";

/**
 * 원 단위 가격 입력. 화면에는 "18,000" 처럼 천 단위 쉼표로 보여 주고, 값은 숫자 문자열("18000")로 넘긴다.
 */
export function PriceInput({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (digits: string) => void;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="input pr-9 text-right tabular-nums"
        value={formatThousands(value)}
        placeholder={placeholder}
        maxLength={9}
        onChange={(e) => onChange(onlyDigits(e.target.value).slice(0, 7))}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-600" aria-hidden>
        원
      </span>
    </div>
  );
}
