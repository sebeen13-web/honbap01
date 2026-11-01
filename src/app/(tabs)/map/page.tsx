import type { Metadata } from "next";
import { NearbyScreen } from "@/features/restaurants/nearby-screen";

export const metadata: Metadata = { title: "지도 - 혼밥 지도" };

/** 지도 탭 (로그인 없이 사용) */
export default function MapPage() {
  return <NearbyScreen />;
}
