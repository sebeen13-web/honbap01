"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "홈",
    match: (p: string) => p === "/",
    icon: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" strokeLinejoin="round" />,
  },
  {
    href: "/map",
    label: "지도",
    match: (p: string) => p.startsWith("/map"),
    icon: (
      <>
        <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" strokeLinejoin="round" />
        <circle cx="12" cy="9.5" r="2.5" />
      </>
    ),
  },
  {
    href: "/request",
    label: "요청",
    match: (p: string) => p.startsWith("/request"),
    icon: (
      <>
        <path d="M4 5h16v11H9l-5 4z" strokeLinejoin="round" />
        <path d="M12 8v5M9.5 10.5h5" strokeLinecap="round" />
      </>
    ),
  },
  {
    href: "/me",
    label: "내 정보",
    match: (p: string) => p.startsWith("/me"),
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
      </>
    ),
  },
] as const;

/** 하단 탭: 홈 / 지도 / 요청 / 내 정보. 아이폰 하단 안전영역만큼 여백을 둔다. */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav aria-label="주요 메뉴" className="shrink-0 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${
                  active ? "font-bold text-primary-strong" : "font-medium text-gray-600"
                }`}
              >
                <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8}>
                  {t.icon}
                </svg>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
