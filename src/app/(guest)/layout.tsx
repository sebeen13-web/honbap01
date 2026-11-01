import { NearbyProvider } from "@/features/nearby/nearby-context";
import { getKakaoAppKey } from "@/lib/env";

/**
 * 손님 화면 공통: 하단 탭 화면((tabs))과 식당 상세(/restaurants/[id])가 함께 쓰는 상태.
 * 상세로 갔다가 돌아와도 위치·조회 결과·지도 선택이 유지된다(좌표는 메모리에만).
 */
export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return <NearbyProvider kakaoAppKey={getKakaoAppKey()}>{children}</NearbyProvider>;
}
