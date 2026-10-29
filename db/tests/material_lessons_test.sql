begin;
insert into hub.operators(id,email,name,password_hash,role,organization) values
 ('00000000-0000-0000-0000-000000000031','lesson-clips@example.invalid','가상 클립스','unused','member','CLIPS');
insert into hub.sessions values(decode(repeat('31',32),'hex'),'00000000-0000-0000-0000-000000000031',now()+interval '1 hour');
insert into hub.subjects(name) values('가상 반복 프로젝트'),('가상 변경된 과목');
insert into hub.instructors(id,name,organization) values
 ('00000000-0000-0000-0000-000000000032','가상 원래 강사','CLIPS'),
 ('00000000-0000-0000-0000-000000000033','가상 새 강사','CLIPS'),
 ('00000000-0000-0000-0000-000000000034','가상 타 기관 강사','LGE');
insert into hub.classes(id,region,cohort,track,name) values
 ('00000000-0000-0000-0000-000000000035','대전',1,'AX','가상 프로젝트 1반'),
 ('00000000-0000-0000-0000-000000000036','대전',2,'AX','가상 프로젝트 2반');
insert into hub.slots(id,class_id,day,subject,instructor_id,organization,kind) values
 ('00000000-0000-0000-0000-000000000037','00000000-0000-0000-0000-000000000035','2099-03-02','가상 반복 프로젝트','00000000-0000-0000-0000-000000000032','CLIPS','수업'),
 ('00000000-0000-0000-0000-000000000038','00000000-0000-0000-0000-000000000035','2099-03-03','가상 반복 프로젝트','00000000-0000-0000-0000-000000000032','CLIPS','수업'),
 ('00000000-0000-0000-0000-000000000039','00000000-0000-0000-0000-000000000036','2099-03-02','가상 반복 프로젝트','00000000-0000-0000-0000-000000000034','LGE','수업');
set local role hub_app;
do $$ declare c bytea:=decode(repeat('31',32),'hex');r jsonb;payload jsonb;v uuid;begin
 assert hub.api_read(null,'material_lessons','{"from":"2099-03-02"}')->>'code'='session_expired','수업 후보 비로그인 차단';
 r:=hub.api_read(c,'material_lessons','{"from":"2099-03-02","to":"2099-03-02"}');assert jsonb_array_length(r->'rows')=1,'다른 기관 수업 후보 제외';
 assert r->'rows'->0->>'cohort'='1' and r->'rows'->0->>'instructor_name'='가상 원래 강사','기수·반·강사 후보 정보';
 assert jsonb_array_length(hub.api_read(c,'material_lessons','{"from":"2099-03-02","organization":"LGE"}')->'rows')=0,'기관 필터 우회 차단';
 payload:='{"slot_id":"00000000-0000-0000-0000-000000000037","subject":"가상 변경된 과목","instructor_id":"00000000-0000-0000-0000-000000000033","organization":"CLIPS","filename":"프로젝트.pdf","bytes":10,"mime":"application/pdf","uploader":"가상 등록자","reason":"등록"}';
 r:=hub.api_material(c,'upload',payload||jsonb_build_object('disk_key',gen_random_uuid()));assert (r->>'ok')::boolean,'수업 연결 교재 등록';v:=(r->>'id')::uuid;
 r:=hub.api_material(c,'upload',payload||jsonb_build_object('disk_key',gen_random_uuid()));assert (r->>'ok')::boolean and (r->>'id')::uuid<>v,'같은 수업·파일명에 여러 교재 허용';
 r:=hub.api_material(c,'upload',payload||jsonb_build_object('slot_id','00000000-0000-0000-0000-000000000038','disk_key',gen_random_uuid()));assert (r->>'ok')::boolean,'다음 날 같은 프로젝트 과목 구분';
 assert hub.api_material(c,'upload',payload||jsonb_build_object('slot_id','00000000-0000-0000-0000-000000000039','disk_key',gen_random_uuid()))->>'code'='lesson_unavailable','타 기관 수업 ID 위조 차단';
 r:=hub.api_read(c,'materials','{"q":"가상 반복 프로젝트"}');
 assert jsonb_array_length(r->'rows')=3,'클라이언트 과목 위조 무시·수업의 과목 자동 등록';
 assert exists(select 1 from jsonb_array_elements(r->'rows') x where x->>'lesson_day'='2099-03-02' and x->>'lesson_track'='AX' and x->>'lesson_region'='대전' and x->>'lesson_instructor'='가상 원래 강사'),'등록 당시 정보 저장';
end $$;
reset role;
update hub.slots set subject='가상 변경된 과목',instructor_id='00000000-0000-0000-0000-000000000033' where id='00000000-0000-0000-0000-000000000037';
-- 과목 관리의 이름 변경 등으로 연결용 정식 이름이 바뀌어도 표시용 등록 정보는 보존한다.
update hub.materials set subject='가상 변경된 과목' where slot_id='00000000-0000-0000-0000-000000000037';
delete from hub.slots where id='00000000-0000-0000-0000-000000000037';
set local role hub_app;
do $$ declare c bytea:=decode(repeat('31',32),'hex');r jsonb;v uuid;begin
 r:=hub.api_read(c,'materials','{"q":"가상 반복 프로젝트"}');assert jsonb_array_length(r->'rows')=3,'등록 당시 과목명으로 검색';
 select (x->>'id')::uuid into v from jsonb_array_elements(r->'rows') x where x->>'lesson_day'='2099-03-02' limit 1;
 assert exists(select 1 from jsonb_array_elements(r->'rows') x where (x->>'id')::uuid=v and x->>'lesson_instructor'='가상 원래 강사' and x->>'slot_id' is null),'시간표 삭제 후에도 등록 당시 정보 보존';
 r:=hub.api_material(c,'update',jsonb_build_object('id',v,'subject','가상 반복 프로젝트','instructor_id','00000000-0000-0000-0000-000000000033','actor','가상 수정자','reason','파일 정보 수정'));
 assert (r->>'ok')::boolean,'원본 수업 삭제 후 교재 수정 가능';
 r:=hub.api_material(c,'file',jsonb_build_object('id',v));assert r->'material'->>'lesson_subject'='가상 반복 프로젝트' and r->'material'->>'lesson_instructor'='가상 원래 강사','수정 시에도 등록 정보 유지';
end $$;
reset role;
rollback;
