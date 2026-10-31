-- =====================================================================
-- 보안 점검(Supabase advisor 0028) 반영:
--   is_admin(), owns_restaurant() 는 "로그인 사용자" 대상 RLS 정책에서만 쓰인다.
--   비로그인(anon)이 /rest/v1/rpc 로 직접 호출할 이유가 없으므로 실행 권한을 회수한다.
--   restaurant_is_public() 은 손님(anon) 조회·제보 정책에 필요하므로 유지한다.
--   (트리거 solo_policies_set_source 는 security definer 라서 영향 없음)
-- =====================================================================
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.owns_restaurant(uuid) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.owns_restaurant(uuid) to authenticated;
