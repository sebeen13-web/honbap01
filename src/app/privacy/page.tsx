import type { Metadata } from "next";
import { LegalPage } from "@/features/legal/legal-page";

export const metadata: Metadata = { title: "개인정보 처리방침 - 혼밥 지도" };

export default function PrivacyPage() {
  return (
    <LegalPage title="개인정보 처리방침" updated="2026년 11월 1일">
      <section>
        <h2>1. 모으는 정보</h2>
        <ul>
          <li>
            <strong>카카오로 로그인할 때</strong>: 카카오 닉네임, 카카오 회원 식별자(로그인 식별자). 카카오에서 이메일을 받도록
            설정한 경우 이메일도 받을 수 있어요.
          </li>
          <li>
            <strong>이메일로 로그인할 때</strong>: 이메일 주소(로그인 식별자), 비밀번호(암호화되어 저장되며 운영자도 볼 수
            없어요).
          </li>
          <li>
            <strong>서비스를 쓰면서 생기는 정보</strong>: 즐겨찾기한 식당, ‘오늘도 됐어요/안 됐어요’ 확인 기록(식당·결과·날짜),
            제보 내용.
          </li>
        </ul>
        <p className="mt-2">이메일과 전화번호는 화면에 보여 주지 않고, 다른 이용자에게 공개하지 않아요.</p>
      </section>
      <section>
        <h2>2. 손님 위치는 저장하지 않아요</h2>
        <p>
          ‘내 위치로 찾기’를 누르면 휴대폰의 위치를 받아 근처 식당을 찾는 데 한 번 쓰고 끝나요. 위치는 서버·기록(로그)·브라우저
          저장소 어디에도 저장하지 않아요. 위치를 허용하지 않아도 동네 검색으로 쓸 수 있어요.
        </p>
      </section>
      <section>
        <h2>3. 왜 쓰나요</h2>
        <ul>
          <li>로그인과 계정 확인</li>
          <li>같은 사람이 같은 식당을 하루에 여러 번 확인하지 못하게 막기(중복 확인 방지)</li>
          <li>즐겨찾기 저장, 제보 처리</li>
        </ul>
      </section>
      <section>
        <h2>4. 얼마나 보관하나요</h2>
        <ul>
          <li>계정 정보(닉네임·로그인 식별자), 즐겨찾기: 탈퇴할 때까지. 탈퇴하면 바로 삭제해요.</li>
          <li>확인 기록: 90일이 지나면 삭제해요. 탈퇴하면 바로 삭제해요.</li>
          <li>제보 내용: 처리를 위해 보관하며, 탈퇴하면 작성자와의 연결을 지워요.</li>
        </ul>
      </section>
      <section>
        <h2>5. 삭제하는 방법</h2>
        <p>‘내 정보 &gt; 회원 탈퇴’를 누르면 위 정보가 바로 삭제돼요. 도움이 필요하면 아래 문의처로 연락해 주세요.</p>
      </section>
      <section>
        <h2>6. 맡기는 곳</h2>
        <ul>
          <li>Supabase: 데이터 저장과 로그인 처리 (서버 위치: 대한민국 서울 리전)</li>
          <li>카카오: 카카오 로그인, 지도·주소 검색</li>
        </ul>
      </section>
      <section>
        <h2>7. 문의</h2>
        <p>개인정보 관련 문의: [운영자 이름 / 이메일 주소를 적어 주세요]</p>
      </section>
    </LegalPage>
  );
}
