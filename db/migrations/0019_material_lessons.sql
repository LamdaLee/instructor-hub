-- 수업 연결은 선택한 시간표 ID로 검증하고, 등록 당시 정보를 교재마다 보존한다.
-- 같은 수업·과목·파일명에 여러 자료를 허용하며 기존 자료는 추정해서 연결하지 않는다.
begin;
alter table hub.materials
 add column slot_id uuid references hub.slots on delete set null,
 add column lesson_day date,
 add column lesson_region text,
 add column lesson_track text,
 add column lesson_cohort integer,
 add column lesson_class_name text,
 add column lesson_instructor text,
 add column lesson_subject text;
create index on hub.materials(slot_id) where deleted_at is null;
alter function hub.api_read(bytea,text,jsonb) rename to read_before_material_schedule;
revoke all on function hub.read_before_material_schedule(bytea,text,jsonb) from public,hub_app;
create function hub.api_read(p_token bytea,p_view text,p_filter jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=hub,pg_temp as $$
declare o operators:=actor(p_token);begin
 if o.id is null then return '{"ok":false,"code":"session_expired"}';end if;
 if p_view='materials' then
  return jsonb_build_object('ok',true,'rows',(select coalesce(jsonb_agg(to_jsonb(m)-'disk_key' order by lesson_day desc nulls last,created_at desc),'[]') from materials m
   where m.deleted_at is null and (m.published or o.role='admin') and material_org_allowed(o,m.organization)
    and (nullif(p_filter->>'organization','') is null or m.organization=p_filter->>'organization')
    and (nullif(p_filter->>'subject','') is null or m.subject=p_filter->>'subject')
    and (nullif(p_filter->>'q','') is null or m.subject ilike '%'||(p_filter->>'q')||'%' or m.lesson_subject ilike '%'||(p_filter->>'q')||'%' or m.filename ilike '%'||(p_filter->>'q')||'%')));
 end if;
 if p_view<>'material_lessons' then return read_before_material_schedule(p_token,p_view,p_filter);end if;
 if nullif(p_filter->>'from','') is null or (nullif(p_filter->>'to','') is not null and p_filter->>'to'<>p_filter->>'from') then return '{"ok":false,"code":"bad_request"}';end if;
 return jsonb_build_object('ok',true,'rows',(select coalesce(jsonb_agg(to_jsonb(x) order by region,track,cohort,class_name,period),'[]') from (
  select s.id,s.day,c.region,c.track,c.cohort,c.name class_name,s.period,s.subject,s.instructor_id,i.name instructor_name,i.organization
  from slots s join classes c on c.id=s.class_id join instructors i on i.id=s.instructor_id
  where s.day=(p_filter->>'from')::date and s.kind='수업' and s.subject is not null and i.archived_at is null
   and i.organization in ('CLIPS','aSSIST','LGE','LAB4DX') and material_org_allowed(o,i.organization)
   and (nullif(p_filter->>'organization','') is null or i.organization=p_filter->>'organization')
   and (nullif(p_filter->>'region','') is null or c.region=p_filter->>'region')
   and (nullif(p_filter->>'track','') is null or c.track=p_filter->>'track')
 ) x));
end $$;
alter function hub.api_material(bytea,text,jsonb) rename to material_before_schedule;
revoke all on function hub.material_before_schedule(bytea,text,jsonb) from public,hub_app;
create or replace function hub.material_before_schedule(p_token bytea,p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=hub,pg_temp as $$
declare o operators:=actor(p_token);m materials;v uuid;old jsonb;target_org text;teacher_org text;begin
 if o.id is null then return '{"ok":false,"code":"session_expired"}';end if;
 if p_action not in ('upload','update','delete','file') then return '{"ok":false,"code":"bad_request"}';end if;
 if p_action in ('update','delete') and (nullif(trim(p_data->>'actor'),'') is null or length(p_data->>'actor')>80 or nullif(trim(p_data->>'reason'),'') is null or length(p_data->>'reason')>1000) then return '{"ok":false,"code":"bad_request"}';end if;
 v:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());
 if p_action='file' then
  select * into m from materials where id=v and deleted_at is null and (published or o.role='admin') and material_org_allowed(o,organization);
  if m.id is null then return '{"ok":false,"code":"not_found"}';end if;
  return jsonb_build_object('ok',true,'material',to_jsonb(m));
 end if;
 perform pg_advisory_xact_lock(8734038);
 if p_action='upload' then
  if rate_hit('upload:'||coalesce(p_data->>'ip','unknown'))>20 then return '{"ok":false,"code":"rate_limited"}';end if;
  if (select coalesce(sum(bytes),0) from materials)+(p_data->>'bytes')::bigint>2147483648 then return '{"ok":false,"code":"storage_full"}';end if;
  if not exists(select 1 from instructors where id=(p_data->>'instructor_id')::uuid and archived_at is null) then return '{"ok":false,"code":"bad_request"}';end if;
  select organization into teacher_org from instructors where id=(p_data->>'instructor_id')::uuid;
  target_org:=coalesce(nullif(p_data->>'organization',''),teacher_org);
  if target_org is null or target_org not in ('CLIPS','aSSIST','LGE','LAB4DX') then return '{"ok":false,"code":"bad_request"}';end if;
  if not material_org_allowed(o,target_org) then return '{"ok":false,"code":"forbidden"}';end if;
  if teacher_org is distinct from target_org then return '{"ok":false,"code":"bad_request"}';end if;
  insert into materials(id,subject,instructor_id,filename,disk_key,bytes,mime,uploader,published,organization) values(v,p_data->>'subject',(p_data->>'instructor_id')::uuid,p_data->>'filename',(p_data->>'disk_key')::uuid,(p_data->>'bytes')::bigint,p_data->>'mime',trim(p_data->>'uploader'),case when o.role='admin' then coalesce((p_data->>'published')::boolean,true) else true end,target_org);
 else
  select * into m from materials where id=v and deleted_at is null and (published or o.role='admin') and material_org_allowed(o,organization) for update;
  if m.id is null then return '{"ok":false,"code":"not_found"}';end if;
  old:=to_jsonb(m)-'disk_key';
  if p_action='delete' then update materials set deleted_at=now(),updated_at=now() where id=v;
  else
   if p_data ? 'disk_key' and (select coalesce(sum(bytes),0) from materials)-m.bytes+(p_data->>'bytes')::bigint>2147483648 then return '{"ok":false,"code":"storage_full"}';end if;
   target_org:=coalesce(nullif(p_data->>'organization',''),m.organization);
   if target_org is null or target_org not in ('CLIPS','aSSIST','LGE','LAB4DX') then return '{"ok":false,"code":"bad_request"}';end if;
   if not material_org_allowed(o,target_org) then return '{"ok":false,"code":"forbidden"}';end if;
   if not (m.lesson_day is not null and m.instructor_id=(p_data->>'instructor_id')::uuid and m.organization=target_org) and not exists(select 1 from instructors where id=(p_data->>'instructor_id')::uuid and organization=target_org and archived_at is null) then return '{"ok":false,"code":"bad_request"}';end if;
   update materials set organization=target_org,subject=p_data->>'subject',instructor_id=(p_data->>'instructor_id')::uuid,published=case when o.role='admin' then coalesce((p_data->>'published')::boolean,true) else published end,filename=coalesce(p_data->>'filename',filename),disk_key=coalesce((p_data->>'disk_key')::uuid,disk_key),bytes=coalesce((p_data->>'bytes')::bigint,bytes),mime=coalesce(p_data->>'mime',mime),updated_at=now() where id=v;
  end if;
 end if;
 insert into audit_logs(operator_id,actor_email,action,target_table,target_id,summary,before_value,after_value) select o.id,coalesce(o.email,'공개 사용자'),'material_'||p_action,'materials',v::text,coalesce(p_data->>'reason','')||' / 작업자(입력값): '||coalesce(p_data->>'actor',p_data->>'uploader',m.uploader),old,to_jsonb(x)-'disk_key' from materials x where id=v;
 return jsonb_build_object('ok',true,'id',v,'previous_key',case when p_action='update' and p_data ? 'disk_key' then m.disk_key end);
end $$;
create function hub.api_material(p_token bytea,p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=hub,pg_temp as $$
declare o operators:=actor(p_token);m materials;snapshot jsonb;r jsonb;data jsonb:=p_data;begin
 if o.id is null then return '{"ok":false,"code":"session_expired"}';end if;
 if p_action not in ('upload','update') then return material_before_schedule(p_token,p_action,p_data);end if;
 if p_action='update' then
  select * into m from materials where id=nullif(p_data->>'id','')::uuid and deleted_at is null and (published or o.role='admin') and material_org_allowed(o,organization) for update;
  if m.id is null then return '{"ok":false,"code":"not_found"}';end if;
 end if;
 if nullif(p_data->>'organization','') is not null and not material_org_allowed(o,p_data->>'organization') then return '{"ok":false,"code":"forbidden"}';end if;
 if p_action='upload' or nullif(p_data->>'slot_id','') is not null then
  if nullif(p_data->>'slot_id','') is null then return '{"ok":false,"code":"lesson_required"}';end if;
  select jsonb_build_object('slot_id',s.id,'lesson_day',s.day,'lesson_region',c.region,'lesson_track',c.track,'lesson_cohort',c.cohort,'lesson_class_name',c.name,'lesson_instructor',i.name,'lesson_subject',s.subject,
   'subject',s.subject,'instructor_id',i.id,'organization',i.organization) into snapshot
  from slots s join classes c on c.id=s.class_id join instructors i on i.id=s.instructor_id
  where s.id=(p_data->>'slot_id')::uuid and s.kind='수업' and s.subject is not null and i.archived_at is null
   and i.organization in ('CLIPS','aSSIST','LGE','LAB4DX') and material_org_allowed(o,i.organization);
  if snapshot is null then return '{"ok":false,"code":"lesson_unavailable"}';end if;
  if (p_data ? 'organization' and p_data->>'organization' is distinct from snapshot->>'organization') then return '{"ok":false,"code":"bad_request"}';end if;
  data:=p_data||snapshot;
 elsif m.lesson_day is not null then
  -- 파일 교체만으로 시간표의 이후 변경이나 클라이언트 입력에 스냅샷을 덮어쓰지 않는다.
  data:=p_data||jsonb_build_object('subject',m.subject,'instructor_id',m.instructor_id,'organization',m.organization);
 end if;
 r:=material_before_schedule(p_token,p_action,data);
 if coalesce((r->>'ok')::boolean,false) and snapshot is not null then
  update materials set slot_id=(snapshot->>'slot_id')::uuid,lesson_day=(snapshot->>'lesson_day')::date,
   lesson_region=snapshot->>'lesson_region',lesson_track=snapshot->>'lesson_track',lesson_cohort=(snapshot->>'lesson_cohort')::integer,
   lesson_class_name=snapshot->>'lesson_class_name',lesson_instructor=snapshot->>'lesson_instructor',lesson_subject=snapshot->>'lesson_subject' where id=(r->>'id')::uuid;
  insert into audit_logs(operator_id,actor_email,action,target_table,target_id,summary,before_value,after_value)
  values(o.id,o.email,'material_lesson','materials',r->>'id','교재 수업 연결',case when m.id is null then null else to_jsonb(m)-'disk_key' end,snapshot);
 end if;
 return r;
end $$;
revoke all on function hub.api_read(bytea,text,jsonb),hub.api_material(bytea,text,jsonb),hub.material_before_schedule(bytea,text,jsonb) from public;
revoke all on function hub.material_before_schedule(bytea,text,jsonb) from hub_app;
grant execute on function hub.api_read(bytea,text,jsonb),hub.api_material(bytea,text,jsonb) to hub_app;
commit;
