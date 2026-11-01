import Link from "next/link";

/** 사장님 화면 공통 틀 (하단 탭 없음, 상단에 돌아가기) */
export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gray-50 print:bg-white">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white pt-[env(safe-area-inset-top)] print:hidden">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2 px-2">
          <Link href="/me" className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-gray-800">
            ← 내 정보
          </Link>
          <p className="font-bold text-primary-strong">사장님</p>
          <Link href="/owner" className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-gray-800">
            대시보드
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-xl px-4 py-5 print:max-w-none print:p-0">{children}</div>
    </div>
  );
}
