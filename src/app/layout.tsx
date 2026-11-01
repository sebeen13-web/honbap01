import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "혼밥 지도 - 1인분 되는 식당",
  description: "혼자 가도 1인분 주문할 수 있는 근처 식당을 찾아보세요.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 상단 바가 흰색이라 브라우저 주소창 색도 흰색으로 맞춘다 (브랜드 색은 globals.css 한 곳에서만 정의)
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
