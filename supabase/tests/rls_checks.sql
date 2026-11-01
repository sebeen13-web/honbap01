-- =====================================================================
-- 역할별 권한(RLS) + 시간대 규칙 점검 스크립트 (로컬용)
--
--   실행:  psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/tests/rls_checks.sql
--   전제:  npx supabase db reset 으로 seed 가 들어간 상태
--   결과:  NOTICE 로 PASS / FAIL 이 찍힌다. 전체가 한 트랜잭션이고 마지막에 rollback 하므로 데이터는 남지 않는다.
-- =====================================================================
\set ON_ERROR_STOP 1
set client_min_messages = notice;
begin;

-- ── 준비: 테스트 계정 (rollback 되므로 남지 않음) ─────────────────────
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('bbbbbbbb-0000-0000-0000-0000000000b1', 'owner1@test.local'),
  ('bbbbbbbb-0000-0000-0000-0000000000b2', 'owner2@test.local'),
  ('bbbbbbbb-0000-0000-0000-0000000000b3', 'owner3@test.local');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
-- owner1 은 샘플 2(한그릇 샤브)의 사장님
update public.restaurants set owner_id = 'bbbbbbbb-0000-0000-0000-0000000000b1' where id = '00000000-0000-0000-0000-000000000002';

-- =====================================================================
-- 1) 손님 (anon)
-- =====================================================================
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true) as _claims \gset

do $$
declare n int;
begin
  select count(*) into n from public.solo_menu_items;
  raise notice '% anon: 메뉴 읽기 = 공개 식당 것만 (기대 7, 실제 %)', case when n = 7 then 'PASS' else 'FAIL' end, n;
  select count(*) into n from public.solo_time_rules;
  raise notice '% anon: 시간대 규칙 읽기 = 공개 식당 것만 (기대 4, 실제 %)', case when n = 4 then 'PASS' else 'FAIL' end, n;
  select count(*) into n from public.nearby_restaurants(37.3219, 126.8309, 3000);
  raise notice '% anon: nearby_restaurants (기대 3, 실제 %)', case when n = 3 then 'PASS' else 'FAIL' end, n;
  select count(*) into n from public.confirmation_summaries(array[
    '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004']::uuid[]);
  raise notice '% anon: 확인 집계는 공개 식당만 (기대 3, 실제 %)', case when n = 3 then 'PASS' else 'FAIL' end, n;

  begin
    insert into public.solo_menu_items (restaurant_id, name, solo_price) values ('00000000-0000-0000-0000-000000000001', 'x', 1000);
    raise notice 'FAIL anon: 메뉴 직접 등록이 허용됨';
  exception when insufficient_privilege then raise notice 'PASS anon: 메뉴 직접 등록 차단';
  end;
  begin
    perform 1 from public.solo_confirmations;
    raise notice 'FAIL anon: 확인 행 읽기가 허용됨';
  exception when insufficient_privilege then raise notice 'PASS anon: 확인 행(해시) 읽기 차단';
  end;
  begin
    insert into public.solo_confirmations (restaurant_id, result, visitor_hash)
    values ('00000000-0000-0000-0000-000000000001', 'ok', repeat('a', 64));
    raise notice 'FAIL anon: 확인 직접 등록이 허용됨';
  exception when insufficient_privilege then raise notice 'PASS anon: 확인 직접 등록 차단 (서버 API 전용)';
  end;
  begin
    perform 1 from public.restaurant_daily_stats;
    raise notice 'FAIL anon: 통계 읽기가 허용됨';
  exception when insufficient_privilege then raise notice 'PASS anon: 통계 읽기 차단';
  end;
  begin
    insert into public.restaurant_daily_stats (restaurant_id, day, views) values ('00000000-0000-0000-0000-000000000001', current_date, 999);
    raise notice 'FAIL anon: 통계 직접 쓰기가 허용됨';
  exception when insufficient_privilege then raise notice 'PASS anon: 통계 직접 쓰기 차단';
  end;
  begin
    perform 1 from public.restaurant_claims;
    raise notice 'FAIL anon: 연결 요청 읽기가 허용됨';
  exception when insufficient_privilege then raise notice 'PASS anon: 연결 요청 접근 차단';
  end;
  begin
    perform public.purge_old_confirmations();
    raise notice 'FAIL anon: 정리 함수 실행이 허용됨';
  exception when insufficient_privilege then raise notice 'PASS anon: 90일 정리 함수 실행 차단';
  end;
  begin
    perform public.admin_save_restaurant(null, 'x', 'y', 37.3, 126.8, null, '기타', null, 'all_day', null, false, null,
      '[{"name":"a","solo_price":1000}]'::jsonb, null);
    raise notice 'FAIL anon: 관리자 저장 함수 실행이 허용됨';
  exception when insufficient_privilege then raise notice 'PASS anon: 관리자 저장 함수 차단';
  end;

  -- 통계 올리기 함수는 허용 (숫자만)
  perform public.increment_restaurant_stat('00000000-0000-0000-0000-000000000001', 'view');
  perform public.increment_restaurant_stat('00000000-0000-0000-0000-000000000004', 'view'); -- 숨김 식당: 무시
  raise notice 'PASS anon: increment_restaurant_stat 호출 가능';
  begin
    perform public.increment_restaurant_stat('00000000-0000-0000-0000-000000000001', 'hack');
    raise notice 'FAIL anon: 잘못된 통계 종류가 허용됨';
  exception when invalid_parameter_value then raise notice 'PASS anon: 잘못된 통계 종류 거부';
  end;
