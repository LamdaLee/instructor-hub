-- 기본 강의장을 유지하며 반별 예외 기간과 수업별 시간을 관리한다.
begin;
create table hub.venue_overrides(
 id uuid primary key default gen_random_uuid(),
 class_id uuid not null references hub.classes,
 starts_on date not null,
 ends_on date not null check(ends_on>=starts_on),
 room text not null check(length(trim(room)) between 1 and 200),
 note text not null default '' check(length(note)<=2000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index on hub.venue_overrides(class_id,starts_on,ends_on);
revoke all on hub.venue_overrides from public,hub_app;
alter table hub.slots add column start_time time, add column end_time time;
alter table hub.slots add constraint slot_times_valid check(
 (start_time is null and end_time is null) or
 (start_time is not null and end_time is not null and end_time>start_time)
);
create or replace view hub.slot_view as
 select s.id,s.class_id,s.day,s.period,s.subject,s.instructor_id,s.instructor_name,s.organization,s.kind,s.place,s.note,s.review_reason,
 concat(c.region,' ',c.track,' ',c.cohort,'기 · ',coalesce(c.source_code,c.name)) class_name,c.region,c.cohort,c.track,i.name linked_name,
 exists(select 1 from hub.slots x where x.id<>s.id and x.day=s.day and x.class_id<>s.class_id and x.instructor_id=s.instructor_id) conflict,
 s.module,s.hours,s.assignment_status,
 coalesce(nullif(trim(s.place),''),v.room,nullif(trim(c.room),''),'') effective_place,
 s.start_time,s.end_time,
 coalesce(s.start_time,case when coalesce(nullif(trim(s.place),''),v.room,c.room,'') not like '%평택%' then time '09:00' end) effective_start_time,
 coalesce(s.end_time,case when coalesce(nullif(trim(s.place),''),v.room,c.room,'') not like '%평택%' then time '18:00' end) effective_end_time
 from hub.slots s join hub.classes c on c.id=s.class_id
 left join hub.instructors i on i.id=s.instructor_id
 left join hub.venue_overrides v on v.class_id=s.class_id and s.day between v.starts_on and v.ends_on;

alter function hub.api_read(bytea,text,jsonb) rename to read_before_venues;
revoke all on function hub.read_before_venues(bytea,text,jsonb) from public,hub_app;
create function hub.api_read(p_token bytea,p_view text,p_filter jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=hub,pg_temp as $$
declare r jsonb;begin
 r:=read_before_venues(p_token,p_view,p_filter);
 if p_view='options' and coalesce((r->>'ok')::boolean,false) and (actor(p_token)).role='admin' then
  r:=r||jsonb_build_object('venue_overrides',(select coalesce(jsonb_agg(to_jsonb(v) order by starts_on,room),'[]') from venue_overrides v));
 end if;
 return r;
end $$;

alter function hub.api_save(bytea,text,jsonb) rename to save_before_venues;
revoke all on function hub.save_before_venues(bytea,text,jsonb) from public,hub_app;
create function hub.api_save(p_token bytea,p_kind text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=hub,pg_temp as $$
declare o operators;old venue_overrides;v uuid;cid uuid;first_day date;last_day date;item jsonb;r jsonb;previous jsonb;next_time time;finish_time time;begin
 if p_kind not in ('venue_override','delete_venue_override','slots') then return save_before_venues(p_token,p_kind,p_data);end if;
 o:=actor(p_token);
 if o.id is null then return '{"ok":false,"code":"session_expired"}';end if;
 if o.role<>'admin' then return '{"ok":false,"code":"forbidden"}';end if;
 if p_kind in ('venue_override','delete_venue_override') then
  if nullif(p_data->>'id','') is not null then
   select * into old from venue_overrides where id=(p_data->>'id')::uuid;
   if old.id is null then return '{"ok":false,"code":"not_found"}';end if;
   cid:=old.class_id;
  else cid:=(p_data->>'class_id')::uuid;
  end if;
  -- 같은 반의 기간 등록을 직렬화해 동시 요청의 기간 중복도 막는다.
  perform 1 from classes where id=cid for update;
  if not found then return '{"ok":false,"code":"not_found"}';end if;
  if old.id is not null then
   select * into old from venue_overrides where id=old.id for update;
   if not found then return '{"ok":false,"code":"not_found"}';end if;
  end if;
  if p_kind='delete_venue_override' then
   if old.id is null then return '{"ok":false,"code":"bad_request"}';end if;
   delete from venue_overrides where id=old.id;
   insert into audit_logs(operator_id,actor_email,action,target_table,target_id,summary,before_value)
   values(o.id,o.email,p_kind,'venue_overrides',old.id::text,'강의장 예외 기간 삭제',to_jsonb(old));
   return jsonb_build_object('ok',true,'id',old.id);
  end if;
  if (p_data->>'class_id')::uuid is distinct from cid or
   jsonb_typeof(p_data->'room') is distinct from 'string' or length(trim(p_data->>'room')) not between 1 and 200 or
   jsonb_typeof(p_data->'note') is distinct from 'string' or length(p_data->>'note')>2000 or
   coalesce(p_data->>'starts_on','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(p_data->>'ends_on','') !~ '^\d{4}-\d{2}-\d{2}$' then return '{"ok":false,"code":"bad_request"}';end if;
  first_day:=(p_data->>'starts_on')::date;last_day:=(p_data->>'ends_on')::date;
  if last_day<first_day then return '{"ok":false,"code":"bad_request"}';end if;
  if exists(select 1 from venue_overrides where class_id=cid and id is distinct from old.id and starts_on<=last_day and ends_on>=first_day) then return '{"ok":false,"code":"venue_overlap"}';end if;
  v:=coalesce(old.id,gen_random_uuid());
  insert into venue_overrides(id,class_id,starts_on,ends_on,room,note) values(v,cid,first_day,last_day,trim(p_data->>'room'),p_data->>'note')
  on conflict(id) do update set starts_on=excluded.starts_on,ends_on=excluded.ends_on,room=excluded.room,note=excluded.note,updated_at=now();
  insert into audit_logs(operator_id,actor_email,action,target_table,target_id,summary,before_value,after_value)
  select o.id,o.email,p_kind,'venue_overrides',v::text,'강의장 예외 기간 저장',case when old.id is null then null else to_jsonb(old) end,to_jsonb(x) from venue_overrides x where id=v;
  return jsonb_build_object('ok',true,'id',v);
 end if;
 -- 시간을 생략한 기존 API 호출은 이전 시간을 그대로 보존한다.
 for item in select value from jsonb_array_elements(p_data->'rows') loop
  if (item ? 'start_time') <> (item ? 'end_time') then return '{"ok":false,"code":"bad_request"}';end if;
  if item ? 'start_time' then
   if (nullif(item->>'start_time','') is null) <> (nullif(item->>'end_time','') is null) then return '{"ok":false,"code":"bad_request"}';end if;
   if nullif(item->>'start_time','') is not null then
    if item->>'start_time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:00)?$' or item->>'end_time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:00)?$' then return '{"ok":false,"code":"bad_request"}';end if;
    if (item->>'end_time')::time <= (item->>'start_time')::time then return '{"ok":false,"code":"bad_request"}';end if;
   end if;
  end if;
 end loop;
 r:=save_before_venues(p_token,p_kind,p_data);
 if coalesce((r->>'ok')::boolean,false) then
  for item in select value from jsonb_array_elements(p_data->'rows') loop
   if item ? 'start_time' then
    select id,to_jsonb(s) into v,previous from slots s where class_id=(item->>'class_id')::uuid and day=(item->>'day')::date and period=coalesce(item->>'period','') for update;
    next_time:=nullif(item->>'start_time','')::time;finish_time:=nullif(item->>'end_time','')::time;
    update slots set start_time=next_time,end_time=finish_time where id=v;
    if previous->>'start_time' is distinct from next_time::text or previous->>'end_time' is distinct from finish_time::text then
     insert into audit_logs(operator_id,actor_email,action,target_table,target_id,summary,before_value,after_value)
     select o.id,o.email,'slot_times','slots',v::text,'수업 시간 변경',previous,to_jsonb(s) from slots s where id=v;
    end if;
   end if;
  end loop;
 end if;
 return r;
end $$;
revoke all on function hub.api_read(bytea,text,jsonb),hub.api_save(bytea,text,jsonb) from public;
grant execute on function hub.api_read(bytea,text,jsonb),hub.api_save(bytea,text,jsonb) to hub_app;
commit;
