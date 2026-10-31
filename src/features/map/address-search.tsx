"use client";

import { useId, useState } from "react";
import { loadKakaoSdk } from "@/features/map/load-kakao-sdk";
import type { KakaoAddressResult, KakaoNamespace, KakaoPlaceResult } from "@/features/map/kakao-types";

export type AddressSelection = {
  address: string;
  latitude: number;
  longitude: number;
  /** 장소(상호) 검색 결과를 골랐을 때만 채워진다 */
  placeName?: string;
  phone?: string;
};

type Candidate = AddressSelection & { key: string; label: string; sub?: string };

/**
 * 카카오 주소 검색.
 *  - 도로명/지번 주소로 검색(Geocoder.addressSearch)하고,
 *  - 결과가 없으면 상호명으로 검색(Places.keywordSearch)한다.
 * 결과를 고르면 주소와 위도·경도를 onSelect 로 넘긴다.
 */
export function AddressSearch({
  appKey,
  onSelect,
  invalid,
  describedBy,
}: {
  appKey: string | null;
  onSelect: (s: AddressSelection) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  if (!appKey) {
    return (
      <div role="note" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <p className="font-semibold">카카오 주소 검색을 쓸 수 없어요.</p>
        <p className="mt-1">
          <code>.env.local</code>에 <code>NEXT_PUBLIC_KAKAO_MAP_APP_KEY</code>(카카오 JavaScript 키)를 넣고 개발 서버를
          다시 시작해 주세요. 키가 있어야 주소를 고르면 위도·경도가 자동으로 입력됩니다.
        </p>
      </div>
    );
  }

  async function search() {
    const q = query.trim();
    if (q.length < 2) {
      setStatus("error");
      setMessage("검색어를 두 글자 이상 입력해 주세요.");
      return;
    }
    setStatus("loading");
    setMessage(null);
    setCandidates([]);
    try {
      const kakao = await loadKakaoSdk(appKey!);
      let found = await searchAddress(kakao, q);
      if (found.length === 0) found = await searchPlace(kakao, q);
      setCandidates(found);
      setStatus("done");
      if (found.length === 0) setMessage("검색 결과가 없어요. 도로명 주소(예: 중앙대로 900)나 상호명으로 다시 검색해 보세요.");
    } catch (e) {
      setStatus("error");
      setMessage(
        `${e instanceof Error ? e.message : "주소 검색에 실패했어요."} JavaScript 키가 맞는지, 카카오 개발자 콘솔의 [플랫폼 > Web 사이트 도메인]에 현재 주소(${window.location.origin})가 등록돼 있는지 확인해 주세요.`,
      );
    }
  }

  return (
    <div>
      <label htmlFor={inputId} className="sr-only">
        주소 또는 상호명 검색
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // 바깥 폼 제출 방지
              void search();
            }
          }}
          placeholder="도로명·지번 주소 또는 상호명"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="input"
        />
        <button type="button" onClick={() => void search()} disabled={status === "loading"} className="btn-secondary shrink-0">
          {status === "loading" ? "검색 중…" : "주소 검색"}
        </button>
      </div>

      <div aria-live="polite">
        {message ? <p className={status === "error" ? "field-error" : "mt-2 text-sm text-gray-600"}>{message}</p> : null}
        {candidates.length > 0 ? (
          <ul className="mt-2 max-h-64 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
            {candidates.map((c) => (
              <li key={c.key}>
                <button
                  type="button"
                  className="w-full px-3 py-2.5 text-left hover:bg-primary-soft"
                  onClick={() => {
                    onSelect(c);
                    setCandidates([]);
                    setMessage(`선택됨: ${c.address}`);
                    setStatus("done");
                  }}
                >
                  <span className="block text-sm font-medium text-gray-900">{c.label}</span>
                  {c.sub ? <span className="block text-xs text-gray-600">{c.sub}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function searchAddress(kakao: KakaoNamespace, q: string): Promise<Candidate[]> {
  const { services } = kakao.maps;
  return new Promise((resolve, reject) => {
    new services.Geocoder().addressSearch(
      q,
      (result: KakaoAddressResult[], status) => {
        if (status === services.Status.ERROR) return reject(new Error("주소 검색 중 오류가 났어요."));
        resolve(
          (result ?? []).map((r, i) => {
            const road = r.road_address?.address_name;
            const jibun = r.address?.address_name;
            const address = road || jibun || r.address_name;
            return {
              key: `a-${i}-${r.x}-${r.y}`,
              label: address,
              sub: road && jibun ? `지번: ${jibun}` : undefined,
              address,
              latitude: Number(r.y),
              longitude: Number(r.x),
            };
          }),
        );
      },
      { size: 10 },
    );
  });
}

function searchPlace(kakao: KakaoNamespace, q: string): Promise<Candidate[]> {
  const { services } = kakao.maps;
  return new Promise((resolve, reject) => {
    new services.Places().keywordSearch(
      q,
      (result: KakaoPlaceResult[], status) => {
        if (status === services.Status.ERROR) return reject(new Error("장소 검색 중 오류가 났어요."));
        resolve(
          (result ?? []).map((p) => {
            const address = p.road_address_name || p.address_name;
            return {
              key: `p-${p.id}`,
              label: p.place_name,
              sub: [address, p.category_name].filter(Boolean).join(" · "),
              address,
              latitude: Number(p.y),
              longitude: Number(p.x),
              placeName: p.place_name,
              phone: p.phone || undefined,
            };
          }),
        );
      },
      { size: 10 },
    );
  });
}
