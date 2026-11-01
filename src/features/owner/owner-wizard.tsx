"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES } from "@/lib/constants";
import { AddressSearch } from "@/features/map/address-search";
import { MenuItemsEditor } from "@/features/restaurants/editors/menu-items-editor";
import { TimeRulesEditor } from "@/features/restaurants/editors/time-rules-editor";
import { newMenuRow, newTimeRuleRow, type MenuRow, type TimeRuleRow } from "@/features/restaurants/form-rows";
import { toFieldErrors, type FieldErrors } from "@/features/restaurants/schema";
import { guessCategory } from "@/features/requests/place-search";
import { ownerMenusSchema, ownerPlaceSchema, ownerRulesSchema } from "@/features/owner/owner-schema";
import { requestClaimAction, saveOwnerRestaurantAction } from "@/features/owner/actions";
import type { Category, OwnerPlaceLookup } from "@/types/database";
import type { OwnerPlace, OwnerWizardInitial } from "@/features/owner/owner-values";

const STEPS = ["식당 찾기", "1인분 메뉴", "1인분 되는 시간"] as const;

/** 화면용 key 를 뺀 값 */
const menuValues = (rows: MenuRow[]) =>
  rows.map((m) => ({
    name: m.name,
    solo_price: m.solo_price,
    regular_price_per_person: m.regular_price_per_person,
    normal_min_servings: m.normal_min_servings,
    note: m.note,
  }));
const ruleValues = (rows: TimeRuleRow[]) =>
  rows.map((r) => ({ day_type: r.day_type, start_time: r.start_time, end_time: r.end_time, available: r.available, note: r.note }));
type Draft = { step: number; place: OwnerPlace; menus: MenuRow[]; time_rules: TimeRuleRow[]; savedAt: string };

const draftKey = (userId: string) => `honbap:owner-draft:v1:${userId}`;
function readDraft(userId: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(userId));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

/**
 * 사장님 등록(3단계) / 내 식당 수정.
 *  ① 식당 찾기 — 카카오 장소 검색. 이미 조사된 식당이면 "내 식당으로 연결 요청"
 *  ② 1인분 메뉴(이름·가격) 1개 이상
 *  ③ 1인분 되는 시간(시간대 규칙) 1개 이상
 * 작성 중인 내용은 이 브라우저에 임시 저장된다(식당 정보만, 손님 위치와 무관).
 */
