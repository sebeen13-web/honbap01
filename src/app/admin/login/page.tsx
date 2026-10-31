import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/session";
import { adminLogoutAction } from "@/features/admin/auth-actions";
import { AdminLoginForm } from "@/features/admin/login-form";

export const metadata: Metadata = { title: "관리자 로그인 - 혼밥 지도" };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const { user, role } = await getCurrentUser();

  if (user && role === "admin") redirect("/admin/restaurants");

  // 로그인은 되어 있지만 관리자가 아닌 경우(예: 사장님 계정)
  const forbidden = !!user || error === "forbidden";

  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      <h1 className="text-2xl font-bold">관리자 로그인</h1>
      <p className="mt-1 text-sm text-gray-600">혼밥 지도 운영자 전용 페이지입니다.</p>

      {forbidden ? (
        <div role="alert" className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">관리자 권한이 없는 계정이에요.</p>
          <p className="mt-1">
            {user ? (
              <>
                지금 <strong>{user.email}</strong> 계정으로 로그인되어 있습니다.{" "}
              </>
            ) : null}
            관리자 페이지는 관리자(admin) 계정만 이용할 수 있어요. 관리자 계정으로 다시 로그인해 주세요.
          </p>
          {user ? (
            <form action={adminLogoutAction} className="mt-3">
              <button type="submit" className="btn-secondary">
                로그아웃
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      {!user ? <AdminLoginForm next={next} /> : null}
    </main>
  );
}
