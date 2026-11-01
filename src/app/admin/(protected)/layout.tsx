import Link from "next/link";
import { requireAdmin } from "@/features/admin/guard";
import { adminLogoutAction } from "@/features/admin/auth-actions";

// 관리자 영역은 항상 요청 시점의 권한으로 렌더링한다.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // 미들웨어에서 한 번 막고, 서버 컴포넌트에서도 다시 확인한다.
  const { user } = await requireAdmin();

  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-1">
            <Link href="/admin/restaurants" className="mr-2 font-bold text-primary-strong">
              관리자
            </Link>
            <Link href="/admin/restaurants" className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-gray-800">
              식당
            </Link>
            <Link href="/admin/requests" className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-gray-800">
              요청
            </Link>
            <Link href="/admin/claims" className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-gray-800">
              연결
            </Link>
            <Link href="/admin/review" className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-gray-800">
              확인 필요
            </Link>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-gray-600 sm:inline">{user.email}</span>
            <form action={adminLogoutAction}>
              <button type="submit" className="btn-secondary min-h-9 py-1">
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-6">{children}</div>
    </div>
  );
}
