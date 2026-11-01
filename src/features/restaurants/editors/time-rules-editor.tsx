"use client";

import { DAY_TYPES, DAY_TYPE_LABEL, MAX_TIME_RULES, type FieldErrors } from "@/features/restaurants/schema";
import type { DayType } from "@/types/database";
import { newTimeRuleRow, type TimeRuleRow } from "@/features/restaurants/form-rows";

function ruleHint(r: TimeRuleRow): string | null {
  if (!r.start_time || !r.end_time) return null;
  if (r.start_time === r.end_time) return "시작과 종료가 같으면 하루 종일로 처리해요.";
  if (r.end_time < r.start_time) return "종료가 시작보다 이르면 자정을 넘겨 다음 날까지로 처리해요.";
  return null;
}

/**
 * 시간대 규칙 행 편집 (0~8개). 겹치면 '불가'가 우선한다. 한국 시간 기준.
 * 오류 경로: time_rules, time_rules.{i}.day_type / start_time / end_time / note
 */
export function TimeRulesEditor({
  rows,
  onChange,
  errors,
  onClearErrors,
}: {
  rows: TimeRuleRow[];
  onChange: (rows: TimeRuleRow[]) => void;
  errors: FieldErrors;
  onClearErrors: (prefix: string) => void;
}) {
  const update = (i: number, patch: Partial<TimeRuleRow>) => {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    Object.keys(patch).forEach((k) => onClearErrors(`time_rules.${i}.${k}`));
    onClearErrors("time_rules");
  };
  const e = (i: number, f: string) => errors[`time_rules.${i}.${f}`];

  return (
    <div>
      {rows.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
          규칙이 없으면 손님 화면에 ‘지금 1인분 가능’ 여부를 표시하지 않아요.
        </p>
      ) : (
        <ol className="space-y-3">
          {rows.map((row, i) => {
            const hint = ruleHint(row);
            return (
              <li key={row.key} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-800">규칙 {i + 1}</p>
                  <button
                    type="button"
                    className="btn-secondary min-h-11 px-3"
                    aria-label={`시간대 규칙 ${i + 1} 삭제`}
                    onClick={() => {
                      onChange(rows.filter((_, j) => j !== i));
                      onClearErrors("time_rules");
                    }}
                  >
                    삭제
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor={`rule-${i}-day_type`} className="block text-sm font-medium">
                      요일
                    </label>
                    <select
                      id={`rule-${i}-day_type`}
                      className="input mt-1"
                      value={row.day_type}
                      onChange={(ev) => update(i, { day_type: ev.target.value as DayType })}
                      aria-invalid={!!e(i, "day_type") || undefined}
                    >
                      {DAY_TYPES.map((d) => (
                        <option key={d} value={d}>
                          {DAY_TYPE_LABEL[d]}
                          {d === "weekday" ? " (월~금)" : d === "weekend" ? " (토·일)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <fieldset>
                    <legend className="block text-sm font-medium">1인분</legend>
                    <div className="mt-1 grid grid-cols-2 gap-1">
                      {[
                        { v: true, label: "가능" },
                        { v: false, label: "불가" },
                      ].map((o) => (
                        <label
                          key={String(o.v)}
                          className="flex min-h-11 cursor-pointer items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:font-semibold"
                        >
                          <input
                            type="radio"
                            name={`rule-${row.key}-available`}
                            className="sr-only"
                            checked={row.available === o.v}
                            onChange={() => update(i, { available: o.v })}
                          />
                          {o.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>

                <div className="mt-2 flex items-end gap-2">
                  <div className="flex-1">
                    <label htmlFor={`rule-${i}-start_time`} className="block text-sm font-medium">
                      시작
                    </label>
                    <input
                      id={`rule-${i}-start_time`}
                      type="time"
                      className="input mt-1"
                      value={row.start_time}
                      onChange={(ev) => update(i, { start_time: ev.target.value })}
                      aria-invalid={!!e(i, "start_time") || undefined}
                    />
                  </div>
                  <span className="pb-3 text-gray-600" aria-hidden>
                    ~
                  </span>
                  <div className="flex-1">
                    <label htmlFor={`rule-${i}-end_time`} className="block text-sm font-medium">
                      종료
                    </label>
                    <input
                      id={`rule-${i}-end_time`}
                      type="time"
                      className="input mt-1"
                      value={row.end_time}
                      onChange={(ev) => update(i, { end_time: ev.target.value })}
                      aria-invalid={!!e(i, "end_time") || undefined}
                    />
                  </div>
                </div>
                {e(i, "start_time") || e(i, "end_time") || e(i, "day_type") ? (
                  <p className="field-error">{e(i, "start_time") || e(i, "end_time") || e(i, "day_type")}</p>
                ) : hint ? (
                  <p className="mt-1 text-xs text-gray-700">{hint}</p>
                ) : null}

                <label htmlFor={`rule-${i}-note`} className="mt-2 block text-sm font-medium">
                  메모
                </label>
                <input
                  id={`rule-${i}-note`}
                  className="input mt-1"
                  value={row.note}
                  maxLength={100}
                  placeholder={row.available ? "선택 · 예: 점심 1인 세트" : "선택 · 예: 저녁 피크에는 2인 이상만"}
                  onChange={(ev) => update(i, { note: ev.target.value })}
                  aria-invalid={!!e(i, "note") || undefined}
                />
                {e(i, "note") ? <p className="field-error">{e(i, "note")}</p> : null}
              </li>
            );
          })}
        </ol>
      )}
      <button
        type="button"
        className="btn-secondary mt-3"
        disabled={rows.length >= MAX_TIME_RULES}
        onClick={() => onChange([...rows, newTimeRuleRow()])}
      >
        + 시간대 규칙 추가 ({rows.length}/{MAX_TIME_RULES})
      </button>
      {errors.time_rules ? <p className="field-error">{errors.time_rules}</p> : null}
    </div>
  );
}