end $$;
reset role;

do $$
declare v int; h int;
begin
  select views into v from public.restaurant_daily_stats
   where restaurant_id = '00000000-0000-0000-0000-000000000001' and day = (now() at time zone 'Asia/Seoul')::date;
  select count(*) into h from public.restaurant_daily_stats where restaurant_id = '00000000-0000-0000-0000-000000000004';
  raise notice '% 통계: 공개 식당만 1 증가, 숨김 식당은 기록 안 됨 (views=%, 숨김 행=%)',
    case when v = 1 and h = 0 then 'PASS' else 'FAIL' end, v, h;
end $$;

-- =====================================================================
-- 2) 사장님 owner1 (샘플 2 의 사장님)
-- =====================================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-0000000000b1","role":"authenticated"}', true) as _claims \gset

do $$
declare n int; src text; ver timestamptz; ver2 timestamptz; src2 text;
begin
  insert into public.solo_menu_items (restaurant_id, name, solo_price, regular_price_per_person)
  values ('00000000-0000-0000-0000-000000000002', '테스트 메뉴', 12000, 11000);
  select source, last_verified_at into src, ver from public.solo_policies where restaurant_id = '00000000-0000-0000-0000-000000000002';
  raise notice '% owner1: 자기 식당 메뉴 추가 → 출처 owner_registered, 확인일 갱신 (%, %)',
    case when src = 'owner_registered' and ver > now() - interval '1 minute' then 'PASS' else 'FAIL' end, src, ver;

  begin
    insert into public.solo_menu_items (restaurant_id, name, solo_price) values ('00000000-0000-0000-0000-000000000001', 'x', 1000);
    raise notice 'FAIL owner1: 남의 식당 메뉴 추가가 허용됨';
  exception when insufficient_privilege then raise notice 'PASS owner1: 남의 식당 메뉴 추가 차단';
  end;
  update public.solo_menu_items set solo_price = 100 where restaurant_id = '00000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  raise notice '% owner1: 남의 식당 메뉴 수정 0행 (실제 %)', case when n = 0 then 'PASS' else 'FAIL' end, n;
  delete from public.solo_time_rules where restaurant_id = '00000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  raise notice '% owner1: 남의 식당 시간대 규칙 삭제 0행 (실제 %)', case when n = 0 then 'PASS' else 'FAIL' end, n;

  -- 메뉴 10개 한도 (현재 3개 → 7개 더 넣으면 10개, 11번째는 거부)
  insert into public.solo_menu_items (restaurant_id, name, solo_price)
  select '00000000-0000-0000-0000-000000000002', '추가 ' || g, 10000 from generate_series(1, 7) g;
  begin
    insert into public.solo_menu_items (restaurant_id, name, solo_price) values ('00000000-0000-0000-0000-000000000002', '11번째', 10000);
    raise notice 'FAIL owner1: 메뉴 11개째가 허용됨';
  exception when check_violation then raise notice 'PASS owner1: 메뉴 최대 10개 제한';
  end;
  -- 시간대 규칙 8개 한도 (현재 1개 → 7개 더, 9번째 거부)
  insert into public.solo_time_rules (restaurant_id, day_type, start_time, end_time, available)
  select '00000000-0000-0000-0000-000000000002', 'all', make_time(g, 0, 0), make_time(g, 30, 0), true from generate_series(1, 7) g;
  begin
    insert into public.solo_time_rules (restaurant_id, day_type, start_time, end_time, available)
    values ('00000000-0000-0000-0000-000000000002', 'all', '09:00', '10:00', true);
    raise notice 'FAIL owner1: 시간대 규칙 9개째가 허용됨';
  exception when check_violation then raise notice 'PASS owner1: 시간대 규칙 최대 8개 제한';
  end;

  -- 일시중단(is_active 만 변경) → 출처·확인일 유지
  select source, last_verified_at into src, ver from public.solo_policies where restaurant_id = '00000000-0000-0000-0000-000000000002';
  update public.solo_policies set is_active = false where restaurant_id = '00000000-0000-0000-0000-000000000002';
  select source, last_verified_at into src2, ver2 from public.solo_policies where restaurant_id = '00000000-0000-0000-0000-000000000002';
  raise notice '% owner1: 일시중단 토글은 출처·확인일 유지', case when src = src2 and ver = ver2 then 'PASS' else 'FAIL' end;
  update public.solo_policies set is_active = true where restaurant_id = '00000000-0000-0000-0000-000000000002';

  -- 출처를 직접 admin_checked 로 바꾸려 해도 서버가 덮어씀
  update public.solo_policies set source = 'admin_checked', time_slot_note = '변경' where restaurant_id = '00000000-0000-0000-0000-000000000002';
  select source into src from public.solo_policies where restaurant_id = '00000000-0000-0000-0000-000000000002';
  raise notice '% owner1: 출처 위조 불가 (결과 %)', case when src = 'owner_registered' then 'PASS' else 'FAIL' end, src;

  select count(*) into n from public.restaurant_daily_stats where restaurant_id = '00000000-0000-0000-0000-000000000002';
  raise notice '% owner1: 자기 식당 통계 읽기 (기대 7, 실제 %)', case when n = 7 then 'PASS' else 'FAIL' end, n;
  select count(*) into n from public.restaurant_daily_stats where restaurant_id <> '00000000-0000-0000-0000-000000000002';
  raise notice '% owner1: 남의 식당 통계 0행 (실제 %)', case when n = 0 then 'PASS' else 'FAIL' end, n;
  select count(*) into n from public.solo_confirmations;
  raise notice '% owner1: 확인 원본 행은 못 읽음 (실제 %)', case when n = 0 then 'PASS' else 'FAIL' end, n;

  begin
    insert into public.restaurant_claims (restaurant_id, owner_id) values ('00000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-0000000000b1');
    raise notice 'FAIL owner1: 이미 식당이 있는데 연결 요청이 허용됨';
  exception when insufficient_privilege then raise notice 'PASS owner1: 식당이 이미 있으면 연결 요청 불가';
  end;
