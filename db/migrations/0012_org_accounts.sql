-- 기관 계정: 가입 신청(LAB4DX 승인)과 강사 등록·삭제 변경 신청(LGE·LAB4DX 승인·반려).
-- aSSIST·CLIPS 계정은 자기 기관 강사와 신청만 보고 신청한다. 기관 계정은 시간표·과정을 직접 바꾸지 않는다.
begin;
alter table hub.operators add column organization text references hub.organizations;
create table hub.signup_requests(
 id uuid primary key default gen_random_uuid(),
 email text not null check(email=lower(email) and length(email) between 3 and 320),
 name text not null check(length(trim(name)) between 1 and 80),
 organization text not null references hub.organizations check(organization in ('aSSIST','CLIPS','LGE','LAB4DX')),
 password_hash text not null,
 status text not null default 'submitted' check(status in ('submitted','approved','rejected')),
 created_at timestamptz not null default now(),
 decided_by uuid references hub.operators,decided_at timestamptz,decision_note text not null default '',
 operator_id uuid references hub.operators
);
create unique index signup_one_pending on hub.signup_requests(email) where status='submitted';
create table hub.instructor_requests(
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('register','remove')),
 organization text not null references hub.organizations,
 instructor_id uuid references hub.instructors,
 name text not null check(length(trim(name)) between 1 and 100),
 phone text not null default '' check(length(phone)<=50),
 email text not null default '' check(length(email)<=254),
 reason text not null check(length(trim(reason)) between 1 and 2000),
 status text not null default 'submitted' check(status in ('submitted','approved','rejected')),
 requested_by uuid not null references hub.operators,created_at timestamptz not null default now(),
 decided_by uuid references hub.operators,decided_at timestamptz,decision_note text not null default '',
 check(kind='register' or instructor_id is not null)
);
create index on hub.instructor_requests(organization,created_at desc);
create unique index instructor_one_pending_removal on hub.instructor_requests(instructor_id) where kind='remove' and status='submitted';
revoke all on hub.signup_requests,hub.instructor_requests from public,hub_app;

-- 전체 기관 열람·변경 신청 승인: 관리자, LGE, LAB4DX. 가입 승인: 관리자, LAB4DX.
create function hub.sees_all_orgs(o hub.operators) returns boolean language sql immutable as $$
 select o.role='admin' or coalesce(o.organization in ('LGE','LAB4DX'),false) $$;
create function hub.approves_signups(o hub.operators) returns boolean language sql immutable as $$
 select o.role='admin' or coalesce(o.organization='LAB4DX',false) $$;
revoke all on function hub.sees_all_orgs(hub.operators),hub.approves_signups(hub.operators) from public,hub_app;

create or replace function hub.api_me(p_token bytea) returns jsonb language plpgsql security definer set search_path=hub,pg_temp as $$
declare o operators:=actor(p_token); begin
 if o.id is null then return '{"ok":false,"code":"session_expired"}'; end if;
 return jsonb_build_object('ok',true,'operator',jsonb_build_object('id',o.id,'email',o.email,'name',o.name,'role',o.role,'organization',o.organization,
  'all_orgs',sees_all_orgs(o),'review_requests',sees_all_orgs(o),'review_signups',approves_signups(o)));
end $$;

-- 비로그인 가입 신청. 이미 계정이 있거나 대기 중인 이메일도 같은 응답을 돌려 존재 여부를 드러내지 않는다.
create function hub.api_signup(p_data jsonb,p_ip text) returns jsonb
language plpgsql security definer set search_path=hub,extensions,pg_temp as $$
declare v_email text:=lower(trim(p_data->>'email'));v_id uuid;begin
 if jsonb_typeof(p_data) is distinct from 'object' or v_email is null or v_email!~'^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_email)>320
  or nullif(trim(p_data->>'name'),'') is null or length(trim(p_data->>'name'))>80
  or coalesce(p_data->>'organization','') not in ('aSSIST','CLIPS','LGE','LAB4DX') then return '{"ok":false,"code":"bad_request"}'; end if;
 if p_data->>'password' is null or length(p_data->>'password')<10 or octet_length(p_data->>'password')>72 then return '{"ok":false,"code":"weak_password"}'; end if;
 if rate_hit('signup:'||coalesce(p_ip,'unknown'))>5 then return '{"ok":false,"code":"rate_limited"}'; end if;
 if exists(select 1 from operators where email=v_email) or exists(select 1 from signup_requests where email=v_email and status='submitted') then return '{"ok":true}'; end if;
 insert into signup_requests(email,name,organization,password_hash) values(v_email,trim(p_data->>'name'),p_data->>'organization',crypt(p_data->>'password',gen_salt('bf',12))) returning id into v_id;
 insert into audit_logs(actor_email,action,target_table,target_id,summary) values(v_email,'signup_request','signup_requests',v_id::text,'가입 신청 · '||(p_data->>'organization'));
 return '{"ok":true}';
end $$;

