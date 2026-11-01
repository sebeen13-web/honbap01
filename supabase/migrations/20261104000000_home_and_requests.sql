-- =====================================================================
-- 홈 / 요청 탭
--   - restaurants.kakao_place_id : 카카오 장소 id (요청과 식당을 잇는 열쇠)
--   - restaurant_requests        : "여기도 1인분 되게 해주세요" 요청 (누구나 읽기)
--   - restaurant_request_votes   : 요청 +1 (본인 것만 보임 — 누가 눌렀는지 공개하지 않음)
--   - 요청 만들기는 create_restaurant_request() 로만 (로그인, 하루 5개, 등록된 식당 차단)
--   - 같은 kakao_place_id 로 식당이 등록/연결되면 요청이 자동으로 '등록됨'
--   - nearby_restaurants 에 created_at(등록일) 추가 — 홈의 '새로 등록된 곳'
-- 손님 위치는 여전히 함수 인자로만 받고 저장하지 않는다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. restaurants.kakao_place_id
-- ---------------------------------------------------------------------
alter table public.restaurants
  add column kakao_place_id text unique check (kakao_place_id is null or kakao_place_id ~ '^[0-9]{1,20}$');

-- ---------------------------------------------------------------------
-- 2. 요청 / 투표
-- ---------------------------------------------------------------------
create table public.restaurant_requests (
  id             uuid primary key default gen_random_uuid(),
  kakao_place_id text not null unique check (kakao_place_id ~ '^[0-9]{1,20}$'),
  name           text not null check (char_length(btrim(name)) between 1 and 100),
  address        text not null check (char_length(btrim(address)) between 1 and 200),
  latitude       double precision not null check (latitude  between 33 and 39),
  longitude      double precision not null check (longitude between 124 and 132),
  category       text check (category is null or category in ('고깃집', '샤브샤브', '회', '기타')),
  status         text not null default 'open' check (status in ('open', 'registered', 'closed')),
  vote_count     integer not null default 1 check (vote_count >= 0),
  restaurant_id  uuid references public.restaurants (id) on delete set null,
  created_at     timestamptz not null default now(),
  -- 하루 5개 제한 검사용. 공개하지 않는다(아래 컬럼 권한에서 제외).
  created_by     uuid references auth.users (id) on delete set null
);
create index restaurant_requests_votes_idx on public.restaurant_requests (vote_count desc, created_at desc) where status <> 'closed';
create index restaurant_requests_creator_idx on public.restaurant_requests (created_by, created_at);

create table public.restaurant_request_votes (
  user_id    uuid not null references auth.users (id) on delete cascade,
  request_id uuid not null references public.restaurant_requests (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
create index restaurant_request_votes_request_idx on public.restaurant_request_votes (request_id);

-- 투표가 바뀌면 vote_count 를 실제 투표 수로 다시 센다
create or replace function public.recount_request_votes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rid uuid := coalesce(new.request_id, old.request_id);
begin
  if tg_op = 'DELETE' then
    rid := old.request_id;
  end if;
  update public.restaurant_requests
     set vote_count = (select count(*) from public.restaurant_request_votes v where v.request_id = rid)
   where id = rid;
  return null;
end;
$$;

create trigger restaurant_request_votes_recount
  after insert or delete on public.restaurant_request_votes
  for each row execute function public.recount_request_votes();

-- 같은 카카오 장소로 식당이 등록·연결되면 요청을 '등록됨'으로
create or replace function public.link_requests_to_restaurant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kakao_place_id is not null
     and (tg_op = 'INSERT' or new.kakao_place_id is distinct from old.kakao_place_id) then
    update public.restaurant_requests
       set status = 'registered', restaurant_id = new.id
     where kakao_place_id = new.kakao_place_id;
  end if;
  return null;
end;
$$;

create trigger restaurants_link_requests
  after insert or update of kakao_place_id on public.restaurants
  for each row execute function public.link_requests_to_restaurant();

-- ---------------------------------------------------------------------
-- 3. RLS + 컬럼 권한
-- ---------------------------------------------------------------------
alter table public.restaurant_requests      enable row level security;
alter table public.restaurant_request_votes enable row level security;

-- 요청: 누구나 읽기(created_by 제외), 관리자만 상태 변경. 만들기는 함수로만.
revoke all on public.restaurant_requests from anon, authenticated;
grant select (id, kakao_place_id, name, address, latitude, longitude, category, status, vote_count, restaurant_id, created_at)
  on public.restaurant_requests to anon, authenticated;
grant update (status, restaurant_id) on public.restaurant_requests to authenticated;
grant delete on public.restaurant_requests to authenticated;

create policy "restaurant_requests: 누구나 읽기" on public.restaurant_requests
  for select to anon, authenticated using (true);
create policy "restaurant_requests: 관리자 상태 변경" on public.restaurant_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "restaurant_requests: 관리자 삭제" on public.restaurant_requests
  for delete to authenticated using (public.is_admin());

-- 투표: 본인 것만 보기/추가/취소. 열려 있는 요청에만 +1.
revoke all on public.restaurant_request_votes from anon;
revoke update on public.restaurant_request_votes from authenticated;
create policy "restaurant_request_votes: 본인 조회" on public.restaurant_request_votes
  for select to authenticated using (user_id = auth.uid());
create policy "restaurant_request_votes: 본인 +1" on public.restaurant_request_votes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.restaurant_requests q where q.id = request_id and q.status = 'open')
  );