end $$;
reset role;

-- =====================================================================
-- 3) 사장님 owner2, owner3 (아직 식당 없음) — 연결 요청
-- =====================================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-0000000000b2","role":"authenticated"}', true) as _claims \gset
do $$
declare n int;
begin
  insert into public.restaurant_claims (restaurant_id, owner_id) values ('00000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-0000000000b2');
  raise notice 'PASS owner2: 연결 안 된 식당에 연결 요청';
  begin
    insert into public.restaurant_claims (restaurant_id, owner_id) values ('00000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-0000000000b2');
    raise notice 'FAIL owner2: 대기 중 요청이 있는데 또 요청됨';
  exception when unique_violation then raise notice 'PASS owner2: 대기 중 요청은 하나만';
  end;
  begin
    insert into public.restaurant_claims (restaurant_id, owner_id) values ('00000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-0000000000b2');
    raise notice 'FAIL owner2: 이미 사장님이 있는 식당에 요청됨';
  exception when insufficient_privilege or unique_violation then raise notice 'PASS owner2: 이미 연결된 식당은 요청 불가';
  end;
  begin
    insert into public.restaurant_claims (restaurant_id, owner_id) values ('00000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-0000000000b3');
    raise notice 'FAIL owner2: 남의 이름으로 요청됨';
  exception when insufficient_privilege or unique_violation then raise notice 'PASS owner2: 다른 사람 명의 요청 불가';
  end;
  update public.restaurant_claims set status = 'approved' where owner_id = 'bbbbbbbb-0000-0000-0000-0000000000b2';
  get diagnostics n = row_count;
  raise notice '% owner2: 스스로 승인 불가 (변경 % 행)', case when n = 0 then 'PASS' else 'FAIL' end, n;
  select count(*) into n from public.restaurant_claims;
  raise notice '% owner2: 자기 요청만 보임 (실제 %)', case when n = 1 then 'PASS' else 'FAIL' end, n;
  begin
    insert into public.solo_menu_items (restaurant_id, name, solo_price) values ('00000000-0000-0000-0000-000000000001', 'x', 1000);
    raise notice 'FAIL owner2: 승인 전 메뉴 추가가 허용됨';
  exception when insufficient_privilege then raise notice 'PASS owner2: 승인 전에는 식당 메뉴 수정 불가';
  end;
