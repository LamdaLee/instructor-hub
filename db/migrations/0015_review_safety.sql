-- 승인 대기 건수와 가입 승인 시 기관 정정·권한 확인. 기존 권한 범위는 유지한다.
begin;
create or replace function hub.api_org(p_token bytea,p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=hub,pg_temp as $$
declare o operators:=actor(p_token);r instructor_requests;s signup_requests;i instructors;v_org text;v_id uuid;v_note text;chosen_org text;begin
 if o.id is null then return '{"ok":false,"code":"session_expired"}'; end if;
 if jsonb_typeof(p_data) is distinct from 'object' then return '{"ok":false,"code":"bad_request"}'; end if;
 v_note:=trim(coalesce(p_data->>'note',''));
 if p_action='counts' then
  return jsonb_build_object('ok',true,
   'requests',case when sees_all_orgs(o) then (select count(*) from instructor_requests where status='submitted') else 0 end,
   'signups',case when approves_signups(o) then (select count(*) from signup_requests where status='submitted') else 0 end);
 elsif p_action='instructors' then
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
   chosen_org:=coalesce(p_data->>'organization',s.organization);
   if chosen_org not in ('aSSIST','CLIPS','LGE','LAB4DX') then return '{"ok":false,"code":"bad_request"}';end if;
   if chosen_org in ('LGE','LAB4DX') and coalesce(p_data->>'confirm_privileged','false')<>'true' then return '{"ok":false,"code":"bad_request"}';end if;
   if exists(select 1 from operators where email=s.email) then return '{"ok":false,"code":"duplicate"}'; end if;
   insert into operators(email,name,password_hash,role,organization) values(s.email,s.name,s.password_hash,'member',chosen_org) returning id into v_id;
  end if;
  update signup_requests set organization=coalesce(chosen_org,organization),status=case when p_data->>'decision'='approve' then 'approved' else 'rejected' end,decided_by=o.id,decided_at=now(),decision_note=v_note,operator_id=v_id,
   password_hash=case when p_data->>'decision'='approve' then password_hash else '' end where id=s.id;
  insert into audit_logs(operator_id,actor_email,action,target_table,target_id,summary)
  values(o.id,o.email,'signup_'||(p_data->>'decision'),'signup_requests',s.id::text,coalesce(chosen_org,s.organization)||coalesce(' · '||nullif(v_note,''),''));
  if chosen_org is distinct from s.organization and chosen_org is not null then
   insert into audit_logs(operator_id,actor_email,action,target_table,target_id,before_value,after_value,summary) values(o.id,o.email,'signup_organization','signup_requests',s.id::text,jsonb_build_object('organization',s.organization),jsonb_build_object('organization',chosen_org),'가입 승인 시 소속 기관 정정');
  end if;
  return jsonb_build_object('ok',true,'id',s.id);
 end if;
 return '{"ok":false,"code":"bad_request"}';
end $$;
revoke all on function hub.api_org(bytea,text,jsonb) from public;
grant execute on function hub.api_org(bytea,text,jsonb) to hub_app;
commit;
