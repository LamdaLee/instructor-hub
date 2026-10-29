-- 승인된 공개 포털. 기존 hub 데이터와 백업 매핑은 보존한다.
begin;
alter table hub.classes add column manager text not null default '', add column room text not null default '';
alter table hub.slots add column assignment_status text not null default '임시' check(assignment_status in ('임시','변경예정','확정'));
-- 기존 강사 연결 여부로 확정 여부를 추정하지 않는다. 기존 수업은 명시적으로 검토 후 상태를 지정한다.
create or replace view hub.slot_view as
 select s.id,s.class_id,s.day,s.period,s.subject,s.instructor_id,s.instructor_name,s.organization,s.kind,s.place,s.note,s.review_reason,
 c.name class_name,c.region,c.cohort,c.track,i.name linked_name,
 exists(select 1 from hub.slots x where x.id<>s.id and x.day=s.day and x.class_id<>s.class_id and x.instructor_id=s.instructor_id) conflict,
 s.module,s.hours,s.assignment_status
 from hub.slots s join hub.classes c on c.id=s.class_id left join hub.instructors i on i.id=s.instructor_id;
create table hub.announcements(id uuid primary key default gen_random_uuid(),title text not null check(length(title) between 1 and 200),body text not null check(length(body) between 1 and 10000),region text references hub.regions,important boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz);
create table hub.materials(id uuid primary key,subject text not null references hub.subjects, instructor_id uuid not null references hub.instructors,filename text not null check(length(filename) between 1 and 240),disk_key uuid not null unique,bytes bigint not null check(bytes between 1 and 52428800),mime text not null check(mime in ('application/pdf','application/vnd.openxmlformats-officedocument.presentationml.presentation')),uploader text not null check(length(uploader) between 1 and 80),published boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz);
alter function hub.api_save(bytea,text,jsonb) rename to save_v7;
revoke all on function hub.save_v7(bytea,text,jsonb) from public,hub_app;
create function hub.api_save(p_token bytea,p_kind text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=hub,pg_temp as $$
declare o operators:=actor(p_token);r jsonb;v uuid;old jsonb;item jsonb;begin
 if o.id is null then return '{"ok":false,"code":"session_expired"}';end if;
 if o.role<>'admin' then return '{"ok":false,"code":"forbidden"}';end if;
 if p_kind='announcement' then
  v:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());
  select to_jsonb(a) into old from announcements a where id=v for update;
  if coalesce((p_data->>'delete')::boolean,false) then update announcements set deleted_at=now() where id=v;
  else insert into announcements(id,title,body,region,important) values(v,trim(p_data->>'title'),trim(p_data->>'body'),nullif(p_data->>'region',''),coalesce((p_data->>'important')::boolean,false)) on conflict(id) do update set title=excluded.title,body=excluded.body,region=excluded.region,important=excluded.important,updated_at=now();end if;
  insert into audit_logs(operator_id,actor_email,action,target_table,target_id,before_value,after_value) select o.id,o.email,'announcement','announcements',v::text,old,to_jsonb(a) from announcements a where id=v;
  return jsonb_build_object('ok',true,'id',v);
 elsif p_kind='delete_slot' then
  v:=(p_data->>'id')::uuid;select to_jsonb(s) into old from slots s where id=v for update;
  if old is null then return '{"ok":false,"code":"not_found"}';end if;
  delete from slots where id=v;
  insert into audit_logs(operator_id,actor_email,action,target_table,target_id,before_value) values(o.id,o.email,'delete','slots',v::text,old);
  return '{"ok":true}';
 end if;
 if p_kind='slots' and exists(select 1 from jsonb_array_elements(p_data->'rows') x where x ? 'assignment_status' and x->>'assignment_status' not in ('임시','변경예정','확정')) then return '{"ok":false,"code":"bad_request"}';end if;
 r:=save_v7(p_token,p_kind,p_data);
 if coalesce((r->>'ok')::boolean,false) then
  if p_kind='class' then
   v:=(r->>'id')::uuid;select to_jsonb(c) into old from classes c where id=v;
   update classes set manager=coalesce(p_data->>'manager',manager),room=coalesce(p_data->>'room',room) where id=v;
   insert into audit_logs(operator_id,actor_email,action,target_table,target_id,before_value,after_value) select o.id,o.email,'class_details','classes',v::text,old,to_jsonb(c) from classes c where id=v;
  elsif p_kind='slots' then
   for item in select * from jsonb_array_elements(p_data->'rows') loop
    if item ? 'assignment_status' then
     select id,to_jsonb(s) into v,old from slots s where class_id=(item->>'class_id')::uuid and day=(item->>'day')::date and period=coalesce(item->>'period','') for update;
     update slots set assignment_status=item->>'assignment_status' where id=v;
     insert into audit_logs(operator_id,actor_email,action,target_table,target_id,before_value,after_value) select o.id,o.email,'assignment','slots',v::text,old,to_jsonb(s) from slots s where id=v;
    end if;
   end loop;
  end if;
 end if;
 return r;
