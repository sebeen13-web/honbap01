"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CATEGORIES, TIME_SLOT_LABEL } from "@/lib/constants";
import { AddressSearch } from "@/features/map/address-search";
import { saveRestaurantAction } from "@/features/admin/restaurant-actions";
import { MenuItemsEditor } from "@/features/restaurants/editors/menu-items-editor";
import { TimeRulesEditor } from "@/features/restaurants/editors/time-rules-editor";
import type { RestaurantFormInitial } from "@/features/admin/restaurant-form-values";
import {
  DAY_KEYS,
  DAY_LABEL,
  TIME_SLOTS,
  restaurantFormSchema,
  toFieldErrors,
  type BusinessHours,
  type DayKey,
  type FieldErrors,
} from "@/features/restaurants/schema";
import type { Category } from "@/types/database";

type DayState = { closed: boolean; open: string; close: string };
type HoursState = Record<DayKey, DayState>;

function hoursToState(h: BusinessHours | null): HoursState {
  const out = {} as HoursState;
  for (const d of DAY_KEYS) {
    const v = h?.[d];
    out[d] = v ? { closed: false, open: v.open, close: v.close } : { closed: !!h, open: "11:00", close: "21:00" };
  }
  return out;
}

function stateToHours(s: HoursState): BusinessHours {
  const out = {} as BusinessHours;
  for (const d of DAY_KEYS) out[d] = s[d].closed ? null : { open: s[d].open, close: s[d].close };
  return out;
}

