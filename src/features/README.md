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
