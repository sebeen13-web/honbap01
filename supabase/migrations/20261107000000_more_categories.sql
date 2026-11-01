-- =====================================================================
-- 음식 종류 확장: 4개 → 15개 ("생활 식당"까지)
--   기존 값(고깃집 / 샤브샤브 / 회 / 기타)은 그대로라 데이터 변경 없음.
--   허용 목록은 valid_categories() 한 곳에서 관리한다(앱의 src/lib/constants.ts CATEGORIES 와 같은 순서).
-- =====================================================================

create or replace function public.valid_categories()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    '고깃집', '곱창·막창', '닭갈비·찜닭', '족발·보쌈', '샤브샤브', '전골·찜·탕', '회', '해산물·조개구이',
    '중식 요리', '국밥·순대', '돈가스·경양식', '국수·칼국수', '찌개·백반', '분식', '기타'
  ]::text[];
$$;

alter table public.restaurants drop constraint restaurants_category_check;
alter table public.restaurants
  add constraint restaurants_category_check check (category = any (public.valid_categories()));

alter table public.restaurant_requests drop constraint restaurant_requests_category_check;
alter table public.restaurant_requests
  add constraint restaurant_requests_category_check check (category is null or category = any (public.valid_categories()));

-- 요청 만들기: 음식 종류 검사를 새 목록으로
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

  if p_category is not null and not (p_category = any (public.valid_categories())) then
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

grant execute on function public.valid_categories() to anon, authenticated;
