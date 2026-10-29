-- 로그인하지 않은 요청에는 시간표·강사·공지·교재 등 어떤 정보도 내주지 않는다.
-- aSSIST·CLIPS 계정은 포털에서도 자기 기관 강사의 이름·연락처만 본다(업로드한 v2·v3 권한 기준).
-- 소속 기관이 없는 기존 내부 운영진 계정은 종전처럼 로그인 후 전체를 본다.
begin;
alter function hub.api_read(bytea,text,jsonb) rename to read_org_accounts;
revoke all on function hub.read_org_accounts(bytea,text,jsonb) from public,hub_app;
-- 다른 기관 수업은 강사 식별 정보를 지우고 과목·기관·장소만 남긴다.
create function hub.mask_slots(p_rows jsonb,p_org text) returns jsonb language sql immutable as $$
 select coalesce(jsonb_agg(case when not coalesce(x->>'organization'=p_org,false)
  then (x||jsonb_build_object('instructor_id',null,'instructor_name','','linked_name',null,'conflict',false,
   'instructor_hidden',x->>'instructor_id' is not null or coalesce(x->>'instructor_name','')<>''))-'phone'-'email' else x end),'[]')
 from jsonb_array_elements(coalesce(p_rows,'[]')) x $$;
revoke all on function hub.mask_slots(jsonb,text) from public,hub_app;
create function hub.api_read(p_token bytea,p_view text,p_filter jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=hub,pg_temp as $$
declare o operators:=actor(p_token);r jsonb;begin
 if o.id is null then return '{"ok":false,"code":"session_expired"}'; end if;
 r:=read_org_accounts(p_token,p_view,p_filter);
 if sees_all_orgs(o) or o.organization is null or not coalesce((r->>'ok')::boolean,false) then return r; end if;
 if p_view='options' then
  r:=jsonb_set(r,'{instructors}',(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(r->'instructors') x where coalesce(x->>'organization'=o.organization,false)));
 elsif p_view='instructors' then
  r:=jsonb_set(r,'{rows}',(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(r->'rows') x where coalesce(x->>'organization'=o.organization,false)));
 elsif p_view='instructor' then
  if not coalesce(r->'instructor'->>'organization'=o.organization,false) then return '{"ok":false,"code":"not_found"}'; end if;
 elsif p_view in ('slots','dashboard','reports','export') then
  r:=jsonb_set(r,'{rows}',mask_slots(r->'rows',o.organization));
  if r ? 'unassigned' then r:=jsonb_set(r,'{unassigned}',mask_slots(r->'unassigned',o.organization)); end if;
 end if;
 return r;
end $$;
alter function hub.api_material(bytea,text,jsonb) rename to material_org_accounts;
revoke all on function hub.material_org_accounts(bytea,text,jsonb) from public,hub_app;
create function hub.api_material(p_token bytea,p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=hub,pg_temp as $$
begin
 if (actor(p_token)).id is null then return '{"ok":false,"code":"session_expired"}'; end if;
 return material_org_accounts(p_token,p_action,p_data);
end $$;
revoke all on function hub.api_read(bytea,text,jsonb),hub.api_material(bytea,text,jsonb) from public;
grant execute on function hub.api_read(bytea,text,jsonb),hub.api_material(bytea,text,jsonb) to hub_app;
commit;