export function OwnerWizard({
  mode,
  restaurantId,
  userId,
  kakaoAppKey,
  initial,
  pendingClaim,
}: {
  mode: "create" | "edit";
  restaurantId: string | null;
  userId: string;
  kakaoAppKey: string | null;
  initial: OwnerWizardInitial;
  /** 검토 중인 연결 요청이 있으면 그 식당 이름 */
  pendingClaim: string | null;
}) {
  const [step, setStep] = useState(0);
  const [place, setPlace] = useState<OwnerPlace>(initial.place);
  const [menus, setMenus] = useState<MenuRow[]>(initial.menus);
  const [rules, setRules] = useState<TimeRuleRow[]>(initial.time_rules);
  const [lookup, setLookup] = useState<OwnerPlaceLookup | null>(null);
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [draftOffer, setDraftOffer] = useState<Draft | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [claim, setClaim] = useState<{ state: "idle" | "sending" | "sent" | "error"; message?: string }>({ state: "idle" });
  const [pending, startTransition] = useTransition();
  const topRef = useRef<HTMLDivElement>(null);
  const restored = useRef(mode === "edit");
  const submitting = useRef(false);

  // 작성하던 내용이 있으면 이어서 쓸지 묻는다 (새 등록만)
  useEffect(() => {
    if (mode !== "create") return;
    const d = readDraft(userId);
    if (d) setDraftOffer(d);
    else restored.current = true;
  }, [mode, userId]);

  // 임시 저장 (입력이 바뀌면 0.8초 뒤 자동 저장)
  useEffect(() => {
    if (mode !== "create" || !restored.current) return;
    const t = window.setTimeout(() => saveDraft(false), 800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, menus, rules, step, mode]);

  function saveDraft(manual: boolean) {
    if (submitting.current && !manual) return;
    const empty = !place.address && menus.every((m) => !m.name && !m.solo_price);
    if (empty && !manual) return;
    const at = new Date().toISOString();
    try {
      window.localStorage.setItem(draftKey(userId), JSON.stringify({ step, place, menus, time_rules: rules, savedAt: at } satisfies Draft));
      setSavedAt(at);
    } catch {
      if (manual) setFormError("이 브라우저에서는 임시 저장을 할 수 없어요.");
    }
  }
  function clearDraft() {
    try {
      window.localStorage.removeItem(draftKey(userId));
    } catch {
      // 무시
    }
  }

  const clearErrors = (prefix: string) =>
    setErrors((prev) => {
      const hit = Object.keys(prev).filter((e) => e === prefix || e.startsWith(`${prefix}.`));
      if (hit.length === 0) return prev;
      const next = { ...prev };
      hit.forEach((e) => delete next[e]);
      return next;
    });

  async function lookupPlace(pid: string) {
    setLookupState("loading");
    const { data, error } = await createClient().rpc("owner_place_lookup", { p_kakao_place_id: pid });
    if (error) {
      setLookup(null);
      setLookupState("error");
      return;
    }
    setLookup(data?.[0] ?? null);
    setLookupState("done");
  }

  const existing = mode === "create" && lookup?.restaurant_id ? lookup : null;
  const votes = lookup?.request_votes ?? 0;

  function goTo(next: number) {
    setFormError(null);
    // 앞으로 갈 때는 지금 단계를 검사
    if (next > step) {
      const result =
        step === 0
          ? ownerPlaceSchema.safeParse(place)
          : step === 1
            ? ownerMenusSchema.safeParse(menuValues(menus))
            : ownerRulesSchema.safeParse(ruleValues(rules));
      if (!result.success) {
        const fe = toFieldErrors(result.error);
        const prefix = step === 0 ? "place" : step === 1 ? "menus" : "time_rules";
        setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k === "_form" ? prefix : `${prefix}.${k}`, v])));
        setFormError("입력값을 확인해 주세요.");
        return;
      }
      if (step === 0 && existing) return;
    }
    setErrors({});
    setStep(next);
    topRef.current?.scrollIntoView({ block: "start" });
  }

  function submit() {
    const rulesCheck = ownerRulesSchema.safeParse(ruleValues(rules));
    if (!rulesCheck.success) return goTo(3);
    const payload = {
      place,
      menus: menuValues(menus),
      time_rules: ruleValues(rules),
    };
    setFormError(null);
    startTransition(async () => {
      // 성공하면 서버가 /owner 로 이동시키므로, 보내기 전에 임시 저장을 지우고 실패하면 다시 저장한다
      submitting.current = true;
      if (mode === "create") clearDraft();
      try {
        const res = await saveOwnerRestaurantAction(restaurantId, payload);
        if (res && !res.ok) {
          submitting.current = false;
          if (mode === "create") saveDraft(true);
          setErrors(res.fieldErrors ?? {});
          setFormError(res.message);
          if (res.code === "place_taken" || res.fieldErrors?.["place.address"]) setStep(0);
        }
      } catch (e) {
        unstable_rethrow(e); // 성공 시 서버의 redirect 는 그대로 진행
        submitting.current = false;
        if (mode === "create") saveDraft(true);
        setFormError("서버와 통신하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.");
      }
    });
  }

  async function sendClaim() {
    if (!existing?.restaurant_id) return;
    setClaim({ state: "sending" });
    const res = await requestClaimAction(existing.restaurant_id);
    setClaim(res.ok ? { state: "sent" } : { state: "error", message: res.message });
  }

  const err = (k: string) => errors[k];
  const lastStep = STEPS.length - 1;

  return (
    <div ref={topRef} className="scroll-mt-20 space-y-5">
      {draftOffer ? (
        <div role="status" className="rounded-xl border border-primary/30 bg-primary-soft p-3 text-sm text-primary-strong">
          <p className="font-semibold">작성하던 내용이 있어요{draftOffer.place.name ? ` (${draftOffer.place.name})` : ""}.</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setPlace(draftOffer.place);
                setMenus(draftOffer.menus.length ? draftOffer.menus : [newMenuRow()]);
                setRules(draftOffer.time_rules.length ? draftOffer.time_rules : [newTimeRuleRow()]);
                setStep(Math.min(Math.max(draftOffer.step, 0), lastStep));
                setSavedAt(draftOffer.savedAt);
                if (draftOffer.place.kakao_place_id) void lookupPlace(draftOffer.place.kakao_place_id);
                setDraftOffer(null);
                restored.current = true;
              }}
            >
              이어서 작성
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                clearDraft();
                setDraftOffer(null);
                restored.current = true;
              }}
            >
              새로 시작
            </button>
          </div>
        </div>
      ) : null}

      {mode === "create" && pendingClaim ? (
        <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          ‘{pendingClaim}’ 연결 요청을 검토하고 있어요. 승인되면 사장님 화면이 열려요.
        </p>
      ) : null}

      {/* 진행 표시 */}
      <ol className="grid grid-cols-3 gap-1" aria-label="등록 단계">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined}>
            <span className={`block h-1.5 rounded-full ${i <= step ? "bg-primary" : "bg-gray-200"}`} aria-hidden />
            <span className={`mt-1 block text-xs ${i === step ? "font-bold text-primary-strong" : "text-gray-600"}`}>
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      {votes > 0 ? (
        <p className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white">
          🙋 손님 {votes}명이 이 식당의 1인분을 요청했어요{mode === "create" ? ". 등록하면 요청한 손님들께 알려드려요." : "."}
        </p>
      ) : null}

      {/* ① 식당 */}
      {step === 0 ? (
        <section className="space-y-4" aria-labelledby="step1">
          <h2 id="step1" className="text-lg font-bold text-gray-900">
            어느 식당인가요?
          </h2>
          {mode === "create" ? (
            <>
              <AddressSearch
                appKey={kakaoAppKey}
                preferPlaces
                label="가게 이름 또는 주소 검색"
                placeholder="가게 이름 (예: ○○갈비 안산점)"
                invalid={!!(err("place.address") || err("place.latitude"))}
                onSelect={(s) => {
                  setPlace((p) => ({
                    ...p,
                    kakao_place_id: s.placeId ?? null,
                    name: s.placeName ?? p.name,
                    address: s.address,
                    latitude: s.latitude,
                    longitude: s.longitude,
                    phone: s.phone ?? p.phone,
                    category: s.category ? guessCategory(s.category) : p.category,
                  }));
                  clearErrors("place");
                  setClaim({ state: "idle" });
                  setLookup(null);
                  if (s.placeId) void lookupPlace(s.placeId);
                  else setLookupState("idle");
                }}
              />
              {err("place.address") || err("place.latitude") ? <p className="field-error">{err("place.address") || err("place.latitude")}</p> : null}
            </>
          ) : null}

          {place.address ? (
            <div className="rounded-xl bg-gray-50 p-3 text-sm">
              <p className="text-gray-600">주소</p>
              <p className="font-medium text-gray-900">{place.address}</p>
              {mode === "edit" ? <p className="mt-1 text-xs text-gray-600">주소·위치를 바꾸려면 운영자에게 문의해 주세요.</p> : null}
            </div>
          ) : null}

          {lookupState === "loading" ? <p className="text-sm text-gray-700">등록된 식당인지 확인하는 중…</p> : null}
          {lookupState === "error" ? <p className="field-error">등록 여부를 확인하지 못했어요. 다시 골라 주세요.</p> : null}

          {existing ? (
            <div className="rounded-xl border-2 border-primary p-4 text-sm">
              {existing.is_mine ? (
                <>
                  <p className="font-semibold text-gray-900">이미 내 식당으로 등록돼 있어요.</p>
                  <Link href="/owner" className="btn-primary mt-3 w-full">
                    사장님 화면으로
                  </Link>
                </>
              ) : existing.has_owner ? (
                <p className="font-semibold text-gray-900">이미 다른 사장님이 관리하는 식당이에요. 잘못 연결됐다면 운영자에게 문의해 주세요.</p>
              ) : existing.my_claim_status === "pending" || claim.state === "sent" ? (
                <p role="status" className="font-semibold text-primary-strong">
                  연결 요청을 보냈어요. 운영자가 확인(전화 등)한 뒤 승인하면 사장님 화면이 열려요.
                </p>
              ) : (
                <>
                  <p className="font-semibold text-gray-900">혼밥 지도가 이미 조사해 둔 식당이에요.</p>
                  <p className="mt-1 text-gray-700">
                    새로 등록하지 않고 ‘내 식당으로 연결 요청’을 보내 주세요. 운영자가 확인 후 승인하면 메뉴·시간을 직접 고칠 수 있어요.
                  </p>
                  {existing.my_claim_status === "rejected" ? (
                    <p className="mt-1 text-xs text-gray-600">이전 요청은 승인되지 않았어요. 다시 요청할 수 있어요.</p>
                  ) : null}
                  <button type="button" onClick={() => void sendClaim()} disabled={claim.state === "sending"} className="btn-primary mt-3 w-full">
                    {claim.state === "sending" ? "보내는 중…" : "내 식당으로 연결 요청"}
                  </button>
                  {claim.state === "error" ? (
                    <p role="alert" className="field-error">
                      {claim.message}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          ) : place.address ? (
            <div className="space-y-3">
              <div>
                <label htmlFor="o-name" className="block text-sm font-medium">
                  가게 이름 <span className="text-primary">*</span>
                </label>
                <input
                  id="o-name"
                  className="input mt-1"
                  value={place.name}
                  maxLength={100}
                  onChange={(e) => {
                    setPlace({ ...place, name: e.target.value });
                    clearErrors("place.name");
                  }}
                  aria-invalid={!!err("place.name") || undefined}
                />
                {err("place.name") ? <p className="field-error">{err("place.name")}</p> : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="o-category" className="block text-sm font-medium">
                    음식 종류 <span className="text-primary">*</span>
                  </label>
                  <select
                    id="o-category"
                    className="input mt-1"
                    value={place.category}
                    onChange={(e) => {
                      setPlace({ ...place, category: e.target.value as Category | "" });
                      clearErrors("place.category");
                    }}
                    aria-invalid={!!err("place.category") || undefined}
                  >
                    <option value="">골라 주세요</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  {err("place.category") ? <p className="field-error">{err("place.category")}</p> : null}
                </div>
                <div>
                  <label htmlFor="o-phone" className="block text-sm font-medium">
                    전화번호
                  </label>
                  <input
                    id="o-phone"
                    type="tel"
                    className="input mt-1"
                    value={place.phone}
                    maxLength={20}
                    placeholder="선택"
                    onChange={(e) => {
                      setPlace({ ...place, phone: e.target.value });
                      clearErrors("place.phone");
                    }}
                    aria-invalid={!!err("place.phone") || undefined}
                  />
                  {err("place.phone") ? <p className="field-error">{err("place.phone")}</p> : null}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ② 메뉴 */}
      {step === 1 ? (
        <section className="space-y-2" aria-labelledby="step2">
          <h2 id="step2" className="text-lg font-bold text-gray-900">
            1인분으로 주문할 수 있는 메뉴
          </h2>
          <p className="text-sm text-gray-700">보통 2인분부터 파는 메뉴를 1인분으로 시킬 때의 가격을 적어 주세요. 하나만 있어도 돼요.</p>
          <MenuItemsEditor rows={menus} onChange={setMenus} errors={errors} onClearErrors={clearErrors} />
        </section>
      ) : null}

      {/* ③ 시간 */}
      {step === 2 ? (
        <section className="space-y-2" aria-labelledby="step3">
          <h2 id="step3" className="text-lg font-bold text-gray-900">
            1인분이 되는 시간
          </h2>
          <p className="text-sm text-gray-700">
            언제 1인분이 되는지 알려 주세요. 바쁜 시간에 안 된다면 ‘불가’ 규칙을 하나 더 넣으면 돼요. (예: 평일 18~20시 불가)
          </p>
          <TimeRulesEditor rows={rules} onChange={setRules} errors={errors} onClearErrors={clearErrors} />
        </section>
      ) : null}

      <div aria-live="assertive">
        {formError ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {formError}
          </p>
        ) : null}
      </div>

      {/* 아래 버튼 */}
      {!(step === 0 && existing) ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            {step > 0 ? (
              <button type="button" onClick={() => goTo(step - 1)} className="btn-secondary min-h-12 flex-1">
                이전
              </button>
            ) : null}
            {step < lastStep ? (
              <button type="button" onClick={() => goTo(step + 1)} disabled={step === 0 && !place.address} className="btn-primary min-h-12 flex-[2]">
                다음
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={pending} className="btn-primary min-h-12 flex-[2]">
                {pending ? "저장하는 중…" : mode === "create" ? "등록하기" : "저장하기"}
              </button>
            )}
          </div>
          {mode === "create" ? (
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span aria-live="polite">
                {savedAt
                  ? `임시 저장됨 ${new Date(savedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} (이 브라우저)`
                  : "입력한 내용은 이 브라우저에 자동으로 임시 저장돼요."}
              </span>
              <button type="button" onClick={() => saveDraft(true)} className="inline-flex min-h-11 items-center px-2 font-medium text-primary-strong underline">
                임시 저장
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
