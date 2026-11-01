import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/features/auth/session";
import { signOutAction } from "@/features/auth/actions";
import { DeleteAccount } from "@/features/auth/delete-account";
import { KakaoLoginButton } from "@/features/auth/kakao-button";

export const metadata: Metadata = { title: "내 정보 - 혼밥 지도" };
export const dynamic = "force-dynamic";

const PROVIDER_LABEL: Record<string, string> = { kakao: "카카오", email: "이메일" };
const ROLE_LABEL = { user: "손님", owner: "사장님", admin: "관리자" } as const;
const FAVORITE_PREVIEW = 3;

function LegalLinks() {
  return (
    <p className="mt-8 text-xs text-gray-600">
      <Link href="/terms" className="underline underline-offset-2">
        이용약관
      </Link>{" "}
      ·{" "}
      <Link href="/privacy" className="underline underline-offset-2">
        개인정보 처리방침
      </Link>
    </p>
  );
}

export default async function MePage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { supabase, user, role } = await getCurrentUser();
  const { notice } = await searchParams;

  // 비로그인: 탭 안에서 로그인 안내
  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-8">
        <h1 className="text-2xl font-bold text-gray-900">내 정보</h1>
        <p className="mt-2 text-sm text-gray-700">
          둘러보기는 로그인 없이 가능해요. 로그인하면 식당 저장, 1인분 요청과 +1, ‘오늘도 됐어요’ 확인을 할 수 있어요.
        </p>
        <div className="mt-5 space-y-2">
          <KakaoLoginButton next="/me" />
          <Link href="/login?next=%2Fme" className="btn-secondary w-full">
            이메일로 로그인
          </Link>
        </div>
        <LegalLinks />
      </main>
    );
  }

  const [{ data: profile }, { data: owned }, { data: favorites }, { data: votes }, { data: pendingClaim }] = await Promise.all([
    supabase.from("profiles").select("nickname").eq("id", user.id).maybeSingle(),
    supabase.from("restaurants").select("name").eq("owner_id", user.id).maybeSingle(),
    supabase
      .from("favorites")
      .select("restaurant_id, restaurants(id, name, category)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(FAVORITE_PREVIEW + 1),
    supabase
      .from("restaurant_request_votes")
      .select("created_at, restaurant_requests(id, name, address, status, vote_count, restaurant_id)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("restaurant_claims")
      .select("restaurants(name)")
      .eq("owner_id", user.id)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle(),
  ]);
  const provider = String(user.app_metadata?.provider ?? "email");
  const favs = favorites ?? [];
  const myRequests = (votes ?? []).map((v) => v.restaurant_requests).filter((q) => q !== null);

  return (
    <main className="mx-auto max-w-md px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-8">
      <h1 className="text-2xl font-bold text-gray-900">내 정보</h1>

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

      {/* 사장님 */}
      <section className="mt-6 rounded-xl border border-gray-200 p-4" aria-labelledby="owner-title">
        <h2 id="owner-title" className="text-base font-bold text-gray-900">
          사장님이신가요?
        </h2>
        {owned ? (
          <>
            <p className="mt-1 text-sm text-gray-700">‘{owned.name}’ 사장님 화면에서 메뉴·시간을 고치고, 손님 반응과 스티커를 볼 수 있어요.</p>
            <Link href="/owner" className="btn-primary mt-3 w-full">
              사장님 화면으로
            </Link>
          </>
        ) : pendingClaim ? (
          <p className="mt-1 text-sm text-amber-900">
            ‘{pendingClaim.restaurants?.name ?? "식당"}’ 연결 요청을 검토하고 있어요. 승인되면 사장님 화면이 열려요.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-gray-700">
              1인분 되는 우리 가게를 5분 만에 등록하세요. 등록하면 지도에 바로 보이고, 요청한 손님들께도 ‘등록됐어요’로 알려져요.
            </p>
            <Link href="/owner/register" className="btn-secondary mt-3 w-full">
              내 식당 등록하기
            </Link>
          </>
        )}
      </section>

      {/* 저장한 식당 */}
      <section className="mt-6" aria-labelledby="fav-title">
        <div className="flex items-center justify-between">
          <h2 id="fav-title" className="text-base font-bold text-gray-900">
            저장한 식당
          </h2>
          {favs.length > 0 ? (
            <Link href="/me/favorites" className="inline-flex min-h-11 items-center text-sm font-medium text-primary-strong">
              전체 보기
            </Link>
          ) : null}
        </div>
        {favs.length === 0 ? (
          <p className="mt-1 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
            아직 저장한 식당이 없어요. 식당 카드의 ♡ 를 눌러 저장해 보세요.
          </p>
        ) : (
          <ul className="mt-1 divide-y divide-gray-100 rounded-xl border border-gray-200">
            {favs.slice(0, FAVORITE_PREVIEW).map((f) => (
              <li key={f.restaurant_id}>
                {f.restaurants ? (
                  <Link href={`/restaurants/${f.restaurants.id}`} prefetch={false} className="flex min-h-12 items-center justify-between px-3 text-sm">
                    <span className="font-medium text-gray-900">{f.restaurants.name}</span>
                    <span className="text-gray-600">{f.restaurants.category}</span>
                  </Link>
                ) : (
                  <p className="flex min-h-12 items-center px-3 text-sm text-gray-700">지금은 볼 수 없는 식당이에요</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 내가 요청한 식당 */}
      <section className="mt-6" aria-labelledby="req-title">
        <div className="flex items-center justify-between">
          <h2 id="req-title" className="text-base font-bold text-gray-900">
            내가 요청한 식당
          </h2>
          <Link href="/request" className="inline-flex min-h-11 items-center text-sm font-medium text-primary-strong">
            요청하러 가기
          </Link>
        </div>
        {myRequests.length === 0 ? (
          <p className="mt-1 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">아직 요청한 식당이 없어요.</p>
        ) : (
          <ul className="mt-1 space-y-2">
            {myRequests.map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{q.name}</p>
                  <p className="text-xs text-gray-700">요청 {q.vote_count}명</p>
                </div>
                {q.status === "registered" ? (
                  q.restaurant_id ? (
                    <Link
                      href={`/restaurants/${q.restaurant_id}`}
                      prefetch={false}
                      className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary px-3 text-xs font-semibold text-white"
                    >
                      등록됐어요 →
                    </Link>
                  ) : (
                    <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">등록됐어요</span>
                  )
                ) : q.status === "closed" ? (
                  <span className="shrink-0 rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-800">조사 완료</span>
                ) : (
                  <span className="shrink-0 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary-strong">요청 중</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={signOutAction} className="mt-6">
        <button type="submit" className="btn-secondary w-full">
          로그아웃
        </button>
      </form>

      <section className="mt-10 border-t border-gray-200 pt-6">
        <h2 className="text-base font-semibold text-gray-900">회원 탈퇴</h2>
        <div className="mt-3">
          <DeleteAccount ownedRestaurant={owned?.name ?? null} isAdmin={role === "admin"} />
        </div>
      </section>

      <LegalLinks />
    </main>
  );
}
