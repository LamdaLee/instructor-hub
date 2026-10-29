-- 선택하지 않은 필터의 빈 문자열을 NULL과 동일하게 처리한다.
begin;
create or replace function hub.api_read(p_token bytea,p_view text,p_filter jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=hub,pg_temp as $$
declare o operators:=actor(p_token); result jsonb; today date:=(now() at time zone 'Asia/Seoul')::date; begin
 if o.id is null then return '{"ok":false,"code":"session_expired"}'; end if;
 if p_view='options' then
  return jsonb_build_object('ok',true,'regions',(select jsonb_agg(name order by name) from regions),
   'organizations',(select jsonb_agg(name order by name) from organizations),
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
