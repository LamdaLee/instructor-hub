-- 시간표 편집에서도 최신 모듈·시수 정보를 보존하고 변경을 기록한다.
begin;
create or replace function hub.api_save(p_token bytea,p_kind text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=hub,pg_temp as $$
declare item jsonb; existing boolean; result jsonb; before_meta jsonb; begin
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
 result:=save_impl(p_token,p_kind,p_data);
 if (result->>'ok')::boolean and p_kind='slots' then
  for item in select * from jsonb_array_elements(p_data->'rows') loop
   if item ? 'module' or item ? 'hours' then
    select jsonb_build_object('module',s.module,'hours',s.hours) into before_meta from slots s where s.class_id=(item->>'class_id')::uuid and s.day=(item->>'day')::date and s.period=coalesce(item->>'period','');
    update slots s set module=case when item ? 'module' then nullif(item->>'module','') else s.module end,
     hours=case when item ? 'hours' then (item->>'hours')::numeric else s.hours end
    where s.class_id=(item->>'class_id')::uuid and s.day=(item->>'day')::date and s.period=coalesce(item->>'period','');
    insert into audit_logs(operator_id,actor_email,action,target_table,target_id,before_value,after_value)
    select (actor(p_token)).id,(actor(p_token)).email,'slot_metadata','slots',s.id::text,before_meta,jsonb_build_object('module',s.module,'hours',s.hours)
    from slots s where s.class_id=(item->>'class_id')::uuid and s.day=(item->>'day')::date and s.period=coalesce(item->>'period','');
   end if;
  end loop;
 end if;
 return result;
end $$;
create or replace function hub.api_read(p_token bytea,p_view text,p_filter jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=hub,pg_temp as $$
declare o operators:=actor(p_token); result jsonb; today date:=(now() at time zone 'Asia/Seoul')::date; begin
 if o.id is null then return '{"ok":false,"code":"session_expired"}'; end if;
 if p_view='options' then
  return jsonb_build_object('ok',true,'regions',(select jsonb_agg(name order by name) from regions),
   'organizations',(select jsonb_agg(name order by name) from organizations),
   'modules',(select coalesce(jsonb_agg(to_jsonb(m) order by track,subject,name),'[]') from modules m),
   'subjects',(select coalesce(jsonb_agg(to_jsonb(x) order by name),'[]') from subjects x),
   'classes',(select coalesce(jsonb_agg(to_jsonb(x) order by region,cohort,track),'[]') from classes x),
   'instructors',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'organization',organization) order by name),'[]') from instructors where archived_at is null));
 elsif p_view in ('slots','dashboard','reports','export') then
  with filtered as (
   select * from slot_view s where
    (nullif(p_filter->>'region','') is null or s.region=p_filter->>'region') and
    (nullif(p_filter->>'cohort','') is null or s.cohort=(p_filter->>'cohort')::int) and
    (nullif(p_filter->>'track','') is null or s.track=p_filter->>'track') and
    (nullif(p_filter->>'organization','') is null or s.organization=p_filter->>'organization') and
    (nullif(p_filter->>'class_id','') is null or s.class_id=(p_filter->>'class_id')::uuid) and
    (nullif(p_filter->>'instructor_id','') is null or s.instructor_id=(p_filter->>'instructor_id')::uuid) and
    (nullif(p_filter->>'subject','') is null or s.subject=p_filter->>'subject') and
    (nullif(p_filter->>'from','') is null or s.day>=(p_filter->>'from')::date) and
    (nullif(p_filter->>'to','') is null or s.day<=(p_filter->>'to')::date)
  ) select coalesce(jsonb_agg(to_jsonb(f) order by day,class_name,period),'[]') into result from filtered f;
  if p_view='dashboard' then
   return jsonb_build_object('ok',true,'rows',result,'today',today,
    'unassigned',(select coalesce(jsonb_agg(to_jsonb(s) order by day),'[]') from slot_view s where day between today and today+13 and instructor_id is null and kind='수업'
      and (nullif(p_filter->>'region','') is null or s.region=p_filter->>'region') and (nullif(p_filter->>'cohort','') is null or s.cohort=(p_filter->>'cohort')::int)
      and (nullif(p_filter->>'track','') is null or s.track=p_filter->>'track') and (nullif(p_filter->>'organization','') is null or s.organization=p_filter->>'organization')),
    'review',(select count(*) from slot_view s where review_reason is not null
      and (nullif(p_filter->>'region','') is null or s.region=p_filter->>'region') and (nullif(p_filter->>'cohort','') is null or s.cohort=(p_filter->>'cohort')::int)
      and (nullif(p_filter->>'track','') is null or s.track=p_filter->>'track') and (nullif(p_filter->>'organization','') is null or s.organization=p_filter->>'organization')));
  end if;
  if p_view='export' then
   insert into audit_logs(operator_id,actor_email,action,target_table,summary) values(o.id,o.email,'export','slots',jsonb_build_object('contacts',coalesce(nullif(p_filter->>'contacts','')::boolean,false),'rows',jsonb_array_length(result))::text);
   if coalesce(nullif(p_filter->>'contacts','')::boolean,false) then
    select coalesce(jsonb_agg(e.value||jsonb_build_object('phone',i.phone,'email',i.email)),'[]') into result
    from jsonb_array_elements(result) e left join instructors i on i.id=(e.value->>'instructor_id')::uuid;
   end if;
  end if;
  return jsonb_build_object('ok',true,'rows',result);
 elsif p_view='instructors' then
  with scheduled as (select s.* from slot_view s where
    (nullif(p_filter->>'region','') is null or s.region=p_filter->>'region') and
    (nullif(p_filter->>'cohort','') is null or s.cohort=(p_filter->>'cohort')::int) and
    (nullif(p_filter->>'track','') is null or s.track=p_filter->>'track') and
    (nullif(p_filter->>'subject','') is null or s.subject=p_filter->>'subject')),
  data as (select i.id,i.name,i.organization,i.subjects,i.archived_at,
    array(select distinct s.subject from slots s where s.instructor_id=i.id and s.subject is not null) taught_subjects,
    array(select distinct s.region from scheduled s where s.instructor_id=i.id) regions,
    array(select distinct s.class_name from scheduled s where s.instructor_id=i.id) classes,
    (select count(distinct s.day) from scheduled s where s.instructor_id=i.id) total_days,
    (select max(s.day) from scheduled s where s.instructor_id=i.id and s.day<=today) last_day,
    (select min(s.day) from scheduled s where s.instructor_id=i.id and s.day>=today) next_day
   from instructors i where
    (coalesce(nullif(p_filter->>'archived','')::boolean,false) or i.archived_at is null) and
    (nullif(p_filter->>'organization','') is null or i.organization=p_filter->>'organization') and
    (nullif(p_filter->>'q','') is null or i.name ilike '%'||(p_filter->>'q')||'%') and
    (nullif(p_filter->>'subject','') is null or p_filter->>'subject'=any(i.subjects) or exists(select 1 from slots s where s.instructor_id=i.id and s.subject=p_filter->>'subject')) and
    ((nullif(p_filter->>'region','') is null and nullif(p_filter->>'cohort','') is null and nullif(p_filter->>'track','') is null) or exists(select 1 from scheduled s where s.instructor_id=i.id)))
  select coalesce(jsonb_agg(to_jsonb(d) order by name),'[]') into result from data d;
  return jsonb_build_object('ok',true,'rows',result);
 elsif p_view='instructor' then
  select to_jsonb(i) into result from instructors i where id=(p_filter->>'id')::uuid;
  if result is null then return '{"ok":false,"code":"not_found"}'; end if;
  return jsonb_build_object('ok',true,'instructor',result,'rows',(select coalesce(jsonb_agg(to_jsonb(s) order by day),'[]') from slot_view s where instructor_id=(p_filter->>'id')::uuid));
 elsif p_view in ('operators','audit') then
  if o.role<>'admin' then return '{"ok":false,"code":"forbidden"}'; end if;
  if p_view='operators' then
   select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'email',email,'role',role,'active',active) order by email),'[]') into result from operators;
  else
   select coalesce(jsonb_agg(to_jsonb(a) order by created_at desc),'[]') into result from
    (select id,actor_email,action,target_table,target_id,summary,before_value,after_value,created_at from audit_logs order by created_at desc limit 200 offset greatest(0,coalesce(nullif(p_filter->>'offset','')::int,0))) a;
  end if;
  return jsonb_build_object('ok',true,'rows',result);
 end if;
 return '{"ok":false,"code":"bad_request"}';
end $$;
commit;
