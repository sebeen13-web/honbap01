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
