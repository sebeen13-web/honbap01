-- =====================================================================
-- 차별점 반영: "2인분부터 파는 식당에서, 1인분이 되는 메뉴와 가격을 구체적으로 보여주는 지도"
--
--   1) solo_menu_items        : 1인분 메뉴·가격 (solo_policies.solo_menus 대체)
--   2) solo_time_rules        : 시간대별 1인분 가능/불가 규칙
--   3) solo_confirmations     : "오늘도 됐어요/안 됐어요" 원탭 확인 (서버 API 로만 등록)
--   4) restaurant_claims      : 사장님 "내 식당으로 연결 요청" → 관리자 승인
--   5) restaurant_daily_stats : 사장님 통계 (숫자만)
--   6) nearby_restaurants     : 메뉴·가격·지금 가능 여부·확인 집계 반환
--
-- 기존 solo_menus(text[]) 는 가격이 없어 이전할 수 없으므로 데이터 이전 없이 제거한다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. solo_menus 를 참조하는 함수 정리 (컬럼 제거 전에)
-- ---------------------------------------------------------------------
drop function if exists public.nearby_restaurants(double precision, double precision, int);
drop function if exists public.admin_save_restaurant(
  uuid, text, text, double precision, double precision, text, text, jsonb, text[], text, text, boolean, text
);

alter table public.solo_policies drop column solo_menus;

-- 출처/확인일 트리거 재정의
--   - is_active 만 바뀐 경우(일시중단/숨김 토글) → 출처·확인일 유지 (기존 규칙)
--   - 그 밖의 저장(내용 변경, 다시 저장, 메뉴·시간대 규칙 변경으로 인한 갱신) → 역할로 출처 결정, 확인일 = now()
create or replace function public.solo_policies_set_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.is_active is distinct from old.is_active
     and (new.time_slot, new.time_slot_note, new.extra_fee, new.extra_fee_note, new.restaurant_id)
         is not distinct from
         (old.time_slot, old.time_slot_note, old.extra_fee, old.extra_fee_note, old.restaurant_id)
  then
    new.source := old.source;
    new.last_verified_at := old.last_verified_at;
    return new;
  end if;

  if public.is_admin() then
    new.source := 'admin_checked';
  elsif auth.uid() is not null then
    new.source := 'owner_registered';
  elsif tg_op = 'UPDATE' then
    -- service_role / SQL Editor: 출처를 따로 지정하지 않았으면 유지
    new.source := coalesce(new.source, old.source);
  end if;

  new.last_verified_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. 공통 트리거 함수
-- ---------------------------------------------------------------------

-- 식당당 개수 제한 (tg_argv[0] = 최대 개수, tg_argv[1] = 안내용 이름)
create or replace function public.enforce_per_restaurant_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lim   int  := tg_argv[0]::int;
  label text := tg_argv[1];
  n     int;
begin
  -- 동시에 여러 행을 넣어도 한도를 넘지 않도록 식당 단위로 잠근다
  perform pg_advisory_xact_lock(hashtextextended(tg_table_name || ':' || new.restaurant_id::text, 0));
  execute format('select count(*) from %I.%I where restaurant_id = $1 and id <> $2', tg_table_schema, tg_table_name)
    into n using new.restaurant_id, new.id;
  if n >= lim then
    raise exception '%은(는) 식당당 최대 %개까지 등록할 수 있어요.', label, lim using errcode = '23514';
  end if;
  return new;
end;
$$;

-- 메뉴·시간대 규칙이 바뀌면 solo_policies 를 "다시 저장"한 것으로 처리한다
-- → solo_policies_set_source 트리거가 역할에 따라 출처와 last_verified_at 을 갱신
create or replace function public.touch_solo_policy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    update public.solo_policies set updated_at = now() where restaurant_id = new.restaurant_id;
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and new.restaurant_id is distinct from old.restaurant_id) then
    update public.solo_policies set updated_at = now() where restaurant_id = old.restaurant_id;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. solo_menu_items: 1인분 메뉴·가격 (식당당 최대 10개)
