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
  migrations/20261102000000_menus_time_rules_confirmations.sql  # 1인분 메뉴·가격, 시간대 규칙, 원탭 확인, 연결 요청, 통계
  seed.sql                             # 샘플 식당 4곳 (메뉴·가격·시간대 규칙·확인·통계 포함)
  tests/rls_checks.sql                 # 역할별 권한 + 시간대 규칙 점검 (rollback 되어 데이터 안 남음)
  migrations/20261103000000_customer_accounts.sql  # 손님 로그인: 역할 user/owner/admin, 닉네임, 즐겨찾기, 확인=user_id 기준, 탈퇴
  migrations/20261104000000_home_and_requests.sql  # 카카오 장소 id, 식당 요청·+1, nearby 에 등록일
docs/ROADMAP.md                        # 차별점과 3~6단계 화면 명세 (이후 단계는 이 문서를 따른다)
src/
  app/                                 # 라우트 (/, /restaurants/[id], /owner, /admin ...)
  app/(tabs)/                          # 하단 탭 화면: / (홈), /map (지도), /request (요청), /me (내 정보)
  app/(tabs)/layout.tsx                # NearbyProvider + 하단 탭 (탭을 옮겨도 위치·조회 결과 유지)
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
| `profiles` | 가입 시 자동 생성, `role` = user(기본) / owner / admin, `nickname`(카카오 닉네임, 없으면 "익명의 혼밥러"). 사용자는 자기 역할을 바꿀 수 없음. owner 승격은 식당 연결 시 트리거만 |
| `favorites` | 즐겨찾기 (본인 것만 읽기/쓰기, 공개 식당만 추가) |
| `restaurant_requests` | "1인분 되게 해주세요" 요청. 누구나 읽기(요청자는 비공개), 만들기는 `create_restaurant_request()`(로그인, 하루 5개). 같은 `kakao_place_id` 로 식당이 등록되면 자동 '등록됨' |
| `restaurant_request_votes` | 요청 +1. 본인 것만 보기/추가/취소. `vote_count` 는 트리거가 다시 셈 |
| `restaurants` | `location`(geography) 은 위도·경도로 자동 계산되는 생성 컬럼 + GIST 인덱스. `business_hours`(jsonb) 로 '영업 중' 판단. `owner_id` unique → 사장님당 1개 |
| `solo_policies` | 식당당 1개. `is_active=false` = 사장님 일시중단 **또는** 관리자 숨김. `source`/`last_verified_at` 은 트리거가 로그인 역할로 결정 (클라이언트 값 무시). 메뉴·시간대 규칙을 저장해도 갱신, `is_active` 만 바꾸면 유지 |
| `solo_menu_items` | 1인분 메뉴·가격 (식당당 최대 10개). `solo_price` 1인분 가격, `regular_price_per_person` 보통 1인당 가격, `normal_min_servings` 원래 최소 인분 |
| `solo_time_rules` | 평일/주말/매일 × 시작~종료 × 가능/불가 (최대 8개). 겹치면 불가 우선, 자정 넘김 지원, 한국 시간. 규칙 없으면 null |
| `solo_confirmations` | "오늘도 됐어요/안 됐어요". 로그인 사용자만, `user_id` 기준 같은 식당 하루 1회(한국 날짜). 행 읽기는 관리자만, 공개 집계는 `confirmation_summaries()` |
| `restaurant_claims` | 사장님 "내 식당으로 연결 요청" → 관리자 승인 시 `restaurants.owner_id` 설정 |
| `restaurant_daily_stats` | 식당별 일자별 조회·길찾기·전화 수. `increment_restaurant_stat()` 로만 증가, 사장님은 자기 식당만 읽기 |
| `reports` | 자유 텍스트 제보. 로그인 사용자만 등록(`user_id`), 읽기는 관리자만. 탈퇴하면 작성자 연결만 끊김 |

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

## 오래된 확인 데이터 정리 (90일)

`solo_confirmations` 는 90일이 지나면 지운다. 지금은 수동으로 실행한다(6단계에서 자동화 점검).

- Supabase 대시보드 → **SQL Editor** 에서:

```sql
select public.purge_old_confirmations();        -- 지운 행 수를 돌려준다 (기본 90일)
-- 같은 내용을 직접 쓰려면:
-- delete from public.solo_confirmations where created_at < now() - interval '90 days';
```

