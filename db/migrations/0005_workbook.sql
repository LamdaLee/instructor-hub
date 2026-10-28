-- 최신 통합 엑셀의 교과목·모듈·시수와 출처 식별자를 보존한다.
begin;
alter table hub.classes add column source_code text unique, add column cohort_label text;
alter table hub.slots add column module text, add column hours numeric(5,2) check(hours between 0 and 24);
create table hub.modules(track text not null,subject text not null references hub.subjects,name text not null,hours numeric(5,2) not null check(hours between 0 and 24),primary key(track,subject,name));
create table hub.workbook_instructors(source_id text primary key,instructor_id uuid not null unique references hub.instructors);
create table hub.import_snapshots(digest text primary key,slots jsonb not null,created_at timestamptz not null default now());
alter table hub.import_runs add column source text not null default 'backup';
revoke all on hub.modules,hub.workbook_instructors,hub.import_snapshots from public,hub_app;
create or replace view hub.slot_view as
 select s.id,s.class_id,s.day,s.period,s.subject,s.instructor_id,s.instructor_name,s.organization,s.kind,s.place,s.note,s.review_reason,
 concat(c.region,' ',c.track,' ',c.cohort,'기 · ',coalesce(c.source_code,c.name)) class_name,c.region,c.cohort,c.track,i.name linked_name,
 exists(select 1 from hub.slots x where x.id<>s.id and x.day=s.day and x.class_id<>s.class_id and x.instructor_id=s.instructor_id) conflict,
 s.module,s.hours
 from hub.slots s join hub.classes c on c.id=s.class_id left join hub.instructors i on i.id=s.instructor_id;
commit;
