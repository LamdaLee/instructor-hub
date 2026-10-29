-- 과목은 보관으로 삭제하고, 이름 변경 시 연결된 수업·자료를 함께 유지한다.
begin;
alter table hub.subjects add column archived_at timestamptz;
alter function hub.api_read(bytea,text,jsonb) rename to read_portal;
revoke all on function hub.read_portal(bytea,text,jsonb) from public,hub_app;
create function hub.api_read(p_token bytea,p_view text,p_filter jsonb default '{}') returns jsonb language plpgsql security definer set search_path=hub,pg_temp as $$
declare r jsonb;begin
 r:=read_portal(p_token,p_view,p_filter);
 if p_view='options' and coalesce((r->>'ok')::boolean,false) then
 r:=jsonb_set(r,'{subjects}',(select coalesce(jsonb_agg(to_jsonb(s) order by name),'[]') from subjects s where s.archived_at is null or (actor(p_token)).role='admin'));
 end if;return r;
end $$;
alter function hub.api_save(bytea,text,jsonb) rename to save_portal;
revoke all on function hub.save_portal(bytea,text,jsonb) from public,hub_app;
create function hub.api_save(p_token bytea,p_kind text,p_data jsonb) returns jsonb language plpgsql security definer set search_path=hub,pg_temp as $$
declare o operators:=actor(p_token);old jsonb;r jsonb;previous text;next_name text;begin
 if o.id is null then return '{"ok":false,"code":"session_expired"}';end if;
 if o.role<>'admin' then return '{"ok":false,"code":"forbidden"}';end if;
 if p_kind not in ('archive_subject','rename_subject') then return save_portal(p_token,p_kind,p_data);end if;
 previous:=p_data->>'old_name';next_name:=trim(p_data->>'name');
 select to_jsonb(s) into old from subjects s where name=previous for update;
 if old is null then return '{"ok":false,"code":"not_found"}';end if;
 if p_kind='archive_subject' then update subjects set archived_at=now() where name=previous;
 else
  if next_name is null or length(next_name) not between 1 and 200 or exists(select 1 from subjects where name=next_name) then return '{"ok":false,"code":"bad_request"}';end if;
  insert into subjects(name,track) values(next_name,p_data->>'track');
  update slots set subject=next_name where subject=previous;
  update modules set subject=next_name where subject=previous;
  update materials set subject=next_name,updated_at=now() where subject=previous;
  update instructors set subjects=array_replace(subjects,previous,next_name) where previous=any(subjects);
  update subjects set archived_at=now() where name=previous;
 end if;
 insert into audit_logs(operator_id,actor_email,action,target_table,target_id,before_value,after_value,summary) values(o.id,o.email,p_kind,'subjects',previous,old,jsonb_build_object('name',case when p_kind='rename_subject' then next_name else previous end,'archived',p_kind='archive_subject'),'과목 연결과 기존 원문 이력 보존');
 return '{"ok":true}';
end $$;
-- 엑셀 원본 반 식별자는 그대로 표시한다.
create or replace view hub.slot_view as select s.id,s.class_id,s.day,s.period,s.subject,s.instructor_id,s.instructor_name,s.organization,s.kind,s.place,s.note,s.review_reason,
 concat(c.region,' ',c.track,' ',c.cohort,'기 · ',coalesce(c.source_code,c.name)) class_name,c.region,c.cohort,c.track,i.name linked_name,
 exists(select 1 from hub.slots x where x.id<>s.id and x.day=s.day and x.class_id<>s.class_id and x.instructor_id=s.instructor_id) conflict,s.module,s.hours,s.assignment_status
 from hub.slots s join hub.classes c on c.id=s.class_id left join hub.instructors i on i.id=s.instructor_id;
grant execute on function hub.api_read(bytea,text,jsonb),hub.api_save(bytea,text,jsonb) to hub_app;
commit;
