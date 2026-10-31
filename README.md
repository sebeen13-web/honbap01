# 혼밥 지도

사장님이 "혼자 와도 1인분 주문 가능"이라고 등록한 식당만 지도·목록으로 보여주는 모바일 우선 웹앱.

- Next.js 15 (App Router) + TypeScript + Tailwind CSS v4
- Supabase (Auth, Postgres, PostGIS, RLS)
- 카카오맵 JavaScript API

## 폴더 구조

```
supabase/
  migrations/20261031000000_init.sql   # 테이블 + RLS + 함수 (nearby_restaurants 등)
  seed.sql                             # 로컬용 가상 샘플 식당 4곳 (안산 중앙역 주변)
src/
  app/                                 # 라우트 (/, /restaurants/[id], /owner, /admin ...)
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