export function RestaurantForm({
  restaurantId,
  initial,
  kakaoAppKey,
}: {
  /** null 이면 새로 등록 */
  restaurantId: string | null;
  initial: RestaurantFormInitial;
  kakaoAppKey: string | null;
}) {
  const [v, setV] = useState(initial);
  const [hoursEnabled, setHoursEnabled] = useState(initial.business_hours !== null);
  const [hours, setHours] = useState<HoursState>(() => hoursToState(initial.business_hours));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const set = <K extends keyof RestaurantFormInitial>(key: K, value: RestaurantFormInitial[K]) => {
    setV((prev) => ({ ...prev, [key]: value }));
    // 고친 칸의 오류 문구는 바로 지운다 (하위 항목 포함)
    setErrors((prev) => {
      const k = String(key);
      const hit = Object.keys(prev).filter((e) => e === k || e.startsWith(`${k}.`));
      if (hit.length === 0) return prev;
      const next = { ...prev };
      hit.forEach((e) => delete next[e]);
      return next;
    });
  };

  const clearErrors = (prefix: string) =>
    setErrors((prev) => {
      const hit = Object.keys(prev).filter((e) => e === prefix || e.startsWith(`${prefix}.`));
      if (hit.length === 0) return prev;
      const next = { ...prev };
      hit.forEach((e) => delete next[e]);
      return next;
    });

  const err = (key: string) => errors[key];
  const errProps = (key: string, id: string) =>
    errors[key] ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` } : {};

  /** 서버로 보낼 값 (행 key 는 빼고 보낸다) */
  function buildPayload() {
    return {
      ...v,
      menus: v.menus.map((m) => ({
        name: m.name,
        solo_price: m.solo_price,
        regular_price_per_person: m.regular_price_per_person,
        normal_min_servings: m.normal_min_servings,
        note: m.note,
      })),
      time_rules: v.time_rules.map((r) => ({
        day_type: r.day_type,
        start_time: r.start_time,
        end_time: r.end_time,
        available: r.available,
        note: r.note,
      })),
      business_hours: hoursEnabled ? stateToHours(hours) : null,
    };
  }

  function focusFirstError() {
    requestAnimationFrame(() => {
      const el = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      el?.focus();
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const payload = buildPayload();
    const parsed = restaurantFormSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      setFormError("입력값을 확인해 주세요.");
      focusFirstError();
      return;
    }
    setErrors({});
    startTransition(async () => {
      try {
        // 성공하면 서버 액션이 목록으로 이동시킨다. 실패할 때만 결과가 돌아온다.
        const res = await saveRestaurantAction(restaurantId, payload);
        if (res && !res.ok) {
          setErrors(res.fieldErrors ?? {});
          setFormError(res.message);
          focusFirstError();
        }
      } catch {
        setFormError("서버와 통신하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.");
      }
    });
  }

  const hoursErrorKeys = Object.keys(errors).filter((k) => k.startsWith("business_hours"));

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-8">
      <fieldset disabled={pending} className="space-y-8">
        {/* ── 기본 정보 ── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">기본 정보</h2>

          <Field id="name" label="식당 이름" required error={err("name")}>
            <input
              id="name"
              className="input"
              value={v.name}
              maxLength={100}
              onChange={(e) => set("name", e.target.value)}
              {...errProps("name", "name")}
            />
          </Field>

          <div>
            <p className="block text-sm font-medium">
              주소 <span className="text-primary">*</span>
            </p>
            <p className="mb-2 text-xs text-gray-600">
              상호명으로 검색해 고르면 위도·경도와 카카오 장소가 함께 입력돼요(손님 요청과 연결돼요). 상호가 없으면 주소로
              찾아도 돼요.
            </p>
            <AddressSearch
              appKey={kakaoAppKey}
              preferPlaces
              label="상호명 또는 주소 검색"
              placeholder="상호명 또는 도로명·지번 주소"
              invalid={!!(err("address") || err("latitude") || err("longitude"))}
              describedBy={err("address") || err("latitude") ? "address-error" : undefined}
              onSelect={(s) => {
                setV((prev) => ({
                  ...prev,
                  address: s.address,
                  latitude: s.latitude,
                  longitude: s.longitude,
                  // 상호 검색으로 골랐고 비어 있으면 이름·전화번호도 채워 준다
                  name: prev.name || s.placeName || prev.name,
                  phone: prev.phone || s.phone || prev.phone,
                  // 주소만 고르면 카카오 장소 연결은 비운다
                  kakao_place_id: s.placeId ?? "",
                }));
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.address;
                  delete next.latitude;
                  delete next.longitude;
                  return next;
                });
              }}
            />
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-gray-50 p-3 text-sm">
              <dt className="text-gray-600">선택한 주소</dt>
              <dd className="break-all">{v.address || <span className="text-gray-500">아직 선택하지 않았어요</span>}</dd>
              <dt className="text-gray-600">카카오 장소</dt>
              <dd>
                {v.kakao_place_id ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <a
                      href={`https://place.map.kakao.com/${v.kakao_place_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary-strong underline underline-offset-2"
                    >
                      연결됨 ({v.kakao_place_id})
                    </a>
                    <button type="button" className="text-xs text-gray-700 underline" onClick={() => set("kakao_place_id", "")}>
                      연결 해제
                    </button>
                  </span>
                ) : (
                  <span className="text-gray-500">없음 (상호명으로 검색해 고르면 연결돼요)</span>
                )}
              </dd>
              <dt className="text-gray-600">위도·경도</dt>
              <dd>
                {v.latitude !== null && v.longitude !== null ? (
                  `${v.latitude.toFixed(6)}, ${v.longitude.toFixed(6)}`
                ) : (
                  <span className="text-gray-500">-</span>
                )}
              </dd>
            </dl>
            {err("address") || err("latitude") || err("longitude") || err("kakao_place_id") ? (
              <p id="address-error" className="field-error">
                {err("address") || err("latitude") || err("longitude") || err("kakao_place_id")}
              </p>
            ) : null}
          </div>

          <Field id="phone" label="전화번호" hint="선택 · 예: 031-123-4567" error={err("phone")}>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              className="input"
              value={v.phone}
              maxLength={20}
              onChange={(e) => set("phone", e.target.value)}
              {...errProps("phone", "phone")}
            />
          </Field>

          <Field id="category" label="음식 종류" required error={err("category")}>
            <select
              id="category"
              className="input"
              value={v.category}
              onChange={(e) => set("category", e.target.value as Category | "")}
              {...errProps("category", "category")}
            >
              <option value="">선택해 주세요</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </section>

        {/* ── 1인분 정책 ── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">1인분 주문</h2>

          <div>
            <p className="block text-sm font-medium">
              1인분 메뉴와 가격 <span className="text-primary">*</span>
            </p>
            <p className="mb-2 text-xs text-gray-600">
              보통 2인분부터 파는 메뉴를 1인분으로 시킬 때의 가격을 적어 주세요. ‘보통 1인당 가격’을 같이 적으면 손님
              화면에 차액이 표시돼요.
            </p>
            <MenuItemsEditor
              rows={v.menus}
              onChange={(rows) => setV((prev) => ({ ...prev, menus: rows }))}
              errors={errors}
              onClearErrors={clearErrors}
            />
          </div>

          <div>
            <p className="block text-sm font-medium">시간대 규칙</p>
            <p className="mb-2 text-xs text-gray-600">
              언제 1인분이 되고 안 되는지 적어 주세요. 겹치면 ‘불가’가 우선이고, 규칙에 없는 시간은 ‘불가’로 봐요. (한국 시간
              기준, 최대 8개)
            </p>
            <TimeRulesEditor
              rows={v.time_rules}
              onChange={(rows) => setV((prev) => ({ ...prev, time_rules: rows }))}
              errors={errors}
              onClearErrors={clearErrors}
            />
          </div>

          <fieldset>
            <legend className="text-sm font-medium">
              시간대 요약 <span className="text-primary">*</span>
            </legend>
            <p className="text-xs text-gray-600">목록에 짧게 보여 줄 요약이에요. 실제 가능 여부는 위 시간대 규칙으로 판단해요.</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TIME_SLOTS.map((slot) => (
                <label
                  key={slot}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
                >
                  <input
                    type="radio"
                    name="time_slot"
                    value={slot}
                    checked={v.time_slot === slot}
                    onChange={() => set("time_slot", slot)}
                    className="accent-primary"
                  />
                  {TIME_SLOT_LABEL[slot]}
                </label>
              ))}
            </div>
          </fieldset>

          <Field
            id="time_slot_note"
            label="시간대 메모"
            required={v.time_slot === "custom"}
            hint={v.time_slot === "custom" ? "예: 평일 14~17시만 1인 주문 가능" : "선택 · 예: 주말 점심은 2인 이상만"}
            error={err("time_slot_note")}
          >
            <input
              id="time_slot_note"
              className="input"
              value={v.time_slot_note}
              maxLength={200}
              onChange={(e) => set("time_slot_note", e.target.value)}
              {...errProps("time_slot_note", "time_slot_note")}
            />
          </Field>

          <fieldset>
            <legend className="text-sm font-medium">1인 주문 시 추가 요금 (보조 설명)</legend>
            <p className="text-xs text-gray-600">차액은 메뉴의 1인분 가격과 보통 1인당 가격으로 자동 계산돼요. 상차림비처럼 따로 받는 돈이 있을 때만 적어 주세요.</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[
                { value: false, label: "없음" },
                { value: true, label: "있음" },
              ].map((o) => (
                <label
                  key={String(o.value)}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
                >
                  <input
                    type="radio"
                    name="extra_fee"
                    checked={v.extra_fee === o.value}
                    onChange={() => set("extra_fee", o.value)}
                    className="accent-primary"
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>

          {v.extra_fee ? (
            <Field id="extra_fee_note" label="추가 요금 메모" required hint="예: 1인 주문 시 상차림비 2,000원 별도" error={err("extra_fee_note")}>
              <input
                id="extra_fee_note"
                className="input"
                value={v.extra_fee_note}
                maxLength={200}
                onChange={(e) => set("extra_fee_note", e.target.value)}
                {...errProps("extra_fee_note", "extra_fee_note")}
              />
            </Field>
          ) : null}
        </section>

        {/* ── 영업시간 (선택) ── */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            영업시간 <span className="text-sm font-normal text-gray-600">(선택)</span>
          </h2>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={hoursEnabled}
              onChange={(e) => setHoursEnabled(e.target.checked)}
              className="size-5 accent-primary"
            />
            영업시간 입력하기
          </label>
          {!hoursEnabled ? (
            <p className="text-sm text-gray-600">입력하지 않으면 손님 화면에 ‘영업시간 정보 없음’으로 표시돼요.</p>
          ) : (
            <>
              <p className="text-xs text-gray-600">
                닫는 시간이 여는 시간보다 이르면 자정을 넘겨 영업(예: 17:00~02:00), 같으면 24시간 영업으로 처리해요.
              </p>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {DAY_KEYS.map((d) => {
                  const day = hours[d];
                  const setDay = (patch: Partial<DayState>) => {
                    setHours((h) => ({ ...h, [d]: { ...h[d], ...patch } }));
                    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith("business_hours"))));
                  };
                  return (
                    <li key={d} className="flex flex-wrap items-center gap-2 px-3 py-2">
                      <span className="w-6 font-medium">{DAY_LABEL[d]}</span>
                      <label className="flex min-h-11 items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={day.closed}
                          onChange={(e) => setDay({ closed: e.target.checked })}
                          className="size-4 accent-primary"
                        />
                        휴무
                      </label>
                      {!day.closed ? (
                        <span className="flex items-center gap-1">
                          <label className="sr-only" htmlFor={`${d}-open`}>
                            {DAY_LABEL[d]}요일 여는 시간
                          </label>
                          <input
                            id={`${d}-open`}
                            type="time"
                            className="input w-auto py-1.5"
                            value={day.open}
                            onChange={(e) => setDay({ open: e.target.value })}
                            aria-invalid={!!err(`business_hours.${d}.open`) || undefined}
                          />
                          <span aria-hidden>~</span>
                          <label className="sr-only" htmlFor={`${d}-close`}>
                            {DAY_LABEL[d]}요일 닫는 시간
                          </label>
                          <input
                            id={`${d}-close`}
                            type="time"
                            className="input w-auto py-1.5"
                            value={day.close}
                            onChange={(e) => setDay({ close: e.target.value })}
                            aria-invalid={!!err(`business_hours.${d}.close`) || undefined}
                          />
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {hoursErrorKeys.length > 0 ? <p className="field-error">{errors[hoursErrorKeys[0]]}</p> : null}
            </>
          )}
        </section>
      </fieldset>

      <div aria-live="assertive">
        {formError ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {formError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href="/admin/restaurants" className="btn-secondary">
          취소
        </Link>
        <button type="submit" disabled={pending} aria-busy={pending} className="btn-primary sm:min-w-40">
          {pending ? "저장 중…" : restaurantId ? "수정 내용 저장" : "식당 등록"}
        </button>
      </div>
      <p className="text-xs text-gray-600">
        관리자가 저장하면 출처는 ‘직접 확인함’, 마지막 확인일은 저장 시각으로 기록돼요.
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label} {required ? <span className="text-primary">*</span> : null}
      </label>
      {hint ? <p className="text-xs text-gray-600">{hint}</p> : null}
      <div className="mt-1">{children}</div>
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
