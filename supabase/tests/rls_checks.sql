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
  ('bbbbbbbb-0000-0000-0000-0000000000b3', 'owner3@test.local'),
  ('cccccccc-0000-0000-0000-0000000000c1', 'guest1@test.local'),
  ('cccccccc-0000-0000-0000-0000000000c2', 'guest2@test.local'),
  ('dddddddd-0000-0000-0000-0000000000d1', 'req1@test.local'),
  ('dddddddd-0000-0000-0000-0000000000d2', 'req2@test.local'),
  ('eeeeeeee-0000-0000-0000-0000000000e1', 'newowner@test.local'),
  ('eeeeeeee-0000-0000-0000-0000000000e2', 'other@test.local');
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
    insert into public.solo_confirmations (restaurant_id, result, user_id)
    values ('00000000-0000-0000-0000-000000000001', 'ok', '00000000-0000-0000-0000-0000000000a1');
    raise notice 'FAIL anon: 확인 등록이 허용됨';
  exception when insufficient_privilege then raise notice 'PASS anon: 확인 등록 차단 (로그인 필요)';
  end;
  begin
    insert into public.reports (restaurant_id, reason) values ('00000000-0000-0000-0000-000000000001', '테스트');
    raise notice 'FAIL anon: 비로그인 제보가 허용됨';
  exception when insufficient_privilege then raise notice 'PASS anon: 제보 차단 (로그인 필요)';
  end;
  begin
    perform 1 from public.favorites;
    raise notice 'FAIL anon: 즐겨찾기 접근이 허용됨';
  exception when insufficient_privilege then raise notice 'PASS anon: 즐겨찾기 접근 차단';
  end;
  select count(*) into n from public.profiles;
  raise notice '% anon: 프로필 0행 (실제 %)', case when n = 0 then 'PASS' else 'FAIL' end, n;
  begin
    perform public.delete_my_account();
    raise notice 'FAIL anon: 탈퇴 함수 실행이 허용됨';
  exception when insufficient_privilege then raise notice 'PASS anon: 탈퇴 함수 차단';
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

  select role into src from public.profiles where id = 'bbbbbbbb-0000-0000-0000-0000000000b1';
  raise notice '% owner1: 식당이 연결되면 user → owner 자동 승격 (현재 %)', case when src = 'owner' then 'PASS' else 'FAIL' end, src;
  update public.profiles set role = 'admin' where id = 'bbbbbbbb-0000-0000-0000-0000000000b1';
  get diagnostics n = row_count;
  raise notice '% owner1: 자기 역할을 admin 으로 못 바꿈 (변경 % 행)', case when n = 0 then 'PASS' else 'FAIL' end, n;

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
  raise notice '% owner2: 승인 전에는 user (현재 %)',
    case when (select role from public.profiles where id = auth.uid()) = 'user' then 'PASS' else 'FAIL' end,
    (select role from public.profiles where id = auth.uid());
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
  select role into src from public.profiles where id = 'bbbbbbbb-0000-0000-0000-0000000000b2';
  raise notice '% admin: 연결 요청 승인 → owner2 가 owner 로 승격 (현재 %)', case when src = 'owner' then 'PASS' else 'FAIL' end, src;
  select role into src from public.profiles where id = 'bbbbbbbb-0000-0000-0000-0000000000b3';
  raise notice '% admin: 거절된 owner3 은 user 유지 (현재 %)', case when src = 'user' then 'PASS' else 'FAIL' end, src;
  select count(*) into n from public.reports;
  raise notice '% admin: 제보 읽기 가능', case when n >= 0 then 'PASS' else 'FAIL' end;
  begin
    perform public.delete_my_account();
    raise notice 'FAIL admin: 관리자 탈퇴가 허용됨';
  exception when insufficient_privilege then raise notice 'PASS admin: 관리자 계정은 탈퇴 불가(실수 방지)';
  end;
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
-- 5) 로그인 손님 guest1 (role = user)
-- =====================================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-0000000000c1","role":"authenticated"}', true) as _claims \gset
do $$
declare n int; r text; u uuid;
begin
  select role into r from public.profiles where id = auth.uid();
  raise notice '% guest1: 가입 기본 역할 = user (현재 %)', case when r = 'user' then 'PASS' else 'FAIL' end, r;
  select count(*) into n from public.profiles;
  raise notice '% guest1: 자기 프로필만 보임 (실제 %)', case when n = 1 then 'PASS' else 'FAIL' end, n;
  update public.profiles set role = 'owner' where id = auth.uid();
  get diagnostics n = row_count;
  raise notice '% guest1: 자기 역할을 owner 로 못 바꿈 (변경 % 행)', case when n = 0 then 'PASS' else 'FAIL' end, n;
  update public.profiles set role = 'admin' where id = auth.uid();
  get diagnostics n = row_count;
  raise notice '% guest1: 자기 역할을 admin 으로 못 바꿈 (변경 % 행)', case when n = 0 then 'PASS' else 'FAIL' end, n;

  -- 즐겨찾기
  insert into public.favorites (user_id, restaurant_id) values (auth.uid(), '00000000-0000-0000-0000-000000000001');
  raise notice 'PASS guest1: 즐겨찾기 추가';
  begin
    insert into public.favorites (user_id, restaurant_id) values (auth.uid(), '00000000-0000-0000-0000-000000000004');
    raise notice 'FAIL guest1: 숨김 식당 즐겨찾기가 허용됨';
  exception when insufficient_privilege then raise notice 'PASS guest1: 숨김 식당은 즐겨찾기 불가';
  end;
  begin
    insert into public.favorites (user_id, restaurant_id) values ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000001');
    raise notice 'FAIL guest1: 남의 즐겨찾기 추가가 허용됨';
  exception when insufficient_privilege then raise notice 'PASS guest1: 남의 명의 즐겨찾기 불가';
  end;
  select count(*) into n from public.favorites;
  raise notice '% guest1: 자기 즐겨찾기만 보임 (기대 1, 실제 %)', case when n = 1 then 'PASS' else 'FAIL' end, n;
  delete from public.favorites where user_id = '00000000-0000-0000-0000-0000000000a1';
  get diagnostics n = row_count;
  raise notice '% guest1: 남의 즐겨찾기 삭제 0행 (실제 %)', case when n = 0 then 'PASS' else 'FAIL' end, n;

  -- 원탭 확인 (4단계 버튼이 쓸 규칙)
  insert into public.solo_confirmations (restaurant_id, user_id, result) values ('00000000-0000-0000-0000-000000000001', auth.uid(), 'ok');
  raise notice 'PASS guest1: 확인 등록';
  begin
    insert into public.solo_confirmations (restaurant_id, user_id, result) values ('00000000-0000-0000-0000-000000000001', auth.uid(), 'not_ok');
    raise notice 'FAIL guest1: 같은 식당 하루 2회가 허용됨';
  exception when unique_violation then raise notice 'PASS guest1: 같은 식당 하루 1회 (user_id·한국 날짜 기준)';
  end;
  begin
    insert into public.solo_confirmations (restaurant_id, user_id, result, created_at, confirm_day)
    values ('00000000-0000-0000-0000-000000000001', auth.uid(), 'ok', now() - interval '3 days', current_date - 3);
    raise notice 'FAIL guest1: 날짜를 바꿔 하루 1회 제한을 우회함';
  exception when unique_violation then raise notice 'PASS guest1: 날짜·시각을 직접 넣어도 서버가 오늘로 고정';
  end;
  begin
    insert into public.solo_confirmations (restaurant_id, user_id, result)
    values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a5', 'not_ok');
    raise notice 'PASS guest1: (다른 사람 id 를 넣어도) 등록은 됨 → 아래에서 본인 명의로 저장됐는지 확인';
  exception when insufficient_privilege then raise notice 'PASS guest1: 남의 명의 확인 등록 차단';
  end;
  begin
    insert into public.solo_confirmations (restaurant_id, user_id, result) values ('00000000-0000-0000-0000-000000000004', auth.uid(), 'ok');
    raise notice 'FAIL guest1: 숨김 식당 확인이 허용됨';
  exception when insufficient_privilege then raise notice 'PASS guest1: 숨김 식당은 확인 불가';
  end;
  select count(*) into n from public.solo_confirmations;
  raise notice '% guest1: 확인 원본 행은 못 읽음(집계 함수로만) (실제 %)', case when n = 0 then 'PASS' else 'FAIL' end, n;

  -- 제보
  insert into public.reports (restaurant_id, reason, user_id) values ('00000000-0000-0000-0000-000000000001', '1인분 안 된대요', auth.uid());
  raise notice 'PASS guest1: 로그인 사용자 제보';
  begin
    insert into public.reports (restaurant_id, reason, user_id) values ('00000000-0000-0000-0000-000000000001', 'x', '00000000-0000-0000-0000-0000000000a5');
    raise notice 'FAIL guest1: 남의 명의 제보가 허용됨';
  exception when insufficient_privilege then raise notice 'PASS guest1: 남의 명의 제보 불가';
  end;
  select count(*) into n from public.reports;
  raise notice '% guest1: 제보 읽기 0행(관리자만) (실제 %)', case when n = 0 then 'PASS' else 'FAIL' end, n;

  -- 관리자 페이지용 데이터
  begin
    perform public.admin_save_restaurant(null, 'x', 'y', 37.3, 126.8, null, '기타', null, 'all_day', null, false, null,
      '[{"name":"a","solo_price":1000}]'::jsonb, null);
    raise notice 'FAIL guest1: 관리자 저장 함수가 허용됨';
  exception when insufficient_privilege then raise notice 'PASS guest1: 관리자 저장 함수 차단';
  end;
