import { NearbyScreen } from "@/features/restaurants/nearby-screen";
import { getKakaoAppKey } from "@/lib/env";

/** 손님 메인 화면 (로그인 없이 사용). 지도·위치·목록은 모두 클라이언트 컴포넌트에서 처리한다. */
export default function Home() {
  return <NearbyScreen kakaoAppKey={getKakaoAppKey()} />;
}
