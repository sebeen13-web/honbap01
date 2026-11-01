import { NearbyProvider } from "@/features/nearby/nearby-context";
import { TabBar } from "@/features/tabs/tab-bar";
import { getKakaoAppKey } from "@/lib/env";

/**
 * 손님 화면(홈 / 지도 / 요청 / 내 정보) 공통 틀.
 * 탭을 옮겨도 이 레이아웃은 유지되므로 위치·조회 결과가 그대로 남는다.
 * 관리자·로그인·약관·식당 상세 화면은 이 그룹 밖에 있어 탭이 보이지 않는다.
 */
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <NearbyProvider kakaoAppKey={getKakaoAppKey()}>
      <div className="flex h-dvh flex-col">
        <div className="relative min-h-0 flex-1 overflow-y-auto">{children}</div>
        <TabBar />
      </div>
    </NearbyProvider>
  );
}
