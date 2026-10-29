begin;
insert into hub.operators(id,email,name,password_hash,role,organization) values
 ('00000000-0000-0000-0000-000000000051','safe-admin@example.invalid','가상 관리자','unused','admin',null),
 ('00000000-0000-0000-0000-000000000052','safe-lab@example.invalid','가상 승인자','unused','member','LAB4DX'),
 ('00000000-0000-0000-0000-000000000053','safe-clips@example.invalid','가상 신청자','unused','member','CLIPS');
insert into hub.sessions values
 (decode(repeat('51',32),'hex'),'00000000-0000-0000-0000-000000000051',now()+interval '1 hour'),
 (decode(repeat('52',32),'hex'),'00000000-0000-0000-0000-000000000052',now()+interval '1 hour'),
 (decode(repeat('53',32),'hex'),'00000000-0000-0000-0000-000000000053',now()+interval '1 hour');
insert into hub.signup_requests(id,email,name,password_hash,organization) values
 ('00000000-0000-0000-0000-000000000054','safe-new@example.invalid','가상 가입자','unused','LAB4DX'),
 ('00000000-0000-0000-0000-000000000055','safe-new2@example.invalid','가상 가입자2','unused','LGE');
set local role hub_app;
do $$ declare a bytea:=decode(repeat('51',32),'hex');l bytea:=decode(repeat('52',32),'hex');c bytea:=decode(repeat('53',32),'hex');r jsonb;begin
 assert hub.api_org(null,'counts','{}')->>'code'='session_expired','비로그인 건수 조회 차단';
 assert (hub.api_org(l,'counts','{}')->>'signups')::integer>=2,'가입 대기 건수';
 assert (hub.api_org(c,'counts','{}')->>'signups')::integer=0,'비승인자 가입 대기 노출 차단';
 assert hub.api_org(c,'decide_signup','{"id":"00000000-0000-0000-0000-000000000054","decision":"approve","organization":"CLIPS"}')->>'code'='forbidden','기관 정정도 승인 권한 필요';
 assert hub.api_org(l,'decide_signup','{"id":"00000000-0000-0000-0000-000000000055","decision":"approve"}')->>'code'='bad_request','LGE 권한 확인 없이 승인 차단';
 r:=hub.api_org(l,'decide_signup','{"id":"00000000-0000-0000-0000-000000000054","decision":"approve","organization":"CLIPS"}');assert (r->>'ok')::boolean,'승인 시 기관 정정';
 r:=hub.api_org(l,'decide_signup','{"id":"00000000-0000-0000-0000-000000000055","decision":"approve","confirm_privileged":true}');assert (r->>'ok')::boolean,'권한 확인 후 승인';
 assert hub.api_org(l,'decide_signup','{"id":"00000000-0000-0000-0000-000000000055","decision":"approve","confirm_privileged":true}')->>'code'='already_decided','중복 승인 차단';
 assert exists(select 1 from jsonb_array_elements(hub.api_read(a,'audit','{}')->'rows') x where x->>'action'='signup_organization' and x->'before_value'->>'organization'='LAB4DX' and x->'after_value'->>'organization'='CLIPS'),'기관 정정 이력';
end $$;
reset role;
do $$ begin
 assert exists(select 1 from hub.operators where email='safe-new@example.invalid' and organization='CLIPS'),'계정의 정정된 소속';
 assert exists(select 1 from hub.operators where email='safe-new2@example.invalid' and organization='LGE'),'확인한 소속';
end $$;
rollback;