-- ---------------------------------------------------------------------
create table public.solo_menu_items (
  id                       uuid primary key default gen_random_uuid(),
  restaurant_id            uuid not null references public.restaurants (id) on delete cascade,
  name                     text not null check (char_length(btrim(name)) between 1 and 50),
  -- 1인분으로 주문할 때 가격(원)
  solo_price               integer not null check (solo_price between 100 and 500000),
  -- 보통(2인 이상 주문 시) 1인당 가격(원). 모르면 null
  regular_price_per_person integer check (regular_price_per_person is null or regular_price_per_person between 100 and 500000),
  -- 원래 최소 주문 인분 (예: 2인분부터)
  normal_min_servings      smallint not null default 2 check (normal_min_servings between 1 and 20),
  note                     text check (note is null or char_length(note) <= 100),
  sort_order               smallint not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index solo_menu_items_restaurant_idx on public.solo_menu_items (restaurant_id, sort_order);

create trigger solo_menu_items_set_updated_at
  before update on public.solo_menu_items
  for each row execute function public.set_updated_at();
create trigger solo_menu_items_limit
  before insert or update of restaurant_id on public.solo_menu_items
  for each row execute function public.enforce_per_restaurant_limit('10', '1인분 메뉴');
create trigger solo_menu_items_touch_policy
  after insert or update or delete on public.solo_menu_items
  for each row execute function public.touch_solo_policy();

-- ---------------------------------------------------------------------
-- 3. solo_time_rules: 시간대 규칙 (식당당 최대 8개)
--   day_type: weekday(월~금) / weekend(토·일) / all(매일)
--   start < end : 같은 날 [start, end)
--   start > end : 자정 넘김 (예: 22:00~02:00 → 그날 22시~다음날 2시)
--   start = end : 그날 하루 종일
--   겹치면 available = false 가 우선. 한국 시간 기준.
-- ---------------------------------------------------------------------
create table public.solo_time_rules (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  day_type      text not null check (day_type in ('weekday', 'weekend', 'all')),
  start_time    time not null,
  end_time      time not null,
  available     boolean not null,
  note          text check (note is null or char_length(note) <= 100),
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index solo_time_rules_restaurant_idx on public.solo_time_rules (restaurant_id, sort_order);

create trigger solo_time_rules_set_updated_at
  before update on public.solo_time_rules
  for each row execute function public.set_updated_at();
create trigger solo_time_rules_limit
  before insert or update of restaurant_id on public.solo_time_rules
  for each row execute function public.enforce_per_restaurant_limit('8', '시간대 규칙');
create trigger solo_time_rules_touch_policy
  after insert or update or delete on public.solo_time_rules
  for each row execute function public.touch_solo_policy();

-- 요일 구분이 ISO 요일(1=월 … 7=일)에 해당하는지
create or replace function public.solo_day_matches(day_type text, isodow int)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case day_type
    when 'all'     then true
    when 'weekday' then isodow between 1 and 5
    when 'weekend' then isodow in (6, 7)
    else false
  end;
$$;

-- 주어진 시각에 1인분이 가능한지.
--   rules: [{"day_type","start_time":"HH:MM","end_time":"HH:MM","available"}, ...]
--   null  = 규칙 없음(정보 없음)
--   false = 불가 규칙에 걸리거나, 어떤 규칙에도 해당하지 않음
--   true  = 가능 규칙에 해당하고 불가 규칙에는 해당하지 않음
create or replace function public.solo_available_at(rules jsonb, at_time timestamptz default now())
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  local_ts  timestamp := at_time at time zone 'Asia/Seoul';
  dow       int       := extract(isodow from local_ts)::int;
  prev_dow  int       := case when extract(isodow from local_ts)::int = 1 then 7 else extract(isodow from local_ts)::int - 1 end;
  t         time      := local_ts::time;
  r         jsonb;
  s         time;
  e         time;
  covers    boolean;
  any_true  boolean   := false;
begin
  if rules is null or jsonb_typeof(rules) <> 'array' or jsonb_array_length(rules) = 0 then
    return null;
  end if;

  for r in select value from jsonb_array_elements(rules) loop
    s := (r ->> 'start_time')::time;
    e := (r ->> 'end_time')::time;
    if s < e then
      covers := public.solo_day_matches(r ->> 'day_type', dow) and t >= s and t < e;
    elsif s > e then
      -- 자정 넘김: 오늘 시작분 + 어제 시작해서 넘어온 분
      covers := (public.solo_day_matches(r ->> 'day_type', dow) and t >= s)
             or (public.solo_day_matches(r ->> 'day_type', prev_dow) and t < e);
    else
      covers := public.solo_day_matches(r ->> 'day_type', dow);
    end if;

    if covers then
      if (r ->> 'available')::boolean then
        any_true := true;
      else
        return false;                               -- 불가 우선
      end if;
    end if;
  end loop;

  return any_true;
end;
$$;

-- 지금 불가일 때, 오늘(한국 시간) 안에 다시 가능해지는 가장 이른 시각. 없으면 null.
create or replace function public.solo_next_available_at(rules jsonb, at_time timestamptz default now())
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  local_ts timestamp := at_time at time zone 'Asia/Seoul';
  today    date      := (at_time at time zone 'Asia/Seoul')::date;
  now_t    time      := (at_time at time zone 'Asia/Seoul')::time;
  cand     time;
  ts       timestamptz;
begin
  if public.solo_available_at(rules, at_time) is distinct from false then
    return null;                                     -- 이미 가능하거나 정보 없음
  end if;

  -- 상태가 바뀔 수 있는 시각 = 규칙의 시작·종료 시각
  for cand in
    select distinct x.v::time
    from jsonb_array_elements(rules) as el(value),
         lateral (values (el.value ->> 'start_time'), (el.value ->> 'end_time')) as x(v)
    where x.v::time > now_t
    order by 1
  loop
    ts := (today + cand) at time zone 'Asia/Seoul';
    if public.solo_available_at(rules, ts) then
      return ts;
    end if;
  end loop;

  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. solo_confirmations: "오늘도 됐어요 / 안 됐어요"
--   visitor_hash = 서버에서 hash(IP + User-Agent + 한국 날짜 + 서버 솔트). 원본 IP·위치는 저장하지 않는다.
--   해시에 날짜가 들어가므로 (식당, visitor_hash) unique = 같은 사람 같은 식당 하루 1회.
--   등록은 서버 API route(service_role)로만. anon/authenticated 직접 쓰기 불가.
-- ---------------------------------------------------------------------
create table public.solo_confirmations (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  result        text not null check (result in ('ok', 'not_ok')),
  created_at    timestamptz not null default now(),
  visitor_hash  text not null check (char_length(visitor_hash) between 32 and 128),
  constraint solo_confirmations_once_per_day unique (restaurant_id, visitor_hash)
);

create index solo_confirmations_restaurant_time_idx on public.solo_confirmations (restaurant_id, created_at desc);
create index solo_confirmations_created_idx on public.solo_confirmations (created_at);

-- 식당별 확인 집계 (개별 행·해시는 노출하지 않고 숫자만)
--   공개 중인 식당, 또는 관리자/그 식당 사장님만 집계를 볼 수 있다.
create or replace function public.confirmation_summaries(rids uuid[])
returns table (
  restaurant_id uuid,
  ok_30d        int,
  not_ok_30d    int,
  last_ok_at    timestamptz,
  needs_review  boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    x.rid,
    (count(c.id) filter (where c.result = 'ok'     and c.created_at >= now() - interval '30 days'))::int,
    (count(c.id) filter (where c.result = 'not_ok' and c.created_at >= now() - interval '30 days'))::int,
    max(c.created_at) filter (where c.result = 'ok'),
    (count(c.id) filter (where c.result = 'not_ok' and c.created_at >= now() - interval '14 days')) >= 3
  from unnest(rids) as x(rid)
  left join public.solo_confirmations c on c.restaurant_id = x.rid
  where public.restaurant_is_public(x.rid) or public.is_admin() or public.owns_restaurant(x.rid)
  group by x.rid;
$$;

-- 90일 지난 확인 데이터 삭제 (SQL Editor 에서 수동 실행: select public.purge_old_confirmations();)
create or replace function public.purge_old_confirmations(keep_days int default 90)
returns int
language sql
security definer
set search_path = ''
as $$
  with d as (
    delete from public.solo_confirmations
    where created_at < now() - make_interval(days => greatest(keep_days, 30))
    returning 1
  )
  select count(*)::int from d;
$$;

-- ---------------------------------------------------------------------
-- 5. restaurant_claims: 사장님 "내 식당으로 연결 요청"
--   관리자가 승인하면 restaurants.owner_id 가 설정된다. (사장님 한 명당 식당 하나 유지)
-- ---------------------------------------------------------------------
create table public.restaurant_claims (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  owner_id      uuid not null references auth.users (id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    uuid references auth.users (id) on delete set null
);

-- 사장님당 처리 대기 중인 요청은 하나만
create unique index restaurant_claims_one_pending_per_owner on public.restaurant_claims (owner_id) where status = 'pending';
create index restaurant_claims_pending_idx on public.restaurant_claims (created_at) where status = 'pending';
create index restaurant_claims_restaurant_idx on public.restaurant_claims (restaurant_id);

-- 아직 사장님이 연결되지 않은 식당인지 (RLS 에 숨겨진 식당도 확인해야 하므로 security definer)
create or replace function public.restaurant_is_claimable(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.restaurants where id = rid and owner_id is null);
$$;

-- 상태 변경 처리: pending 에서만 바뀔 수 있고, 승인되면 식당에 사장님을 연결한다.
create or replace function public.restaurant_claims_on_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.restaurant_id is distinct from old.restaurant_id or new.owner_id is distinct from old.owner_id then
    raise exception '연결 요청의 식당·사장님은 바꿀 수 없어요.' using errcode = '42501';
  end if;
  if new.status is not distinct from old.status then
    return new;
  end if;
  if old.status <> 'pending' then
    raise exception '이미 처리된 연결 요청이에요.' using errcode = '23514';
  end if;

  new.decided_at := now();
  new.decided_by := auth.uid();

  if new.status = 'approved' then
    if exists (select 1 from public.restaurants where owner_id = new.owner_id) then
      raise exception '이 사장님은 이미 다른 식당과 연결되어 있어요.' using errcode = '23505';
    end if;
    update public.restaurants set owner_id = new.owner_id
     where id = new.restaurant_id and owner_id is null;
    if not found then
      raise exception '이미 다른 사장님과 연결된 식당이에요.' using errcode = '23505';
    end if;
    -- 같은 식당에 대한 다른 대기 요청은 거절 처리
    update public.restaurant_claims
       set status = 'rejected'
     where restaurant_id = new.restaurant_id and id <> new.id and status = 'pending';
  end if;
  return new;
end;
$$;

create trigger restaurant_claims_update
  before update on public.restaurant_claims
  for each row execute function public.restaurant_claims_on_update();

-- ---------------------------------------------------------------------
-- 6. restaurant_daily_stats: 사장님 통계 (개인 식별 정보 없이 숫자만)
-- ---------------------------------------------------------------------
create table public.restaurant_daily_stats (
  restaurant_id     uuid not null references public.restaurants (id) on delete cascade,
  day               date not null,
  views             integer not null default 0 check (views >= 0),
  directions_clicks integer not null default 0 check (directions_clicks >= 0),
  phone_taps        integer not null default 0 check (phone_taps >= 0),
  primary key (restaurant_id, day)
);

-- 공개 중인 식당의 오늘(한국 날짜) 숫자를 1 올린다. kind: view / directions / phone
create or replace function public.increment_restaurant_stat(p_restaurant_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d date := (now() at time zone 'Asia/Seoul')::date;
begin
  if p_kind not in ('view', 'directions', 'phone') then
    raise exception '알 수 없는 통계 종류입니다: %', p_kind using errcode = '22023';
  end if;
  if not public.restaurant_is_public(p_restaurant_id) then
    return;                                          -- 비공개 식당은 조용히 무시
  end if;

  insert into public.restaurant_daily_stats as s (restaurant_id, day, views, directions_clicks, phone_taps)
  values (p_restaurant_id, d, (p_kind = 'view')::int, (p_kind = 'directions')::int, (p_kind = 'phone')::int)
  on conflict (restaurant_id, day) do update
    set views             = s.views + excluded.views,
        directions_clicks = s.directions_clicks + excluded.directions_clicks,
        phone_taps        = s.phone_taps + excluded.phone_taps;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------
alter table public.solo_menu_items        enable row level security;
alter table public.solo_time_rules        enable row level security;
alter table public.solo_confirmations     enable row level security;
alter table public.restaurant_claims      enable row level security;
alter table public.restaurant_daily_stats enable row level security;

-- 메뉴: 공개 식당은 누구나 읽기 / 사장님은 자기 식당 것 전부 / 관리자 전체
create policy "solo_menu_items: 공개 조회(활성만)" on public.solo_menu_items
  for select to anon, authenticated using (public.restaurant_is_public(restaurant_id));
create policy "solo_menu_items: 사장님 본인 조회" on public.solo_menu_items
  for select to authenticated using (public.owns_restaurant(restaurant_id));
create policy "solo_menu_items: 사장님 등록" on public.solo_menu_items
  for insert to authenticated with check (public.owns_restaurant(restaurant_id));
create policy "solo_menu_items: 사장님 수정" on public.solo_menu_items
  for update to authenticated
  using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));
create policy "solo_menu_items: 사장님 삭제" on public.solo_menu_items
  for delete to authenticated using (public.owns_restaurant(restaurant_id));
create policy "solo_menu_items: 관리자 전체" on public.solo_menu_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 시간대 규칙: 메뉴와 동일
create policy "solo_time_rules: 공개 조회(활성만)" on public.solo_time_rules
  for select to anon, authenticated using (public.restaurant_is_public(restaurant_id));
create policy "solo_time_rules: 사장님 본인 조회" on public.solo_time_rules
  for select to authenticated using (public.owns_restaurant(restaurant_id));
create policy "solo_time_rules: 사장님 등록" on public.solo_time_rules
  for insert to authenticated with check (public.owns_restaurant(restaurant_id));
create policy "solo_time_rules: 사장님 수정" on public.solo_time_rules
  for update to authenticated
  using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));
create policy "solo_time_rules: 사장님 삭제" on public.solo_time_rules
  for delete to authenticated using (public.owns_restaurant(restaurant_id));
create policy "solo_time_rules: 관리자 전체" on public.solo_time_rules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 확인: 관리자만 행을 읽고 정리할 수 있다. 등록은 service_role(서버 API)만. (집계는 confirmation_summaries)
create policy "solo_confirmations: 관리자 조회" on public.solo_confirmations
  for select to authenticated using (public.is_admin());
create policy "solo_confirmations: 관리자 삭제" on public.solo_confirmations
  for delete to authenticated using (public.is_admin());
revoke insert, update, truncate on public.solo_confirmations from anon, authenticated;
revoke select, delete on public.solo_confirmations from anon;

-- 연결 요청: 사장님은 자기 요청 등록·조회·취소(대기 중일 때), 관리자 전체(승인/거절)
create policy "restaurant_claims: 사장님 요청" on public.restaurant_claims
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and status = 'pending'
    and decided_at is null
    and decided_by is null
    and public.restaurant_is_claimable(restaurant_id)
    and not exists (select 1 from public.restaurants r where r.owner_id = auth.uid())
  );
