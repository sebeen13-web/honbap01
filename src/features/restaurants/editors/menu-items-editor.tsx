"use client";

import { PriceInput } from "@/features/restaurants/editors/price-input";
import { MAX_SOLO_MENUS, formatThousands, type FieldErrors } from "@/features/restaurants/schema";
import { newMenuRow, type MenuRow } from "@/features/restaurants/form-rows";

/** 1인분 가격과 보통 1인당 가격의 차이 안내 */
function diffText(row: MenuRow): string | null {
  if (!row.solo_price || !row.regular_price_per_person) return null;
  const diff = Number(row.solo_price) - Number(row.regular_price_per_person);
  if (diff > 0) return `1인분으로 시키면 1인당 ${formatThousands(diff)}원 더 내요`;
  if (diff < 0) return `1인분이 오히려 ${formatThousands(-diff)}원 저렴해요`;
  return "보통 가격과 같아요";
}

/**
 * 1인분 메뉴·가격 행 편집 (1~10개).
 * 오류 경로: menus, menus.{i}.name / solo_price / regular_price_per_person / normal_min_servings / note
 */
export function MenuItemsEditor({
  rows,
  onChange,
  errors,
  onClearErrors,
}: {
  rows: MenuRow[];
  onChange: (rows: MenuRow[]) => void;
  errors: FieldErrors;
  /** prefix 로 시작하는 오류를 지운다 */
  onClearErrors: (prefix: string) => void;
}) {
  const update = (i: number, patch: Partial<MenuRow>) => {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    Object.keys(patch).forEach((k) => onClearErrors(`menus.${i}.${k}`));
    onClearErrors("menus");
  };
  const e = (i: number, f: string) => errors[`menus.${i}.${f}`];
  const inv = (i: number, f: string) =>
    e(i, f) ? { invalid: true, describedBy: `menu-${i}-${f}-error` } : { invalid: false, describedBy: undefined };
  const Err = ({ i, f }: { i: number; f: string }) =>
    e(i, f) ? (
      <p id={`menu-${i}-${f}-error`} className="field-error">
        {e(i, f)}
      </p>
    ) : null;

  return (
    <div>
      <ol className="space-y-3">
        {rows.map((row, i) => {
          const diff = diffText(row);
          return (
            <li key={row.key} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">메뉴 {i + 1}</p>
                <button
                  type="button"
                  className="btn-secondary min-h-11 px-3"
                  disabled={rows.length <= 1}
                  aria-label={`메뉴 ${i + 1} 삭제`}
                  onClick={() => {
                    onChange(rows.filter((_, j) => j !== i));
                    onClearErrors("menus");
                  }}
                >
                  삭제
                </button>
              </div>

              <label htmlFor={`menu-${i}-name`} className="mt-2 block text-sm font-medium">
                메뉴 이름 <span className="text-primary">*</span>
              </label>
              <input
                id={`menu-${i}-name`}
                className="input mt-1"
                value={row.name}
                maxLength={50}
                placeholder="예: 삼겹살 1인분(180g)"
                onChange={(ev) => update(i, { name: ev.target.value })}
                aria-invalid={!!e(i, "name") || undefined}
                aria-describedby={e(i, "name") ? `menu-${i}-name-error` : undefined}
              />
              <Err i={i} f="name" />

              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor={`menu-${i}-solo_price`} className="block text-sm font-medium">
                    1인분 가격 <span className="text-primary">*</span>
                  </label>
                  <div className="mt-1">
                    <PriceInput
                      id={`menu-${i}-solo_price`}
                      value={row.solo_price}
                      placeholder="18,000"
                      onChange={(d) => update(i, { solo_price: d })}
                      {...inv(i, "solo_price")}
                    />
                  </div>
                  <Err i={i} f="solo_price" />
                </div>
                <div>
                  <label htmlFor={`menu-${i}-regular_price_per_person`} className="block text-sm font-medium">
                    보통 1인당 가격
                  </label>
                  <div className="mt-1">
                    <PriceInput
                      id={`menu-${i}-regular_price_per_person`}
                      value={row.regular_price_per_person}
                      placeholder="선택"
                      onChange={(d) => update(i, { regular_price_per_person: d })}
                      {...inv(i, "regular_price_per_person")}
                    />
                  </div>
                  <Err i={i} f="regular_price_per_person" />
                </div>
              </div>
              {diff ? <p className="mt-1 text-xs text-gray-700">{diff}</p> : null}

              <div className="mt-2 grid grid-cols-[7rem_1fr] gap-2">
                <div>
                  <label htmlFor={`menu-${i}-normal_min_servings`} className="block text-sm font-medium">
                    원래 최소 인분
                  </label>
                  <div className="relative mt-1">
                    <input
                      id={`menu-${i}-normal_min_servings`}
                      type="text"
                      inputMode="numeric"
                      className="input pr-12 text-right tabular-nums"
                      value={row.normal_min_servings}
                      maxLength={2}
                      onChange={(ev) => update(i, { normal_min_servings: ev.target.value.replace(/[^0-9]/g, "") })}
                      aria-invalid={!!e(i, "normal_min_servings") || undefined}
                      aria-describedby={e(i, "normal_min_servings") ? `menu-${i}-normal_min_servings-error` : undefined}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-600" aria-hidden>
                      인분
                    </span>
                  </div>
                  <Err i={i} f="normal_min_servings" />
                </div>
                <div>
                  <label htmlFor={`menu-${i}-note`} className="block text-sm font-medium">
                    메모
                  </label>
                  <input
                    id={`menu-${i}-note`}
                    className="input mt-1"
                    value={row.note}
                    maxLength={100}
                    placeholder="선택 · 예: 공깃밥 별도"
                    onChange={(ev) => update(i, { note: ev.target.value })}
                    aria-invalid={!!e(i, "note") || undefined}
                    aria-describedby={e(i, "note") ? `menu-${i}-note-error` : undefined}
                  />
                  <Err i={i} f="note" />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        className="btn-secondary mt-3"
        disabled={rows.length >= MAX_SOLO_MENUS}
        onClick={() => onChange([...rows, newMenuRow()])}
      >
        + 메뉴 추가 ({rows.length}/{MAX_SOLO_MENUS})
      </button>
      {errors.menus ? <p className="field-error">{errors.menus}</p> : null}
    </div>
  );
}
