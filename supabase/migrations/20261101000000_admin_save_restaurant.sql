-- =====================================================================
-- 2단계: 관리자 식당 등록/수정 (식당 + 1인분 정책을 한 트랜잭션으로 저장)
--
--   security invoker → 호출자의 RLS("관리자 전체" 정책)가 그대로 적용된다.
--   source / last_verified_at 은 solo_policies_set_source 트리거가 결정한다
--   (관리자 → admin_checked, 내용이 바뀌면 last_verified_at = now()).
-- =====================================================================
create or replace function public.admin_save_restaurant(
  p_id             uuid,
  p_name           text,
  p_address        text,
  p_latitude       double precision,
  p_longitude      double precision,
  p_phone          text,
  p_category       text,
  p_business_hours jsonb,
  p_solo_menus     text[],
  p_time_slot      text,
  p_time_slot_note text,
  p_extra_fee      boolean,
  p_extra_fee_note text
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
    (restaurant_id, solo_menus, time_slot, time_slot_note, extra_fee, extra_fee_note, source)
  values
    (rid, p_solo_menus, p_time_slot, p_time_slot_note, p_extra_fee, p_extra_fee_note, 'admin_checked')
  on conflict (restaurant_id) do update
    set solo_menus     = excluded.solo_menus,
        time_slot      = excluded.time_slot,
        time_slot_note = excluded.time_slot_note,
        extra_fee      = excluded.extra_fee,
        extra_fee_note = excluded.extra_fee_note;
  -- is_active(숨김)는 여기서 건드리지 않는다. 목록의 숨김/숨김 해제 버튼이 담당.

  return rid;
end;
$$;

revoke execute on function public.admin_save_restaurant(
  uuid, text, text, double precision, double precision, text, text, jsonb, text[], text, text, boolean, text
) from public, anon;
grant execute on function public.admin_save_restaurant(
  uuid, text, text, double precision, double precision, text, text, jsonb, text[], text, text, boolean, text
) to authenticated;
