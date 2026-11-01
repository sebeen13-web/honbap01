# 혼밥 지도

사장님이 "혼자 와도 1인분 주문 가능"이라고 등록한 식당만 지도·목록으로 보여주는 모바일 우선 웹앱.

- Next.js 15 (App Router) + TypeScript + Tailwind CSS v4
- Supabase (Auth, Postgres, PostGIS, RLS)
- 카카오맵 JavaScript API

## 폴더 구조

```
supabase/
  migrations/20261031000000_init.sql   # 테이블 + RLS + 함수 (nearby_restaurants 등)
  migrations/20261101000000_admin_save_restaurant.sql  # 관리자 식당+정책 저장 함수 (2단계)
  migrations/20261101000100_revoke_anon_helpers.sql    # 비로그인의 is_admin/owns_restaurant 직접 호출 차단
  seed.sql                             # 로컬용 가상 샘플 식당 4곳 (안산 중앙역 주변)
src/
  app/                                 # 라우트 (/, /restaurants/[id], /owner, /admin ...)
  app/page.tsx                         # 손님 메인: 지도 + 목록 시트 + 필터 (3단계)
  app/admin/login                      # 관리자 로그인 (보호 대상 아님)
  app/admin/(protected)/               # 관리자 전용: layout 에서 requireAdmin()
    restaurants/ , restaurants/new , restaurants/[id]/edit
  features/                            # 기능별 폴더 (features/README.md 참고)
  lib/env.ts                           # 환경변수 검증(zod)
  lib/supabase/{client,server,middleware}.ts
  lib/constants.ts                     # 음식 종류, 시간대·출처 라벨, 반경, 기본 중심(안산)
  types/database.ts                    # DB 타입
```

## DB 설계 요약

| 테이블 | 핵심 |
|---|---|
| `profiles` | 가입 시 자동 생성, `role` = owner(기본) / admin. 역할 변경은 관리자만 |
| `restaurants` | `location`(geography) 은 위도·경도로 자동 계산되는 생성 컬럼 + GIST 인덱스. `business_hours`(jsonb) 로 '영업 중' 판단. `owner_id` unique → 사장님당 1개 |
| `solo_policies` | 식당당 1개. `is_active=false` = 사장님 일시중단 **또는** 관리자 숨김. `source`/`last_verified_at` 은 트리거가 로그인 역할로 결정 (클라이언트 값 무시) |
| `reports` | 손님 정보 없이 식당 id + 사유만. 누구나 등록, 읽기는 관리자만 |

`business_hours` 형식: `{"mon":{"open":"11:00","close":"22:00"}, "sun":null, ...}` — `null` 은 휴무, `close <= open` 은 자정 넘김, `open = close` 는 24시간.

## 실행

```bash
cp .env.example .env.local   # 값 채우기
npm install
npm run dev                  # http://localhost:3000
```

로컬 Supabase(Docker 필요): `npm run db:start` → `npm run db:reset` (마이그레이션 + 샘플 데이터)
원격 Supabase: `npx supabase login` → `npx supabase link --project-ref <ref>` → `npm run db:push`

## 원격 Supabase 프로젝트 만들기

1. https://supabase.com/dashboard → **New project** (Region: Northeast Asia (Seoul) 권장). DB 비밀번호는 따로 보관.
2. 마이그레이션 + 샘플 데이터 적용 (둘 중 하나)
   - CLI: `npx supabase login` → `npx supabase link --project-ref <ref>` → `npx supabase db push --include-seed`
   - 대시보드: **SQL Editor** 에서 `supabase/migrations/*.sql` 을 파일 이름 순서대로 실행한 뒤 `supabase/seed.sql` 실행
3. **Project Settings > API** 의 Project URL, anon(publishable) 키를 `.env.local` 에 넣는다.
4. **Authentication > URL Configuration** 의 Site URL 에 `http://localhost:3000`(배포 후엔 배포 주소).

## 관리자 계정 만들기

관리자 가입 화면은 따로 없다(아무나 관리자가 되지 않도록). 계정을 만든 뒤 SQL 로 역할을 바꾼다.

1. Supabase 대시보드 **Authentication > Users > Add user > Create new user**
   이메일·비밀번호 입력, **Auto Confirm User** 체크 → 가입 트리거가 `profiles` 행(role = owner)을 자동으로 만든다.
2. **SQL Editor** 에서 실행:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'admin@example.com');

-- 확인
select u.email, p.role from public.profiles p join auth.users u on u.id = p.id;
```

3. `/admin/login` 에서 로그인. 관리자 권한을 회수할 때는 `role = 'owner'` 로 되돌린다.

로컬 Supabase 라면 Studio(http://127.0.0.1:54323)에서 같은 방법으로 하거나 `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres` 로 위 SQL 을 실행한다.

## 관리자 권한 확인 구조 (2단계)

- `src/middleware.ts` → `/admin/**`(로그인 페이지 제외) 요청마다 로그인 + `profiles.role = 'admin'` 확인, 아니면 `/admin/login`(권한 없음 안내)으로 보낸다.
- 서버 컴포넌트(`app/admin/(protected)/layout.tsx`, 각 page)와 **모든 서버 액션**에서 `requireAdmin()` 으로 다시 확인한다.
- DB 에서도 RLS(`관리자 전체` 정책)와 `admin_save_restaurant()` 안의 `is_admin()` 검사로 한 번 더 막는다.
- 저장 시 `source` / `last_verified_at` 은 클라이언트에서 받지 않는다. 트리거가 `admin_checked` / `now()` 로 기록한다.

## 손님 메인 화면 (3단계)

- 처음에는 안내와 "내 위치로 찾기" 버튼만 보이고, 버튼을 눌러야 위치 권한을 묻는다.
- 위치를 거부하거나 실패하면 동네 검색(카카오 주소/키워드)으로 기준점을 고른다.
- 손님 좌표는 `nearby_restaurants` 요청 본문(POST)에만 쓰고, 서버·localStorage·쿠키·콘솔 어디에도 남기지 않는다.
- 위치 기능은 https 주소나 `localhost` 에서만 동작한다. 휴대폰으로 PC 개발 서버(`http://192.168...`)에 접속하면 위치가 막히므로, 휴대폰 확인은 배포 주소(https)나 동네 검색으로 한다.