- 로컬: `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "select public.purge_old_confirmations();"`

이 함수는 손님·사장님·관리자 계정에서 API 로 부를 수 없다(SQL Editor / service_role 전용).

## 권한 점검 스크립트

```bash
npx supabase db reset
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/tests/rls_checks.sql
```

`PASS` / `FAIL` 이 한 줄씩 찍힌다. 한 트랜잭션 안에서 실행하고 rollback 하므로 데이터가 남지 않는다.

## 손님 로그인 설정 (카카오 + 이메일)

### ⚠️ 비밀 값 관리
- **카카오 Client Secret, Supabase service_role 키는 코드·채팅·GitHub 에 절대 넣지 않는다.**
  - 카카오 Client Secret 은 Supabase 대시보드에만 입력한다.
  - service_role 키는 지금 앱에서 쓰지 않는다. 필요해지면 `.env.local` 에만 둔다.
- `.env.local` 은 git 에 올리지 않는 파일이다(`.gitignore`). 공개 저장소에 올라가 있다면 `git rm --cached .env.local` 로 빼고,
  비밀 값이 들어 있었다면 그 키를 새로 발급(재발급)한다.

### 카카오 개발자 콘솔 (developers.kakao.com)
1. 내 애플리케이션 → 앱 선택 → **앱 키 > REST API 키**를 확인한다 (Supabase 의 Client ID).
2. **카카오 로그인 > 일반**에서 사용 설정 **ON**.
3. **Redirect URI** 에 `https://vquelkukpoevtceblrbm.supabase.co/auth/v1/callback` 추가 (로컬 Supabase 로 시험하면 `http://localhost:54321/auth/v1/callback` 도).
   앱 주소(`http://localhost:3000/...`)가 아니라 **Supabase 주소**다.
4. **카카오 로그인 > 보안**에서 Client Secret 코드를 만들고 활성화한다 (Supabase 의 Client Secret).
5. **동의항목**: `닉네임(profile_nickname)` 을 필수 또는 선택 동의로 설정한다. `프로필 사진`은 선택.
   `카카오계정(이메일, account_email)` 은 **비즈 앱**에서만 켤 수 있다. 이메일 없이 쓰려면 아래 Supabase 의 "Allow users without an email" 을 켠다.
6. **플랫폼 > Web 사이트 도메인**에 `http://localhost:3000` 과 배포 도메인 (지도용, 기존과 동일).

### Supabase 대시보드
1. **Authentication > Sign In / Providers > Kakao**: Enabled ON, Client ID = REST API 키, Client Secret = 위 4번 코드.
   이메일 동의항목을 켜지 않았다면 **Allow users without an email** 을 ON.
2. **Authentication > URL Configuration**
   - Site URL: `http://localhost:3000` (배포 후에는 배포 주소)
   - Redirect URLs: `http://localhost:3000/**` 와 `https://<배포 도메인>/**`
3. **Authentication > Sign In / Providers > Email**: 사용. "Confirm email" 을 켜 두면 가입 시 인증 메일을 눌러야 로그인된다.
   기본 메일 발송은 시간당 횟수 제한이 작으므로, 실제 운영 전에는 SMTP(예: Resend)를 설정한다.

### 이메일 없이 카카오 로그인이 되는지
- Supabase 는 기본으로 카카오에 `account_email` 동의를 함께 요청할 수 있다. 이메일 동의항목이 꺼져 있는데 요청되면 카카오가 **KOE205(설정하지 않은 동의항목)** 오류를 보여 준다.
- 이메일을 못 받은 채로 Supabase 가 거절하면 앱 `/login` 에 "카카오 계정에서 이메일 정보를 받지 못해…" 안내가 뜬다(원인 문구가 함께 표시됨).
- 해결: (1) Supabase Kakao 설정에서 **Allow users without an email** ON, 그래도 KOE205 가 나오면 (2) 카카오 앱을 비즈 앱으로 전환(개인 개발자도 가능)한 뒤 `카카오계정(이메일)` 을 **선택 동의**로 켠다.

## 약관·개인정보 처리방침
`/terms`, `/privacy` 는 **법률 검토 전 초안**이다. 운영자 이름·연락처(`[…]` 부분)를 채우고, 서비스 공개 전에 전문가 검토를 받는다.
