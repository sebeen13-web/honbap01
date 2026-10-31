-- =====================================================================
-- 혼밥 가능 식당 지도 - 초기 스키마
--   테이블: profiles, restaurants, solo_policies, reports
--   함수:   nearby_restaurants, is_open_now, 권한 헬퍼
--   RLS:    손님(anon) / 사장님(owner) / 관리자(admin)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. 확장
--   Supabase 권장대로 확장은 extensions 스키마에 설치한다.
-- ---------------------------------------------------------------------
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------
-- 1. 공통: updated_at 자동 갱신
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. profiles: 로그인 사용자(사장님/관리자)의 역할
--   - 가입 시 트리거로 자동 생성(role = 'owner')
--   - 관리자는 DB에서 직접 role = 'admin' 으로 바꾼다
-- ---------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'owner' check (role in ('owner', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 현재 사용자가 관리자인지. RLS 정책 안에서 profiles 를 다시 조회할 때
-- 재귀가 생기지 않도록 security definer 로 둔다.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- 3. restaurants
-- ---------------------------------------------------------------------
create table public.restaurants (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(btrim(name)) between 1 and 100),
  address        text not null check (char_length(btrim(address)) between 1 and 200),
  latitude       double precision not null check (latitude  between 33 and 39),   -- 대한민국 범위
  longitude      double precision not null check (longitude between 124 and 132),
  phone          text check (phone is null or phone ~ '^[0-9+\-() ]{7,20}$'),
  category       text not null check (category in ('고깃집', '샤브샤브', '회', '기타')),
  -- 요일별 영업시간. 키: mon~sun, 값: {"open":"HH:MM","close":"HH:MM"} 또는 null(휴무)
  -- close <= open 이면 자정을 넘겨 영업(예: 17:00~02:00). open = close 이면 24시간.
  -- 컬럼 자체가 null 이면 "영업시간 정보 없음".
  business_hours jsonb check (business_hours is null or jsonb_typeof(business_hours) = 'object'),
  -- 사장님 1명당 식당 1개 (null 은 여러 개 허용 = 관리자가 등록한 식당)
  owner_id       uuid unique references auth.users (id) on delete set null,
  -- 위도/경도로부터 자동 계산되는 geography 좌표. 근처 조회는 이 컬럼 + GIST 인덱스를 쓴다.
  location       extensions.geography(Point, 4326)
                 generated always as (
                   extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
                 ) stored,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index restaurants_location_gix on public.restaurants using gist (location);

create trigger restaurants_set_updated_at
  before update on public.restaurants
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. solo_policies: 식당당 1개의 "1인분 정책"
--   is_active = false → 사장님의 "일시 중단" 또는 관리자의 "숨김" (둘 다 같은 값)
-- ---------------------------------------------------------------------
create table public.solo_policies (
  id               uuid primary key default gen_random_uuid(),
  restaurant_id    uuid not null unique references public.restaurants (id) on delete cascade,
  solo_menus       text[] not null check (cardinality(solo_menus) between 1 and 20),
  time_slot        text not null default 'all_day'
                   check (time_slot in ('all_day', 'lunch', 'dinner', 'custom')),
  time_slot_note   text check (time_slot_note is null or char_length(time_slot_note) <= 200),
  extra_fee        boolean not null default false,
  extra_fee_note   text check (extra_fee_note is null or char_length(extra_fee_note) <= 200),
  is_active        boolean not null default true,
  source           text not null default 'owner_registered'
                   check (source in ('admin_checked', 'owner_registered')),
  last_verified_at timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint custom_slot_needs_note
    check (time_slot <> 'custom' or char_length(btrim(coalesce(time_slot_note, ''))) > 0)
);

create index solo_policies_active_idx on public.solo_policies (restaurant_id) where is_active;

create trigger solo_policies_set_updated_at
  before update on public.solo_policies
  for each row execute function public.set_updated_at();

-- 출처(source)와 마지막 확인일을 서버가 결정한다. 클라이언트 값은 믿지 않는다.
--   - 사장님(관리자 아님)이 등록/수정 → source = owner_registered, last_verified_at = now()
--   - 관리자가 등록/수정            → source = admin_checked,    last_verified_at = now()
--   - is_active 만 바뀐 경우(일시중단/숨김 토글) → 출처/확인일은 그대로 둔다
create or replace function public.solo_policies_set_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and (new.solo_menus, new.time_slot, new.time_slot_note, new.extra_fee, new.extra_fee_note, new.restaurant_id)
         is not distinct from
         (old.solo_menus, old.time_slot, old.time_slot_note, old.extra_fee, old.extra_fee_note, old.restaurant_id)
  then
    new.source := old.source;
    new.last_verified_at := old.last_verified_at;
    return new;
  end if;

  if public.is_admin() then
    new.source := 'admin_checked';
  elsif auth.uid() is not null then
    new.source := 'owner_registered';
  end if;
  -- auth.uid() 가 null 이면 service_role / SQL Editor / seed 실행: 넣은 값을 그대로 존중한다.

  new.last_verified_at := now();
  return new;
end;
$$;

create trigger solo_policies_source
  before insert or update on public.solo_policies
  for each row execute function public.solo_policies_set_source();

-- ---------------------------------------------------------------------
-- 5. reports: 손님 제보 ("여기 1인분 안 됐어요")
--   손님 정보는 저장하지 않는다(식당 id, 사유, 시각만).
-- ---------------------------------------------------------------------
create table public.reports (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  reason        text not null check (char_length(btrim(reason)) between 1 and 500),
  created_at    timestamptz not null default now(),
  handled       boolean not null default false
);

create index reports_unhandled_idx on public.reports (created_at desc) where not handled;
create index reports_restaurant_idx on public.reports (restaurant_id);

-- ---------------------------------------------------------------------
-- 6. RLS 헬퍼 (security definer: restaurants <-> solo_policies 정책 간 재귀 방지)
-- ---------------------------------------------------------------------
create or replace function public.owns_restaurant(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.restaurants
    where id = rid and owner_id = auth.uid()
  );
$$;

create or replace function public.restaurant_is_public(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.solo_policies
    where restaurant_id = rid and is_active
  );
$$;

-- ---------------------------------------------------------------------
-- 7. RLS 정책
-- ---------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.restaurants   enable row level security;
alter table public.solo_policies enable row level security;
alter table public.reports       enable row level security;

-- profiles: 본인 것만 읽기, 관리자는 전부. 역할 변경은 관리자만(사장님 셀프 승격 방지).
create policy "profiles: 본인 읽기" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles: 관리자 전체" on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- restaurants
create policy "restaurants: 공개 조회(활성만)" on public.restaurants
  for select to anon, authenticated using (public.restaurant_is_public(id));
create policy "restaurants: 사장님 본인 조회" on public.restaurants
  for select to authenticated using (owner_id = auth.uid());
create policy "restaurants: 사장님 등록" on public.restaurants
  for insert to authenticated with check (owner_id = auth.uid());
create policy "restaurants: 사장님 수정" on public.restaurants
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "restaurants: 관리자 전체" on public.restaurants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- solo_policies
create policy "solo_policies: 공개 조회(활성만)" on public.solo_policies
  for select to anon, authenticated using (is_active);
create policy "solo_policies: 사장님 본인 조회" on public.solo_policies
  for select to authenticated using (public.owns_restaurant(restaurant_id));
create policy "solo_policies: 사장님 등록" on public.solo_policies
  for insert to authenticated with check (public.owns_restaurant(restaurant_id));
create policy "solo_policies: 사장님 수정" on public.solo_policies
  for update to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));
