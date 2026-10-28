-- 장소나 메모만 수정해도 엑셀의 검토 사유가 사라지지 않게 한다.
begin;
create or replace function hub.api_save(p_token bytea,p_kind text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=hub,pg_temp as $$
declare item jsonb; existing boolean; result jsonb; before_meta jsonb; previous_reviews jsonb; begin
 if (actor(p_token)).id is null then return '{"ok":false,"code":"session_expired"}'; end if;
 if jsonb_typeof(p_data) is distinct from 'object' then return '{"ok":false,"code":"bad_request"}'; end if;
 if p_kind='slots' then
  if jsonb_typeof(p_data->'rows') is distinct from 'array' then return '{"ok":false,"code":"bad_request"}'; end if;
  if jsonb_array_length(p_data->'rows') not between 1 and 500 then return '{"ok":false,"code":"bad_request"}'; end if;
  if exists(select 1 from jsonb_array_elements(p_data->'rows') x group by x->>'class_id',x->>'day',coalesce(x->>'period','') having count(*)>1) then return '{"ok":false,"code":"bad_request"}'; end if;
  for item in select * from jsonb_array_elements(p_data->'rows') loop
   if item ? 'hours' and item->>'hours' is not null and (item->>'hours')::numeric not between 0 and 24 then return '{"ok":false,"code":"bad_request"}'; end if;
   if nullif(item->>'class_id','') is null or nullif(item->>'day','') is null or jsonb_typeof(item) is distinct from 'object' then return '{"ok":false,"code":"bad_request"}'; end if;
   if nullif(item->>'id','') is not null and not exists(select 1 from slots where id=(item->>'id')::uuid and class_id=(item->>'class_id')::uuid and day=(item->>'day')::date and period=coalesce(item->>'period','')) then return '{"ok":false,"code":"not_found"}'; end if;
  end loop;
 elsif p_kind in ('operator','instructor','class','organization','subject') then
  if nullif(trim(p_data->>'name'),'') is null then return '{"ok":false,"code":"bad_request"}'; end if;
 else return '{"ok":false,"code":"bad_request"}'; end if;
 if p_kind='slots' then
  select coalesce(jsonb_object_agg(s.id::text,s.review_reason),'{}') into previous_reviews from slots s
  where exists(select 1 from jsonb_array_elements(p_data->'rows') x where s.class_id=(x->>'class_id')::uuid and s.day=(x->>'day')::date and s.period=coalesce(x->>'period',''));
 end if;
 result:=save_impl(p_token,p_kind,p_data);
 if (result->>'ok')::boolean and p_kind='slots' then
  for item in select * from jsonb_array_elements(p_data->'rows') loop
   if item ? 'module' or item ? 'hours' or item ? 'review_reason' or previous_reviews<>'{}' then
    select jsonb_build_object('module',s.module,'hours',s.hours,'review_reason',s.review_reason) into before_meta from slots s where s.class_id=(item->>'class_id')::uuid and s.day=(item->>'day')::date and s.period=coalesce(item->>'period','');
    update slots s set module=case when item ? 'module' then nullif(item->>'module','') else s.module end,
     hours=case when item ? 'hours' then (item->>'hours')::numeric else s.hours end,
     review_reason=case when item ? 'review_reason' then nullif(item->>'review_reason','')
      when previous_reviews->>s.id::text is not null and previous_reviews->>s.id::text not like '%강사 연결 확인 필요%'
      then nullif(concat_ws(' / ',previous_reviews->>s.id::text,s.review_reason),'') else s.review_reason end
    where s.class_id=(item->>'class_id')::uuid and s.day=(item->>'day')::date and s.period=coalesce(item->>'period','');
    insert into audit_logs(operator_id,actor_email,action,target_table,target_id,before_value,after_value)
    select (actor(p_token)).id,(actor(p_token)).email,'slot_metadata','slots',s.id::text,before_meta,jsonb_build_object('module',s.module,'hours',s.hours,'review_reason',s.review_reason)
    from slots s where s.class_id=(item->>'class_id')::uuid and s.day=(item->>'day')::date and s.period=coalesce(item->>'period','');
   end if;
  end loop;
 end if;
 return result;
end $$;
commit;
