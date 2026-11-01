import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { requireOwner } from "@/features/auth/guard";
import { PrintButton } from "@/features/owner/print-button";

export const metadata: Metadata = { title: "혼밥 환영 스티커 - 혼밥 지도" };
export const dynamic = "force-dynamic";

/** QR 이 가리킬 사이트 주소: NEXT_PUBLIC_SITE_URL(배포 주소) 이 있으면 그것, 없으면 지금 접속한 주소 */
async function siteOrigin() {
  const fixed = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (fixed) return fixed;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

const SMALL_COUNT = 8;

/** A4 인쇄용 "혼밥 환영 스티커": 큰 것 1장 + 작은 것 8개(한 장). 식당 상세로 가는 QR 코드 포함. */
export default async function OwnerStickerPage() {
  const { supabase, user } = await requireOwner("/owner/sticker");
  const { data: r } = await supabase.from("restaurants").select("id, name").eq("owner_id", user.id).maybeSingle();
  if (!r) redirect("/owner/register");

  const url = `${await siteOrigin()}/restaurants/${r.id}`;
  const qr = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#111827", light: "#ffffff" } });
  const isLocal = /\/\/(localhost|127\.)/.test(url);

  const QR = ({ className }: { className: string }) => (
    <div className={`bg-white [&>svg]:block [&>svg]:size-full ${className}`} role="img" aria-label={`${r.name} 혼밥 지도 페이지 QR 코드`} dangerouslySetInnerHTML={{ __html: qr }} />
  );

  return (
    <main>
      <div className="space-y-3 print:hidden">
        <h1 className="text-2xl font-bold text-gray-900">혼밥 환영 스티커</h1>
        <p className="text-sm text-gray-700">
          매장 입구나 계산대에 붙여 주세요. QR 을 찍으면 손님이 바로 우리 가게의 1인분 메뉴·가격을 볼 수 있어요.
        </p>
        <p className="rounded-lg bg-gray-100 p-3 text-xs break-all text-gray-800">QR 주소: {url}</p>
        {isLocal ? (
          <p role="note" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            지금은 내 컴퓨터 주소(localhost)라서 손님 휴대폰에서는 열리지 않아요. 배포한 뒤 다시 인쇄해 주세요.
          </p>
        ) : null}
        <PrintButton />
        <p className="text-xs text-gray-600">1쪽: 큰 스티커(포스터) · 2쪽: 작은 스티커 8개. 인쇄 창에서 ‘배경 그래픽’을 켜면 색이 함께 나와요.</p>
      </div>

      {/* 1쪽: 큰 스티커 */}
      <section
        aria-label="큰 스티커 미리보기"
        className="@container mx-auto mt-6 flex aspect-[190/270] w-full max-w-[190mm] flex-col items-center justify-between rounded-[4cqw] border-[1.5cqw] border-primary bg-white p-[7cqw] text-center [print-color-adjust:exact] print:mt-0 print:break-after-page print:rounded-none"
      >
        <p className="text-[5cqw] font-bold tracking-tight text-primary-strong">혼밥 지도</p>
        <div>
          <p className="text-[12cqw] leading-tight font-black text-gray-900">
            혼자 오셔도
            <br />
            <span className="text-primary">1인분 OK</span>
          </p>
          <p className="mt-[3cqw] text-[4.2cqw] font-medium text-gray-800">1인분 메뉴와 가격은 QR 로 확인하세요</p>
        </div>
        <QR className="w-[48cqw] rounded-[2cqw] border-[0.6cqw] border-gray-200 p-[2cqw]" />
        <p className="text-[5.5cqw] font-bold text-gray-900">{r.name}</p>
      </section>

      {/* 2쪽: 작은 스티커 8개 (90mm × 60mm) */}
      <section
        aria-label="작은 스티커 미리보기"
        className="mx-auto mt-6 grid max-w-[190mm] grid-cols-2 gap-[3%] print:mt-0 print:grid-cols-[90mm_90mm] print:justify-center print:gap-[4mm]"
      >
        {Array.from({ length: SMALL_COUNT }, (_, i) => (
          <div
            key={i}
            className="@container flex aspect-[3/2] break-inside-avoid items-center gap-[4cqw] rounded-[4cqw] border-[1.2cqw] border-primary bg-white p-[5cqw] [print-color-adjust:exact] print:h-[60mm] print:w-[90mm]"
            aria-hidden={i > 0 || undefined}
          >
            <div className="min-w-0 flex-1 text-left">
              <p className="text-[5cqw] font-bold text-primary-strong">혼밥 지도</p>
              <p className="mt-[2cqw] text-[7.5cqw] leading-tight font-black whitespace-nowrap text-gray-900">
                혼자 오셔도
                <br />
                <span className="text-[9cqw] text-primary">1인분 OK</span>
              </p>
              <p className="mt-[2cqw] truncate text-[5.5cqw] font-semibold text-gray-800">{r.name}</p>
            </div>
            <QR className="w-[36cqw] shrink-0" />
          </div>
        ))}
      </section>
    </main>
  );
}
