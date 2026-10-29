-- 강사 허브: 앱은 hub.api_* 함수만 실행한다.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema hub;
revoke all on schema hub from public;
alter default privileges in schema hub revoke execute on functions from public;
create table hub.regions(name text primary key check(length(name)>0));
insert into hub.regions values ('대전'),('대구'),('부산');
create table hub.organizations(name text primary key check(length(name)>0));
insert into hub.organizations values ('aSSIST'),('CLIPS'),('LGE'),('LAB4DX');
create table hub.classes(
 id uuid primary key default gen_random_uuid(), region text not null references hub.regions,
 cohort int not null check(cohort>0), track text not null, name text not null check(length(trim(name))>0),
 starts_on date, ends_on date, active boolean not null default true,
 check(ends_on is null or starts_on is null or ends_on>=starts_on)
);
create table hub.subjects(name text primary key check(length(trim(name))>0),track text);
create table hub.instructors(
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name))>0),
 organization text references hub.organizations, phone text, email text, subjects text[] not null default '{}',
 memo text not null default '', archived_at timestamptz
);
create table hub.slots(
 id uuid primary key default gen_random_uuid(), class_id uuid not null references hub.classes,
 day date not null, period text not null default '', subject text references hub.subjects,
 instructor_id uuid references hub.instructors, instructor_name text not null default '',
 organization text references hub.organizations, kind text not null default '수업' check(kind in ('수업','공통','휴일','없음')),
 place text not null default '',note text not null default '',review_reason text,
 unique(class_id,day,period)
);
create index on hub.slots(day,class_id);
create index on hub.slots(instructor_id,day);
create table hub.operators(
 id uuid primary key default gen_random_uuid(),email text not null unique check(email=lower(email)),name text not null,
 password_hash text not null, role text not null default 'member' check(role in ('admin','member')),active boolean not null default true
);
create table hub.sessions(token_hash bytea primary key,operator_id uuid not null references hub.operators,expires_at timestamptz not null);
create table hub.rate_limits(key text primary key,hits int not null,until_at timestamptz not null);
create table hub.audit_logs(
 id uuid primary key default gen_random_uuid(),operator_id uuid references hub.operators,actor_email text,
 action text not null,target_table text not null,target_id text,summary text,
 before_value jsonb,after_value jsonb,created_at timestamptz not null default now()
);
create index on hub.audit_logs(created_at desc);
create table hub.import_runs(digest text primary key,counts jsonb not null,created_at timestamptz not null default now());
create function hub.actor(p_token bytea) returns hub.operators
language sql stable set search_path=hub,pg_temp as $$
 select o.* from operators o join sessions s on s.operator_id=o.id
 where s.token_hash=p_token and s.expires_at>now() and o.active
$$;
create function hub.rate_hit(p_key text) returns int language plpgsql set search_path=hub,pg_temp as $$
declare n int; begin
 insert into rate_limits values(p_key,1,now()+interval '15 minutes')
 on conflict(key) do update set hits=case when rate_limits.until_at<=now() then 1 else rate_limits.hits+1 end,
 until_at=case when rate_limits.until_at<=now() then now()+interval '15 minutes' else rate_limits.until_at end returning hits into n;
 return n;
end $$;
create function hub.api_login(p_email text,p_password text,p_token bytea,p_ip text) returns jsonb
language plpgsql security definer set search_path=hub,extensions,pg_temp as $$
declare o operators; k text := 'ip:'||coalesce(p_ip,'unknown'); begin
 if octet_length(p_token)<>32 or length(p_email)>320 or length(p_password)>200 then return '{"ok":false,"code":"bad_request"}'; end if;
 if rate_hit(k)>30 or rate_hit('email:'||lower(p_email))>10 then return '{"ok":false,"code":"rate_limited"}'; end if;
 select * into o from operators where email=lower(trim(p_email)) and active;
 if o.id is null or crypt(p_password,o.password_hash) is distinct from o.password_hash then
  return '{"ok":false,"code":"invalid_credentials"}';
 end if;
 delete from rate_limits where key='email:'||lower(p_email);
 delete from sessions where expires_at<now();
 insert into sessions values(p_token,o.id,now()+interval '8 hours');
 insert into audit_logs(operator_id,actor_email,action,target_table,target_id) values(o.id,o.email,'login','operators',o.id::text);
 return jsonb_build_object('ok',true,'operator',jsonb_build_object('id',o.id,'name',o.name,'role',o.role));
end $$;
create function hub.api_logout(p_token bytea) returns jsonb language plpgsql security definer set search_path=hub,pg_temp as $$
begin delete from sessions where token_hash=p_token; return '{"ok":true}'; end $$;
create function hub.api_me(p_token bytea) returns jsonb language plpgsql security definer set search_path=hub,pg_temp as $$
declare o operators:=actor(p_token); begin
 if o.id is null then return '{"ok":false,"code":"session_expired"}'; end if;
 return jsonb_build_object('ok',true,'operator',jsonb_build_object('id',o.id,'email',o.email,'name',o.name,'role',o.role));
