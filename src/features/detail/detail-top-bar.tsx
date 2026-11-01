"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useNearby } from "@/features/nearby/nearby-context";
import { bumpStat } from "@/features/detail/stats";

const viewed = new Set<string>();

/**
 * 상세 상단 바: 뒤로가기(앱 안에서 왔으면 이전 화면, 바로 들어왔으면 홈) + 즐겨찾기.
 * 처음 그려질 때 조회 수(view)를 1 올린다.
 */
export function DetailTopBar({ restaurantId, name, isPublic }: { restaurantId: string; name: string; isPublic: boolean }) {
  const router = useRouter();
  const { canGoBack, favorites, requireLogin } = useNearby();
  const once = useRef(false);

  useEffect(() => {
    // 개발 모드의 두 번 실행 / 같은 탭에서 다시 그려질 때 중복 집계를 막는다
    if (once.current || viewed.has(restaurantId) || !isPublic) return;
    once.current = true;
    viewed.add(restaurantId);
    bumpStat(restaurantId, "view");
  }, [restaurantId, isPublic]);

  const saved = favorites.ids.has(restaurantId);

  return (
    <header className="sticky top-0 z-20 flex items-center gap-1 border-b border-gray-200 bg-white/95 px-1 pt-[env(safe-area-inset-top)] backdrop-blur">
      <button
        type="button"
        onClick={() => (canGoBack() ? router.back() : router.push("/"))}
        aria-label="뒤로 가기"
        className="grid size-11 shrink-0 place-items-center rounded-full text-gray-900 hover:bg-gray-100"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="m15 5-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <p className="min-w-0 flex-1 truncate font-semibold text-gray-900">{name}</p>
      {isPublic ? (
        <button
          type="button"
          aria-pressed={saved}
          aria-label={saved ? "즐겨찾기에서 빼기" : "즐겨찾기에 저장"}
          onClick={() => {
            if (
              requireLogin({
                title: "로그인하면 저장할 수 있어요",
                description: "즐겨찾기한 식당은 ‘내 정보’에서 다시 볼 수 있어요. 둘러보기는 로그인 없이 가능해요.",
                next: `/restaurants/${restaurantId}`,
              })
            )
              void favorites.toggle(restaurantId);
          }}
          className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-gray-100"
        >
          <svg aria-hidden viewBox="0 0 24 24" className={`size-6 ${saved ? "fill-primary text-primary" : "fill-none text-gray-700"}`} stroke="currentColor" strokeWidth="2">
            <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
    </header>
  );
}