end $$;
reset role;

do $$
declare u uuid;
begin
  select user_id into u from public.solo_confirmations where restaurant_id = '00000000-0000-0000-0000-000000000002' order by created_at desc limit 1;
  raise notice '% guest1: 남의 id 로 넣은 확인도 본인 명의로 저장됨 (저장된 user_id=%)',
    case when u = 'cccccccc-0000-0000-0000-0000000000c1' then 'PASS' else 'FAIL' end, u;
end $$;

-- 사장님 등록 흐름: 손님이 자기 식당을 등록하면 owner 로 승격 (5단계 "내 식당 등록하기")
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-0000000000c2","role":"authenticated"}', true) as _claims \gset
do $$
declare r text;
begin
  insert into public.restaurants (name, address, latitude, longitude, category, owner_id)
  values ('(테스트) 손님이 등록한 식당', '경기도 안산시', 37.31, 126.83, '기타', auth.uid());
  select role into r from public.profiles where id = auth.uid();
  raise notice '% guest2: 내 식당 등록 → owner 승격 (현재 %)', case when r = 'owner' then 'PASS' else 'FAIL' end, r;
end $$;
reset role;

-- =====================================================================
-- 5-2) 회원 탈퇴
-- =====================================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-0000000000b1","role":"authenticated"}', true) as _claims \gset
do $$ begin perform public.delete_my_account(); end $$;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-0000000000c1","role":"authenticated"}', true) as _claims \gset
do $$ begin perform public.delete_my_account(); end $$;
reset role;
do $$
declare n int; o uuid;
begin
  select owner_id into o from public.restaurants where id = '00000000-0000-0000-0000-000000000002';
  raise notice '% 탈퇴(사장님 owner1): 식당 연결 해제, 식당은 남음 (owner_id=%)', case when o is null then 'PASS' else 'FAIL' end, o;
  select count(*) into n from auth.users where id in ('bbbbbbbb-0000-0000-0000-0000000000b1', 'cccccccc-0000-0000-0000-0000000000c1');
  raise notice '% 탈퇴: 계정 삭제 (남은 %)', case when n = 0 then 'PASS' else 'FAIL' end, n;
  select count(*) into n from public.profiles where id in ('bbbbbbbb-0000-0000-0000-0000000000b1', 'cccccccc-0000-0000-0000-0000000000c1');
  raise notice '% 탈퇴: 프로필 삭제 (남은 %)', case when n = 0 then 'PASS' else 'FAIL' end, n;
  select count(*) into n from public.favorites where user_id = 'cccccccc-0000-0000-0000-0000000000c1';
  raise notice '% 탈퇴: 즐겨찾기 삭제 (남은 %)', case when n = 0 then 'PASS' else 'FAIL' end, n;
  select count(*) into n from public.solo_confirmations where user_id = 'cccccccc-0000-0000-0000-0000000000c1';
  raise notice '% 탈퇴: 확인 기록 삭제 (남은 %)', case when n = 0 then 'PASS' else 'FAIL' end, n;
  select count(*) into n from public.reports where reason = '1인분 안 된대요' and user_id is null;
  raise notice '% 탈퇴: 제보 내용은 남고 작성자 연결만 끊김 (%건)', case when n = 1 then 'PASS' else 'FAIL' end, n;