end $$;
-- 로그·목록에 연락처와 인증 정보를 포함하지 않는다.
create view hub.slot_view as
 select s.*,c.name class_name,c.region,c.cohort,c.track,i.name linked_name,
 exists(select 1 from hub.slots x where x.id<>s.id and x.day=s.day and x.class_id<>s.class_id and x.instructor_id=s.instructor_id) conflict
 from hub.slots s join hub.classes c on c.id=s.class_id left join hub.instructors i on i.id=s.instructor_id;
create function hub.api_read(p_token bytea,p_view text,p_filter jsonb default '{}') returns jsonb
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
   insert into audit_logs(operator_id,actor_email,action,target_table,summary) values(o.id,o.email,'export','slots',jsonb_build_object('contacts',coalesce((p_filter->>'contacts')::boolean,false),'rows',jsonb_array_length(result))::text);
   if coalesce((p_filter->>'contacts')::boolean,false) then
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
    (coalesce((p_filter->>'archived')::boolean,false) or i.archived_at is null) and
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
    (select id,actor_email,action,target_table,target_id,summary,before_value,after_value,created_at from audit_logs order by created_at desc limit 200 offset greatest(0,coalesce((p_filter->>'offset')::int,0))) a;
  end if;
  return jsonb_build_object('ok',true,'rows',result);
 end if;
 return '{"ok":false,"code":"bad_request"}';
