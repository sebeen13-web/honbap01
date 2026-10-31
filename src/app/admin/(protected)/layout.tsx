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
          <Link href="/admin/restaurants" className="font-bold text-primary">
            혼밥 지도 관리자
          </Link>
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