end $$;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-0000000000b3","role":"authenticated"}', true) as _claims \gset
insert into public.restaurant_claims (restaurant_id, owner_id) values ('00000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-0000000000b3');
reset role;

-- =====================================================================
-- 4) 관리자
-- =====================================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true) as _claims \gset
do $$
declare n int; o uuid; st text; src text;
begin
  select count(*) into n from public.solo_confirmations;
  raise notice '% admin: 확인 원본 전체 읽기 (기대 10, 실제 %)', case when n = 10 then 'PASS' else 'FAIL' end, n;
  select count(*) into n from public.solo_menu_items;
  raise notice '% admin: 숨김 식당 메뉴 포함 전체 읽기 (기대 17 = 샘플 9 + owner1 추가 8, 실제 %)', case when n = 17 then 'PASS' else 'FAIL' end, n;

  update public.restaurant_claims set status = 'approved'
   where owner_id = 'bbbbbbbb-0000-0000-0000-0000000000b2' and status = 'pending';
  select owner_id into o from public.restaurants where id = '00000000-0000-0000-0000-000000000001';
  select status into st from public.restaurant_claims where owner_id = 'bbbbbbbb-0000-0000-0000-0000000000b3';
  raise notice '% admin: 승인 → 식당에 사장님 연결, 같은 식당 다른 요청은 거절 (owner=%, 다른 요청=%)',
    case when o = 'bbbbbbbb-0000-0000-0000-0000000000b2' and st = 'rejected' then 'PASS' else 'FAIL' end, o, st;
  begin
    update public.restaurant_claims set status = 'rejected' where owner_id = 'bbbbbbbb-0000-0000-0000-0000000000b2';
    raise notice 'FAIL admin: 처리된 요청 상태가 다시 바뀜';
  exception when check_violation then raise notice 'PASS admin: 처리된 요청은 다시 바꿀 수 없음';
  end;

  -- 관리자가 저장하면 admin_checked (사장님 등록 식당이라도)
  perform public.admin_save_restaurant('00000000-0000-0000-0000-000000000002', '(샘플) 한그릇 샤브', '경기도 안산시 단원구 광덕대로 100',
    37.3195, 126.8335, '031-000-0002', '샤브샤브', null, 'lunch', null, false, null,
    '[{"name":"소고기 샤브 1인 세트","solo_price":13000,"regular_price_per_person":12000,"normal_min_servings":2}]'::jsonb,
    '[{"day_type":"all","start_time":"11:00","end_time":"15:00","available":true}]'::jsonb);
  select source into src from public.solo_policies where restaurant_id = '00000000-0000-0000-0000-000000000002';
  select count(*) into n from public.solo_menu_items where restaurant_id = '00000000-0000-0000-0000-000000000002';
  raise notice '% admin: 저장 → admin_checked, 메뉴 목록 교체 (출처 %, 메뉴 %개)',
    case when src = 'admin_checked' and n = 1 then 'PASS' else 'FAIL' end, src, n;
  begin
    perform public.admin_save_restaurant(null, 'x', 'y', 37.3, 126.8, null, '기타', null, 'all_day', null, false, null, '[]'::jsonb, null);
    raise notice 'FAIL admin: 메뉴 없이 저장됨';
  exception when check_violation then raise notice 'PASS admin: 메뉴 0개면 저장 거부';
  end;
  select count(*) into n from public.restaurant_daily_stats;
  raise notice '% admin: 통계 전체 읽기 (실제 %행)', case when n >= 8 then 'PASS' else 'FAIL' end, n;
