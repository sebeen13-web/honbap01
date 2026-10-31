-- 로컬 개발용 샘플 데이터 (supabase db reset 시 자동 실행)
-- 실제 식당이 아닌 가상의 데이터입니다. 위치: 경기도 안산시 중앙역 주변.
insert into public.restaurants (id, name, address, latitude, longitude, phone, category, business_hours) values
  ('00000000-0000-0000-0000-000000000001', '(샘플) 혼고기 중앙점', '경기도 안산시 단원구 중앙대로 900', 37.3168, 126.8390, '031-000-0001', '고깃집',
   '{"mon":{"open":"11:30","close":"23:00"},"tue":{"open":"11:30","close":"23:00"},"wed":{"open":"11:30","close":"23:00"},"thu":{"open":"11:30","close":"23:00"},"fri":{"open":"11:30","close":"02:00"},"sat":{"open":"11:30","close":"02:00"},"sun":null}'),
  ('00000000-0000-0000-0000-000000000002', '(샘플) 한그릇 샤브', '경기도 안산시 단원구 광덕대로 100', 37.3195, 126.8335, '031-000-0002', '샤브샤브',
   '{"mon":{"open":"11:00","close":"21:00"},"tue":{"open":"11:00","close":"21:00"},"wed":{"open":"11:00","close":"21:00"},"thu":{"open":"11:00","close":"21:00"},"fri":{"open":"11:00","close":"21:00"},"sat":{"open":"11:00","close":"21:00"},"sun":{"open":"11:00","close":"21:00"}}'),
  ('00000000-0000-0000-0000-000000000003', '(샘플) 1인 회센터', '경기도 안산시 상록구 용신로 200', 37.3010, 126.8460, null, '회', null),
  ('00000000-0000-0000-0000-000000000004', '(샘플) 일시중단 식당', '경기도 안산시 단원구 고잔로 50', 37.3170, 126.8380, null, '기타', null);

insert into public.solo_policies (restaurant_id, solo_menus, time_slot, time_slot_note, extra_fee, extra_fee_note, is_active, source) values
  ('00000000-0000-0000-0000-000000000001', array['삼겹살 1인분', '목살 1인분'], 'all_day', null, true, '1인 주문 시 상차림비 2,000원', true, 'admin_checked'),
  ('00000000-0000-0000-0000-000000000002', array['소고기 샤브 1인 세트'], 'lunch', null, false, null, true, 'owner_registered'),
  ('00000000-0000-0000-0000-000000000003', array['모둠회 소(1인)'], 'custom', '평일 14~17시만 1인 주문 가능', false, null, true, 'admin_checked'),
  ('00000000-0000-0000-0000-000000000004', array['정식'], 'all_day', null, false, null, false, 'owner_registered');
