-- 배정 상태를 지정하지 않은 수업은 빈 상태로 보존한다. 기존 지정 상태는 유지한다.
begin;
alter table hub.slots alter column assignment_status set default '';
alter table hub.slots drop constraint if exists slots_assignment_status_check;
alter table hub.slots add constraint slots_assignment_status_check check(assignment_status in ('','임시','변경예정','확정'));
alter function hub.api_save(bytea,text,jsonb) rename to save_before_optional_assignment;
revoke all on function hub.save_before_optional_assignment(bytea,text,jsonb) from public,hub_app;
create function hub.api_save(p_token bytea,p_kind text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=hub,pg_temp as $$
declare o operators;clean jsonb;item jsonb;r jsonb;v uuid;old jsonb;begin
 if p_kind<>'slots' then return save_before_optional_assignment(p_token,p_kind,p_data);end if;
 o:=actor(p_token);
 if o.id is null then return '{"ok":false,"code":"session_expired"}';end if;
 if o.role<>'admin' then return '{"ok":false,"code":"forbidden"}';end if;
 if jsonb_typeof(p_data->'rows') is distinct from 'array' then return '{"ok":false,"code":"bad_request"}';end if;
 for item in select value from jsonb_array_elements(p_data->'rows') loop
  if item ? 'assignment_status' and (jsonb_typeof(item->'assignment_status') is distinct from 'string' or item->>'assignment_status' not in ('','임시','변경예정','확정')) then return '{"ok":false,"code":"bad_request"}';end if;
 end loop;
 -- 기존 함수의 상태 검사를 유지하고 빈 상태만 이 함수에서 저장한다.
 select coalesce(jsonb_agg(case when value->>'assignment_status'='' then value-'assignment_status' else value end order by ordinal),'[]'::jsonb) into clean from jsonb_array_elements(p_data->'rows') with ordinality as x(value,ordinal);
 r:=save_before_optional_assignment(p_token,p_kind,jsonb_set(p_data,'{rows}',clean));
 if coalesce((r->>'ok')::boolean,false) then
  for item in select value from jsonb_array_elements(p_data->'rows') loop
   if item->>'assignment_status'='' then
    select id,to_jsonb(s) into v,old from slots s where class_id=(item->>'class_id')::uuid and day=(item->>'day')::date and period=coalesce(item->>'period','') for update;
    update slots set assignment_status='' where id=v;
    if old->>'assignment_status' is distinct from '' then
     insert into audit_logs(operator_id,actor_email,action,target_table,target_id,summary,before_value,after_value)
     select o.id,o.email,'assignment','slots',v::text,'강사 배정 상태 해제',old,to_jsonb(s) from slots s where id=v;
    end if;
   end if;
  end loop;
 end if;
 return r;
end $$;
revoke all on function hub.api_save(bytea,text,jsonb) from public;
grant execute on function hub.api_save(bytea,text,jsonb) to hub_app;
commit;
