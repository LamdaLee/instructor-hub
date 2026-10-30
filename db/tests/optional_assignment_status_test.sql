begin;
insert into hub.operators(id,email,name,password_hash,role) values
 ('00000000-0000-0000-0000-000000000161','status-admin@example.invalid','가상 관리자','unused','admin'),
 ('00000000-0000-0000-0000-000000000162','status-member@example.invalid','가상 운영진','unused','member');
insert into hub.sessions values(decode(repeat('a1',32),'hex'),'00000000-0000-0000-0000-000000000161',now()+interval '1 hour'),(decode(repeat('a2',32),'hex'),'00000000-0000-0000-0000-000000000162',now()+interval '1 hour');
insert into hub.classes(id,region,cohort,track,name) values('00000000-0000-0000-0000-000000000163','대전',96,'TEST-STATUS','가상 상태 반');
set local role hub_app;
do $$
declare a bytea:=decode(repeat('a1',32),'hex');m bytea:=decode(repeat('a2',32),'hex');r jsonb;item jsonb;state text;
payload jsonb:='{"rows":[{"class_id":"00000000-0000-0000-0000-000000000163","day":"2098-01-05","kind":"수업"}]}';begin
 r:=hub.api_save(a,'slots',payload);assert (r->>'ok')::boolean,'상태 생략 신규 저장';
 item:=hub.api_read(a,'slots','{"class_id":"00000000-0000-0000-0000-000000000163"}')->'rows'->0;
 assert item->>'assignment_status'='','기본은 빈 상태';
 payload:=payload||'{"overwrite":true}';
 foreach state in array array['임시','변경예정','확정',''] loop
  payload:=jsonb_set(payload,'{rows,0,assignment_status}',to_jsonb(state));
  r:=hub.api_save(a,'slots',payload);assert (r->>'ok')::boolean,'세 상태와 해제 저장';
  item:=hub.api_read(a,'slots','{"class_id":"00000000-0000-0000-0000-000000000163"}')->'rows'->0;
  assert item->>'assignment_status'=state,'지정·해제 상태 반영';
 end loop;
 assert hub.api_save(m,'slots',payload)->>'code'='forbidden','기관 계정 직접 변경 차단';
 payload:=jsonb_set(payload,'{rows,0,assignment_status}','"오류"');
 assert hub.api_save(a,'slots',payload)->>'code'='bad_request','미지원 상태 차단';
end $$;
reset role;
rollback;
