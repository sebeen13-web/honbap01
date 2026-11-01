import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/features/auth/guard";
import { signOutAction } from "@/features/auth/actions";
import { DeleteAccount } from "@/features/auth/delete-account";

export const metadata: Metadata = { title: "내 정보 - 혼밥 지도" };
export const dynamic = "force-dynamic";

const PROVIDER_LABEL: Record<string, string> = { kakao: "카카오", email: "이메일" };
const ROLE_LABEL = { user: "손님", owner: "사장님", admin: "관리자" } as const;

export default async function MePage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { supabase, user, role } = await requireUser("/me");
  const { notice } = await searchParams;

  const [{ data: profile }, { data: owned }] = await Promise.all([
    supabase.from("profiles").select("nickname").eq("id", user.id).maybeSingle(),
    supabase.from("restaurants").select("name").eq("owner_id", user.id).maybeSingle(),
  ]);
  const provider = String(user.app_metadata?.provider ?? "email");

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <Link href="/" className="text-sm text-gray-700 underline underline-offset-2">
        ← 지도로
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">내 정보</h1>

      {notice === "owner-required" ? (
        <p role="status" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          사장님 화면은 식당을 등록하거나 연결 요청이 승인된 뒤에 쓸 수 있어요.
        </p>
      ) : null}

      {/* 이메일·전화번호는 보여 주지 않는다 */}
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border border-gray-200 p-4 text-sm">
        <dt className="text-gray-600">닉네임</dt>
        <dd className="font-semibold text-gray-900">{profile?.nickname ?? "익명의 혼밥러"}</dd>
        <dt className="text-gray-600">로그인 방식</dt>
        <dd>{PROVIDER_LABEL[provider] ?? provider}</dd>
        <dt className="text-gray-600">계정 종류</dt>
        <dd>
          {ROLE_LABEL[role ?? "user"]}
          {owned ? <span className="text-gray-700"> · {owned.name}</span> : null}
        </dd>
      </dl>

      <div className="mt-4 grid gap-2">
        <Link href="/me/favorites" className="btn-secondary w-full">
          ♡ 즐겨찾기 목록
        </Link>
        <form action={signOutAction}>
          <button type="submit" className="btn-secondary w-full">
            로그아웃
          </button>
        </form>
      </div>

      <section className="mt-10 border-t border-gray-200 pt-6">
        <h2 className="text-base font-semibold text-gray-900">회원 탈퇴</h2>
        <div className="mt-3">
          <DeleteAccount ownedRestaurant={owned?.name ?? null} isAdmin={role === "admin"} />
        </div>
      </section>

      <p className="mt-8 text-xs text-gray-600">
        <Link href="/terms" className="underline underline-offset-2">
          이용약관
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          개인정보 처리방침
        </Link>
      </p>
    </main>
  );
}
