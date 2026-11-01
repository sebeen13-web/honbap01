import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/session";
import { KakaoLoginButton } from "@/features/auth/kakao-button";
import { EmailLoginForm } from "@/features/auth/email-login-form";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "로그인 - 혼밥 지도" };
export const dynamic = "force-dynamic";

const ERROR_TEXT: Record<string, string> = {
  provider: "카카오 로그인이 완료되지 않았어요. 다시 시도해 주세요.",
  callback: "로그인을 마무리하지 못했어요. 링크가 만료됐거나 다른 브라우저에서 열었을 수 있어요. 다시 시도해 주세요.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; detail?: string; notice?: string }>;
}) {
  const { next: rawNext, error, detail, notice } = await searchParams;
  const next = safeNextPath(rawNext);
  const { user } = await getCurrentUser();
  if (user) redirect(next);

  // 카카오에서 이메일을 못 받은 경우 등, 원인을 알 수 있게 안내
  const emailMissing = error === "provider" && detail && /email/i.test(detail);

  return (
    <main className="mx-auto max-w-sm px-4 py-8">
      <Link href="/" className="text-sm text-gray-700 underline underline-offset-2">
        ← 지도로
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">혼밥 지도 로그인</h1>
      <p className="mt-1 text-sm text-gray-700">
        <strong className="text-primary-strong">둘러보기는 로그인 없이 가능해요.</strong> 즐겨찾기 저장, ‘오늘도 됐어요’ 확인,
        제보할 때만 로그인이 필요해요.
      </p>

      {notice === "deleted" ? (
        <p role="status" className="mt-4 rounded-lg border border-primary/30 bg-primary-soft p-3 text-sm text-primary-strong">
          탈퇴가 완료됐어요. 그동안 이용해 주셔서 고마워요.
        </p>
      ) : null}
      {error ? (
        <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p>{emailMissing ? "카카오 계정에서 이메일 정보를 받지 못해 로그인이 중단됐어요. 운영자에게 알려 주세요." : (ERROR_TEXT[error] ?? ERROR_TEXT.callback)}</p>
          {detail ? <p className="mt-1 text-xs text-red-700">({detail})</p> : null}
        </div>
      ) : null}

      <div className="mt-6">
        <KakaoLoginButton next={next} />
      </div>

      <div className="my-6 flex items-center gap-3 text-xs text-gray-600" aria-hidden>
        <span className="h-px flex-1 bg-gray-200" />
        또는 이메일로
        <span className="h-px flex-1 bg-gray-200" />
      </div>
      <EmailLoginForm next={next} />

      <p className="mt-6 text-xs leading-relaxed text-gray-700">
        로그인하면{" "}
        <Link href="/terms" className="underline underline-offset-2">
          이용약관
        </Link>
        과{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          개인정보 처리방침
        </Link>
        에 동의하는 것으로 봐요. 손님 위치는 저장하지 않아요.
      </p>

      {/* 로그인이 꼭 필요한 화면(/me, /owner)에서 왔으면 지도로 보낸다 */}
      <Link href={/^\/(me|owner)(\/|$|\?)/.test(next) ? "/" : next} className="btn-secondary mt-4 w-full">
        나중에 할게요
      </Link>
    </main>
  );
}
