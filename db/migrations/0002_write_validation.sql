-- 직접 함수 호출에도 HTTP와 같은 입력 방어를 적용한다.
begin;
alter function hub.api_save(bytea,text,jsonb) rename to save_impl;
revoke all on function hub.save_impl(bytea,text,jsonb) from public,hub_app;
create function hub.api_save(p_token bytea,p_kind text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=hub,pg_temp as $$
declare item jsonb; existing boolean; begin
 if (actor(p_token)).id is null then return '{"ok":false,"code":"session_expired"}'; end if;
 if jsonb_typeof(p_data) is distinct from 'object' then return '{"ok":false,"code":"bad_request"}'; end if;
 if p_kind='slots' then
  if jsonb_typeof(p_data->'rows') is distinct from 'array' then return '{"ok":false,"code":"bad_request"}'; end if;
  if jsonb_array_length(p_data->'rows') not between 1 and 500 then return '{"ok":false,"code":"bad_request"}'; end if;
  if exists(select 1 from jsonb_array_elements(p_data->'rows') x group by x->>'class_id',x->>'day',coalesce(x->>'period','') having count(*)>1) then return '{"ok":false,"code":"bad_request"}'; end if;
  for item in select * from jsonb_array_elements(p_data->'rows') loop
   if nullif(item->>'class_id','') is null or nullif(item->>'day','') is null or jsonb_typeof(item) is distinct from 'object' then return '{"ok":false,"code":"bad_request"}'; end if;
   if nullif(item->>'id','') is not null and not exists(select 1 from slots where id=(item->>'id')::uuid and class_id=(item->>'class_id')::uuid and day=(item->>'day')::date and period=coalesce(item->>'period','')) then return '{"ok":false,"code":"not_found"}'; end if;
  end loop;
 elsif p_kind in ('operator','instructor','class','organization','subject') then
  if nullif(trim(p_data->>'name'),'') is null then return '{"ok":false,"code":"bad_request"}'; end if;
 else return '{"ok":false,"code":"bad_request"}'; end if;
 return save_impl(p_token,p_kind,p_data);
end $$;
revoke all on function hub.api_save(bytea,text,jsonb) from public;
grant execute on function hub.api_save(bytea,text,jsonb) to hub_app;
commit;