end $$;
reset role;

-- =====================================================================
-- 5) 서버 API (service_role)
-- =====================================================================
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true) as _claims \gset
do $$
declare n int;
begin
  insert into public.solo_confirmations (restaurant_id, result, visitor_hash)
  values ('00000000-0000-0000-0000-000000000002', 'ok', repeat('f', 64));
  raise notice 'PASS service_role: 확인 등록 가능';
  begin
    insert into public.solo_confirmations (restaurant_id, result, visitor_hash)
    values ('00000000-0000-0000-0000-000000000002', 'not_ok', repeat('f', 64));
    raise notice 'FAIL service_role: 같은 사람 같은 식당 하루 2회가 허용됨';
  exception when unique_violation then raise notice 'PASS service_role: 같은 해시·같은 식당 하루 1회 제한';
  end;
  insert into public.solo_confirmations (restaurant_id, result, visitor_hash, created_at)
  values ('00000000-0000-0000-0000-000000000002', 'ok', repeat('e', 64), now() - interval '100 days');
  select public.purge_old_confirmations() into n;
  raise notice '% service_role: 90일 지난 확인 삭제 (삭제 %행)', case when n = 1 then 'PASS' else 'FAIL' end, n;
end $$;
reset role;

-- =====================================================================
-- 6) 시간대 규칙 계산 (한국 시간 기준)
--   2026-11-02 = 월요일, 2026-11-07 = 토요일
-- =====================================================================
do $$
declare
  peak jsonb := '[{"day_type":"all","start_time":"11:30","end_time":"23:00","available":true},
                  {"day_type":"weekday","start_time":"18:00","end_time":"20:00","available":false}]';
  night jsonb := '[{"day_type":"weekday","start_time":"22:00","end_time":"02:00","available":true}]';
  allday jsonb := '[{"day_type":"weekend","start_time":"00:00","end_time":"00:00","available":true}]';
  procedure_ok boolean;
