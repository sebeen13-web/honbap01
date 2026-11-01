import type { Metadata } from "next";
import { requireAdmin } from "@/features/admin/guard";
import { getKakaoAppKey } from "@/lib/env";
import { ANSAN_RESEARCH } from "@/features/admin/import/ansan-research";
import { ImportScreen } from "@/features/admin/import/import-screen";

export const metadata: Metadata = { title: "조사 식당 일괄 등록 - 혼밥 지도 관리자" };

/**
 * 인터넷 조사로 모은 안산 1인분 가능 식당을 한 번에 등록한다.
 * 위치는 이 화면(브라우저)에서 카카오 장소 검색으로 찾고, 관리자가 후보를 확인한 뒤 저장한다.
 */
export default async function AdminImportPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("restaurants").select("kakao_place_id").not("kakao_place_id", "is", null);
  const existingPlaceIds = (data ?? []).map((r) => r.kakao_place_id).filter((x): x is string => !!x);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">조사 식당 일괄 등록 ({ANSAN_RESEARCH.length}곳)</h1>
        <p className="mt-1 text-sm text-gray-700">
          안산에서 1인분 주문이 된다는 근거(메뉴판·후기)를 찾은 식당이에요. 가격은 자료가 올라온 시점 기준이라 지금과 다를 수 있어요.
        </p>
        <ol className="mt-2 list-decimal pl-5 text-sm text-gray-700">
          <li>‘카카오에서 위치 찾기’를 누르면 가게마다 카카오맵 후보가 나와요.</li>
          <li>후보 주소가 맞는지 보고, 아니면 다른 후보나 ‘건너뛰기’를 골라요.</li>
          <li>‘저장’을 누르면 메뉴·가격·시간 규칙과 함께 등록돼요. 이미 등록된 가게는 건너뛰어요.</li>
        </ol>
      </div>
      <ImportScreen kakaoAppKey={getKakaoAppKey()} existingPlaceIds={existingPlaceIds} />
    </div>
  );
}