end $$;

-- =====================================================================
-- 5-3) 서버 (service_role): 90일 정리
-- =====================================================================
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true) as _claims \gset
do $$
declare n int;
begin
  insert into public.solo_confirmations (restaurant_id, user_id, result, created_at)
  values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a5', 'ok', now() - interval '100 days');
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


-- =====================================================================
-- 7) 요청 / +1
-- =====================================================================
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true) as _claims \gset
do $$
declare n int;
begin
  select count(*) into n from public.list_restaurant_requests(37.3219, 126.8309, 'popular');
  raise notice '% anon: 요청 목록 읽기(등록됨 포함, 조사 완료 제외) (기대 3, 실제 %)', case when n = 3 then 'PASS' else 'FAIL' end, n;
  select count(*) into n from public.restaurant_requests;
  raise notice '% anon: 요청 테이블 읽기 (기대 4, 실제 %)', case when n = 4 then 'PASS' else 'FAIL' end, n;
  begin
    perform created_by from public.restaurant_requests;
    raise notice 'FAIL anon: 요청자(created_by)가 보임';
  exception when insufficient_privilege then raise notice 'PASS anon: 요청한 사람(created_by)은 비공개';
  end;
  begin
    perform 1 from public.restaurant_request_votes;
    raise notice 'FAIL anon: 투표 목록이 보임';
  exception when insufficient_privilege then raise notice 'PASS anon: 누가 +1 했는지 비공개';
  end;
  begin
    perform public.create_restaurant_request('9900000999', 'x', 'y', 37.3, 126.8, null);
    raise notice 'FAIL anon: 비로그인 요청 생성이 허용됨';
  exception when insufficient_privilege then raise notice 'PASS anon: 요청 생성은 로그인 필요';
  end;
  begin
    insert into public.restaurant_request_votes (user_id, request_id) values ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000b2');
    raise notice 'FAIL anon: 비로그인 +1 이 허용됨';
  exception when insufficient_privilege then raise notice 'PASS anon: +1 은 로그인 필요';
  end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-0000000000d1","role":"authenticated"}', true) as _claims \gset
