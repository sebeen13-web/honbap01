import { TabBar } from "@/features/tabs/tab-bar";

/**
 * 하단 탭 화면(홈 / 지도 / 요청 / 내 정보) 틀. 상태(NearbyProvider)는 한 단계 위 (guest) 레이아웃에 있다.
 * 관리자·로그인·약관·식당 상세 화면에는 탭이 보이지 않는다.
 */
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col">
      <div className="relative min-h-0 flex-1 overflow-y-auto">{children}</div>
      <TabBar />
    </div>
  );
}
