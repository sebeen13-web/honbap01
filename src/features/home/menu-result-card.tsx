import Link from "next/link";
import { TimeBadge } from "@/features/restaurants/restaurant-card";
import { formatDiff, formatDistance, formatWon } from "@/features/restaurants/format";
import type { MenuHit } from "@/features/home/menu-search";

/** 메뉴 검색 결과 카드: 메뉴가 주인공, 식당은 보조 정보. 누르면 식당 상세(4단계). */
export function MenuResultCard({ hit }: { hit: MenuHit }) {
  const { menu: m, restaurant: r } = hit;
  return (
    <li>
      <Link
        href={`/restaurants/${r.id}`}
        prefetch={false}
        className="block rounded-xl border border-gray-200 bg-white p-3 hover:border-primary"
      >
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 font-bold text-gray-900">{m.name}</span>
          <span className="shrink-0 font-bold text-primary-strong">1인 {formatWon(m.solo_price)}</span>
        </span>
        {m.regular_price_per_person !== null ? (
          <span className="mt-0.5 block text-right text-xs text-gray-700">
            보통 1인당 {formatWon(m.regular_price_per_person)} · {formatDiff(m.solo_price, m.regular_price_per_person)}
          </span>
        ) : null}
        <span className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-gray-800">
          <span className="font-medium">{r.name}</span>
          <span className="text-gray-600">· {r.category} · {formatDistance(r.distance_m)}</span>
          <TimeBadge r={r} />
          {r.needs_review ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-300">⚠ 확인 필요</span>
          ) : null}
        </span>
      </Link>
    </li>
  );
}
