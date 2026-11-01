import type { Metadata } from "next";
import { RequestScreen } from "@/features/requests/request-screen";

export const metadata: Metadata = { title: "식당 요청 - 혼밥 지도" };

/** 요청 탭: 목록은 누구나, 요청·+1 은 로그인 */
export default function RequestPage() {
  return <RequestScreen />;
}
