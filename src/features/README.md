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