end $$;
create or replace function hub.api_read(p_token bytea,p_view text,p_filter jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=hub,pg_temp as $$
declare o operators:=actor(p_token); result jsonb; today date:=(now() at time zone 'Asia/Seoul')::date; begin

 if p_view='announcements' then
  return jsonb_build_object('ok',true,'rows',(select coalesce(jsonb_agg(to_jsonb(a) order by important desc,created_at desc),'[]') from announcements a where deleted_at is null and (nullif(p_filter->>'region','') is null or a.region is null or a.region=p_filter->>'region')));
 elsif p_view='materials' then
  return jsonb_build_object('ok',true,'rows',(select coalesce(jsonb_agg(to_jsonb(m)-'disk_key' order by created_at desc),'[]') from materials m where deleted_at is null and (m.published or o.role='admin') and (nullif(p_filter->>'subject','') is null or m.subject=p_filter->>'subject') and (nullif(p_filter->>'q','') is null or m.subject ilike '%'||(p_filter->>'q')||'%' or m.filename ilike '%'||(p_filter->>'q')||'%')));
 elsif p_view='options' then
  return jsonb_build_object('ok',true,'regions',(select jsonb_agg(name order by name) from regions),
   'organizations',(select jsonb_agg(name order by name) from organizations),
   'modules',(select coalesce(jsonb_agg(to_jsonb(m) order by track,subject,name),'[]') from modules m),
   'subjects',(select coalesce(jsonb_agg(to_jsonb(x) order by name),'[]') from subjects x),
   'classes',(select coalesce(jsonb_agg(to_jsonb(x) order by region,cohort,track),'[]') from classes x where x.active or o.role='admin'),
   'instructors',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'organization',organization) order by name),'[]') from instructors where archived_at is null));
 elsif p_view in ('slots','dashboard','reports','export') then
  with filtered as (
   select * from slot_view s where (o.role='admin' or exists(select 1 from classes c where c.id=s.class_id and c.active)) and
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
   if o.id is not null then insert into audit_logs(operator_id,actor_email,action,target_table,summary) values(o.id,o.email,'export','slots',jsonb_build_object('contacts',coalesce(nullif(p_filter->>'contacts','')::boolean,false),'rows',jsonb_array_length(result))::text); end if;
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
    ((o.role='admin' and coalesce(nullif(p_filter->>'archived','')::boolean,false)) or i.archived_at is null) and
    (nullif(p_filter->>'organization','') is null or i.organization=p_filter->>'organization') and
    (nullif(p_filter->>'q','') is null or i.name ilike '%'||(p_filter->>'q')||'%') and
    (nullif(p_filter->>'subject','') is null or p_filter->>'subject'=any(i.subjects) or exists(select 1 from slots s where s.instructor_id=i.id and s.subject=p_filter->>'subject')) and
    ((nullif(p_filter->>'region','') is null and nullif(p_filter->>'cohort','') is null and nullif(p_filter->>'track','') is null) or exists(select 1 from scheduled s where s.instructor_id=i.id)))
  select coalesce(jsonb_agg(to_jsonb(d) order by name),'[]') into result from data d;
  return jsonb_build_object('ok',true,'rows',result);
 elsif p_view='instructor' then
  select to_jsonb(i) into result from instructors i where id=(p_filter->>'id')::uuid and (archived_at is null or o.role='admin');
  if result is null then return '{"ok":false,"code":"not_found"}'; end if;
  return jsonb_build_object('ok',true,'instructor',result,'rows',(select coalesce(jsonb_agg(to_jsonb(s) order by day),'[]') from slot_view s where instructor_id=(p_filter->>'id')::uuid));
 elsif p_view in ('operators','audit') then
  if o.id is null or o.role<>'admin' then return '{"ok":false,"code":"forbidden"}'; end if;
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