end $$;
create function hub.api_save(p_token bytea,p_kind text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=hub,extensions,pg_temp as $$
declare o operators:=actor(p_token); v_id uuid; before_row jsonb; after_row jsonb; item jsonb;
 v_slot slots; v_instructor instructors; v_class classes; v_operator operators; v_name text; v_conflicts int:=0; begin
 if o.id is null then return '{"ok":false,"code":"session_expired"}'; end if;
 if p_kind in ('operator','class','organization','subject') and o.role<>'admin' then return '{"ok":false,"code":"forbidden"}'; end if;
 v_id:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());
 if p_kind='slots' then
  if jsonb_typeof(p_data->'rows')<>'array' or jsonb_array_length(p_data->'rows')=0 or jsonb_array_length(p_data->'rows')>500 then return '{"ok":false,"code":"bad_request"}'; end if;
  -- 반영 전에 대상 반을 순서대로 잠가 동시 편집과 덮어쓰기 확인의 경쟁을 막는다.
  perform 1 from classes where id in(select (x->>'class_id')::uuid from jsonb_array_elements(p_data->'rows') x) order by id for update;
  for item in select * from jsonb_array_elements(p_data->'rows') loop
   if not exists(select 1 from classes where id=(item->>'class_id')::uuid) then return '{"ok":false,"code":"bad_request"}'; end if;
   if exists(select 1 from slots where class_id=(item->>'class_id')::uuid and day=(item->>'day')::date and period=coalesce(item->>'period','')
     and id is distinct from nullif(item->>'id','')::uuid) and not coalesce((p_data->>'overwrite')::boolean,false) then
    return '{"ok":false,"code":"overwrite_required"}';
   end if;
  end loop;
  for item in select * from jsonb_array_elements(p_data->'rows') loop
   select * into v_slot from slots where class_id=(item->>'class_id')::uuid and day=(item->>'day')::date and period=coalesce(item->>'period','') for update;
   before_row:=to_jsonb(v_slot); v_id:=coalesce(v_slot.id,gen_random_uuid());
   if nullif(item->>'subject','') is not null then insert into subjects(name) values(item->>'subject') on conflict do nothing; end if;
   if nullif(item->>'instructor_id','') is not null then
    select * into v_instructor from instructors where id=(item->>'instructor_id')::uuid;
    if v_instructor.id is null then raise exception 'invalid instructor' using errcode='22023'; end if;
   else v_instructor:=null; end if;
   insert into slots(id,class_id,day,period,subject,instructor_id,instructor_name,organization,kind,place,note,review_reason)
   values(v_id,(item->>'class_id')::uuid,(item->>'day')::date,coalesce(item->>'period',''),nullif(item->>'subject',''),
    v_instructor.id,coalesce(nullif(item->>'instructor_name',''),v_instructor.name,''),nullif(item->>'organization',''),coalesce(item->>'kind','수업'),coalesce(item->>'place',''),coalesce(item->>'note',''),
    case when v_instructor.id is null and nullif(item->>'instructor_name','') is not null then '강사 연결 확인 필요' end)
   on conflict(id) do update set subject=excluded.subject,instructor_id=excluded.instructor_id,instructor_name=excluded.instructor_name,organization=excluded.organization,
    kind=excluded.kind,place=excluded.place,note=excluded.note,review_reason=excluded.review_reason;
   select to_jsonb(s) into after_row from slots s where id=v_id;
   insert into audit_logs(operator_id,actor_email,action,target_table,target_id,before_value,after_value) values(o.id,o.email,'save','slots',v_id::text,before_row,after_row);
  end loop;
  select count(*) into v_conflicts from slot_view where conflict and id in(select s.id from slots s join jsonb_array_elements(p_data->'rows') x on s.class_id=(x->>'class_id')::uuid and s.day=(x->>'day')::date);
  return jsonb_build_object('ok',true,'conflicts',v_conflicts);
 elsif p_kind='instructor' then
  select * into v_instructor from instructors where id=v_id for update; before_row:=to_jsonb(v_instructor)-'phone'-'email';
  insert into instructors(id,name,organization,phone,email,subjects,memo,archived_at)
  values(v_id,p_data->>'name',nullif(p_data->>'organization',''),p_data->>'phone',p_data->>'email',
   array(select jsonb_array_elements_text(coalesce(p_data->'subjects','[]'))),coalesce(p_data->>'memo',''),(p_data->>'archived_at')::timestamptz)
  on conflict(id) do update set name=excluded.name,organization=excluded.organization,phone=excluded.phone,email=excluded.email,subjects=excluded.subjects,memo=excluded.memo,archived_at=excluded.archived_at;
  select to_jsonb(i)-'phone'-'email' into after_row from instructors i where id=v_id;
 elsif p_kind='class' then
  select * into v_class from classes where id=v_id for update; before_row:=to_jsonb(v_class);
  insert into classes(id,region,cohort,track,name,starts_on,ends_on,active)
  values(v_id,p_data->>'region',(p_data->>'cohort')::int,p_data->>'track',p_data->>'name',nullif(p_data->>'starts_on','')::date,nullif(p_data->>'ends_on','')::date,coalesce((p_data->>'active')::boolean,true))
  on conflict(id) do update set region=excluded.region,cohort=excluded.cohort,track=excluded.track,name=excluded.name,starts_on=excluded.starts_on,ends_on=excluded.ends_on,active=excluded.active;
  select to_jsonb(c) into after_row from classes c where id=v_id;
 elsif p_kind='operator' then
  perform pg_advisory_xact_lock(8734031);
  select * into v_operator from operators where id=v_id for update; before_row:=to_jsonb(v_operator)-'password_hash';
  if v_operator.role='admin' and v_operator.active and (p_data->>'role'<>'admin' or not (p_data->>'active')::boolean)
   and (select count(*) from operators where role='admin' and active)<=1 then return '{"ok":false,"code":"last_admin"}'; end if;
  if (v_operator.id is null or nullif(p_data->>'password','') is not null) and (length(p_data->>'password')<10 or p_data->>'password' is null or octet_length(p_data->>'password')>72) then
   return '{"ok":false,"code":"weak_password"}'; end if;
  insert into operators(id,email,name,password_hash,role,active)
  values(v_id,lower(trim(p_data->>'email')),p_data->>'name',case when nullif(p_data->>'password','') is not null then crypt(p_data->>'password',gen_salt('bf',12)) else v_operator.password_hash end,p_data->>'role',coalesce((p_data->>'active')::boolean,true))
  on conflict(id) do update set email=excluded.email,name=excluded.name,password_hash=excluded.password_hash,role=excluded.role,active=excluded.active;
  if nullif(p_data->>'password','') is not null or not coalesce((p_data->>'active')::boolean,true) or v_operator.role is distinct from p_data->>'role' then delete from sessions where operator_id=v_id; end if;
  select to_jsonb(a)-'password_hash' into after_row from operators a where id=v_id;
 elsif p_kind='organization' then
  v_name:=trim(p_data->>'name'); insert into organizations values(v_name) on conflict do nothing; after_row:=jsonb_build_object('name',v_name);
 elsif p_kind='subject' then
  v_name:=trim(p_data->>'name'); select to_jsonb(s) into before_row from subjects s where name=v_name;
  insert into subjects values(v_name,nullif(p_data->>'track','')) on conflict(name) do update set track=excluded.track;
  after_row:=jsonb_build_object('name',v_name,'track',p_data->>'track');
 else return '{"ok":false,"code":"bad_request"}'; end if;
 insert into audit_logs(operator_id,actor_email,action,target_table,target_id,before_value,after_value)
 values(o.id,o.email,'save',p_kind,coalesce(v_name,v_id::text),before_row,after_row);
 return jsonb_build_object('ok',true,'id',v_id);
end $$;
do $$ begin if not exists(select from pg_roles where rolname='hub_app') then create role hub_app nologin; end if; end $$;
grant usage on schema hub to hub_app;
revoke all on all tables in schema hub from public,hub_app;
revoke all on all functions in schema hub from public,hub_app;
grant execute on function hub.api_login(text,text,bytea,text),hub.api_logout(bytea),hub.api_me(bytea),hub.api_read(bytea,text,jsonb),hub.api_save(bytea,text,jsonb) to hub_app;
commit;
