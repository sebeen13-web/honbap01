# 혼밥 지도 로드맵

> **"2인분부터 파는 식당에서, 1인분이 되는 메뉴와 가격을 구체적으로 보여주는 지도"**

## 차별점

1. **1인분 메뉴·가격 구체화** — "1인분 돼요"가 아니라 "삼겹살 1인 18,000원 (보통 1인당 16,000원, +2,000원)".
2. **시간대별 정직한 가능 여부** — "평일 저녁 피크엔 안 돼요"까지 규칙으로 표시. 지금 가능/몇 시부터 가능.
3. **마지막 확인일 + "오늘도 됐어요/안 됐어요" 원탭 확인** — 리뷰 대신 원탭, 최근 안 된다는 확인이 쌓이면 경고.
4. **사장님 5분 등록 + "혼밥 환영" 스티커 + 사장님 통계** — 사장님이 직접 올리고, 매장에 붙이고, 효과를 본다.

## 진행 상황

| 단계 | 내용 | 상태 |
|---|---|---|
| 1 | 스키마, RLS, PostGIS, nearby_restaurants | 완료 |
| 2 | 관리자 로그인, 식당 등록·수정·숨김 | 완료 (메뉴·가격·시간대 규칙 입력으로 개편 완료) |
| 차별점 DB | 메뉴·가격, 시간대 규칙, 원탭 확인, 연결 요청, 통계 테이블 + RLS | 완료 (`20261102000000_menus_time_rules_confirmations.sql`) |
| 3 | 손님 메인(지도+목록+필터+위치) | 완료 (아래 [3단계 손님 메인] 명세 반영, 주 색상 청록 #0F766E) |
| 손님 로그인 | 카카오·이메일 로그인, /login·/me·/me/favorites, 즐겨찾기, 회원 탈퇴, 약관·개인정보 처리방침(초안) | 완료 (`20261103000000_customer_accounts.sql`) |
| 하단 탭 + 홈 + 요청 | 하단 탭(홈 / 지도 / 요청 / 내 정보), 홈(메뉴 검색·섹션), 지도는 `/map`, 요청 탭(요청·+1·공유), 관리자 요청 목록 | 완료 (`20261104000000_home_and_requests.sql`) |
| 4 | 상세 + 원탭 확인 + 통계 호출 + 제보 | 완료 (`/restaurants/[id]`, `POST /api/restaurants/[id]/confirm`, DB 변경 없음) |
| 5 | 사장님 등록·대시보드·스티커, 관리자 승인 | 완료 (`20261106000000_owner.sql`, `/owner`, `/owner/register`, `/owner/edit`, `/owner/sticker`, `/admin/claims`, `/admin/review`) |
| 6 | 데이터 정리 점검, 배포 가이드 | 예정 |

이후 단계는 아래 **화면 명세를 반드시 따른다.**

---

## 화면 명세

[3단계 손님 메인]
- 카드: 이름·종류·거리·출처 배지·확인일, "보통 {normal_min_servings}인분부터 → 1인분 가능" 문구, 대표 메뉴 최대 2개를 "메뉴명 1인 18,000원" 형태로, 보통 가격이 있으면 "(보통 1인당 16,000원, +2,000원)"을 작게 덧붙이고, 메뉴가 더 있으면 "외 N개". "확인 당시 가격" 안내를 작게 표시.
- 시간 배지: is_solo_available_now가 true면 "지금 1인분 가능", false면 next_available_at 기준 "17:00부터 가능", null이면 표시 없음.
- 필터: 음식 종류, "지금 1인분 가능"(null은 제외하고 제외된 개수 안내), 가격대(1만원 이하/1~2만원/2만원 이상, min_solo_price 기준), 정렬 토글(거리순/낮은 가격순).
- 카드 하단: "최근 30일 N명이 됐다고 확인", needs_review=true면 "최근 안 된다는 확인이 있어요" 경고 배지.

[4단계 상세]
- **(추가) `/restaurants/[id]` 는 하단 탭 그룹 밖에 둔다(탭 숨김). 상단에 뒤로가기 버튼: 이전 화면(홈·지도·요청·내 정보)으로 `router.back()`, 바로 들어온 경우(이전 기록 없음)는 홈(`/`)으로. 지도에서 왔으면 돌아갔을 때 위치·조회 결과·선택 상태가 유지된다(NearbyProvider).**
- 메뉴 표(이름, 1인분 가격, 보통 1인당 가격, 차액), 시간대 규칙 표, 출처 배지와 마지막 확인일.
- "오늘도 됐어요 / 안 됐어요" 버튼 2개: 서버 API route로 solo_confirmations에 등록, 하루 1회 제한 안내, 등록 직후 집계 갱신, 위치 권한 요구 안 함. 리뷰 글은 받지 않는다.
- **(변경) 확인 버튼과 제보는 로그인 사용자만.** 비로그인이면 로그인 유도 시트(`LoginPromptSheet`)를 띄운다. 하루 1회 제한은 user_id 기준(한국 날짜).
- 상세 진입, 길찾기 클릭, 전화 클릭 시 increment_restaurant_stat 호출.
- 자유 텍스트 제보(reports) 버튼은 유지.

[5단계 사장님]
- **(변경) 사장님 가입은 기존 손님 계정에서 "내 식당 등록하기"로 승격하는 흐름.** 별도 사장님 가입 화면을 만들지 않는다. 식당을 등록하거나 연결 요청이 승인되면 서버가 role 을 owner 로 바꾼다.
- **(추가) 사장님 등록 화면 상단에 그 식당(카카오 장소 id 기준)의 요청 수를 보여준다:** "손님 N명이 1인분을 요청했어요".
- 등록 폼 3스텝: ①식당 검색/주소(이미 조사된 식당이면 "내 식당으로 연결 요청") ②1인분 메뉴(이름·가격) 1개 이상 ③시간대 규칙 1개 이상. 나머지는 선택. 진행 표시와 임시 저장. 5분 안에 끝나는 것이 목표.
- ~~카카오 로그인(Supabase Auth Kakao provider) 추가.~~ → 손님 로그인 단계에서 이미 구현됨(제외).
- 대시보드: 최근 7·30일 조회·길찾기·전화 수, 확인 버튼 집계, 연결 요청 상태.
- **(추가) 대시보드에 "내 식당 요청 N명" 카드** (restaurant_requests.vote_count, restaurant_id = 내 식당).
- **(추가) 식당이 등록되면(같은 kakao_place_id) 요청은 트리거로 '등록됨'이 되고, 요청자들의 ‘내 정보 > 내가 요청한 식당’에 "등록됐어요"가 표시된다.** 푸시 알림은 만들지 않는다(앱 안 표시만).
- 사장님 등록 시 카카오 장소(키워드) 검색으로 식당을 고르게 해서 kakao_place_id 를 함께 저장한다(요청과 자동 연결).
- /owner/sticker: A4 인쇄용 "혼밥 환영 스티커" 큰 것과 작은 것 2종, 문구 "혼자 오셔도 1인분 OK", 식당 상세로 연결되는 QR 코드(qrcode 패키지), 인쇄 버튼.
- 관리자: 연결 요청 승인/거절, needs_review 식당 목록.

[6단계]
- 90일 지난 확인 데이터 정리 방법 점검, 배포 가이드.

---

## 구현 규칙 (모든 단계 공통)

- 손님은 로그인 없음, 손님 위치는 조회 요청에만 사용하고 어디에도 저장·로그하지 않음.
- 출처 배지는 서버가 결정, 에러/로딩 상태 처리, 한국어 UI, 주 색상 하나, 터치 영역 44px 이상.
- 환경변수가 새로 필요하면 .env.example에 추가.

---

## 참고: 명세가 쓰는 DB 이름 (구현 메모)

명세를 구현할 때 쓰는 실제 이름. 자세한 정의는 `supabase/migrations/20261102000000_menus_time_rules_confirmations.sql`, 타입은 `src/types/database.ts`.

| 명세 | DB / 함수 |
|---|---|
| 메뉴·가격 | `solo_menu_items` (name, solo_price, regular_price_per_person, normal_min_servings, note, sort_order). 차액 = `solo_price - regular_price_per_person` |
| 시간대 규칙 | `solo_time_rules` (day_type weekday/weekend/all, start_time, end_time, available, note). 시작=종료면 하루 종일, 종료<시작이면 자정 넘김 |
| 근처 조회 | `nearby_restaurants(user_lat, user_lng, radius_m)` → menus, min_solo_price, normal_min_servings, is_solo_available_now, next_available_at, time_rules, ok_30d, not_ok_30d, last_ok_at, needs_review |
| 원탭 확인 등록 | 로그인 사용자가 `solo_confirmations` insert (restaurant_id, user_id = 본인, result). user_id·시각·날짜는 트리거가 서버 값으로 고정. **select 권한이 없으므로 `.insert()` 뒤에 `.select()` 를 붙이지 않는다.** 같은 날 중복은 unique 위반(23505) → "오늘은 이미 확인하셨어요" |
| 확인 집계 | `confirmation_summaries(rids uuid[])` (ok_30d, not_ok_30d, last_ok_at, needs_review = 최근 14일 not_ok ≥ 3) |
| 통계 | `increment_restaurant_stat(p_restaurant_id, p_kind)` kind = view / directions / phone. 읽기는 `restaurant_daily_stats` (사장님 본인·관리자) |
| 연결 요청 | `restaurant_claims` insert (status pending) → 관리자가 status = approved 로 바꾸면 트리거가 `restaurants.owner_id` 설정, 같은 식당 다른 대기 요청은 rejected |
| 90일 정리 | `select public.purge_old_confirmations();` (SQL Editor / service_role 전용) |
| 로그인 | `useAuth()`(브라우저 표시용), 서버는 `requireUser()` / `requireOwner()` (`src/features/auth/guard.ts`), 미들웨어가 /me·/owner·/admin 1차 확인 |
| 로그인 유도 | `LoginPromptSheet` (`src/features/auth/login-prompt-sheet.tsx`) — 4단계 확인·제보 버튼에서 재사용 |
| 즐겨찾기 | `favorites` (본인만), `useFavorites(userId)` |
| 역할 | profiles.role = user(가입 기본) / owner(식당 연결 시 트리거가 승격) / admin(DB 에서 직접) |
| 탭 공통 상태 | `NearbyProvider` / `useNearby()` (`src/features/nearby/nearby-context.tsx`): 위치·기준점·반경·조회 결과·지도 필터·즐겨찾기·로그인 유도·`canGoBack()`. `src/app/(guest)/layout.tsx` 에 있어 탭 화면과 상세가 함께 쓴다. 좌표는 메모리에만 |
| 사장님 | `owner_place_lookup()`(이미 조사된 식당·요청 수·내 연결 요청), `owner_save_restaurant()`(새 등록 = owner 승격 / 내 식당 수정, 메뉴·시간 규칙 필수). 화면: `src/features/owner/` (3단계 마법사, 임시 저장은 이 브라우저 localStorage) |
| 상세 | `src/app/(guest)/restaurants/[id]/page.tsx` (탭 없음, 뒤로가기), 확인 `POST /api/restaurants/[id]/confirm` (401 로그인 / 409 오늘 이미 / 403 비공개), 통계 `bumpStat()` (`src/features/detail/stats.ts`) |
| 요청 | `restaurant_requests`(누구나 읽기, created_by 비공개), `restaurant_request_votes`(본인 것만), `create_restaurant_request()`(로그인, 하루 5개, 공개 식당 차단), `list_restaurant_requests()`, `place_request_status()`, `admin_link_request()` |
| 식당 ↔ 요청 | `restaurants.kakao_place_id` — 같은 id 로 등록·연결되면 트리거가 요청을 '등록됨'으로 |

참고: `solo_policies.time_slot`(종일/점심/저녁/별도 안내)은 목록용 요약으로 남아 있다. 3단계 개편 때 시간대 규칙 기반 배지로 바꾸면서 계속 쓸지 정한다.
