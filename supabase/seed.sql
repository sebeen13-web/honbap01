-- 로컬 개발용 샘플 데이터 (supabase db reset 시 자동 실행)
-- 실제 식당이 아닌 가상의 데이터입니다. 위치: 경기도 안산시 중앙역 주변.
--
--   1 혼고기 중앙점  : 관리자 확인, 메뉴 3개, 평일 저녁 피크(18~20시) 1인분 불가 규칙, 확인 ok 다수
--   2 한그릇 샤브    : 사장님 등록, 점심만 가능, 최근 7일 통계
--   3 1인 회센터     : 관리자 확인, 평일 14~17시만, 최근 14일 '안 됐어요' 3건 → needs_review
--   4 일시중단 식당  : is_active = false (손님 화면에 안 보임)

insert into public.restaurants (id, name, address, latitude, longitude, phone, category, business_hours) values
  ('00000000-0000-0000-0000-000000000001', '(샘플) 혼고기 중앙점', '경기도 안산시 단원구 중앙대로 900', 37.3168, 126.8390, '031-000-0001', '고깃집',
   '{"mon":{"open":"11:30","close":"23:00"},"tue":{"open":"11:30","close":"23:00"},"wed":{"open":"11:30","close":"23:00"},"thu":{"open":"11:30","close":"23:00"},"fri":{"open":"11:30","close":"02:00"},"sat":{"open":"11:30","close":"02:00"},"sun":null}'),
  ('00000000-0000-0000-0000-000000000002', '(샘플) 한그릇 샤브', '경기도 안산시 단원구 광덕대로 100', 37.3195, 126.8335, '031-000-0002', '샤브샤브',
   '{"mon":{"open":"11:00","close":"21:00"},"tue":{"open":"11:00","close":"21:00"},"wed":{"open":"11:00","close":"21:00"},"thu":{"open":"11:00","close":"21:00"},"fri":{"open":"11:00","close":"21:00"},"sat":{"open":"11:00","close":"21:00"},"sun":{"open":"11:00","close":"21:00"}}'),
  ('00000000-0000-0000-0000-000000000003', '(샘플) 1인 회센터', '경기도 안산시 상록구 용신로 200', 37.3010, 126.8460, null, '회', null),
  ('00000000-0000-0000-0000-000000000004', '(샘플) 일시중단 식당', '경기도 안산시 단원구 고잔로 50', 37.3170, 126.8380, null, '기타', null);

insert into public.solo_policies (restaurant_id, time_slot, time_slot_note, extra_fee, extra_fee_note, is_active, source) values
  ('00000000-0000-0000-0000-000000000001', 'all_day', null, true, '1인분은 상차림비가 포함된 가격', true, 'admin_checked'),
  ('00000000-0000-0000-0000-000000000002', 'lunch', null, false, null, true, 'owner_registered'),
  ('00000000-0000-0000-0000-000000000003', 'custom', '평일 14~17시만 1인 주문 가능', false, null, true, 'admin_checked'),
  ('00000000-0000-0000-0000-000000000004', 'all_day', null, false, null, false, 'owner_registered');

-- 1인분 메뉴·가격 (regular_price_per_person = 보통 2인 이상 주문 시 1인당 가격)
insert into public.solo_menu_items (restaurant_id, name, solo_price, regular_price_per_person, normal_min_servings, note, sort_order) values
  ('00000000-0000-0000-0000-000000000001', '삼겹살 1인분(180g)', 18000, 16000, 2, null, 0),
  ('00000000-0000-0000-0000-000000000001', '목살 1인분(180g)', 18000, 16000, 2, null, 1),
  ('00000000-0000-0000-0000-000000000001', '된장찌개 정식', 9000, null, 1, '고기 주문 시 함께', 2),
  ('00000000-0000-0000-0000-000000000002', '소고기 샤브 1인 세트', 13000, 12000, 2, '칼국수 사리 포함', 0),
  ('00000000-0000-0000-0000-000000000002', '버섯 샤브 1인 세트', 11000, null, 2, null, 1),
  ('00000000-0000-0000-0000-000000000003', '모둠회 소(1인)', 25000, 22000, 2, null, 0),
  ('00000000-0000-0000-0000-000000000003', '광어 반접시', 18000, null, 2, '매운탕 별도', 1),
  ('00000000-0000-0000-0000-000000000004', '제육 정식', 10000, 9000, 2, null, 0),
  ('00000000-0000-0000-0000-000000000004', '백반 정식', 9000, 8000, 2, null, 1);