do $$
declare j jsonb; n int; c int; rid uuid; r record;
begin
  j := public.create_restaurant_request('9900000201', '테스트 고깃집', '경기도 안산시', 37.31, 126.83, '고깃집');
  select vote_count into c from public.restaurant_requests where kakao_place_id = '9900000201';
  raise notice '% req1: 새 요청 → created, 요청 1명 (%, %)', case when j->>'result' = 'created' and c = 1 then 'PASS' else 'FAIL' end, j->>'result', c;
  j := public.create_restaurant_request('9900000201', '테스트 고깃집', '경기도 안산시', 37.31, 126.83, '고깃집');
  raise notice '% req1: 같은 식당 다시 요청 → already_voted (%)', case when j->>'result' = 'already_voted' then 'PASS' else 'FAIL' end, j->>'result';
  j := public.create_restaurant_request('9900000001', '(샘플) 혼고기 중앙점', '안산', 37.31, 126.83, null);
  raise notice '% req1: 이미 공개 중인 식당 → registered + 식당 id (%)', case when j->>'result' = 'registered' and j->>'restaurant_id' = '00000000-0000-0000-0000-000000000001' then 'PASS' else 'FAIL' end, j;
  j := public.create_restaurant_request('9900000103', 'x', 'y', 37.31, 126.83, null);
  raise notice '% req1: 조사 완료된 요청 → closed (%)', case when j->>'result' = 'closed' then 'PASS' else 'FAIL' end, j->>'result';
  j := public.create_restaurant_request('9900000102', '(샘플 요청) 바다횟집', 'y', 37.30, 126.84, '회');
  select vote_count into c from public.restaurant_requests where id = '00000000-0000-0000-0000-0000000000b2';
  raise notice '% req1: 이미 있는 요청 → voted, 2명 (%, %)', case when j->>'result' = 'voted' and c = 2 then 'PASS' else 'FAIL' end, j->>'result', c;

  begin
    insert into public.restaurant_requests (kakao_place_id, name, address, latitude, longitude) values ('9900000299', 'x', 'y', 37.3, 126.8);
    raise notice 'FAIL req1: 요청 테이블 직접 쓰기가 허용됨';
  exception when insufficient_privilege then raise notice 'PASS req1: 요청은 함수로만 생성(직접 쓰기 차단)';
  end;
  begin
    update public.restaurant_requests set vote_count = 999 where id = '00000000-0000-0000-0000-0000000000b2';
    raise notice 'FAIL req1: vote_count 조작이 허용됨';
  exception when insufficient_privilege then raise notice 'PASS req1: vote_count 직접 수정 불가';
  end;
  update public.restaurant_requests set status = 'closed' where id = '00000000-0000-0000-0000-0000000000b2';
  get diagnostics n = row_count;
  raise notice '% req1: 상태 변경 불가 (변경 % 행)', case when n = 0 then 'PASS' else 'FAIL' end, n;
  begin
    insert into public.restaurant_request_votes (user_id, request_id) values ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000b1');
    raise notice 'FAIL req1: 남의 명의 +1 이 허용됨';
  exception when insufficient_privilege then raise notice 'PASS req1: 남의 명의 +1 불가';
  end;
  begin
    insert into public.restaurant_request_votes (user_id, request_id) values (auth.uid(), '00000000-0000-0000-0000-0000000000b4');
    raise notice 'FAIL req1: 조사 완료 요청에 +1 이 허용됨';
  exception when insufficient_privilege then raise notice 'PASS req1: 열린 요청에만 +1';
  end;
  insert into public.restaurant_request_votes (user_id, request_id) values (auth.uid(), '00000000-0000-0000-0000-0000000000b1');
  select vote_count into c from public.restaurant_requests where id = '00000000-0000-0000-0000-0000000000b1';
  raise notice '% req1: +1 → 4명 (%)', case when c = 4 then 'PASS' else 'FAIL' end, c;
  delete from public.restaurant_request_votes where user_id = auth.uid() and request_id = '00000000-0000-0000-0000-0000000000b1';
  select vote_count into c from public.restaurant_requests where id = '00000000-0000-0000-0000-0000000000b1';
  raise notice '% req1: +1 취소 → 3명 (%)', case when c = 3 then 'PASS' else 'FAIL' end, c;
  select count(*) into n from public.restaurant_request_votes;
  raise notice '% req1: 자기 투표만 보임 (기대 2, 실제 %)', case when n = 2 then 'PASS' else 'FAIL' end, n;

  select * into r from public.place_request_status(array['9900000001', '9900000101', '9900000999']) where kakao_place_id = '9900000001';
  raise notice '% req1: 장소 상태 — 공개 식당이면 restaurant_id', case when r.restaurant_id = '00000000-0000-0000-0000-000000000001' then 'PASS' else 'FAIL' end;
  select * into r from public.place_request_status(array['9900000101']);
  raise notice '% req1: 장소 상태 — 요청 중 3명, 내가 안 누름', case when r.request_status = 'open' and r.vote_count = 3 and not r.i_voted then 'PASS' else 'FAIL' end;

  -- 하루 5개: 오늘 1개 만들었으니 4개 더, 6번째는 거부
  for i in 1..4 loop
    perform public.create_restaurant_request('99000003' || i::text, '테스트 ' || i, '안산', 37.31, 126.83, null);
  end loop;
  begin
    perform public.create_restaurant_request('9900000399', '6번째', '안산', 37.31, 126.83, null);
    raise notice 'FAIL req1: 하루 6번째 새 요청이 허용됨';
  exception when raise_exception then raise notice 'PASS req1: 새 요청 하루 5개 제한 (%)', sqlerrm;
  end;
  j := public.create_restaurant_request('9900000101', '(샘플 요청) 고기굽는집 중앙점', 'y', 37.31, 126.84, '고깃집');
  raise notice '% req1: 한도 후에도 기존 요청 +1 은 가능 (%)', case when j->>'result' = 'voted' then 'PASS' else 'FAIL' end, j->>'result';
  begin
    perform public.admin_link_request('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000003');
    raise notice 'FAIL req1: 일반 사용자가 연결 함수를 실행함';
  exception when insufficient_privilege then raise notice 'PASS req1: 요청 연결은 관리자만';
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-0000000000d2","role":"authenticated"}', true) as _claims \gset
do $$
declare n int;
begin
  select count(*) into n from public.restaurant_request_votes;
  raise notice '% req2: 다른 사람 투표는 안 보임 (실제 %)', case when n = 0 then 'PASS' else 'FAIL' end, n;
  select count(*) into n from public.list_restaurant_requests(null, null, 'popular') where i_voted;
  raise notice '% req2: 목록의 i_voted 는 본인 기준 (실제 %)', case when n = 0 then 'PASS' else 'FAIL' end, n;