create policy "restaurant_claims: 사장님 본인 조회" on public.restaurant_claims
  for select to authenticated using (owner_id = auth.uid());
create policy "restaurant_claims: 사장님 대기 요청 취소" on public.restaurant_claims
  for delete to authenticated using (owner_id = auth.uid() and status = 'pending');
create policy "restaurant_claims: 관리자 전체" on public.restaurant_claims
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.restaurant_claims from anon;

-- 통계: 사장님은 자기 식당만 읽기, 관리자 읽기. 쓰기는 increment_restaurant_stat() 로만.
create policy "restaurant_daily_stats: 사장님 본인 조회" on public.restaurant_daily_stats
  for select to authenticated using (public.owns_restaurant(restaurant_id));
create policy "restaurant_daily_stats: 관리자 조회" on public.restaurant_daily_stats
  for select to authenticated using (public.is_admin());
revoke insert, update, delete, truncate on public.restaurant_daily_stats from anon, authenticated;
revoke select on public.restaurant_daily_stats from anon;

-- ---------------------------------------------------------------------
-- 8. 근처 조회 (반환 형식 변경)
--   손님 좌표는 인자로만 받고 어디에도 저장하지 않는다. security invoker → 호출자 RLS 적용.
-- ---------------------------------------------------------------------
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
  needs_review          boolean
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
      r.id, r.name, r.address, r.latitude, r.longitude, r.phone, r.category, r.business_hours,
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
    coalesce(c.needs_review, false)
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