create function hub.api_org(p_token bytea,p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=hub,pg_temp as $$
declare o operators:=actor(p_token);r instructor_requests;s signup_requests;i instructors;v_org text;v_id uuid;v_note text;begin
 if o.id is null then return '{"ok":false,"code":"session_expired"}'; end if;
 if jsonb_typeof(p_data) is distinct from 'object' then return '{"ok":false,"code":"bad_request"}'; end if;
 v_note:=trim(coalesce(p_data->>'note',''));
 if p_action='instructors' then
  return jsonb_build_object('ok',true,'rows',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'organization',x.organization,'phone',x.phone,'email',x.email,
   'pending',exists(select 1 from instructor_requests q where q.instructor_id=x.id and q.kind='remove' and q.status='submitted')) order by x.organization,x.name),'[]')
   from instructors x where x.archived_at is null and (sees_all_orgs(o) or x.organization=o.organization)
    and (nullif(p_data->>'q','') is null or x.name ilike '%'||(p_data->>'q')||'%')));
 elsif p_action='requests' then
  return jsonb_build_object('ok',true,'rows',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'kind',q.kind,'organization',q.organization,'instructor_id',q.instructor_id,
   'name',q.name,'phone',q.phone,'email',q.email,'reason',q.reason,'status',q.status,'created_at',q.created_at,'requested_by',a.name,
   'decided_by',d.name,'decided_at',q.decided_at,'decision_note',q.decision_note) order by q.status<>'submitted',q.created_at desc),'[]')
   from (select * from instructor_requests where sees_all_orgs(o) or organization=o.organization order by created_at desc limit 300) q
   join operators a on a.id=q.requested_by left join operators d on d.id=q.decided_by));
 elsif p_action='submit' then
  if length(v_note) not between 1 and 2000 then return '{"ok":false,"code":"bad_request"}'; end if;
  if p_data->>'kind'='register' then
   v_org:=case when sees_all_orgs(o) then nullif(p_data->>'organization','') else o.organization end;
   if v_org is null or not exists(select 1 from organizations where name=v_org) or nullif(trim(p_data->>'name'),'') is null or length(trim(p_data->>'name'))>100
    or length(coalesce(p_data->>'phone',''))>50 or length(coalesce(p_data->>'email',''))>254 then return '{"ok":false,"code":"bad_request"}'; end if;
   if exists(select 1 from instructor_requests where kind='register' and status='submitted' and organization=v_org and lower(trim(name))=lower(trim(p_data->>'name'))) then return '{"ok":false,"code":"duplicate"}'; end if;
   insert into instructor_requests(kind,organization,name,phone,email,reason,requested_by)
   values('register',v_org,trim(p_data->>'name'),trim(coalesce(p_data->>'phone','')),trim(coalesce(p_data->>'email','')),v_note,o.id) returning * into r;
  elsif p_data->>'kind'='remove' then
   select * into i from instructors where id=nullif(p_data->>'instructor_id','')::uuid and archived_at is null for update;
   if i.id is null or not (sees_all_orgs(o) or i.organization=o.organization) then return '{"ok":false,"code":"not_found"}'; end if;
   if exists(select 1 from instructor_requests where instructor_id=i.id and kind='remove' and status='submitted') then return '{"ok":false,"code":"duplicate"}'; end if;
   insert into instructor_requests(kind,organization,instructor_id,name,reason,requested_by)
   values('remove',coalesce(i.organization,o.organization,'LAB4DX'),i.id,i.name,v_note,o.id) returning * into r;
  else return '{"ok":false,"code":"bad_request"}'; end if;
  insert into audit_logs(operator_id,actor_email,action,target_table,target_id,summary,after_value)
  values(o.id,o.email,'instructor_request','instructor_requests',r.id::text,r.kind||' 신청 · '||r.organization,to_jsonb(r)-'phone'-'email');
  return jsonb_build_object('ok',true,'id',r.id);
 elsif p_action='decide' then
  if not sees_all_orgs(o) then return '{"ok":false,"code":"forbidden"}'; end if;
  if p_data->>'decision' not in ('approve','reject') or length(v_note)>2000 or (p_data->>'decision'='reject' and v_note='') then return '{"ok":false,"code":"bad_request"}'; end if;
  select * into r from instructor_requests where id=nullif(p_data->>'id','')::uuid for update;
  if r.id is null then return '{"ok":false,"code":"not_found"}'; end if;
  if r.status<>'submitted' then return '{"ok":false,"code":"already_decided"}'; end if;
  if p_data->>'decision'='approve' then
   if r.kind='register' then
    insert into instructors(name,organization,phone,email) values(r.name,r.organization,nullif(r.phone,''),nullif(r.email,'')) returning id into v_id;
    update instructor_requests set instructor_id=v_id where id=r.id;
    insert into audit_logs(operator_id,actor_email,action,target_table,target_id,summary,after_value)
    select o.id,o.email,'save','instructor',v_id::text,'강사 등록 신청 승인',to_jsonb(x)-'phone'-'email' from instructors x where x.id=v_id;
   else
    select * into i from instructors where id=r.instructor_id and archived_at is null for update;
    if i.id is null then return '{"ok":false,"code":"not_found"}'; end if;
    update instructors set archived_at=now() where id=i.id;
    insert into audit_logs(operator_id,actor_email,action,target_table,target_id,summary,before_value,after_value)
    select o.id,o.email,'save','instructor',i.id::text,'강사 삭제 신청 승인(보관)',to_jsonb(i)-'phone'-'email',to_jsonb(x)-'phone'-'email' from instructors x where x.id=i.id;
   end if;
  end if;
  update instructor_requests set status=case when p_data->>'decision'='approve' then 'approved' else 'rejected' end,decided_by=o.id,decided_at=now(),decision_note=v_note where id=r.id;
  insert into audit_logs(operator_id,actor_email,action,target_table,target_id,summary)
  values(o.id,o.email,'instructor_request_'||(p_data->>'decision'),'instructor_requests',r.id::text,v_note);
  return jsonb_build_object('ok',true,'id',r.id);
 elsif p_action='signups' then
  if not approves_signups(o) then return '{"ok":false,"code":"forbidden"}'; end if;
  return jsonb_build_object('ok',true,'rows',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'email',q.email,'name',q.name,'organization',q.organization,'status',q.status,
   'created_at',q.created_at,'decided_by',d.name,'decided_at',q.decided_at,'decision_note',q.decision_note) order by q.status<>'submitted',q.created_at desc),'[]')
   from (select * from signup_requests order by created_at desc limit 300) q left join operators d on d.id=q.decided_by));
 elsif p_action='decide_signup' then
  if not approves_signups(o) then return '{"ok":false,"code":"forbidden"}'; end if;
  if p_data->>'decision' not in ('approve','reject') or length(v_note)>2000 or (p_data->>'decision'='reject' and v_note='') then return '{"ok":false,"code":"bad_request"}'; end if;
  select * into s from signup_requests where id=nullif(p_data->>'id','')::uuid for update;
  if s.id is null then return '{"ok":false,"code":"not_found"}'; end if;
  if s.status<>'submitted' then return '{"ok":false,"code":"already_decided"}'; end if;
  if p_data->>'decision'='approve' then
   if exists(select 1 from operators where email=s.email) then return '{"ok":false,"code":"duplicate"}'; end if;
   insert into operators(email,name,password_hash,role,organization) values(s.email,s.name,s.password_hash,'member',s.organization) returning id into v_id;
  end if;
  update signup_requests set status=case when p_data->>'decision'='approve' then 'approved' else 'rejected' end,decided_by=o.id,decided_at=now(),decision_note=v_note,operator_id=v_id,
   password_hash=case when p_data->>'decision'='approve' then password_hash else '' end where id=s.id;
  insert into audit_logs(operator_id,actor_email,action,target_table,target_id,summary)
  values(o.id,o.email,'signup_'||(p_data->>'decision'),'signup_requests',s.id::text,s.organization||coalesce(' · '||nullif(v_note,''),''));
  return jsonb_build_object('ok',true,'id',s.id);
 end if;
 return '{"ok":false,"code":"bad_request"}';