end $$;
reset role;

-- 관리자: 상태 변경, 식당 등록/연결 시 요청 '등록됨'
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true) as _claims \gset
do $$
declare st text; rid uuid; newid uuid;
begin
  update public.restaurant_requests set status = 'closed' where kakao_place_id = '990000031';
  select status into st from public.restaurant_requests where kakao_place_id = '990000031';
  raise notice '% admin: 요청 조사 완료(closed) (%)', case when st = 'closed' then 'PASS' else 'FAIL' end, st;

  -- 같은 카카오 장소 id 로 식당 등록 → 요청 자동 '등록됨'
  newid := public.admin_save_restaurant(null, '바다횟집', '경기도 안산시 상록구 용신로 230', 37.3022, 126.8471, null, '회', null,
    'all_day', null, false, null, '[{"name":"모둠회 1인","solo_price":20000}]'::jsonb, null, '9900000102');
  select status, restaurant_id into st, rid from public.restaurant_requests where id = '00000000-0000-0000-0000-0000000000b2';
  raise notice '% admin: 같은 장소로 식당 등록 → 요청 등록됨 + 식당 연결 (%)', case when st = 'registered' and rid = newid then 'PASS' else 'FAIL' end, st;

  -- 장소 id 없는 식당에 요청 연결 → 식당에 장소 id 가 붙고 요청 등록됨
  newid := public.admin_save_restaurant(null, '고기굽는집', '경기도 안산시 단원구 중앙대로 920', 37.3175, 126.8402, null, '고깃집', null,
    'all_day', null, false, null, '[{"name":"삼겹 1인","solo_price":17000}]'::jsonb, null, null);
  perform public.admin_link_request('00000000-0000-0000-0000-0000000000b1', newid);
  select status, restaurant_id into st, rid from public.restaurant_requests where id = '00000000-0000-0000-0000-0000000000b1';
  raise notice '% admin: 요청을 기존 식당에 연결 → 등록됨 (%), 식당 장소 id=%', case when st = 'registered' and rid = newid then 'PASS' else 'FAIL' end, st,
    (select kakao_place_id from public.restaurants where id = newid);
  begin
    perform public.admin_save_restaurant(null, '중복', '안산', 37.31, 126.83, null, '기타', null,
      'all_day', null, false, null, '[{"name":"a","solo_price":1000}]'::jsonb, null, '9900000001');
    raise notice 'FAIL admin: 같은 카카오 장소로 식당이 두 번 등록됨';
  exception when unique_violation then raise notice 'PASS admin: 같은 카카오 장소 중복 등록 불가';
  end;
