import type { Metadata } from "next";
import { LegalPage } from "@/features/legal/legal-page";

export const metadata: Metadata = { title: "이용약관 - 혼밥 지도" };

export default function TermsPage() {
  return (
    <LegalPage title="이용약관" updated="2026년 11월 1일">
      <section>
        <h2>1. 어떤 서비스인가요</h2>
        <p>
          혼밥 지도는 2인분부터 파는 식당에서 1인분이 되는 메뉴와 가격을 미리 알려 주는 지도 서비스예요. 지도와 목록은 로그인
          없이 쓸 수 있고, 즐겨찾기·‘오늘도 됐어요/안 됐어요’ 확인·제보는 로그인한 분만 쓸 수 있어요.
        </p>
      </section>
      <section>
        <h2>2. 정보의 정확성</h2>
        <ul>
          <li>메뉴·가격·가능 시간은 관리자 확인이나 사장님 등록을 바탕으로 하며, 확인 당시 기준이에요.</li>
          <li>식당 사정에 따라 실제와 다를 수 있어요. 방문 전에 식당에 확인하는 것을 권해요.</li>
          <li>잘못된 정보는 제보해 주시면 확인 후 고칠게요.</li>
        </ul>
      </section>
      <section>
        <h2>3. 이용자가 지켜 주실 것</h2>
        <ul>
          <li>사실과 다른 확인이나 제보를 일부러 반복해서 남기지 않기</li>
          <li>다른 사람의 계정을 쓰거나 서비스를 방해하지 않기</li>
          <li>제보에 다른 사람의 개인정보나 욕설을 쓰지 않기</li>
        </ul>
        <p className="mt-2">위 내용을 어기면 확인·제보가 삭제되거나 이용이 제한될 수 있어요.</p>
      </section>
      <section>
        <h2>4. 사장님 계정</h2>
        <p>
          손님 계정에서 ‘내 식당 등록하기’로 사장님이 될 수 있어요. 사장님이 등록한 정보는 ‘사장님 등록’으로 표시되고, 사실과
          다르면 관리자가 숨기거나 고칠 수 있어요.
        </p>
      </section>
      <section>
        <h2>5. 탈퇴</h2>
        <p>‘내 정보 &gt; 회원 탈퇴’에서 언제든 탈퇴할 수 있어요. 탈퇴하면 계정 정보가 바로 삭제돼요.</p>
      </section>
      <section>
        <h2>6. 문의</h2>
        <p>문의: [운영자 이메일 주소를 적어 주세요]</p>
      </section>
    </LegalPage>
  );
}
