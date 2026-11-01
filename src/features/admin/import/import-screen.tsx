"use client";

import { useState } from "react";
import { DEFAULT_CENTER } from "@/lib/constants";
import { searchRestaurantsOnKakao } from "@/features/requests/place-search";
import type { KakaoPlaceResult } from "@/features/map/kakao-types";
import type { ResearchItem } from "@/features/admin/import/ansan-research";
import { ALL_RESEARCH } from "@/features/admin/import/all-research";
import { importResearchItemAction } from "@/features/admin/import/actions";

type Row = {
  candidates: KakaoPlaceResult[];
  /** 고른 후보의 카카오 id ("" = 건너뛰기) */
  pick: string;
  search: "idle" | "searching" | "done" | "error";
  save: "idle" | "saving" | "created" | "exists" | "error";
  message?: string;
};

const norm = (s: string) => s.replace(/\s/g, "").toLowerCase();

/**
 * 안산 안의 가게 중 이름에 mustInclude 가 들어간 것만 후보로.
 * 동네 힌트(areaHint)가 있으면 그 동네 주소인 후보를 앞으로 (체인점 지점 고르기).
 */
function filterCandidates(item: ResearchItem, found: KakaoPlaceResult[]) {
  const ok = found.filter((p) => /안산/.test(p.address_name) && norm(p.place_name).includes(norm(item.mustInclude)));
  const hint = item.areaHint;
  const inArea = (p: KakaoPlaceResult) => !!hint && `${p.address_name} ${p.road_address_name}`.includes(hint);
  return [...ok.filter(inArea), ...ok.filter((p) => !inArea(p))].slice(0, 5);
}