end $$;

-- 관리자 계정 화면에서 소속 기관을 함께 보고 지정한다.
alter function hub.api_read(bytea,text,jsonb) rename to read_catalog;
revoke all on function hub.read_catalog(bytea,text,jsonb) from public,hub_app;
create function hub.api_read(p_token bytea,p_view text,p_filter jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=hub,pg_temp as $$
declare r jsonb:=read_catalog(p_token,p_view,p_filter);begin
 if p_view='operators' and coalesce((r->>'ok')::boolean,false) then
  r:=jsonb_set(r,'{rows}',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'email',email,'role',role,'active',active,'organization',organization) order by email),'[]') from operators));
 end if;
 return r;
end $$;
alter function hub.api_save(bytea,text,jsonb) rename to save_settings;
revoke all on function hub.save_settings(bytea,text,jsonb) from public,hub_app;
create function hub.api_save(p_token bytea,p_kind text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=hub,pg_temp as $$
declare o operators;r jsonb;v_org text;begin
 if p_kind='operator' then
  v_org:=nullif(p_data->>'organization','');
  if v_org is not null and not exists(select 1 from organizations where name=v_org) then return '{"ok":false,"code":"bad_request"}'; end if;
 end if;
 r:=save_settings(p_token,p_kind,p_data);
 if p_kind='operator' and coalesce((r->>'ok')::boolean,false) and p_data ? 'organization' then
  o:=actor(p_token);
  update operators set organization=v_org where id=(r->>'id')::uuid and organization is distinct from v_org;
  if found then
   delete from sessions where operator_id=(r->>'id')::uuid;
   insert into audit_logs(operator_id,actor_email,action,target_table,target_id,after_value) values(o.id,o.email,'operator_organization','operators',r->>'id',jsonb_build_object('organization',v_org));
  end if;
 end if;
 return r;
end $$;
revoke all on function hub.api_read(bytea,text,jsonb),hub.api_save(bytea,text,jsonb),hub.api_signup(jsonb,text),hub.api_org(bytea,text,jsonb) from public;
grant execute on function hub.api_read(bytea,text,jsonb),hub.api_save(bytea,text,jsonb),hub.api_signup(jsonb,text),hub.api_org(bytea,text,jsonb) to hub_app;
commit;