begin
  procedure_ok := public.solo_available_at(peak, '2026-11-02 12:00+09') = true;
  raise notice '% 규칙: 월 12:00 가능', case when procedure_ok then 'PASS' else 'FAIL' end;
  raise notice '% 규칙: 월 19:00 불가(겹치면 불가 우선)', case when public.solo_available_at(peak, '2026-11-02 19:00+09') = false then 'PASS' else 'FAIL' end;
  raise notice '% 규칙: 월 19:00 → 다시 가능 20:00 (%)',
    case when public.solo_next_available_at(peak, '2026-11-02 19:00+09') = '2026-11-02 20:00+09' then 'PASS' else 'FAIL' end,
    public.solo_next_available_at(peak, '2026-11-02 19:00+09') at time zone 'Asia/Seoul';
  raise notice '% 규칙: 토 19:00 가능(평일 규칙 미적용)', case when public.solo_available_at(peak, '2026-11-07 19:00+09') = true then 'PASS' else 'FAIL' end;
  raise notice '% 규칙: 월 09:00 불가, 다시 가능 11:30', case when public.solo_available_at(peak, '2026-11-02 09:00+09') = false
    and public.solo_next_available_at(peak, '2026-11-02 09:00+09') = '2026-11-02 11:30+09' then 'PASS' else 'FAIL' end;
  raise notice '% 규칙: 월 23:30 불가, 오늘 안에 다시 가능 없음(null)', case when public.solo_available_at(peak, '2026-11-02 23:30+09') = false
    and public.solo_next_available_at(peak, '2026-11-02 23:30+09') is null then 'PASS' else 'FAIL' end;
  raise notice '% 규칙: 자정 넘김 — 화 01:00 가능(월 22시 시작분)', case when public.solo_available_at(night, '2026-11-03 01:00+09') = true then 'PASS' else 'FAIL' end;
  raise notice '% 규칙: 자정 넘김 — 토 01:00 가능(금 22시 시작분)', case when public.solo_available_at(night, '2026-11-07 01:00+09') = true then 'PASS' else 'FAIL' end;
  raise notice '% 규칙: 자정 넘김 — 월 01:00 불가(일요일은 평일 아님)', case when public.solo_available_at(night, '2026-11-02 01:00+09') = false then 'PASS' else 'FAIL' end;
  raise notice '% 규칙: 시작=종료 → 하루 종일 (토 03:00 가능, 월 12:00 불가)', case when public.solo_available_at(allday, '2026-11-07 03:00+09') = true
    and public.solo_available_at(allday, '2026-11-02 12:00+09') = false then 'PASS' else 'FAIL' end;
  raise notice '% 규칙: 규칙 없음 → null', case when public.solo_available_at('[]'::jsonb) is null and public.solo_next_available_at('[]'::jsonb) is null then 'PASS' else 'FAIL' end;
end $$;

-- needs_review: 샘플 3 은 최근 14일 not_ok 3건
do $$
declare r record;
begin
  select * into r from public.confirmation_summaries(array['00000000-0000-0000-0000-000000000003']::uuid[]);
  raise notice '% 확인 집계: 샘플 3 needs_review (ok_30d=%, not_ok_30d=%, needs_review=%)',
    case when r.needs_review and r.not_ok_30d = 3 and r.ok_30d = 1 then 'PASS' else 'FAIL' end, r.ok_30d, r.not_ok_30d, r.needs_review;
  select * into r from public.confirmation_summaries(array['00000000-0000-0000-0000-000000000001']::uuid[]);
  raise notice '% 확인 집계: 샘플 1 정상 (ok_30d=%, not_ok_30d=%, needs_review=%)',
    case when not r.needs_review and r.ok_30d = 5 and r.not_ok_30d = 1 then 'PASS' else 'FAIL' end, r.ok_30d, r.not_ok_30d, r.needs_review;
end $$;

rollback;
