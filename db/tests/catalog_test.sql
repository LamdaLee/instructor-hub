begin;
insert into hub.operators(id,email,name,password_hash,role) values('00000000-0000-0000-0000-000000000091','catalog@example.invalid','가상 관리자','unused','admin');
insert into hub.sessions values(decode(repeat('91',32),'hex'),'00000000-0000-0000-0000-000000000091',now()+interval '1 hour');
set local role hub_app;
do $$ declare a bytea:=decode(repeat('91',32),'hex');r jsonb;begin
 r:=hub.api_save(a,'subject','{"name":"이름 변경 전 가상 과목","track":"TEST"}');assert (r->>'ok')::boolean,'과목 등록';
 r:=hub.api_save(a,'rename_subject','{"old_name":"이름 변경 전 가상 과목","name":"이름 변경 후 가상 과목","track":"TEST"}');assert (r->>'ok')::boolean,'과목 이름 변경';
 assert exists(select 1 from jsonb_array_elements(hub.api_read(null,'options','{}')->'subjects') x where x->>'name'='이름 변경 후 가상 과목'),'새 과목 선택 가능';
 assert not exists(select 1 from jsonb_array_elements(hub.api_read(null,'options','{}')->'subjects') x where x->>'name'='이름 변경 전 가상 과목'),'이전 과목 신규 선택 제외';
 r:=hub.api_save(a,'archive_subject','{"old_name":"이름 변경 후 가상 과목"}');assert (r->>'ok')::boolean,'과목 보관';
 assert not exists(select 1 from jsonb_array_elements(hub.api_read(null,'options','{}')->'subjects') x where x->>'name'='이름 변경 후 가상 과목'),'보관 과목 신규 선택 제외';
 begin perform hub.save_portal(a,'subject','{"name":"우회"}');raise exception '내부 쓰기 권한 노출';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