create policy "solo_policies: 관리자 전체" on public.solo_policies
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- reports: 누구나 등록(공개 중인 식당에 대해, handled=false 로만), 읽기/처리는 관리자만
create policy "reports: 누구나 등록" on public.reports
  for insert to anon, authenticated
  with check (handled = false and public.restaurant_is_public(restaurant_id));
create policy "reports: 관리자 전체" on public.reports
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 8. 영업 중 여부 (한국 시간 기준)
-- ---------------------------------------------------------------------
create or replace function public.is_open_now(hours jsonb, at_time timestamptz default now())
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  local_ts  timestamp := at_time at time zone 'Asia/Seoul';
  day_keys  text[]    := array['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  dow       int       := extract(dow from local_ts)::int;
  now_t     time      := local_ts::time;
  today_h   jsonb;
  prev_h    jsonb;
  o         time;
  c         time;
begin
  if hours is null then
    return null;                                  -- 정보 없음
  end if;

  -- 오늘 영업분
  today_h := hours -> day_keys[dow + 1];
  if jsonb_typeof(today_h) = 'object' then
    o := (today_h ->> 'open')::time;
    c := (today_h ->> 'close')::time;
    if c > o then
      if now_t >= o and now_t < c then return true; end if;
    elsif now_t >= o then                         -- 자정 넘김 / 24시간
      return true;
    end if;
  end if;

  -- 어제 시작해서 자정을 넘긴 영업분
  prev_h := hours -> day_keys[((dow + 6) % 7) + 1];
  if jsonb_typeof(prev_h) = 'object' then
    o := (prev_h ->> 'open')::time;
    c := (prev_h ->> 'close')::time;
    if c <= o and now_t < c then return true; end if;
  end if;

  return false;
exception
  when others then
    return null;                                  -- 형식이 잘못된 데이터는 "정보 없음"으로 취급
end;
$$;

-- ---------------------------------------------------------------------
-- 9. 근처 조회
--   손님 좌표는 인자로만 받고 어디에도 저장하지 않는다.
--   security invoker 라서 호출자의 RLS 가 그대로 적용된다.
-- ---------------------------------------------------------------------
create or replace function public.nearby_restaurants(
  user_lat double precision,
  user_lng double precision,
  radius_m int default 3000
)
returns table (
  id               uuid,
  name             text,
  address          text,
  latitude         double precision,
  longitude        double precision,
  phone            text,
  category         text,
  distance_m       double precision,
  time_slot        text,
  time_slot_note   text,
  solo_menus       text[],
  extra_fee        boolean,
  extra_fee_note   text,
  source           text,
  last_verified_at timestamptz,
  business_hours   jsonb,
  is_open_now      boolean
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
  )
  select
    r.id, r.name, r.address, r.latitude, r.longitude, r.phone, r.category,
    st_distance(r.location, o.g) as distance_m,
    p.time_slot, p.time_slot_note, p.solo_menus, p.extra_fee, p.extra_fee_note,
    p.source, p.last_verified_at,
    r.business_hours,
    public.is_open_now(r.business_hours) as is_open_now
  from origin o
  join public.restaurants r
    on st_dwithin(r.location, o.g, least(greatest(coalesce(radius_m, 3000), 100), 10000))
  join public.solo_policies p
    on p.restaurant_id = r.id and p.is_active
  order by distance_m asc
  limit 200;
$$;

grant execute on function public.nearby_restaurants(double precision, double precision, int) to anon, authenticated;
grant execute on function public.is_open_now(jsonb, timestamptz) to anon, authenticated;

-- 내부용 함수는 API 로 직접 호출하지 못하게 막는다.
-- (RLS 정책 평가 시에는 정책 소유자 권한이 아니라 호출자 권한이 필요하므로 is_admin 등은 유지)
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.solo_policies_set_source() from public, anon, authenticated;
