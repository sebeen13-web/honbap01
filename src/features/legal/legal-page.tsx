import Link from "next/link";

/** 약관·개인정보 처리방침 공통 틀 */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 text-gray-900">
      <Link href="/" className="text-sm text-gray-700 underline underline-offset-2">
        ← 홈으로
      </Link>
      <h1 className="mt-4 text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-gray-600">시행일: {updated} · 초안(법률 검토 전)</p>
      <div className="mt-6 space-y-6 text-[15px] leading-relaxed [&_h2]:text-lg [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_ul]:mt-2 [&_ul]:space-y-1">
        {children}
      </div>
      <p className="mt-10 text-sm text-gray-700">
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
