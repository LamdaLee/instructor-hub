-- 이전 공개 조회 함수가 호출 경로에 남아 있어도 최종 진입점에서 로그인·기관 경계를 보장한다.
begin;
-- 여러 버전의 권한 래퍼가 중첩돼도 이미 가린 강사의 표시를 보존한다.
create or replace function hub.mask_slots(p_rows jsonb,p_org text) returns jsonb language sql immutable as $$
 select coalesce(jsonb_agg(case when not coalesce(x->>'organization'=p_org,false)
  then (x||jsonb_build_object('instructor_id',null,'instructor_name','','linked_name',null,'conflict',false,
   'instructor_hidden',coalesce((x->>'instructor_hidden')::boolean,false) or x->>'instructor_id' is not null or coalesce(x->>'instructor_name','')<>''))-'phone'-'email' else x end),'[]')
 from jsonb_array_elements(coalesce(p_rows,'[]')) x $$;
revoke all on function hub.mask_slots(jsonb,text) from public,hub_app;
create or replace function hub.api_read(p_token bytea,p_view text,p_filter jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=hub,pg_temp as $$
declare o operators:=actor(p_token);r jsonb;begin
 if o.id is null then return '{"ok":false,"code":"session_expired"}';end if;
 if p_view in ('operators','audit') and o.role<>'admin' then return '{"ok":false,"code":"forbidden"}';end if;
 r:=read_before_main_venues(p_token,p_view,p_filter);
 if not coalesce((r->>'ok')::boolean,false) then return r;end if;
 if p_view='options' and o.role='admin' then
  r:=r||jsonb_build_object('venue_overrides',(select coalesce(jsonb_agg(to_jsonb(v) order by starts_on,room),'[]') from venue_overrides v));
 end if;
 if sees_all_orgs(o) or o.organization is null then return r;end if;
 if p_view='options' then
  r:=jsonb_set(r,'{instructors}',(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(r->'instructors') x where x->>'organization'=o.organization));
 elsif p_view='instructors' then
  r:=jsonb_set(r,'{rows}',(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(r->'rows') x where x->>'organization'=o.organization));
 elsif p_view='instructor' then
  if not coalesce(r->'instructor'->>'organization'=o.organization,false) then return '{"ok":false,"code":"not_found"}';end if;
 elsif p_view in ('slots','dashboard','reports','export') then
  r:=jsonb_set(r,'{rows}',mask_slots(r->'rows',o.organization));
  if r ? 'unassigned' then r:=jsonb_set(r,'{unassigned}',mask_slots(r->'unassigned',o.organization));end if;
 end if;
 return r;
end $$;
create or replace function hub.api_material(p_token bytea,p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=hub,pg_temp as $$
begin
 if (actor(p_token)).id is null then return '{"ok":false,"code":"session_expired"}';end if;
 return material_org_accounts(p_token,p_action,p_data);
end $$;
revoke all on function hub.api_read(bytea,text,jsonb),hub.api_material(bytea,text,jsonb) from public;
grant execute on function hub.api_read(bytea,text,jsonb),hub.api_material(bytea,text,jsonb) to hub_app;
-- 데이터를 출력하지 않고 적용 전에 실제 앱 역할로 비로그인 거절을 검증한다.
set local role hub_app;
do $$ declare v text;begin
 foreach v in array array['options','slots','dashboard','instructors','instructor','announcements','materials','operators','audit','export'] loop
  if hub.api_read(null,v,'{}')->>'code' is distinct from 'session_expired' then raise exception '로그인 보호 검증 실패: %',v;end if;
  if hub.api_read(decode(repeat('00',32),'hex'),v,'{}')->>'code' is distinct from 'session_expired' then raise exception '잘못된 토큰 검증 실패: %',v;end if;
 end loop;
end $$;
reset role;
commit;
