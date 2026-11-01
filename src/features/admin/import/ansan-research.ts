import type { Category, DayType } from "@/types/database";

/**
 * 안산 1인분 가능 식당 조사 목록 (2026-11, 인터넷 공개 정보 기준).
 *
 * - 근거: 다이닝코드·당근·테이블링·블로그 등에 올라온 메뉴판/후기. sources 에 링크를 남긴다.
 * - 가격은 "자료에 올라온 시점" 기준이라 지금과 다를 수 있다. 화면에는 "확인 당시 가격"으로 나간다.
 * - 정확한 위치(좌표·주소·전화·카카오 장소 id)는 이 파일에 적지 않는다.
 *   관리자 화면 /admin/import 가 브라우저에서 카카오 장소 검색(query)으로 찾고, 관리자가 눈으로 확인한 뒤 저장한다.
 * - normal_min_servings: 이 메뉴가 보통 몇 인분부터인지. 1인 전용 메뉴·1인 매장은 1.
 */
export type ResearchMenu = {
  name: string;
  solo_price: number;
  regular_price_per_person?: number;
  normal_min_servings: number;
  note?: string;
};

export type ResearchRule = {
  day_type: DayType;
  start_time: string;
  end_time: string;
  available: boolean;
  note?: string;
};

export type ResearchItem = {
  /** 목록 안에서만 쓰는 고유 키 */
  key: string;
  /** 카카오 장소 검색어 */
  query: string;
  /** 검색 결과의 가게 이름에 반드시 들어가야 하는 말 (띄어쓰기 무시) */
  mustInclude: string;
  /** 1차 검색에서 못 찾으면 차례로 다시 찾아볼 검색어 */
  altQueries?: string[];
  category: Category;
  menus: ResearchMenu[];
  time_rules?: ResearchRule[];
  /** 동네 이름(예: "사동"). 체인점이면 주소에 이 말이 들어간 후보를 먼저 고른다 */
  areaHint?: string;
  /** 조사 메모 (관리자 화면에만 표시) */
  memo: string;
  sources: string[];
};

const dc = (rid: string) => `https://www.diningcode.com/profile.php?rid=${rid}`;