end $$;
reset role;

-- 탈퇴하면 그 사람의 +1 도 빠진다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-0000000000d1","role":"authenticated"}', true) as _claims \gset
do $$ begin perform public.delete_my_account(); end $$;
reset role;
do $$
declare c int;
begin
  select vote_count into c from public.restaurant_requests where id = '00000000-0000-0000-0000-0000000000b1';
  raise notice '% 탈퇴: 그 사람의 +1 이 빠짐 (b1 = %)', case when c = 3 then 'PASS' else 'FAIL' end, c;
end $$;


-- =====================================================================
-- 8) 사장님 등록 (손님 계정 → 내 식당 등록하기)
-- =====================================================================
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true) as _claims \gset
do $$ begin
  begin
    perform * from public.owner_place_lookup('9900000001');
    raise notice 'FAIL anon: 장소 조회가 허용됨';
  exception when insufficient_privilege then raise notice 'PASS anon: 사장님 장소 조회 차단';
  end;
  begin
    perform public.owner_save_restaurant(null, '9900000555', 'x', 'y', 37.31, 126.83, null, '기타',
      '[{"name":"a","solo_price":1000}]'::jsonb, '[{"day_type":"all","start_time":"11:00","end_time":"21:00","available":true}]'::jsonb);
    raise notice 'FAIL anon: 비로그인 식당 등록이 허용됨';
  exception when insufficient_privilege then raise notice 'PASS anon: 식당 등록은 로그인 필요';
  end;