-- ---------------------------------------------------------------------
-- 9. 관리자 식당 저장 (식당 + 정책 + 메뉴 + 시간대 규칙을 한 트랜잭션으로)
-- ---------------------------------------------------------------------
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
  p_time_rules     jsonb
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
    insert into public.restaurants (name, address, latitude, longitude, phone, category, business_hours)
    values (btrim(p_name), btrim(p_address), p_latitude, p_longitude, p_phone, p_category, p_business_hours)
    returning id into rid;
  else
    update public.restaurants
       set name = btrim(p_name),
           address = btrim(p_address),
           latitude = p_latitude,
           longitude = p_longitude,
           phone = p_phone,
           category = p_category,
           business_hours = p_business_hours
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
-- 10. 함수 실행 권한
-- ---------------------------------------------------------------------
grant execute on function public.nearby_restaurants(double precision, double precision, int) to anon, authenticated;
grant execute on function public.confirmation_summaries(uuid[]) to anon, authenticated;
grant execute on function public.increment_restaurant_stat(uuid, text) to anon, authenticated;
grant execute on function public.solo_available_at(jsonb, timestamptz) to anon, authenticated;
grant execute on function public.solo_next_available_at(jsonb, timestamptz) to anon, authenticated;

revoke execute on function public.admin_save_restaurant(
  uuid, text, text, double precision, double precision, text, text, jsonb, text, text, boolean, text, jsonb, jsonb
) from public, anon;
grant execute on function public.admin_save_restaurant(
  uuid, text, text, double precision, double precision, text, text, jsonb, text, text, boolean, text, jsonb, jsonb
) to authenticated;

-- 내부용: API 로 직접 부를 수 없게
revoke execute on function public.purge_old_confirmations(int) from public, anon, authenticated;
revoke execute on function public.restaurant_is_claimable(uuid) from public, anon;
grant execute on function public.restaurant_is_claimable(uuid) to authenticated;
revoke execute on function public.enforce_per_restaurant_limit() from public, anon, authenticated;
revoke execute on function public.touch_solo_policy() from public, anon, authenticated;
revoke execute on function public.restaurant_claims_on_update() from public, anon, authenticated;