-- 시간대 규칙 (겹치면 '불가'가 우선)
insert into public.solo_time_rules (restaurant_id, day_type, start_time, end_time, available, note, sort_order) values
  ('00000000-0000-0000-0000-000000000001', 'all',     '11:30', '23:00', true,  null, 0),
  ('00000000-0000-0000-0000-000000000001', 'weekday', '18:00', '20:00', false, '평일 저녁 피크에는 2인 이상만', 1),
  ('00000000-0000-0000-0000-000000000002', 'all',     '11:00', '15:00', true,  '점심에만 1인 세트', 0),
  ('00000000-0000-0000-0000-000000000003', 'weekday', '14:00', '17:00', true,  null, 0),
  ('00000000-0000-0000-0000-000000000004', 'all',     '11:00', '21:00', true,  null, 0);

-- 원탭 확인 (visitor_hash 는 가짜 해시)
insert into public.solo_confirmations (restaurant_id, result, created_at, visitor_hash)
select '00000000-0000-0000-0000-000000000001', 'ok', now() - make_interval(days => n * 4), encode(sha256(('seed-1-' || n)::bytea), 'hex')
from generate_series(1, 5) as n;
insert into public.solo_confirmations (restaurant_id, result, created_at, visitor_hash) values
  ('00000000-0000-0000-0000-000000000001', 'not_ok', now() - interval '9 days',  encode(sha256('seed-1-x'::bytea), 'hex')),
  ('00000000-0000-0000-0000-000000000003', 'ok',     now() - interval '20 days', encode(sha256('seed-3-a'::bytea), 'hex')),
  ('00000000-0000-0000-0000-000000000003', 'not_ok', now() - interval '2 days',  encode(sha256('seed-3-b'::bytea), 'hex')),
  ('00000000-0000-0000-0000-000000000003', 'not_ok', now() - interval '5 days',  encode(sha256('seed-3-c'::bytea), 'hex')),
  ('00000000-0000-0000-0000-000000000003', 'not_ok', now() - interval '11 days', encode(sha256('seed-3-d'::bytea), 'hex'));

-- 사장님 통계 (최근 7일)
insert into public.restaurant_daily_stats (restaurant_id, day, views, directions_clicks, phone_taps)
select '00000000-0000-0000-0000-000000000002', ((now() at time zone 'Asia/Seoul')::date - n), 20 + n * 3, 4 + (n % 3), n % 2
from generate_series(0, 6) as n;

-- 마지막 확인일을 다양하게 (트리거가 now() 로 덮어쓰지 않도록 잠시 끈다)
alter table public.solo_policies disable trigger solo_policies_source;
update public.solo_policies set last_verified_at = now() - interval '3 days'  where restaurant_id = '00000000-0000-0000-0000-000000000001';
update public.solo_policies set last_verified_at = now() - interval '12 days' where restaurant_id = '00000000-0000-0000-0000-000000000002';
update public.solo_policies set last_verified_at = now() - interval '40 days' where restaurant_id = '00000000-0000-0000-0000-000000000003';
update public.solo_policies set last_verified_at = now() - interval '60 days' where restaurant_id = '00000000-0000-0000-0000-000000000004';
alter table public.solo_policies enable trigger solo_policies_source;