end $$;
reset role;

-- 요청이 모인 새 장소 (newowner 가 등록할 곳)
insert into public.restaurant_requests (kakao_place_id, name, address, latitude, longitude, vote_count, created_by)
values ('9900000555', '새 사장님 식당', '경기도 안산시', 37.31, 126.83, 0, '00000000-0000-0000-0000-0000000000a1');
insert into public.restaurant_request_votes (user_id, request_id)
select u, (select id from public.restaurant_requests where kakao_place_id = '9900000555')
from unnest(array['00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2']::uuid[]) as u;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-0000000000e1","role":"authenticated"}', true) as _claims \gset
do $$
declare r record; rid uuid; st text; role_ text; src text; n int;
begin
  select * into r from public.owner_place_lookup('9900000555');
  raise notice '% newowner: 장소 조회 — 등록 전, 요청 2명 (restaurant=%, votes=%)',
    case when r.restaurant_id is null and r.request_votes = 2 then 'PASS' else 'FAIL' end, r.restaurant_id, r.request_votes;
  select * into r from public.owner_place_lookup('9900000004');
  raise notice '% newowner: 숨김 식당도 "이미 조사된 식당"으로 찾음, 다른 사장님 정보는 없음 (has_owner=%)',
    case when r.restaurant_id = '00000000-0000-0000-0000-000000000004' and r.has_owner = false then 'PASS' else 'FAIL' end, r.has_owner;

  begin
    perform public.owner_save_restaurant(null, '9900000555', '새 사장님 식당', '경기도 안산시', 37.31, 126.83, null, '기타',
      '[{"name":"정식 1인","solo_price":9000}]'::jsonb, '[]'::jsonb);
    raise notice 'FAIL newowner: 시간 규칙 없이 등록됨';
  exception when check_violation then raise notice 'PASS newowner: 시간대 규칙 1개 이상 필수';
  end;
  begin
    perform public.owner_save_restaurant(null, '9900000001', '혼고기', '안산', 37.31, 126.83, null, '고깃집',
      '[{"name":"a","solo_price":9000}]'::jsonb, '[{"day_type":"all","start_time":"11:00","end_time":"21:00","available":true}]'::jsonb);
    raise notice 'FAIL newowner: 이미 있는 식당을 새로 등록함';
  exception when unique_violation then raise notice 'PASS newowner: 이미 등록된 장소는 새 등록 불가(연결 요청으로)';
  end;

  rid := public.owner_save_restaurant(null, '9900000555', '새 사장님 식당', '경기도 안산시 단원구', 37.31, 126.83, '031-555-0000', '기타',
    '[{"name":"정식 1인","solo_price":9000,"regular_price_per_person":8000}]'::jsonb,
    '[{"day_type":"all","start_time":"11:00","end_time":"21:00","available":true}]'::jsonb);
  select role into role_ from public.profiles where id = auth.uid();
  select status into st from public.restaurant_requests where kakao_place_id = '9900000555';
  select source into src from public.solo_policies where restaurant_id = rid;
  raise notice '% newowner: 등록 → owner 승격(%), 요청 등록됨(%), 출처 %',
    case when role_ = 'owner' and st = 'registered' and src = 'owner_registered' then 'PASS' else 'FAIL' end, role_, st, src;
  select count(*) into n from public.nearby_restaurants(37.31, 126.83, 1000) where id = rid;
  raise notice '% newowner: 등록 즉시 손님 화면에 공개 (%)', case when n = 1 then 'PASS' else 'FAIL' end, n;

  begin
    perform public.owner_save_restaurant(null, '9900000556', '두번째', '안산', 37.31, 126.83, null, '기타',
      '[{"name":"a","solo_price":9000}]'::jsonb, '[{"day_type":"all","start_time":"11:00","end_time":"21:00","available":true}]'::jsonb);
    raise notice 'FAIL newowner: 식당 두 개 등록됨';
  exception when unique_violation then raise notice 'PASS newowner: 사장님 한 명당 식당 하나';
  end;

  -- 수정: 메뉴·규칙 교체, 위치는 그대로
  perform public.owner_save_restaurant(rid, null, '새 사장님 식당(수정)', '무시됨', 0, 0, null, '고깃집',
    '[{"name":"정식 1인","solo_price":9500},{"name":"제육 1인","solo_price":10000}]'::jsonb,
    '[{"day_type":"weekday","start_time":"11:00","end_time":"15:00","available":true}]'::jsonb);
  select count(*) into n from public.solo_menu_items where restaurant_id = rid;
  raise notice '% newowner: 내 식당 수정(메뉴 2개, 주소·위치 유지) (메뉴 %개, 주소 %)',
    case when n = 2 and (select address from public.restaurants where id = rid) = '경기도 안산시 단원구' then 'PASS' else 'FAIL' end, n,
    (select address from public.restaurants where id = rid);
  begin
    perform public.owner_save_restaurant('00000000-0000-0000-0000-000000000001', null, '남의 식당', 'x', 0, 0, null, '기타',
      '[{"name":"a","solo_price":9000}]'::jsonb, '[{"day_type":"all","start_time":"11:00","end_time":"21:00","available":true}]'::jsonb);
    raise notice 'FAIL newowner: 남의 식당 수정이 허용됨';
  exception when insufficient_privilege then raise notice 'PASS newowner: 남의 식당은 수정 불가';
  end;
  select count(*) into n from public.restaurant_daily_stats where restaurant_id = rid;
  raise notice 'PASS newowner: 자기 식당 통계 읽기 가능 (%행)', n;
