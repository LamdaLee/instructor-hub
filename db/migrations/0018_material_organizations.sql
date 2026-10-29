-- 교재는 강사 소속과 별도로 자료 기관을 보존하고 목록·파일·변경에 같은 권한을 적용한다.
begin;
alter table hub.materials add column organization text references hub.organizations;
update hub.materials m set organization=i.organization from hub.instructors i where i.id=m.instructor_id and i.organization in ('CLIPS','aSSIST','LGE','LAB4DX');
create index on hub.materials(organization,created_at desc) where deleted_at is null;
create function hub.material_org_allowed(o hub.operators,p_org text) returns boolean
language sql immutable as $$
 select coalesce(o.role='admin' or o.organization in ('LGE','LAB4DX') or (o.organization in ('CLIPS','aSSIST') and o.organization=p_org),false)
$$;
revoke all on function hub.material_org_allowed(hub.operators,text) from public,hub_app;
alter function hub.api_read(bytea,text,jsonb) rename to read_before_material_orgs;
revoke all on function hub.read_before_material_orgs(bytea,text,jsonb) from public,hub_app;
create function hub.api_read(p_token bytea,p_view text,p_filter jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=hub,pg_temp as $$
declare o operators:=actor(p_token);begin
 if o.id is null then return '{"ok":false,"code":"session_expired"}';end if;
 if p_view<>'materials' then return read_before_material_orgs(p_token,p_view,p_filter);end if;
 return jsonb_build_object('ok',true,'rows',(select coalesce(jsonb_agg(to_jsonb(m)-'disk_key' order by created_at desc),'[]') from materials m
  where m.deleted_at is null and (m.published or o.role='admin') and material_org_allowed(o,m.organization)
   and (nullif(p_filter->>'organization','') is null or m.organization=p_filter->>'organization')
   and (nullif(p_filter->>'subject','') is null or m.subject=p_filter->>'subject')
   and (nullif(p_filter->>'q','') is null or m.subject ilike '%'||(p_filter->>'q')||'%' or m.filename ilike '%'||(p_filter->>'q')||'%')));
end $$;
create or replace function hub.api_material(p_token bytea,p_action text,p_data jsonb) returns jsonb
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
   if not exists(select 1 from instructors where id=(p_data->>'instructor_id')::uuid and organization=target_org and archived_at is null) then return '{"ok":false,"code":"bad_request"}';end if;
   update materials set organization=target_org,subject=p_data->>'subject',instructor_id=(p_data->>'instructor_id')::uuid,published=case when o.role='admin' then coalesce((p_data->>'published')::boolean,true) else published end,filename=coalesce(p_data->>'filename',filename),disk_key=coalesce((p_data->>'disk_key')::uuid,disk_key),bytes=coalesce((p_data->>'bytes')::bigint,bytes),mime=coalesce(p_data->>'mime',mime),updated_at=now() where id=v;
  end if;
 end if;
 insert into audit_logs(operator_id,actor_email,action,target_table,target_id,summary,before_value,after_value) select o.id,coalesce(o.email,'공개 사용자'),'material_'||p_action,'materials',v::text,coalesce(p_data->>'reason','')||' / 작업자(입력값): '||coalesce(p_data->>'actor',p_data->>'uploader',m.uploader),old,to_jsonb(x)-'disk_key' from materials x where id=v;
 return jsonb_build_object('ok',true,'id',v,'previous_key',case when p_action='update' and p_data ? 'disk_key' then m.disk_key end);
end $$;
revoke all on function hub.api_read(bytea,text,jsonb),hub.api_material(bytea,text,jsonb) from public;
grant execute on function hub.api_read(bytea,text,jsonb),hub.api_material(bytea,text,jsonb) to hub_app;
commit;
