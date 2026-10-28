begin;
insert into hub.operators(id,email,name,password_hash,role) values('00000000-0000-0000-0000-000000000041','admin-test@example.invalid','가상 관리자',extensions.crypt('known-test-password',extensions.gen_salt('bf')),'admin');
insert into hub.sessions values(decode(repeat('44',32),'hex'),'00000000-0000-0000-0000-000000000041',now()+interval '1 hour');
-- 기존 운영 계정은 이 트랜잭션 안에서만 비활성화하고 마지막 관리자 보호를 검사한다.
update hub.operators set active=false where id<>'00000000-0000-0000-0000-000000000041';
set local role hub_app;
do $$ declare t bytea:=decode(repeat('44',32),'hex');r jsonb;v uuid;begin
 r:=hub.api_save(t,'slots','{}');assert r->>'code'='bad_request','누락된 행 차단';
 r:=hub.api_save(t,'operator','{"id":"00000000-0000-0000-0000-000000000041","name":"가상 관리자","email":"admin-test@example.invalid","role":"member","active":true}');assert r->>'code'='last_admin','마지막 관리자 강등 차단';
 r:=hub.api_save(t,'operator','{"id":"00000000-0000-0000-0000-000000000041","name":"가상 관리자","email":"admin-test@example.invalid","role":"admin","active":false}');assert r->>'code'='last_admin','마지막 관리자 비활성 차단';
 r:=hub.api_save(t,'class','{"name":"가상 관리자 반","region":"대전","track":"TEST","cohort":88,"active":true}');assert (r->>'ok')::boolean,'반 추가';v:=(r->>'id')::uuid;
 r:=hub.api_save(t,'organization','{"name":"가상기관"}');assert (r->>'ok')::boolean,'기관 추가';
 r:=hub.api_save(t,'subject','{"name":"가상과목","track":"TEST"}');assert (r->>'ok')::boolean,'과목 추가';
 r:=hub.api_save(t,'operator','{"name":"가상 운영진","email":"created-test@example.invalid","password":"test-password-2026","role":"member","active":true}');assert (r->>'ok')::boolean,'운영진 추가';v:=(r->>'id')::uuid;
 r:=hub.api_login('created-test@example.invalid','test-password-2026',decode(repeat('55',32),'hex'),'admin-test-ip');assert (r->>'ok')::boolean,'신규 계정 로그인';
 r:=hub.api_save(t,'operator',jsonb_build_object('id',v,'name','가상 운영진','email','created-test@example.invalid','password','new-password-2026','role','member','active',true));assert (r->>'ok')::boolean,'비밀번호 초기화';
 assert hub.api_me(decode(repeat('55',32),'hex'))->>'code'='session_expired','초기화 후 기존 세션 만료';
 r:=hub.api_login('created-test@example.invalid','test-password-2026',decode(repeat('66',32),'hex'),'admin-test-ip');assert r->>'code'='invalid_credentials','이전 비밀번호 차단';
 r:=hub.api_login('created-test@example.invalid','new-password-2026',decode(repeat('66',32),'hex'),'admin-test-ip');assert (r->>'ok')::boolean,'새 비밀번호 로그인';
 begin perform hub.save_impl(t,'subject','{"name":"우회"}');raise exception '내부 쓰기 함수 접근 허용';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
