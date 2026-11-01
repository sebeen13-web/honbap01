"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LocationBar } from "@/features/nearby/location-bar";
import { useNearby } from "@/features/nearby/nearby-context";
import { formatDistance } from "@/features/restaurants/format";
import { guessCategory, lastCategory, searchRestaurantsOnKakao } from "@/features/requests/place-search";
import type { KakaoPlaceResult } from "@/features/map/kakao-types";
import type { CreateRequestResult, PlaceRequestStatus, RequestListItem } from "@/types/database";

type Notice = { kind: "ok" | "error" | "info"; text: string; restaurantId?: string } | null;
type SortKey = "popular" | "near";

const LOGIN_PROMPT = {
  title: "로그인하면 요청할 수 있어요",
  description: "요청과 +1 은 한 사람이 한 번씩만 셀 수 있게 로그인이 필요해요. 둘러보기는 로그인 없이 가능해요.",
  next: "/request",
};

/**
 * 요청 탭: 아직 등록되지 않은 식당에 "1인분 되게 해주세요" 요청 / +1.
 * 기준점 좌표는 카카오 검색과 목록 정렬 요청에만 쓰고 저장하지 않는다.
 */
export function RequestScreen() {
  const { kakaoAppKey, origin, auth, requireLogin } = useNearby();
  const supabase = useRef(createClient()).current;

  const [query, setQuery] = useState("");
  const [searchState, setSearchState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [places, setPlaces] = useState<KakaoPlaceResult[]>([]);
  const [statuses, setStatuses] = useState<Map<string, PlaceRequestStatus>>(new Map());

  const [sort, setSort] = useState<SortKey>("popular");
  const [list, setList] = useState<RequestListItem[]>([]);
  const [listState, setListState] = useState<"loading" | "done" | "error">("loading");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());

  const lat = origin?.coords.lat ?? null;
  const lng = origin?.coords.lng ?? null;
  const userKey = auth.status === "user" ? auth.userId : auth.status;

  const loadList = useCallback(async () => {
    setListState("loading");
    const { data, error } = await supabase.rpc("list_restaurant_requests", {
      p_lat: lat,
      p_lng: lng,
      p_sort: sort === "near" && lat !== null ? "near" : "popular",
      p_limit: 50,
    });
    if (error) {
      setListState("error");
      return;
    }
    setList(data ?? []);
    setListState("done");
  }, [supabase, lat, lng, sort]);

  // 로그인 상태가 바뀌면(i_voted) 다시 불러온다
  useEffect(() => {
    if (auth.status === "loading") return;
    void loadList();
  }, [loadList, userKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // 공유 링크(/request?r=요청id)로 들어오면 그 요청을 강조
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("r");
    if (r) setHighlight(r);
  }, []);
  useEffect(() => {
    if (highlight && listState === "done") itemRefs.current.get(highlight)?.scrollIntoView({ block: "center" });
  }, [highlight, listState]);

  const refreshStatuses = useCallback(
    async (ps: KakaoPlaceResult[]) => {
      if (ps.length === 0) return setStatuses(new Map());
      const { data } = await supabase.rpc("place_request_status", { p_kakao_place_ids: ps.map((p) => p.id) });
      setStatuses(new Map((data ?? []).map((s) => [s.kakao_place_id, s])));
    },
    [supabase],
  );

  async function onSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      setSearchState("error");
      setNotice({ kind: "error", text: "식당 이름을 두 글자 이상 입력해 주세요." });
      return;
    }
    if (!kakaoAppKey) {
      setSearchState("error");
      setNotice({ kind: "error", text: "카카오 지도 키가 설정되지 않아 식당을 검색할 수 없어요." });
      return;
    }
    setNotice(null);
    setSearchState("loading");
    try {
      const found = await searchRestaurantsOnKakao(kakaoAppKey, q, origin?.coords ?? null);
      setPlaces(found);
      await refreshStatuses(found);
      setSearchState("done");
    } catch {
      setSearchState("error");
      setNotice({
        kind: "error",
        text: "식당 검색에 실패했어요. 카카오 지도 설정(JavaScript 키, Web 사이트 도메인, 카카오맵 사용 설정)을 확인하고 다시 시도해 주세요.",
      });
    }
  }

  async function onRequest(p: KakaoPlaceResult) {
    if (!requireLogin(LOGIN_PROMPT)) return;
    setBusy(p.id);
    setNotice(null);
    const { data, error } = await supabase.rpc("create_restaurant_request", {
      p_kakao_place_id: p.id,
      p_name: p.place_name,
      p_address: p.road_address_name || p.address_name,
      p_latitude: Number(p.y),
      p_longitude: Number(p.x),
      p_category: guessCategory(p.category_name, p.place_name),
    });
    setBusy(null);
    if (error) {
      setNotice({
        kind: "error",
        text: error.hint === "daily_limit" ? error.message : "요청하지 못했어요. 잠시 후 다시 시도해 주세요.",
      });
      return;
    }
    const res = data as unknown as CreateRequestResult;
    const text: Record<CreateRequestResult["result"], string> = {
      created: `‘${p.place_name}’ 요청을 남겼어요. 요청이 모이면 사장님께 전할게요.`,
      voted: `‘${p.place_name}’ 요청에 +1 했어요.`,
      already_voted: "이미 +1 한 식당이에요.",
      registered: "이미 1인분 가능한 식당이에요.",
      closed: "조사해 봤지만 아직 1인분이 어려운 식당이에요.",
    };
    setNotice({
      kind: res.result === "created" || res.result === "voted" ? "ok" : "info",
      text: text[res.result],
      restaurantId: res.result === "registered" ? (res.restaurant_id ?? undefined) : undefined,
    });
    await Promise.all([refreshStatuses(places), loadList()]);
  }

  async function onToggleVote(requestId: string, voted: boolean) {
    if (!requireLogin(LOGIN_PROMPT) || auth.status !== "user") return;
    setBusy(requestId);
    setNotice(null);
    const { error } = voted
      ? await supabase.from("restaurant_request_votes").delete().eq("request_id", requestId).eq("user_id", auth.userId)
      : await supabase.from("restaurant_request_votes").insert({ request_id: requestId, user_id: auth.userId });
    setBusy(null);
    if (error) {
      setNotice({ kind: "error", text: voted ? "+1 을 취소하지 못했어요." : "+1 하지 못했어요. 잠시 후 다시 시도해 주세요." });
      return;
    }
    await Promise.all([loadList(), refreshStatuses(places)]);
  }

  async function onShare(item: RequestListItem) {
    const url = `${window.location.origin}/request?r=${item.id}`;
    const text = `‘${item.name}’도 1인분 되면 좋겠어요! 혼밥 지도에서 +1 해 주세요.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "혼밥 지도 요청", text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNotice({ kind: "ok", text: "링크를 복사했어요. 친구에게 보내 주세요." });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // 공유 창을 닫은 경우
      setNotice({ kind: "error", text: `링크를 복사하지 못했어요. 이 주소를 직접 복사해 주세요: ${url}` });
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-8">
      <h1 className="text-2xl font-bold text-gray-900">식당 요청</h1>
      <p className="mt-1 text-sm text-gray-700">여기도 1인분 되면 좋겠어요. 요청이 모이면 사장님께 전해요.</p>

      <div className="mt-4">
        <LocationBar intro="내 근처 식당부터 찾으려면 위치를 정해 주세요" />
      </div>

      {/* 식당 검색 */}
      <form onSubmit={onSearch} className="mt-4" role="search">
        <label htmlFor="place-search" className="block text-sm font-semibold text-gray-900">
          1인분 됐으면 하는 식당 찾기
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="place-search"
            type="search"
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="식당 이름 (예: ○○갈비)"
            autoComplete="off"
          />
          <button type="submit" disabled={searchState === "loading"} className="btn-primary shrink-0">
            {searchState === "loading" ? "찾는 중…" : "검색"}
          </button>
        </div>
        {!origin ? <p className="mt-1 text-xs text-gray-600">위치를 정하지 않으면 전국에서 찾아요.</p> : null}
      </form>

      <div aria-live="polite">
        {notice ? (
          <p
            role={notice.kind === "error" ? "alert" : "status"}
            className={`mt-3 rounded-lg p-3 text-sm ${
              notice.kind === "error"
                ? "border border-red-200 bg-red-50 text-red-800"
                : "border border-primary/30 bg-primary-soft text-primary-strong"
            }`}
          >
            {notice.text}
            {notice.restaurantId ? (
              <>
                {" "}
                <Link href={`/restaurants/${notice.restaurantId}`} prefetch={false} className="font-semibold underline">
                  자세히 보기
                </Link>
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      {searchState === "done" ? (
        places.length === 0 ? (
          <p className="mt-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">검색 결과가 없어요. 식당 이름을 다시 확인해 주세요.</p>
        ) : (
          <ul className="mt-3 space-y-2" aria-label="식당 검색 결과">
            {places.map((p) => {
              const st = statuses.get(p.id);
              return (
                <li key={p.id} className="rounded-xl border border-gray-200 bg-white p-3">
                  <p className="font-semibold text-gray-900">{p.place_name}</p>
                  <p className="text-sm text-gray-700">
                    {p.road_address_name || p.address_name}
                    {p.distance ? ` · ${formatDistance(Number(p.distance))}` : ""}
                  </p>
                  <p className="text-xs text-gray-600">{lastCategory(p.category_name)}</p>
                  <div className="mt-2">
                    {st?.restaurant_id ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white">이미 1인분 가능한 식당이에요</span>
                        <Link href={`/restaurants/${st.restaurant_id}`} prefetch={false} className="btn-secondary min-h-11">
                          자세히 보기
                        </Link>
                      </div>
                    ) : st?.request_id && st.request_status === "open" ? (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-gray-800">요청 {st.vote_count}명</span>
                        <button
                          type="button"
                          disabled={busy === st.request_id}
                          onClick={() => void onToggleVote(st.request_id!, st.i_voted)}
                          aria-pressed={st.i_voted}
                          className={st.i_voted ? "btn-secondary" : "btn-primary"}
                        >
                          {st.i_voted ? "+1 취소" : "+1 하기"}
                        </button>
                      </div>
                    ) : st?.request_status === "registered" ? (
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-strong">1인분 등록됨</span>
                    ) : st?.request_status === "closed" ? (
                      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-800">
                        조사해 봤지만 아직 1인분이 어려운 곳이에요
                      </span>
                    ) : (
                      <button type="button" disabled={busy === p.id} onClick={() => void onRequest(p)} className="btn-primary w-full">
                        {busy === p.id ? "요청하는 중…" : "1인분 되게 해주세요 (요청하기)"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : null}

      {/* 요청 목록 */}
      <section className="mt-8" aria-labelledby="request-list-title">
        <div className="flex items-center justify-between gap-2">
          <h2 id="request-list-title" className="text-lg font-bold text-gray-900">
            모인 요청
          </h2>
          <div role="radiogroup" aria-label="요청 정렬" className="flex rounded-full bg-gray-100 p-0.5">
            {(
              [
                ["popular", "인기순"],
                ["near", "내 근처순"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={sort === k}
                disabled={k === "near" && !origin}
                onClick={() => setSort(k)}
                className="min-h-11 rounded-full px-3 text-sm font-semibold text-gray-700 disabled:opacity-50 aria-checked:bg-white aria-checked:text-primary-strong aria-checked:shadow"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {!origin ? <p className="mt-1 text-xs text-gray-600">‘내 근처순’은 위치나 동네를 정하면 쓸 수 있어요.</p> : null}

        {listState === "loading" ? (
          <ul className="mt-3 space-y-2" aria-busy="true" aria-label="요청 목록 불러오는 중">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </ul>
        ) : listState === "error" ? (
          <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p>요청 목록을 불러오지 못했어요.</p>
            <button type="button" onClick={() => void loadList()} className="btn-secondary mt-3 w-full">
              다시 시도
            </button>
          </div>
        ) : list.length === 0 ? (
          <p className="mt-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">아직 요청이 없어요. 가고 싶은 식당을 검색해 첫 요청을 남겨 보세요.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {list.map((q) => (
              <li
                key={q.id}
                ref={(el) => {
                  if (el) itemRefs.current.set(q.id, el);
                  else itemRefs.current.delete(q.id);
                }}
                className={`rounded-xl border-2 bg-white p-3 ${highlight === q.id ? "border-primary" : "border-gray-200"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{q.name}</p>
                    <p className="text-sm text-gray-700">
                      {q.address}
                      {q.distance_m !== null ? ` · ${formatDistance(q.distance_m)}` : ""}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      {q.category ? <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-800">{q.category}</span> : null}
                      {q.status === "registered" ? (
                        <span className="rounded bg-primary px-1.5 py-0.5 font-semibold text-white">1인분 등록됨</span>
                      ) : (
                        <span className="rounded bg-primary-soft px-1.5 py-0.5 font-semibold text-primary-strong ring-1 ring-primary/25">요청 중</span>
                      )}
                      <span className="font-semibold text-gray-900">요청 {q.vote_count}명</span>
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                  <button type="button" onClick={() => void onShare(q)} className="btn-secondary min-h-11" aria-label={`${q.name} 요청 공유하기`}>
                    공유
                  </button>
                  {q.status === "registered" && q.restaurant_id ? (
                    <Link href={`/restaurants/${q.restaurant_id}`} prefetch={false} className="btn-primary">
                      자세히 보기
                    </Link>
                  ) : q.status === "open" ? (
                    <button
                      type="button"
                      disabled={busy === q.id}
                      onClick={() => void onToggleVote(q.id, q.i_voted)}
                      aria-pressed={q.i_voted}
                      aria-label={q.i_voted ? `${q.name} +1 취소` : `${q.name} +1 하기`}
                      className={q.i_voted ? "btn-secondary" : "btn-primary"}
                    >
                      {q.i_voted ? "+1 취소" : "+1 하기"}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
        <p className="font-semibold">사장님이신가요?</p>
        <p className="mt-1">식당을 등록하면 요청한 손님들께 알려드려요.</p>
        <Link href="/owner/register" className="btn-secondary mt-3">
          내 식당 등록하기
        </Link>
      </aside>
    </main>
  );
}