export const ANSAN_RESEARCH: ResearchItem[] = [
  {
    key: "today-dakgalbi-sangroksu",
    query: "오늘도닭갈비 상록수역점",
    mustInclude: "오늘도닭갈비",
    category: "닭갈비·찜닭",
    menus: [
      { name: "닭갈비 1인분", solo_price: 13900, normal_min_servings: 2, note: "홀에서도 1인분 식사 가능(메뉴판 안내)" },
      { name: "1인 정식(혼밥세트)", solo_price: 17900, normal_min_servings: 1 },
    ],
    memo: "메뉴판에 '홀에서도 1인분 식사 가능합니다' 표기, 혼밥 태그.",
    sources: [dc("lnbbGc7it6V0")],
  },
  {
    key: "dak-yori-namja",
    query: "닭요리하는남자 안산",
    mustInclude: "닭요리하는남자",
    category: "닭갈비·찜닭",
    menus: [
      { name: "1인 순살 간장찜닭", solo_price: 14900, normal_min_servings: 2, note: "찜닭은 보통 2인 이상" },
      { name: "1인 순살 닭볶음탕", solo_price: 14900, normal_min_servings: 2, note: "자료에 따라 11,900원으로도 나옴" },
    ],
    memo: "1인찜닭·1인 닭볶음탕 메뉴, 키오스크 주문, '혼밥하기 좋은 자리 많다'는 후기.",
    sources: [dc("vrk7m1v49NnN")],
  },
  {
    key: "jiwoone-dakhanmari",
    query: "지우네닭한마리칼국수",
    mustInclude: "지우네",
    category: "전골·찜·탕",
    menus: [
      {
        name: "닭반마리",
        solo_price: 20000,
        regular_price_per_person: 17500,
        normal_min_servings: 2,
        note: "닭한마리 35,000원을 2명 기준으로 나눈 값과 비교",
      },
      { name: "닭칼국수", solo_price: 9000, normal_min_servings: 1 },
    ],
    memo: "와동. 닭한마리(35,000) 외에 닭반마리(20,000) 판매, 혼밥 가능 표시.",
    sources: [dc("ptvU4Oemc36s")],
  },
  {
    key: "shabuboat-lotte",
    query: "샤브보트 롯데백화점 안산점",
    mustInclude: "샤브보트",
    category: "샤브샤브",
    menus: [
      { name: "소고기 샤브", solo_price: 10900, normal_min_servings: 1, note: "좌석이 모두 1인 바" },
      { name: "한우 샤브", solo_price: 16900, normal_min_servings: 1 },
    ],
    memo: "1인 샤브 바 형태. '좌석이 모두 1인 바라 혼밥하기 편하다' 후기.",
    sources: [dc("z0sR937WIVQM")],
  },
  {
    key: "shabuway",
    query: "샤브웨이 안산",
    altQueries: ["샤브웨이"],
    mustInclude: "샤브웨이",
    category: "샤브샤브",
    menus: [
      {
        name: "1인 혼밥샤브 세트",
        solo_price: 13000,
        regular_price_per_person: 13000,
        normal_min_servings: 2,
        note: "야채·소고기 100g·칼국수 포함. 2인 커플세트 26,000원",
      },
    ],
    memo: "1인 혼밥샤브 세트 13,000 / 2인 26,000 / 4인 55,000. 11:30~22:00 표기.",
    sources: [dc("wxKFgKkrBXjU")],
  },
  {
    key: "shaburo21-gojan",
    query: "샤브로21 고잔",
    mustInclude: "샤브로21",
    category: "샤브샤브",
    menus: [
      { name: "샤브샤브", solo_price: 7500, normal_min_servings: 1, note: "1인 개인 인덕션. 다이닝코드엔 8,000원" },
      { name: "얼큰 샤브샤브", solo_price: 8500, normal_min_servings: 1 },
    ],
    memo: "가게 소개에 '1인씩 개인 인덕션 제공되어 혼밥부터…'. 가격은 '~원부터'.",
    sources: [dc("6xJIGPdySzrm"), "https://www.daangn.com/kr/local-profile/%EC%83%A4%EB%B8%8C%EB%A1%9C21-%EA%B3%A0%EC%9E%94-ijvw8vbuds24/"],
  },
  {
    key: "honsam-sangroksu",
    query: "혼삼 상록수점",
    altQueries: ["혼삼 안산"],
    mustInclude: "혼삼",
    category: "고깃집",
    menus: [
      { name: "한우차돌구이정식(1인분)", solo_price: 25000, normal_min_servings: 1, note: "차돌 200g·공기밥·된장찌개·찬" },
      { name: "혼자고기만 한우차돌구이(300g)", solo_price: 30000, normal_min_servings: 1 },
    ],
    memo: "1인용 고기 메뉴 운영(한우 1+ 이상).",
    sources: [dc("8jjAH7HPnAPh")],
  },
  {
    key: "sanyacho-galbi",
    query: "산야초갈비이야기",
    altQueries: ["산야초 갈비 안산", "산야초 선부동"],
    mustInclude: "산야초",
    category: "고깃집",
    menus: [
      { name: "왕돼지갈비정식", solo_price: 22000, normal_min_servings: 2, note: "왕돼지갈비 1인분+공기밥, 평일 점심만" },
      { name: "토속돼지갈비정식", solo_price: 23000, normal_min_servings: 2, note: "평일 점심만" },
    ],
    time_rules: [
      { day_type: "weekday", start_time: "11:00", end_time: "15:00", available: true, note: "평일 점심 정식(공휴일 제외, 월요일 휴무)" },
    ],
    memo: "선부동. 1인분 정식은 평일 11:00~15:00, 월요일 정기휴무.",
    sources: [dc("v6PJcnQ5Girh")],
  },
  {
    key: "topyeong-gopchang",
    query: "토평한우소곱창 안산중앙역점",
    mustInclude: "토평",
    category: "곱창·막창",
    menus: [
      {
        name: "뚝배기 한우곱창전골",
        solo_price: 12000,
        normal_min_servings: 2,
        note: "1인분은 뚝배기, 2인분부터 전골냄비(후기)",
      },
    ],
    memo: "후기: '1인분은 뚝배기에 나오고 2인분부터는 전골그릇'. 정규/점심 한정 여부 미확인.",
    sources: [dc("Nvk3CgqbXamk"), "https://www.tabling.co.kr/place/677ccf6066de5f0698844900"],
  },
  {
    key: "choigane-jokbal",
    query: "최가네장충왕족발보쌈",
    altQueries: ["최가네 족발 안산", "최가네왕족발"],
    mustInclude: "최가네",
    category: "족발·보쌈",
    menus: [{ name: "1인분 마늘보쌈세트", solo_price: 22000, normal_min_servings: 2 }],
    memo: "1인분 마늘보쌈셋트 메뉴, 혼밥 가능 매장으로 소개.",
    sources: [dc("Pg4i3H1D3k1I")],
  },
  {
    key: "wonhalmoni-sangroksu",
    query: "원할머니보쌈족발 안산상록수점",
    mustInclude: "원할머니",
    category: "족발·보쌈",
    menus: [{ name: "1인보쌈세트", solo_price: 22000, normal_min_servings: 2, note: "22,000원부터" }],
    memo: "가격표에 1인보쌈세트 22,000원~, 점심특선 후기.",
    sources: ["https://www.daangn.com/kr/local-profile/%EC%9B%90%ED%95%A0%EB%A8%B8%EB%8B%88%EB%B3%B4%EC%8C%88%EC%A1%B1%EB%B0%9C-%EC%95%88%EC%82%B0%EC%83%81%EB%A1%9D%EC%88%98%EC%A0%90-pzgo2qwpnii8/"],
  },
  {
    key: "moorong",
    query: "모오롱 안산",
    mustInclude: "모오롱",
    category: "족발·보쌈",
    menus: [{ name: "보쌈 정식", solo_price: 13000, normal_min_servings: 2, note: "1인 보쌈 메뉴" }],
    time_rules: [
      { day_type: "all", start_time: "11:00", end_time: "15:00", available: true },
      { day_type: "all", start_time: "15:00", end_time: "17:30", available: false, note: "브레이크 타임" },
      { day_type: "all", start_time: "17:30", end_time: "21:00", available: true },
    ],
    memo: "'혼자서도 알차게 즐기는 1인 보쌈 메뉴'. 매일 11:00~21:00, 브레이크 15:00~17:30. 테이블 2~3개.",
    sources: [dc("zhPFvnv1q8mG")],
  },
  {
    key: "dontong-choji",
    query: "돈통마늘보쌈 안산초지점",
    mustInclude: "돈통",
    category: "족발·보쌈",
    menus: [{ name: "마늘보쌈정식", solo_price: 10000, normal_min_servings: 2, note: "점심 정식, 된장 또는 순두부찌개" }],
    memo: "점심 정식 10,000원(마늘보쌈정식·막국수보쌈정식). 시간대 미확인.",
    sources: [dc("tFe6cEl1mBwq")],
  },
  {
    key: "insaeng-agujjim",
    query: "인생아구찜 안산점",
    mustInclude: "인생아구찜",
    category: "전골·찜·탕",
    menus: [
      { name: "살마니아구찜(1인)", solo_price: 25900, normal_min_servings: 2 },
      { name: "인생해물찜(1인, 아구 없음)", solo_price: 31900, normal_min_servings: 2 },
    ],
    memo: "고잔동. 1인 아구찜·해물찜 메뉴, 혼밥 태그.",
    sources: [dc("KHAz2SQwCzba")],
  },
  {
    key: "bada-hoe",
    query: "바다회수산 안산",
    mustInclude: "바다회",
    category: "회",
    menus: [
      { name: "물회(1인분)", solo_price: 16000, normal_min_servings: 1, note: "모둠회는 보통 2인 이상" },
      { name: "회덮밥", solo_price: 12000, normal_min_servings: 1 },
    ],
    memo: "횟집 1인 메뉴(물회 1인분·회덮밥).",
    sources: [dc("07cHhH7U4bjD")],
  },
  {
    key: "kwongane-hoe",
    query: "권가네횟집 안산",
    mustInclude: "권가네",
    category: "회",
    menus: [
      { name: "물회(1인분)", solo_price: 13000, normal_min_servings: 1 },
      { name: "회덮밥(1인분)", solo_price: 11000, normal_min_servings: 1, note: "국물 포함" },
    ],
    memo: "횟집 1인 메뉴(물회·회덮밥 1인분).",
    sources: [dc("exPHEh4m7H5l")],
  },
  {
    key: "eomcheong-hoe",
    query: "엄청난회집 안산",
    altQueries: ["엄청난회"],
    mustInclude: "엄청난회",
    category: "회",
    menus: [
      { name: "모듬물회 1인", solo_price: 20000, regular_price_per_person: 15000, normal_min_servings: 3, note: "3인 45,000원" },
      { name: "물회 1인", solo_price: 15000, normal_min_servings: 1 },
    ],
    memo: "모듬물회 1인 20,000 / 3인 45,000. 포장 위주라는 소개도 있음.",
    sources: [dc("w82U2Ur4CxS0")],
  },
  {
    key: "iljeon-ssangjo",
    query: "일전쌍조 안산",
    mustInclude: "일전쌍조",
    category: "중식 요리",
    menus: [
      { name: "1인 등심 탕수육세트(면+미니탕수육)", solo_price: 22000, normal_min_servings: 2 },
      { name: "1인 미니 만새육", solo_price: 16900, normal_min_servings: 2 },
    ],
    memo: "사동. 요리를 1인용 미니 사이즈·세트로 판매.",
    sources: [dc("TnqOorpYJeVX")],
  },
  {
    key: "jungguksung-wadong",
    query: "중국성 와동",
    altQueries: ["중국성 안산"],
    mustInclude: "중국성",
    category: "중식 요리",
    menus: [{ name: "탕수육+짜장(1인)", solo_price: 21000, normal_min_servings: 2, note: "2인 세트도 있음" }],
    memo: "와동. 탕수육+짜장 1인 세트.",
    sources: [dc("CGc81k58Jktu")],
  },
  {
    key: "eommason-budae",
    query: "엄마손부대찌개 안산",
    mustInclude: "엄마손부대찌개",
    category: "찌개·백반",
    menus: [
      { name: "부대찌개", solo_price: 9000, normal_min_servings: 2, note: "메뉴판엔 2인 이상, 1인도 됐다는 후기" },
      { name: "동태탕", solo_price: 10000, normal_min_servings: 2, note: "메뉴판엔 2인 이상" },
    ],
    memo: "메뉴판은 '1인분(2인 이상)'. 한 방문자 '1인 혼밥도 가능했다'. 확인 필요도 높음.",
    sources: [dc("emp7jd14lBjl")],
  },
  {
    key: "jangbaksa-budae-hanyang",
    query: "장박사부대찌개 안산한양대점",
    mustInclude: "장박사",
    category: "찌개·백반",
    menus: [{ name: "부대찌개 1인 식사", solo_price: 11000, normal_min_servings: 2, note: "1인 혼밥 메뉴, 밥·반찬 무한리필" }],
    memo: "한양대 에리카 앞. '1인 혼밥 메뉴가 따로 있다' 후기, 키오스크 주문.",
    sources: [dc("5avi1pIjtzVO")],
  },
  {
    key: "834-jjukkumi-seonbu",
    query: "834쭈꾸미 선부점",
    mustInclude: "834",
    category: "해산물·조개구이",
    menus: [{ name: "쭈꾸미볶음 1인", solo_price: 16000, normal_min_servings: 2, note: "맵기 선택" }],
    memo: "선부동. '쭈꾸미 1인 16000원' 리뷰, 혼밥 태그.",
    sources: [dc("yyNil8Bdkmb5")],
  },
  {
    key: "onenice-hoguo",
    query: "원나이스양꼬치훠궈",
    mustInclude: "원나이스",
    category: "중식 요리",
    menus: [
      { name: "양꼬치·훠궈 무한리필(1인 1팟)", solo_price: 29900, normal_min_servings: 2 },
      { name: "평일 점심 무한리필", solo_price: 19900, normal_min_servings: 2 },
    ],
    memo: "단원구 고잔로 108 205호. '혼밥하기 딱 좋은 1인 훠궈 무한리필', 1인 1팟.",
    sources: ["https://www.threads.com/@mr_hyung_story/post/DTcXp88gbhc"],
  },
  // ── 2차 조사 (안산 전역, 2026-11) ──────────────────────────────
  {
    key: "bultaneun-jjamppong-bono",
    query: "불타는짬뽕 본오동점",
    mustInclude: "불타는짬뽕",
    category: "중식 요리",
    menus: [{ name: "짜장+1인 탕수육 세트", solo_price: 11000, normal_min_servings: 2 }],
    memo: "본오동 먹자골목. 혼밥 후기 많음, 1인 탕수육 세트.",
    sources: [dc("exb8XHpydJBn")],
  },
  {
    key: "choburi-kimchi-gojan",
    query: "초부리김치찌개 고잔본점",
    mustInclude: "초부리",
    category: "찌개·백반",
    menus: [
      {
        name: "1인분 솥밥+김치찌개",
        solo_price: 11000,
        regular_price_per_person: 13000,
        normal_min_servings: 2,
        note: "3인 39,000원(1인당 13,000원), 1인 1솥밥",
      },
    ],
    memo: "매장 식사 1인분 솥밥+김치찌개 11,000원.",
    sources: [dc("rHZKapYYtwVg")],
  },
  {
    key: "cheongnyeon-jjigae-gojan",
    query: "청년찌개 안산고잔점",
    mustInclude: "청년찌개",
    category: "찌개·백반",
    menus: [{ name: "김치찌개 1인+공기밥 세트", solo_price: 15000, normal_min_servings: 2, note: "돼지·참치·부대·대패 중 선택" }],
    memo: "김치찌개 1인 세트 메뉴.",
    sources: [dc("7PZCbtHl7eQt")],
  },
  {
    key: "deumbaki-wolpi",
    query: "듬박이김치찌개의집 안산월피점",
    mustInclude: "듬박이",
    category: "찌개·백반",
    menus: [{ name: "김치찌개 1인분", solo_price: 9000, normal_min_servings: 2, note: "9,000원부터" }],
    memo: "월피동. 가게 정보에 김치찌개 1인분 9,000원~. 11:00~22:00.",
    sources: ["https://www.daangn.com/kr/local-profile/%EB%93%AC%EB%B0%95%EC%9D%B4%EA%B9%80%EC%B9%98%EC%B0%8C%EA%B0%9C%EC%9D%98%EC%A7%91-%EC%95%88%EC%82%B0%EC%9B%94%ED%94%BC%EC%A0%90-32evjeak1sti/"],
  },
  {
    key: "igane-cheolpan-gopchang",
    query: "이가네철판야채곱창",
    mustInclude: "이가네",
    category: "곱창·막창",
    menus: [
      {
        name: "곱창·순대 야채볶음 1인분",
        solo_price: 10000,
        regular_price_per_person: 9000,
        normal_min_servings: 2,
        note: "2인분 18,000원",
      },
    ],
    memo: "메뉴판에 1인분 10,000 / 2인분 18,000.",
    sources: [dc("Y4YVgdhFGXvt")],
  },
  {
    key: "yetmat-ajimae-sundae",
    query: "옛맛아지매순대 월피동",
    mustInclude: "옛맛아지매",
    altQueries: ["옛맛아지매순대"],
    category: "국밥·순대",
    menus: [{ name: "순대곱창볶음(1인)", solo_price: 11000, normal_min_servings: 2 }],
    memo: "월피동. 순대곱창볶음 1인 메뉴.",
    sources: ["https://www.diningcode.com/list.dc?query=%EC%95%88%EC%82%B0++%EA%B3%B1%EC%B0%BD%EB%B3%B6%EC%9D%8C"],
  },
  {
    key: "yugane-ansan-jungang",
    query: "유가네닭갈비 안산중앙점",
    mustInclude: "유가네닭갈비안산중앙",
    category: "닭갈비·찜닭",
    menus: [{ name: "닭갈비 1인분", solo_price: 11500, normal_min_servings: 2, note: "11,500원부터, 1인분 주문 된다는 후기" }],
    memo: "혼밥·칸막이 태그, 1인석. 후기: '1인분 주문이 된다고 해서' 1인분 주문. 11:00~23:00.",
    sources: [dc("SoGITu77tg9b"), "https://www.daangn.com/kr/local-profile/%EC%9C%A0%EA%B0%80%EB%84%A4%EB%8B%AD%EA%B0%88%EB%B9%84-%EC%95%88%EC%82%B0%EC%A4%91%EC%95%99%EC%A0%90-w7uwtezji7md/"],
  },
  {
    key: "kkotgerang-boribap",
    query: "꽃게랑보리밥 안산",
    mustInclude: "꽃게랑",
    category: "찌개·백반",
    menus: [{ name: "보리밥정식(1인)", solo_price: 15000, normal_min_servings: 2 }],
    memo: "메뉴판에 보리밥정식(1인) 15,000원.",
    sources: [dc("3CRBsd8c0isb")],
  },
  {
    key: "agu-deumppuk",
    query: "아구듬뿍&알곤마니 안산",
    mustInclude: "아구듬뿍",
    altQueries: ["아구듬뿍"],
    category: "전골·찜·탕",
    menus: [{ name: "점심특선 아구찜 1인", solo_price: 12000, normal_min_servings: 2, note: "점심특선(후기)" }],
    time_rules: [
      { day_type: "all", start_time: "11:00", end_time: "14:30", available: true, note: "점심특선" },
      { day_type: "all", start_time: "14:30", end_time: "16:30", available: false, note: "브레이크 타임" },
    ],
    memo: "후기: '아구찜을 1인 1만2천원에(점심특선)'. 11:00~22:00, 브레이크 14:30~16:30. 혼밥 키워드.",
    sources: [dc("w7Phs0W0n5IM")],
  },
  {
    key: "jongno-gamjatang-seonbu",
    query: "종로해장국감자탕 선부",
    mustInclude: "종로해장국",
    altQueries: ["종로해장국감자탕 안산"],
    category: "전골·찜·탕",
    menus: [{ name: "1인 세트(뼈해장국+감자탕볶음밥)", solo_price: 18000, normal_min_servings: 2, note: "감자탕은 보통 2인 이상" }],
    memo: "선부2동. 1인 세트 메뉴, '점심에 혼밥 손님 많다' 후기.",
    sources: [dc("QaZwuaJGo7Hz")],
  },
  {
    key: "gajang-jokbal-singil",
    query: "가장맛있는족발 안산신길점",
    mustInclude: "가장맛있는족발안산신길",
    category: "족발·보쌈",
    menus: [
      { name: "실속족발+쟁반국수(1인)", solo_price: 29000, normal_min_servings: 2, note: "양은 1~2인분" },
      { name: "실속불족발+쟁반국수(1인)", solo_price: 29000, normal_min_servings: 2 },
    ],
    memo: "1인 실속 세트. 영업 14:00~01:00 표기.",
    sources: [dc("nZFUFYE9YGnB")],
  },
  {
    key: "choijunghee-nakji",
    query: "최정희낙지마당 안산",
    mustInclude: "최정희",
    category: "해산물·조개구이",
    menus: [{ name: "낙지볶음 1인분", solo_price: 13000, normal_min_servings: 2, note: "산낙지전골·연포탕은 2인 이상" }],
    memo: "후기: '낙지볶음 1인분만 주문'(포장 14,000원).",
    sources: [dc("PLmWEdzJYpCT")],
  },
  {
    key: "doojjim-wolpi",
    query: "두찜 안산월피점",
    mustInclude: "두찜",
    category: "닭갈비·찜닭",
    menus: [{ name: "까만찜닭 반마리", solo_price: 20800, normal_min_servings: 2, note: "매장 소개 '혼자서도 즐기는 두찜'" }],
    memo: "월피동. 반마리 메뉴. 11:00~23:00.",
    sources: [dc("RLoGvgIrDzTN")],
  },
  {
    key: "sinseon-shabu-kalguksu",
    query: "신선샤브&칼국수 안산",
    mustInclude: "신선샤브",
    category: "샤브샤브",
    menus: [
      { name: "얼큰 소고기샤브 1인 세트", solo_price: 12500, normal_min_servings: 2, note: "야채·소고기 100g·칼국수·볶음밥" },
      { name: "칼국수 세트", solo_price: 9000, normal_min_servings: 1 },
    ],
    memo: "상록구 성안1길 20. 1인 세트 운영.",
    sources: ["https://mom-mom.net/travel/places/6a10285f1fddc94bc514cb63"],
  },
  {
    key: "imone-saengseon",
    query: "이모네생선구이 안산",
    mustInclude: "이모네생선",
    category: "해산물·조개구이",
    menus: [
      { name: "고등어구이", solo_price: 11000, normal_min_servings: 1, note: "구이·볶음은 1인 주문 가능, 조림은 2인 이상" },
      { name: "갈치구이", solo_price: 14000, normal_min_servings: 1 },
    ],
    memo: "이동. 구이·볶음 1인 가능, 조림은 2인부터. 혼밥 후기.",
    sources: [dc("k2uuD0xNwLW3")],
  },
  {
    key: "hakchang-tteokbokki",
    query: "학창시절 즉석떡볶이",
    mustInclude: "학창시절",
    category: "분식",
    menus: [
      {
        name: "즉석떡볶이 1인분",
        solo_price: 9900,
        regular_price_per_person: 8000,
        normal_min_servings: 2,
        note: "2인 16,000원부터, 화요일 휴무",
      },
    ],
    memo: "본오동. 가게 정보에 '1인 방문 시 1인 주문 가능'.",
    sources: [dc("6C2glgELlhjN"), "https://www.daangn.com/kr/local-profile/%ED%95%99%EC%B0%BD%EC%8B%9C%EC%A0%88-%EC%A6%89%EC%84%9D%EB%96%A1%EB%B3%B6%EC%9D%B4-xuwsmrnq4px4/"],
  },
  {
    key: "ayajin-dongtae",
    query: "아야진동태탕 안산점",
    mustInclude: "아야진",
    category: "전골·찜·탕",
    menus: [{ name: "동태탕 1인", solo_price: 13000, normal_min_servings: 2, note: "공기밥 포함, 1인 1메뉴" }],
    memo: "고잔동. 동태탕 1인 13,000원(1인 1메뉴).",
    sources: [dc("horvJGhTgr52")],
  },
];