create policy "restaurant_request_votes: 본인 취소" on public.restaurant_request_votes
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 4. 요청 만들기 (로그인, 하루 5개, 이미 공개 중인 식당은 차단, 이미 있는 요청이면 +1)
--   반환: {"result": "created" | "voted" | "already_voted" | "registered" | "closed", request_id, restaurant_id}
-- ---------------------------------------------------------------------
create or replace function public.create_restaurant_request(
  p_kakao_place_id text,
  p_name           text,
  p_address        text,
  p_latitude       double precision,
  p_longitude      double precision,
  p_category       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid      uuid := auth.uid();
  pid      text := btrim(coalesce(p_kakao_place_id, ''));
  rest_id  uuid;
  req      public.restaurant_requests%rowtype;
  n_today  int;
  new_id   uuid;
begin
  if uid is null then
    raise exception '로그인이 필요해요.' using errcode = '42501';
  end if;
  if pid !~ '^[0-9]{1,20}$' then
    raise exception '카카오 장소 정보가 올바르지 않아요.' using errcode = '22023';
  end if;

  -- 이미 1인분 식당으로 공개 중이면 요청 대신 상세로
  select r.id into rest_id
    from public.restaurants r
   where r.kakao_place_id = pid and public.restaurant_is_public(r.id);
  if rest_id is not null then
    return jsonb_build_object('result', 'registered', 'restaurant_id', rest_id);
  end if;

  select * into req from public.restaurant_requests where kakao_place_id = pid;
  if found then
    if req.status <> 'open' then
      return jsonb_build_object('result', req.status, 'request_id', req.id, 'restaurant_id', req.restaurant_id);
    end if;
    insert into public.restaurant_request_votes (user_id, request_id) values (uid, req.id)
      on conflict do nothing;
    return jsonb_build_object('result', case when found then 'voted' else 'already_voted' end, 'request_id', req.id);
  end if;

  -- 새 요청: 하루(한국 날짜) 5개까지
  perform pg_advisory_xact_lock(hashtextextended('restaurant_request:' || uid::text, 0));
  select count(*) into n_today
    from public.restaurant_requests
   where created_by = uid
     and (created_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date;
  if n_today >= 5 then
    raise exception '새 요청은 하루에 5개까지 만들 수 있어요. 내일 다시 요청해 주세요.'
      using errcode = 'P0001', hint = 'daily_limit';
  end if;

  if p_category is not null and p_category not in ('고깃집', '샤브샤브', '회', '기타') then
    p_category := null;
  end if;

  begin
    insert into public.restaurant_requests
      (kakao_place_id, name, address, latitude, longitude, category, vote_count, created_by)
    values
      (pid, btrim(p_name), btrim(p_address), p_latitude, p_longitude, p_category, 0, uid)
    returning id into new_id;
  exception when unique_violation then
    -- 동시에 같은 식당이 요청된 경우: +1 로 처리
    select id into new_id from public.restaurant_requests where kakao_place_id = pid;
    insert into public.restaurant_request_votes (user_id, request_id) values (uid, new_id) on conflict do nothing;
    return jsonb_build_object('result', 'voted', 'request_id', new_id);
  end;

  insert into public.restaurant_request_votes (user_id, request_id) values (uid, new_id);
  return jsonb_build_object('result', 'created', 'request_id', new_id);
end;
$$;

-- 현재 로그인 사용자가 이 요청에 +1 했는지 (비로그인은 false). 투표 테이블을 직접 열지 않고 답만 준다.
create or replace function public.i_voted_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.restaurant_request_votes v
    where v.request_id = p_request_id and v.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------
-- 5. 검색 결과(카카오 장소 id 여러 개)의 상태: 등록된 식당 / 요청 / 내가 +1 했는지
-- ---------------------------------------------------------------------
create or replace function public.place_request_status(p_kakao_place_ids text[])
returns table (
  kakao_place_id text,
  restaurant_id  uuid,
  request_id     uuid,
  request_status text,
  vote_count     int,
  i_voted        boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    x.pid,
    (select r.id from public.restaurants r
      where r.kakao_place_id = x.pid and public.restaurant_is_public(r.id)),
    q.id,
    q.status,
    q.vote_count,
    case when q.id is null then false else public.i_voted_request(q.id) end
  from unnest(p_kakao_place_ids[1:50]) as x(pid)
  left join public.restaurant_requests q on q.kakao_place_id = x.pid;
$$;

-- ---------------------------------------------------------------------
-- 6. 요청 목록 (인기순 / 내 근처순). 좌표는 정렬용 인자로만 받는다.
-- ---------------------------------------------------------------------
create or replace function public.list_restaurant_requests(
  p_lat   double precision default null,
  p_lng   double precision default null,
  p_sort  text default 'popular',
  p_limit int default 50
)
returns table (
  id             uuid,
  kakao_place_id text,
  name           text,
  address        text,
  latitude       double precision,
  longitude      double precision,
  category       text,
  status         text,
  vote_count     int,
  restaurant_id  uuid,
  created_at     timestamptz,
  distance_m     double precision,
  i_voted        boolean
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with o as (
    select case
      when p_lat between -90 and 90 and p_lng between -180 and 180
      then st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
    end as g
  )
  select
    q.id, q.kakao_place_id, q.name, q.address, q.latitude, q.longitude, q.category, q.status, q.vote_count,
    q.restaurant_id, q.created_at,
    case when o.g is not null
      then st_distance(st_setsrid(st_makepoint(q.longitude, q.latitude), 4326)::geography, o.g) end as distance_m,
    public.i_voted_request(q.id) as i_voted
  from public.restaurant_requests q, o
  where q.status in ('open', 'registered')
  order by
    case when p_sort = 'near' and o.g is not null
      then st_distance(st_setsrid(st_makepoint(q.longitude, q.latitude), 4326)::geography, o.g) end asc nulls last,
    q.vote_count desc,
    q.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

-- ---------------------------------------------------------------------
-- 7. 관리자: 요청을 기존 식당에 연결
-- ---------------------------------------------------------------------
create or replace function public.admin_link_request(p_request_id uuid, p_restaurant_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  req_pid  text;
  rest_pid text;
begin
  if not public.is_admin() then
    raise exception '관리자만 연결할 수 있어요.' using errcode = '42501';
  end if;
  select kakao_place_id into req_pid from public.restaurant_requests where id = p_request_id;
  if not found then
    raise exception '요청을 찾을 수 없어요.' using errcode = 'P0002';
  end if;
  select kakao_place_id into rest_pid from public.restaurants where id = p_restaurant_id;
  if not found then
    raise exception '식당을 찾을 수 없어요.' using errcode = 'P0002';
  end if;

  if rest_pid is null then
    -- 식당에 카카오 장소 id 를 붙이면 트리거가 요청을 '등록됨'으로 바꾼다
    update public.restaurants set kakao_place_id = req_pid where id = p_restaurant_id;
  elsif rest_pid = req_pid then
    update public.restaurant_requests set status = 'registered', restaurant_id = p_restaurant_id where id = p_request_id;
  else
    -- 식당이 이미 다른 카카오 장소와 연결된 경우(이전 등): 요청만 연결
    update public.restaurant_requests set status = 'registered', restaurant_id = p_restaurant_id where id = p_request_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. nearby_restaurants: created_at(등록일) 추가 (반환 형식이 바뀌므로 다시 만든다)
-- ---------------------------------------------------------------------
drop function public.nearby_restaurants(double precision, double precision, int);
create function public.nearby_restaurants(
  user_lat double precision,
  user_lng double precision,
  radius_m int default 3000
)
returns table (
  id                    uuid,
  name                  text,
  address               text,
  latitude              double precision,
  longitude             double precision,
  phone                 text,
  category              text,
  distance_m            double precision,
  time_slot             text,
  time_slot_note        text,
  extra_fee             boolean,
  extra_fee_note        text,
  source                text,
  last_verified_at      timestamptz,
  business_hours        jsonb,
  is_open_now           boolean,
  menus                 jsonb,
  min_solo_price        int,
  normal_min_servings   int,
  is_solo_available_now boolean,
  next_available_at     timestamptz,
  time_rules            jsonb,
  ok_30d                int,
  not_ok_30d            int,
  last_ok_at            timestamptz,
  needs_review          boolean,
  created_at            timestamptz
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with origin as (
    select st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography as g
    where user_lat between -90 and 90
      and user_lng between -180 and 180
  ),
  base as (
    select
      r.id, r.name, r.address, r.latitude, r.longitude, r.phone, r.category, r.business_hours, r.created_at,
      st_distance(r.location, o.g) as distance_m,
      p.time_slot, p.time_slot_note, p.extra_fee, p.extra_fee_note, p.source, p.last_verified_at
    from origin o
    join public.restaurants r
      on st_dwithin(r.location, o.g, least(greatest(coalesce(radius_m, 3000), 100), 10000))
    join public.solo_policies p
      on p.restaurant_id = r.id and p.is_active
    order by distance_m asc
    limit 200
  )
  select
    b.id, b.name, b.address, b.latitude, b.longitude, b.phone, b.category, b.distance_m,
    b.time_slot, b.time_slot_note, b.extra_fee, b.extra_fee_note, b.source, b.last_verified_at,
    b.business_hours,
    public.is_open_now(b.business_hours),
    coalesce(m.menus, '[]'::jsonb),
    m.min_solo_price,
    m.normal_min_servings,
    public.solo_available_at(t.rules),
    public.solo_next_available_at(t.rules),
    coalesce(t.rules, '[]'::jsonb),
    coalesce(c.ok_30d, 0),
    coalesce(c.not_ok_30d, 0),
    c.last_ok_at,
    coalesce(c.needs_review, false),
    b.created_at
  from base b
  left join lateral (
    select
      jsonb_agg(
        jsonb_build_object(
          'name', mi.name,
          'solo_price', mi.solo_price,
          'regular_price_per_person', mi.regular_price_per_person,
          'normal_min_servings', mi.normal_min_servings,
          'note', mi.note,
          'sort_order', mi.sort_order
        )
        order by mi.sort_order, mi.created_at
      ) as menus,
      min(mi.solo_price)::int          as min_solo_price,
      max(mi.normal_min_servings)::int as normal_min_servings
    from public.solo_menu_items mi
    where mi.restaurant_id = b.id
  ) m on true
  left join lateral (
    select
      jsonb_agg(
        jsonb_build_object(
          'day_type', tr.day_type,
          'start_time', to_char(tr.start_time, 'HH24:MI'),
          'end_time', to_char(tr.end_time, 'HH24:MI'),
          'available', tr.available,
          'note', tr.note
        )
        order by tr.sort_order, tr.start_time
      ) as rules
    from public.solo_time_rules tr
    where tr.restaurant_id = b.id
  ) t on true
  left join lateral public.confirmation_summaries(array[b.id]) c on true
  order by b.distance_m asc;
$$;

grant execute on function public.nearby_restaurants(double precision, double precision, int) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 9. 관리자 식당 저장: 카카오 장소 id 도 저장
-- ---------------------------------------------------------------------
drop function public.admin_save_restaurant(
  uuid, text, text, double precision, double precision, text, text, jsonb, text, text, boolean, text, jsonb, jsonb
);
create function public.admin_save_restaurant(
  p_id             uuid,
  p_name           text,
  p_address        text,
  p_latitude       double precision,
  p_longitude      double precision,
  p_phone          text,
  p_category       text,
  p_business_hours jsonb,
  p_time_slot      text,
  p_time_slot_note text,
  p_extra_fee      boolean,
  p_extra_fee_note text,
  p_menus          jsonb,
  p_time_rules     jsonb,
  p_kakao_place_id text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  rid uuid;
begin
  if not public.is_admin() then
    raise exception '관리자만 식당을 등록·수정할 수 있습니다.' using errcode = '42501';
  end if;
  if p_menus is null or jsonb_typeof(p_menus) <> 'array' or jsonb_array_length(p_menus) = 0 then
    raise exception '1인분 메뉴를 하나 이상 입력해 주세요.' using errcode = '23514';
  end if;
  if p_time_rules is not null and jsonb_typeof(p_time_rules) <> 'array' then
    raise exception '시간대 규칙 형식이 올바르지 않습니다.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.restaurants (name, address, latitude, longitude, phone, category, business_hours, kakao_place_id)
    values (btrim(p_name), btrim(p_address), p_latitude, p_longitude, p_phone, p_category, p_business_hours,
            nullif(btrim(coalesce(p_kakao_place_id, '')), ''))
    returning id into rid;
  else
    update public.restaurants
       set name = btrim(p_name),
           address = btrim(p_address),
           latitude = p_latitude,
           longitude = p_longitude,
           phone = p_phone,
           category = p_category,
           business_hours = p_business_hours,
           kakao_place_id = nullif(btrim(coalesce(p_kakao_place_id, '')), '')
     where id = p_id
    returning id into rid;

    if rid is null then
      raise exception '식당을 찾을 수 없습니다.' using errcode = 'P0002';
    end if;
  end if;

  insert into public.solo_policies
    (restaurant_id, time_slot, time_slot_note, extra_fee, extra_fee_note, source)
  values
    (rid, p_time_slot, p_time_slot_note, p_extra_fee, p_extra_fee_note, 'admin_checked')
  on conflict (restaurant_id) do update
    set time_slot      = excluded.time_slot,
        time_slot_note = excluded.time_slot_note,
        extra_fee      = excluded.extra_fee,
        extra_fee_note = excluded.extra_fee_note;
  -- is_active(숨김)는 건드리지 않는다.

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
  if p_time_rules is not null then
    insert into public.solo_time_rules
      (restaurant_id, day_type, start_time, end_time, available, note, sort_order)
    select rid, x.day_type, x.start_time::time, x.end_time::time, x.available,
           nullif(btrim(coalesce(x.note, '')), ''), (ord - 1)::smallint
    from rows from (
           jsonb_to_recordset(p_time_rules)
             as (day_type text, start_time text, end_time text, available boolean, note text)
         ) with ordinality as x(day_type, start_time, end_time, available, note, ord);
  end if;

  return rid;
end;
$$;

-- ---------------------------------------------------------------------
-- 10. 함수 권한
-- ---------------------------------------------------------------------
revoke execute on function public.admin_save_restaurant(
  uuid, text, text, double precision, double precision, text, text, jsonb, text, text, boolean, text, jsonb, jsonb, text
) from public, anon;
grant execute on function public.admin_save_restaurant(
  uuid, text, text, double precision, double precision, text, text, jsonb, text, text, boolean, text, jsonb, jsonb, text
) to authenticated;

revoke execute on function public.create_restaurant_request(text, text, text, double precision, double precision, text) from public, anon;
grant execute on function public.create_restaurant_request(text, text, text, double precision, double precision, text) to authenticated;
grant execute on function public.place_request_status(text[]) to anon, authenticated;
grant execute on function public.i_voted_request(uuid) to anon, authenticated;
grant execute on function public.list_restaurant_requests(double precision, double precision, text, int) to anon, authenticated;
revoke execute on function public.admin_link_request(uuid, uuid) from public, anon;
grant execute on function public.admin_link_request(uuid, uuid) to authenticated;
revoke execute on function public.recount_request_votes() from public, anon, authenticated;
revoke execute on function public.link_requests_to_restaurant() from public, anon, authenticated;
