-- =====================================================================
-- 5단계: 사장님
--   - owner_place_lookup()     : 카카오 장소로 "이미 조사된 식당인지 / 요청 수 / 내 연결 요청 상태" 확인
--   - owner_save_restaurant()  : 손님 계정에서 "내 식당 등록하기"(새 식당) 또는 내 식당 수정을 한 트랜잭션으로
--     · 등록하면 restaurants_promote_owner 트리거가 user → owner 로 승격
--     · 같은 kakao_place_id 요청은 link_requests_to_restaurant 트리거가 '등록됨'으로
--     · 출처는 solo_policies_set_source 트리거가 owner_registered 로 (관리자가 저장하면 admin_checked)
-- 기존 RLS(사장님 등록/수정 정책) 안에서 동작하도록 security invoker 로 둔다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 카카오 장소 조회 (로그인 사용자). 숨김 식당도 찾아야 하므로 security definer,
--    다른 사장님이 누구인지는 돌려주지 않는다(has_owner 만).
-- ---------------------------------------------------------------------
create or replace function public.owner_place_lookup(p_kakao_place_id text)
returns table (
  restaurant_id    uuid,
  restaurant_name  text,
  has_owner        boolean,
  is_mine          boolean,
  request_votes    int,
  request_status   text,
  my_claim_status  text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.name,
    r.owner_id is not null,
    r.owner_id is not distinct from auth.uid() and r.owner_id is not null,
    q.vote_count,
    q.status,
    (select c.status from public.restaurant_claims c
      where c.restaurant_id = r.id and c.owner_id = auth.uid()
      order by c.created_at desc limit 1)
  from (select btrim(coalesce(p_kakao_place_id, '')) as pid) x
  left join public.restaurants r on r.kakao_place_id = x.pid
  left join public.restaurant_requests q on q.kakao_place_id = x.pid
  where auth.uid() is not null and x.pid ~ '^[0-9]{1,20}$';
$$;

-- ---------------------------------------------------------------------
-- 2. 사장님 식당 저장 (p_id = null 이면 새로 등록, 아니면 내 식당 수정)
--    필수: 1인분 메뉴 1~10개, 시간대 규칙 1~8개. 위치·카카오 장소는 등록 때만 정한다.
-- ---------------------------------------------------------------------
create or replace function public.owner_save_restaurant(
  p_id             uuid,
  p_kakao_place_id text,
  p_name           text,
  p_address        text,
  p_latitude       double precision,
  p_longitude      double precision,
  p_phone          text,
  p_category       text,
  p_menus          jsonb,
  p_time_rules     jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  rid uuid;
  pid text := nullif(btrim(coalesce(p_kakao_place_id, '')), '');
begin
  if uid is null then
    raise exception '로그인이 필요해요.' using errcode = '42501';
  end if;
  if p_menus is null or jsonb_typeof(p_menus) <> 'array' or jsonb_array_length(p_menus) = 0 then
    raise exception '1인분 메뉴를 하나 이상 입력해 주세요.' using errcode = '23514';
  end if;
  if p_time_rules is null or jsonb_typeof(p_time_rules) <> 'array' or jsonb_array_length(p_time_rules) = 0 then
    raise exception '1인분 되는 시간을 하나 이상 입력해 주세요.' using errcode = '23514';
  end if;

  if p_id is null then
    if exists (select 1 from public.restaurants where owner_id = uid) then
      raise exception '이미 등록한 식당이 있어요. 사장님 화면에서 수정해 주세요.' using errcode = '23505', hint = 'already_owner';
    end if;
    if pid is not null and public.restaurant_place_taken(pid) then
      raise exception '이미 등록된 식당이에요. ‘내 식당으로 연결 요청’을 해 주세요.' using errcode = '23505', hint = 'place_taken';
    end if;

    insert into public.restaurants (name, address, latitude, longitude, phone, category, owner_id, kakao_place_id)
    values (btrim(p_name), btrim(p_address), p_latitude, p_longitude, nullif(btrim(coalesce(p_phone, '')), ''), p_category, uid, pid)
    returning id into rid;

    insert into public.solo_policies (restaurant_id, time_slot) values (rid, 'all_day');
  else
    update public.restaurants
       set name = btrim(p_name),
           phone = nullif(btrim(coalesce(p_phone, '')), ''),
           category = p_category
     where id = p_id and owner_id = uid
    returning id into rid;
    if rid is null then
      raise exception '내 식당만 수정할 수 있어요.' using errcode = '42501';
    end if;
    insert into public.solo_policies (restaurant_id, time_slot) values (rid, 'all_day')
      on conflict (restaurant_id) do nothing;
  end if;

  delete from public.solo_menu_items where restaurant_id = rid;
  insert into public.solo_menu_items
    (restaurant_id, name, solo_price, regular_price_per_person, normal_min_servings, note, sort_order)
  select rid, btrim(x.name), x.solo_price, x.regular_price_per_person, coalesce(x.normal_min_servings, 2),
         nullif(btrim(coalesce(x.note, '')), ''), (ord - 1)::smallint
  from rows from (
         jsonb_to_recordset(p_menus)
           as (name text, solo_price int, regular_price_per_person int, normal_min_servings smallint, note text)
       ) with ordinality as x(name, solo_price, regular_price_per_person, normal_min_servings, note, ord);

  delete from public.solo_time_rules where restaurant_id = rid;
  insert into public.solo_time_rules
    (restaurant_id, day_type, start_time, end_time, available, note, sort_order)
  select rid, x.day_type, x.start_time::time, x.end_time::time, x.available,
         nullif(btrim(coalesce(x.note, '')), ''), (ord - 1)::smallint
  from rows from (
         jsonb_to_recordset(p_time_rules)
           as (day_type text, start_time text, end_time text, available boolean, note text)
       ) with ordinality as x(day_type, start_time, end_time, available, note, ord);

  return rid;
end;
$$;

-- 이 카카오 장소로 이미 식당이 있는지 (숨김 식당 포함, security definer)
create or replace function public.restaurant_place_taken(p_kakao_place_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.restaurants where kakao_place_id = p_kakao_place_id);
$$;

-- ---------------------------------------------------------------------
-- 3. 권한
-- ---------------------------------------------------------------------
revoke execute on function public.owner_place_lookup(text) from public, anon;
grant execute on function public.owner_place_lookup(text) to authenticated;
revoke execute on function public.owner_save_restaurant(uuid, text, text, text, double precision, double precision, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.owner_save_restaurant(uuid, text, text, text, double precision, double precision, text, text, jsonb, jsonb) to authenticated;
revoke execute on function public.restaurant_place_taken(text) from public, anon;
grant execute on function public.restaurant_place_taken(text) to authenticated;
