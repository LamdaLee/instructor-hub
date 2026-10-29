-- 반별 강의장·담당 매니저만 수정하는 관리자 전용 API. 다른 과정 정보는 보존한다.
begin;
alter function hub.api_save(bytea,text,jsonb) rename to save_catalog;
revoke all on function hub.save_catalog(bytea,text,jsonb) from public,hub_app;
create function hub.api_save(p_token bytea,p_kind text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=hub,pg_temp as $$
declare o operators;previous hub.classes;v uuid;begin
 if p_kind<>'class_settings' then return save_catalog(p_token,p_kind,p_data);end if;
 o:=actor(p_token);
 if o.id is null then return '{"ok":false,"code":"session_expired"}';end if;
 if o.role<>'admin' then return '{"ok":false,"code":"forbidden"}';end if;
 if jsonb_typeof(p_data) is distinct from 'object' or jsonb_typeof(p_data->'manager') is distinct from 'string' or jsonb_typeof(p_data->'room') is distinct from 'string' or length(p_data->>'manager')>200 or length(p_data->>'room')>200 or nullif(p_data->>'id','') is null then return '{"ok":false,"code":"bad_request"}';end if;
 v:=(p_data->>'id')::uuid;
 select * into previous from classes where id=v for update;
 if previous.id is null then return '{"ok":false,"code":"not_found"}';end if;
 if previous.manager=trim(p_data->>'manager') and previous.room=trim(p_data->>'room') then return jsonb_build_object('ok',true,'id',v,'changed',false);end if;
 update classes set manager=trim(p_data->>'manager'),room=trim(p_data->>'room') where id=v;
 insert into audit_logs(operator_id,actor_email,action,target_table,target_id,summary,before_value,after_value)
 select o.id,o.email,'class_settings','classes',v::text,'강의장·담당 매니저 수정',to_jsonb(previous),to_jsonb(c) from classes c where id=v;
 return jsonb_build_object('ok',true,'id',v,'changed',true);
end $$;
revoke all on function hub.api_save(bytea,text,jsonb) from public;
grant execute on function hub.api_save(bytea,text,jsonb) to hub_app;
commit;