export function ImportScreen({ kakaoAppKey, existingPlaceIds }: { kakaoAppKey: string | null; existingPlaceIds: string[] }) {
  const existing = new Set(existingPlaceIds);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [busy, setBusy] = useState<"" | "search" | "save">("");

  const update = (key: string, patch: Partial<Row>) =>
    setRows((prev) => ({ ...prev, [key]: { ...(prev[key] ?? { candidates: [], pick: "", search: "idle", save: "idle" }), ...patch } }));

  async function searchAll() {
    if (!kakaoAppKey) return;
    setBusy("search");
    // 체인점 등에서 같은 카카오 장소가 두 가게에 기본 선택되지 않게
    const used = new Set<string>();
    for (const item of ALL_RESEARCH) {
      update(item.key, { search: "searching" });
      try {
        // 못 찾으면 다른 검색어로 다시 (가게 이름·지점명 표기가 조사 자료와 다를 수 있다)
        let candidates: KakaoPlaceResult[] = [];
        for (const q of [item.query, ...(item.altQueries ?? []), `${item.mustInclude} 안산`]) {
          const found = await searchRestaurantsOnKakao(kakaoAppKey, q, DEFAULT_CENTER, { onlyRestaurants: false });
          candidates = filterCandidates(item, found);
          if (candidates.length) break;
        }
        const first = candidates.find((c) => !used.has(c.id));
        // 이미 등록된 장소는 기본으로 건너뛴다
        const pick = first && !existing.has(first.id) ? first.id : "";
        if (pick) used.add(pick);
        update(item.key, {
          candidates,
          pick,
          search: "done",
        });
      } catch {
        update(item.key, { search: "error", candidates: [], pick: "" });
      }
    }
    setBusy("");
  }

  async function saveAll() {
    setBusy("save");
    for (const item of ALL_RESEARCH) {
      const row = rows[item.key];
      const place = row?.candidates.find((c) => c.id === row.pick);
      if (!row || !place || row.save === "created") continue;
      update(item.key, { save: "saving" });
      const res = await importResearchItemAction(item.key, {
        id: place.id,
        name: place.place_name,
        address: place.road_address_name || place.address_name,
        latitude: Number(place.y),
        longitude: Number(place.x),
        phone: place.phone ?? "",
      });
      update(item.key, res.ok ? { save: "created", message: undefined } : { save: res.status, message: res.message });
    }
    setBusy("");
  }

  const picked = ALL_RESEARCH.filter((i) => rows[i.key]?.pick).length;
  const created = ALL_RESEARCH.filter((i) => rows[i.key]?.save === "created").length;

  if (!kakaoAppKey) {
    return <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">카카오 지도 키(NEXT_PUBLIC_KAKAO_MAP_APP_KEY)가 없어 장소를 찾을 수 없어요.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50/95 px-4 py-3 backdrop-blur">
        <button type="button" className="btn-secondary" disabled={busy !== ""} onClick={searchAll}>
          {busy === "search" ? "카카오에서 찾는 중…" : "① 카카오에서 위치 찾기"}
        </button>
        <button type="button" className="btn-primary" disabled={busy !== "" || picked === 0} onClick={saveAll}>
          {busy === "save" ? "저장 중…" : `② 고른 ${picked}곳 저장`}
        </button>
        {created > 0 ? <span className="text-sm font-medium text-primary-strong">{created}곳 등록됨</span> : null}
      </div>

      <ol className="space-y-3">
        {ALL_RESEARCH.map((item, idx) => {
          const row = rows[item.key];
          return (
            <li key={item.key} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-gray-900">
                    {idx + 1}. {item.query} <span className="text-sm font-normal text-gray-600">· {item.category}</span>
                  </p>
                  <p className="mt-1 text-sm text-gray-700">
                    {item.menus.map((m) => `${m.name} ${m.solo_price.toLocaleString("ko-KR")}원`).join(" / ")}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{item.memo}</p>
                  <p className="mt-1 flex flex-wrap gap-x-2 text-xs">
                    {item.sources.map((s, i) => (
                      <a key={s} href={s} target="_blank" rel="noreferrer" className="text-primary underline">
                        근거 {i + 1}
                      </a>
                    ))}
                  </p>
                </div>
                <SaveBadge row={row} />
              </div>

              {row?.search === "searching" ? <p className="mt-3 text-sm text-gray-600">찾는 중…</p> : null}
              {row?.search === "error" ? <p className="mt-3 text-sm text-red-700">검색 중 오류가 났어요. 다시 찾아 주세요.</p> : null}
              {row?.search === "done" && row.candidates.length === 0 ? (
                <p className="mt-3 text-sm text-amber-800">카카오에서 안산 안의 같은 이름 가게를 찾지 못했어요. 폐업했거나 이름이 바뀌었을 수 있어요.</p>
              ) : null}
              {row?.candidates.length ? (
                <fieldset className="mt-3 space-y-1" disabled={busy !== "" || row.save === "created"}>
                  <legend className="sr-only">{item.query} 위치 고르기</legend>
                  {row.candidates.map((c) => (
                    <label key={c.id} className="flex min-h-11 cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50">
                      <input
                        type="radio"
                        name={item.key}
                        className="mt-1 size-4 accent-[var(--color-primary)]"
                        checked={row.pick === c.id}
                        onChange={() => update(item.key, { pick: c.id })}
                      />
                      <span className="text-sm">
                        <span className="font-medium text-gray-900">{c.place_name}</span>
                        {existing.has(c.id) ? <span className="ml-1 rounded bg-gray-100 px-1.5 text-xs text-gray-700">이미 등록됨</span> : null}
                        <br />
                        <span className="text-gray-600">{c.road_address_name || c.address_name}</span>
                        {c.place_url ? (
                          <a href={c.place_url} target="_blank" rel="noreferrer" className="ml-2 text-xs text-primary underline">
                            카카오맵
                          </a>
                        ) : null}
                      </span>
                    </label>
                  ))}
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 hover:bg-gray-50">
                    <input
                      type="radio"
                      name={item.key}
                      className="size-4 accent-[var(--color-primary)]"
                      checked={row.pick === ""}
                      onChange={() => update(item.key, { pick: "" })}
                    />
                    <span className="text-sm text-gray-700">건너뛰기</span>
                  </label>
                </fieldset>
              ) : null}
              {row?.message ? <p className="mt-2 text-sm text-gray-700">{row.message}</p> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SaveBadge({ row }: { row: Row | undefined }) {
  if (!row || row.save === "idle") return null;
  const map = {
    saving: ["저장 중", "bg-gray-100 text-gray-700"],
    created: ["등록됨", "bg-primary-soft text-primary-strong"],
    exists: ["이미 있음", "bg-gray-100 text-gray-700"],
    error: ["실패", "bg-red-50 text-red-700"],
  } as const;
  const [label, cls] = map[row.save];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}
