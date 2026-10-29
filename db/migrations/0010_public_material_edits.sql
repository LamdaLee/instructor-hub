-- 명시적 사용자 승인: 공개 교재는 비로그인 누구나 수정·삭제. 비공개 자료는 관리자만 접근.
begin;
create or replace function hub.api_material(p_token bytea,p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=hub,pg_temp as $$
declare o operators:=actor(p_token);m materials;v uuid;old jsonb;begin
 if p_action not in ('upload','update','delete','file') then return '{"ok":false,"code":"bad_request"}';end if;
 if p_action in ('update','delete') and (nullif(trim(p_data->>'actor'),'') is null or length(p_data->>'actor')>80 or nullif(trim(p_data->>'reason'),'') is null or length(p_data->>'reason')>1000) then return '{"ok":false,"code":"bad_request"}';end if;
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
  select * into m from materials where id=v and deleted_at is null and (published or o.role='admin') for update;
  if m.id is null then return '{"ok":false,"code":"not_found"}';end if;
  old:=to_jsonb(m)-'disk_key';
  if p_action='delete' then update materials set deleted_at=now(),updated_at=now() where id=v;
  else
   if p_data ? 'disk_key' and (select coalesce(sum(bytes),0) from materials)-m.bytes+(p_data->>'bytes')::bigint>2147483648 then return '{"ok":false,"code":"storage_full"}';end if;
   update materials set subject=p_data->>'subject',instructor_id=(p_data->>'instructor_id')::uuid,published=case when o.role='admin' then coalesce((p_data->>'published')::boolean,true) else published end,filename=coalesce(p_data->>'filename',filename),disk_key=coalesce((p_data->>'disk_key')::uuid,disk_key),bytes=coalesce((p_data->>'bytes')::bigint,bytes),mime=coalesce(p_data->>'mime',mime),updated_at=now() where id=v;
  end if;
 end if;
 insert into audit_logs(operator_id,actor_email,action,target_table,target_id,summary,before_value,after_value) select o.id,coalesce(o.email,'공개 사용자'),'material_'||p_action,'materials',v::text,coalesce(p_data->>'reason','')||' / 작업자(입력값): '||coalesce(p_data->>'actor',p_data->>'uploader',m.uploader),old,to_jsonb(x)-'disk_key' from materials x where id=v;
 return jsonb_build_object('ok',true,'id',v,'previous_key',case when p_action='update' and p_data ? 'disk_key' then m.disk_key end);
end $$;
commit;