create function hub.api_material(p_token bytea,p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=hub,pg_temp as $$
declare o operators:=actor(p_token);m materials;v uuid;old jsonb;begin
 if p_action not in ('upload','update','delete','file') then return '{"ok":false,"code":"bad_request"}';end if;
 if p_action in ('update','delete') and (o.id is null or o.role<>'admin') then return '{"ok":false,"code":"forbidden"}';end if;
 v:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());
 if p_action='file' then
  select * into m from materials where id=v and deleted_at is null and (published or o.role='admin');
  if m.id is null then return '{"ok":false,"code":"not_found"}';end if;
  return jsonb_build_object('ok',true,'material',to_jsonb(m));
 end if;
 perform pg_advisory_xact_lock(8734038);
 if p_action='upload' then
  if rate_hit('upload:'||coalesce(p_data->>'ip','unknown'))>20 then return '{"ok":false,"code":"rate_limited"}';end if;
  if (select coalesce(sum(bytes),0) from materials)+(p_data->>'bytes')::bigint>2147483648 then return '{"ok":false,"code":"storage_full"}';end if;
  if not exists(select 1 from instructors where id=(p_data->>'instructor_id')::uuid and archived_at is null) then return '{"ok":false,"code":"bad_request"}';end if;
  insert into materials(id,subject,instructor_id,filename,disk_key,bytes,mime,uploader,published) values(v,p_data->>'subject',(p_data->>'instructor_id')::uuid,p_data->>'filename',(p_data->>'disk_key')::uuid,(p_data->>'bytes')::bigint,p_data->>'mime',trim(p_data->>'uploader'),case when o.role='admin' then coalesce((p_data->>'published')::boolean,true) else true end);
 else
  select * into m from materials where id=v and deleted_at is null for update;
  if m.id is null then return '{"ok":false,"code":"not_found"}';end if;
  old:=to_jsonb(m)-'disk_key';
  if p_action='delete' then update materials set deleted_at=now(),updated_at=now() where id=v;
  else
   if p_data ? 'disk_key' and (select coalesce(sum(bytes),0) from materials)-m.bytes+(p_data->>'bytes')::bigint>2147483648 then return '{"ok":false,"code":"storage_full"}';end if;
   update materials set subject=p_data->>'subject',instructor_id=(p_data->>'instructor_id')::uuid,published=coalesce((p_data->>'published')::boolean,true),filename=coalesce(p_data->>'filename',filename),disk_key=coalesce((p_data->>'disk_key')::uuid,disk_key),bytes=coalesce((p_data->>'bytes')::bigint,bytes),mime=coalesce(p_data->>'mime',mime),updated_at=now() where id=v;
  end if;
 end if;
 insert into audit_logs(operator_id,actor_email,action,target_table,target_id,summary,before_value,after_value) select o.id,coalesce(o.email,'공개 업로드'),'material_'||p_action,'materials',v::text,coalesce(p_data->>'reason','')||' / 등록자: '||coalesce(p_data->>'uploader',m.uploader),old,to_jsonb(x)-'disk_key' from materials x where id=v;
 return jsonb_build_object('ok',true,'id',v,'previous_key',case when p_action='update' and p_data ? 'disk_key' then m.disk_key end);
end $$;
revoke all on function hub.api_material(bytea,text,jsonb) from public;
grant execute on function hub.api_material(bytea,text,jsonb),hub.api_save(bytea,text,jsonb) to hub_app;
commit;
