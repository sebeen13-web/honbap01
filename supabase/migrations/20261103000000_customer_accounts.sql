-- =====================================================================
-- 손님 로그인 도입
--   - profiles.role: user / owner / admin (가입 기본값 user), nickname 추가
--   - owner 승격은 서버(트리거)만: 사장님 식당 등록 또는 연결 요청 승인 시
--   - favorites(즐겨찾기), 회원 탈퇴 함수
--   - solo_confirmations: visitor_hash → user_id (로그인 사용자, 한국 날짜 기준 하루 1회)
--   - reports: user_id 추가, 로그인 사용자만 제보
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. profiles: 역할 확장 + 닉네임
-- ---------------------------------------------------------------------
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('user', 'owner', 'admin'));
alter table public.profiles alter column role set default 'user';
-- 기존 owner / admin 계정은 그대로 둔다.

alter table public.profiles
  add column nickname text check (nickname is null or char_length(btrim(nickname)) between 1 and 30);

-- 가입 시 프로필 자동 생성: role = user, 닉네임은 카카오 메타데이터에서 (없으면 기본 닉네임)
-- 이메일·전화번호는 닉네임으로 쓰지 않는다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nick text;
begin
  nick := nullif(btrim(coalesce(
    new.raw_user_meta_data ->> 'nickname',
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'user_name',
    new.raw_user_meta_data ->> 'preferred_username',
    ''
  )), '');
  -- 메타데이터에 이메일이 들어 있는 경우는 닉네임으로 쓰지 않는다
  if nick is not null and position('@' in nick) > 0 then
    nick := null;
  end if;

  insert into public.profiles (id, role, nickname)
  values (new.id, 'user', left(coalesce(nick, '익명의 혼밥러'), 30))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 기존 계정의 빈 닉네임 채우기
update public.profiles set nickname = '익명의 혼밥러' where nickname is null;

-- 역할 변경은 관리자만 (기존 정책 "profiles: 관리자 전체" 유지). 본인 수정 정책은 만들지 않는다.
-- → 사용자는 자기 role 을 바꿀 수 없다. owner 승격은 아래 트리거(security definer)만 한다.

-- ---------------------------------------------------------------------
-- 2. owner 승격: 식당에 사장님이 연결되면(직접 등록 / 연결 요청 승인) user → owner
--    admin 은 그대로 둔다.
-- ---------------------------------------------------------------------
create or replace function public.promote_restaurant_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is not null
     and (tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id) then
    update public.profiles set role = 'owner' where id = new.owner_id and role = 'user';
  end if;
  return null;
end;
$$;

create trigger restaurants_promote_owner
  after insert or update of owner_id on public.restaurants
  for each row execute function public.promote_restaurant_owner();

-- ---------------------------------------------------------------------
-- 3. favorites (즐겨찾기): 본인 것만 읽기/쓰기
-- ---------------------------------------------------------------------
create table public.favorites (
  user_id       uuid not null references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (user_id, restaurant_id)
);
create index favorites_restaurant_idx on public.favorites (restaurant_id);

alter table public.favorites enable row level security;
create policy "favorites: 본인 조회" on public.favorites
  for select to authenticated using (user_id = auth.uid());
create policy "favorites: 본인 추가(공개 식당만)" on public.favorites
  for insert to authenticated
  with check (user_id = auth.uid() and public.restaurant_is_public(restaurant_id));
create policy "favorites: 본인 삭제" on public.favorites
  for delete to authenticated using (user_id = auth.uid());
revoke all on public.favorites from anon;
revoke update on public.favorites from authenticated;

-- ---------------------------------------------------------------------
-- 4. solo_confirmations: visitor_hash → user_id
--    기존 익명 확인 기록은 사용자와 연결할 수 없으므로 삭제한다(로컬/샘플 데이터뿐).
-- ---------------------------------------------------------------------
delete from public.solo_confirmations;

alter table public.solo_confirmations drop constraint solo_confirmations_once_per_day;
alter table public.solo_confirmations drop column visitor_hash;
alter table public.solo_confirmations
  add column user_id uuid not null references auth.users (id) on delete cascade,
  add column confirm_day date not null default ((now() at time zone 'Asia/Seoul')::date);
alter table public.solo_confirmations
  add constraint solo_confirmations_once_per_day unique (restaurant_id, user_id, confirm_day);
create index solo_confirmations_user_idx on public.solo_confirmations (user_id);

-- 로그인 사용자가 등록할 때는 시각·날짜·사용자를 서버가 정한다 (하루 1회 제한 우회 방지)
create or replace function public.solo_confirmations_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();
    new.created_at := now();
  end if;
  new.confirm_day := (new.created_at at time zone 'Asia/Seoul')::date;
  return new;
end;
$$;

create trigger solo_confirmations_before_insert
  before insert on public.solo_confirmations
  for each row execute function public.solo_confirmations_before_insert();

-- 등록: 로그인 사용자 본인 명의로, 공개 중인 식당에만. 읽기는 집계 함수(confirmation_summaries)로만.
grant insert on public.solo_confirmations to authenticated;
create policy "solo_confirmations: 로그인 사용자 등록" on public.solo_confirmations
  for insert to authenticated
  with check (user_id = auth.uid() and public.restaurant_is_public(restaurant_id));

-- ---------------------------------------------------------------------
-- 5. reports: user_id 추가, 로그인 사용자만 제보 (읽기는 관리자만 — 기존 정책 유지)
-- ---------------------------------------------------------------------
alter table public.reports
  add column user_id uuid references auth.users (id) on delete set null;
create index reports_user_idx on public.reports (user_id);

drop policy "reports: 누구나 등록" on public.reports;
create policy "reports: 로그인 사용자 등록" on public.reports
  for insert to authenticated
  with check (user_id = auth.uid() and handled = false and public.restaurant_is_public(restaurant_id));
revoke insert, select, update, delete on public.reports from anon;

-- ---------------------------------------------------------------------
-- 6. 회원 탈퇴: 확인 기록·즐겨찾기 삭제, 프로필 삭제(auth.users 삭제 → cascade)
--    사장님이면 식당 연결이 해제된다(restaurants.owner_id → null, 식당 정보는 남음).
--    관리자 계정은 실수 방지를 위해 탈퇴할 수 없다(DB 에서 역할을 바꾼 뒤 탈퇴).
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception '로그인이 필요해요.' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = uid and role = 'admin') then
    raise exception '관리자 계정은 탈퇴할 수 없어요. 먼저 관리자 권한을 해제해 주세요.' using errcode = '42501';
  end if;

  delete from public.favorites where user_id = uid;
  delete from public.solo_confirmations where user_id = uid;
  delete from public.restaurant_claims where owner_id = uid;
  update public.reports set user_id = null where user_id = uid;
  update public.restaurants set owner_id = null where owner_id = uid;
  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. 함수 실행 권한
-- ---------------------------------------------------------------------
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
revoke execute on function public.promote_restaurant_owner() from public, anon, authenticated;
revoke execute on function public.solo_confirmations_before_insert() from public, anon, authenticated;