end $$;

-- 다른 손님: 이미 사장님이 있는 식당 조회 → has_owner, 누구인지는 모름
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-0000000000e2","role":"authenticated"}', true) as _claims \gset
do $$
declare r record;
begin
  select * into r from public.owner_place_lookup('9900000555');
  raise notice '% other: 사장님 있는 식당 → has_owner=true, is_mine=false', case when r.has_owner and not r.is_mine then 'PASS' else 'FAIL' end;
end $$;
reset role;


-- =====================================================================
-- 9) 음식 종류 (15개)
-- =====================================================================
do $$
declare n int;
begin
  select cardinality(public.valid_categories()) into n;
  raise notice '% 음식 종류 15개 (%)', case when n = 15 then 'PASS' else 'FAIL' end, n;
  insert into public.restaurants (name, address, latitude, longitude, category) values ('종류 테스트', '안산', 37.31, 126.83, '국밥·순대');
  raise notice 'PASS 새 음식 종류(국밥·순대) 저장 가능';
  begin
    insert into public.restaurants (name, address, latitude, longitude, category) values ('종류 테스트2', '안산', 37.31, 126.83, '피자');
    raise notice 'FAIL 목록에 없는 종류가 저장됨';
  exception when check_violation then raise notice 'PASS 목록에 없는 종류는 거부';
  end;
end $$;

rollback;
