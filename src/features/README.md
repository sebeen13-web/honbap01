# features/

기능별 폴더. 각 폴더에 그 기능의 컴포넌트·훅·zod 스키마·서버 액션을 함께 둔다.

| 폴더 | 내용 | 단계 |
|---|---|---|
| `admin/` | 관리자 로그인, 식당 직접 등록·수정·숨김, 제보 처리 | 2, 6 |
| `map/` | 카카오맵 SDK 로더, 지도·마커, 주소/키워드 검색 | 2, 3 |
| `location/` | `useUserLocation` 훅 (Geolocation) | 3 |
| `restaurants/` | 목록·카드·필터·상세, 공용 zod 스키마 | 3, 4 |
| `reports/` | 제보하기 | 4 |
| `owner/` | 사장님 로그인·가입, 식당 등록·수정·일시중단 | 5 |
| `auth/` | 로그인 공통(이메일, 이후 카카오 provider 추가 지점) | 2, 5 |

공용 코드는 `src/lib/`(Supabase 클라이언트, env, 상수), 타입은 `src/types/`.

## 2단계에서 만든 파일

- `auth/session.ts` — 현재 사용자 + `profiles.role` 조회 (서버 전용)
- `admin/guard.ts` — `requireAdmin()` : 관리자 페이지·서버 액션 첫 줄에서 호출
- `admin/auth-actions.ts`, `admin/login-form.tsx` — 관리자 로그인/로그아웃
- `admin/restaurant-actions.ts` — 식당 저장(`admin_save_restaurant` RPC), 숨김/숨김 해제
- `admin/restaurant-form.tsx`, `admin/toggle-active-button.tsx` — 등록·수정 폼, 숨김 버튼
- `restaurants/schema.ts` — 식당 + 1인분 정책 zod 스키마 (클라이언트·서버 공용, 5단계 사장님 폼도 재사용)
- `map/load-kakao-sdk.ts`, `map/address-search.tsx`, `map/kakao-types.ts` — 카카오 SDK 로더, 주소/상호 검색

## 3단계에서 만든 파일 (손님 메인 화면 `/`)

- `location/use-user-location.ts` — `useUserLocation()` : idle / loading / success / denied / error. `request()` 를 불러야 권한을 묻는다. 좌표는 메모리에만.
- `map/kakao-map.tsx` — 카카오맵(한 번만 로드), 식당 마커(버튼 오버레이), 내 위치/검색 위치 마커, 반경 원, 시트에 가려지는 영역을 뺀 맞춤·이동
- `map/kakao-types.ts` — SDK 타입(지도·오버레이·원 추가)
- `restaurants/nearby-screen.tsx` — 화면 조립(위치 → 조회 → 필터 → 지도/목록 동기화)
- `restaurants/use-nearby-restaurants.ts` — `nearby_restaurants` RPC 조회(마지막 요청만 반영, 다시 시도)
- `restaurants/bottom-sheet.tsx` — 접힘/중간/펼침 3단계 시트 (끌기·탭·키보드)
- `restaurants/filter-bar.tsx`, `restaurants/filters.ts` — 필터 칩과 클라이언트 필터 로직
- `restaurants/restaurant-card.tsx`, `restaurants/format.ts` — 목록 카드, 거리 표기(350m / 1.2km)

## 차별점 DB 반영 때 만든 파일

- `restaurants/editors/menu-items-editor.tsx` — 1인분 메뉴·가격 행 편집 (관리자 폼, 5단계 사장님 폼에서 재사용)
- `restaurants/editors/time-rules-editor.tsx` — 시간대 규칙 행 편집
- `restaurants/editors/price-input.tsx` — 천 단위 쉼표 가격 입력
- `restaurants/schema.ts` — `menuItemSchema`, `timeRuleSchema` 추가 (클라이언트·서버 공용)

이후 화면 명세는 `docs/ROADMAP.md` 를 따른다.

## 손님 로그인 + 3단계 개편 때 만든 파일

- `auth/` — `use-auth.ts`(브라우저 로그인 상태), `guard.ts`(`requireUser`/`requireOwner`), `actions.ts`(로그아웃·탈퇴),
  `kakao.ts`·`kakao-button.tsx`, `email-login-form.tsx`, `login-prompt-sheet.tsx`(로그인 유도 시트, 4단계에서 재사용), `auth-button.tsx`, `delete-account.tsx`
- `favorites/` — `use-favorites.ts`, `remove-favorite-button.tsx`
- `legal/legal-page.tsx` — 약관·개인정보 처리방침 틀
- `restaurants/nearby-parse.ts` — nearby_restaurants 의 jsonb(menus, time_rules) 파싱
- `lib/safe-redirect.ts` — 로그인 후 돌아갈 경로를 같은 사이트 내부로 제한

## 하단 탭 + 홈 + 요청 때 만든 파일

- `tabs/tab-bar.tsx` — 하단 탭 (홈 / 지도 / 요청 / 내 정보)
- `nearby/nearby-context.tsx` — 탭 공통 상태(위치·조회 결과·필터·즐겨찾기·로그인 유도), `nearby/location-bar.tsx` — 위치 한 줄
- `home/` — `home-screen.tsx`(섹션), `menu-search.ts`·`menu-result-card.tsx`(메뉴 이름 검색)
- `requests/` — `request-screen.tsx`(요청·+1·공유), `place-search.ts`(카카오 장소 검색, 음식 종류 추정)
- `admin/request-actions.ts` — 요청 조사 완료·식당 연결

## 4단계(식당 상세) 때 만든 파일

- `detail/detail-top-bar.tsx` — 뒤로가기(앱 안 이전 화면 / 없으면 홈) + 즐겨찾기, 조회 수 +1
- `detail/detail-actions.tsx` — 길찾기(카카오맵)·전화, 누르면 통계 +1
- `detail/confirm-box.tsx` — "오늘도 됐어요 / 안 됐어요" (API 호출, 하루 1회 안내, 집계 바로 갱신)
- `detail/report-sheet.tsx` — 정보가 다를 때 제보 (빠른 선택 + 자유 글, 로그인)
- `detail/stats.ts` — `bumpStat()` (increment_restaurant_stat)

## 5단계(사장님) 때 만든 파일

- `owner/owner-wizard.tsx` — 등록 3단계 / 수정 (진행 표시, 임시 저장, 요청 수 배너, 연결 요청)
- `owner/owner-values.ts`, `owner/owner-schema.ts` — 폼 값·zod 스키마 (서버·클라이언트 공용)
- `owner/actions.ts` — 저장(owner_save_restaurant), 연결 요청, 일시중단
- `owner/print-button.tsx` — 스티커 인쇄
- `admin/claim-actions.ts` — 연결 요청 승인/거절, 제보 처리 완료
