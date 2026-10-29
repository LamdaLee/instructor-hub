-- 기관 계정의 열람 범위, 강사 변경 신청 승인·반려, 가입 승인 권한을 실제 앱 역할로 검증한다.
begin;
insert into hub.operators(id,email,name,password_hash,role,organization) values
 ('00000000-0000-0000-0000-000000000091','org-assist@example.invalid','가상 어시스트','unused','member','aSSIST'),
 ('00000000-0000-0000-0000-000000000092','org-clips@example.invalid','가상 클립스','unused','member','CLIPS'),
 ('00000000-0000-0000-0000-000000000093','org-lge@example.invalid','가상 엘지','unused','member','LGE'),
 ('00000000-0000-0000-0000-000000000094','org-lab@example.invalid','가상 랩포디엑스','unused','member','LAB4DX');
insert into hub.sessions values(decode(repeat('91',32),'hex'),'00000000-0000-0000-0000-000000000091',now()+interval '1 hour'),
 (decode(repeat('92',32),'hex'),'00000000-0000-0000-0000-000000000092',now()+interval '1 hour'),
 (decode(repeat('93',32),'hex'),'00000000-0000-0000-0000-000000000093',now()+interval '1 hour'),
 (decode(repeat('94',32),'hex'),'00000000-0000-0000-0000-000000000094',now()+interval '1 hour');
insert into hub.instructors(id,name,organization) values('00000000-0000-0000-0000-000000000095','가상 어시스트 강사','aSSIST'),('00000000-0000-0000-0000-000000000096','가상 클립스 강사','CLIPS');
set local role hub_app;
do $$ declare a bytea:=decode(repeat('91',32),'hex');c bytea:=decode(repeat('92',32),'hex');g bytea:=decode(repeat('93',32),'hex');l bytea:=decode(repeat('94',32),'hex');r jsonb;v uuid;w uuid;begin
 assert hub.api_org(null,'instructors','{}')->>'code'='session_expired','비로그인 차단';
 r:=hub.api_org(a,'instructors','{}');
 assert not exists(select 1 from jsonb_array_elements(r->'rows') x where x->>'organization'<>'aSSIST'),'aSSIST는 자기 기관 강사만';
 assert exists(select 1 from jsonb_array_elements(r->'rows') x where x->>'id'='00000000-0000-0000-0000-000000000095'),'자기 기관 강사 조회';
 assert exists(select 1 from jsonb_array_elements(hub.api_org(g,'instructors','{}')->'rows') x where x->>'id'='00000000-0000-0000-0000-000000000096'),'LGE 전체 조회';
 -- 다른 기관 강사 삭제 신청과 다른 기관 이름 등록 시도
 assert hub.api_org(a,'submit','{"kind":"remove","instructor_id":"00000000-0000-0000-0000-000000000096","note":"타 기관"}')->>'code'='not_found','타 기관 삭제 신청 차단';
 r:=hub.api_org(a,'submit','{"kind":"register","organization":"CLIPS","name":"가상 신규 강사","phone":"TEST","note":"신규 등록"}');assert (r->>'ok')::boolean,'등록 신청';v:=(r->>'id')::uuid;
 assert hub.api_org(a,'submit','{"kind":"register","name":"가상 신규 강사","note":"중복"}')->>'code'='duplicate','대기 중 중복 신청 차단';
 assert (select x->>'organization' from jsonb_array_elements(hub.api_org(a,'requests','{}')->'rows') x where x->>'id'=v::text)='aSSIST','기관은 신청자 소속으로 고정';
 assert not exists(select 1 from jsonb_array_elements(hub.api_org(c,'requests','{}')->'rows') x where x->>'id'=v::text),'CLIPS는 다른 기관 신청 비공개';
 assert hub.api_org(a,'decide',jsonb_build_object('id',v,'decision','approve'))->>'code'='forbidden','aSSIST 승인 불가';
 assert hub.api_org(c,'decide',jsonb_build_object('id',v,'decision','approve'))->>'code'='forbidden','CLIPS 승인 불가';
 assert hub.api_org(g,'decide',jsonb_build_object('id',v,'decision','reject'))->>'code'='bad_request','반려 사유 필수';
 assert (hub.api_org(g,'decide',jsonb_build_object('id',v,'decision','approve','note','확인'))->>'ok')::boolean,'LGE 승인';
 assert hub.api_org(l,'decide',jsonb_build_object('id',v,'decision','reject','note','늦은 반려'))->>'code'='already_decided','처리된 신청 재처리 차단';
 assert exists(select 1 from jsonb_array_elements(hub.api_org(a,'instructors','{}')->'rows') x where x->>'name'='가상 신규 강사'),'승인 후 강사 추가';
 r:=hub.api_org(a,'submit','{"kind":"remove","instructor_id":"00000000-0000-0000-0000-000000000095","note":"계약 종료"}');assert (r->>'ok')::boolean,'삭제 신청';w:=(r->>'id')::uuid;
 assert hub.api_org(a,'submit','{"kind":"remove","instructor_id":"00000000-0000-0000-0000-000000000095","note":"다시"}')->>'code'='duplicate','삭제 중복 신청 차단';
 assert (hub.api_org(l,'decide',jsonb_build_object('id',w,'decision','reject','note','근거 부족'))->>'ok')::boolean,'LAB4DX 반려';
 assert exists(select 1 from jsonb_array_elements(hub.api_org(a,'instructors','{}')->'rows') x where x->>'id'='00000000-0000-0000-0000-000000000095'),'반려 후 강사 유지';
 r:=hub.api_org(a,'submit','{"kind":"remove","instructor_id":"00000000-0000-0000-0000-000000000095","note":"보완 신청"}');w:=(r->>'id')::uuid;
 assert (hub.api_org(l,'decide',jsonb_build_object('id',w,'decision','approve'))->>'ok')::boolean,'LAB4DX 삭제 승인';
 assert not exists(select 1 from jsonb_array_elements(hub.api_org(a,'instructors','{}')->'rows') x where x->>'id'='00000000-0000-0000-0000-000000000095'),'승인 후 보관';
 -- 가입 신청은 비로그인으로 제출하고 LAB4DX만 승인한다.
 assert hub.api_signup('{"email":"org-new@example.invalid","name":"가상 신청자","organization":"기타","password":"signup-password-1"}','org-test')->>'code'='bad_request','허용되지 않은 기관';
 assert hub.api_signup('{"email":"org-new@example.invalid","name":"가상 신청자","organization":"CLIPS","password":"short"}','org-test')->>'code'='weak_password','짧은 비밀번호';
 assert (hub.api_signup('{"email":"Org-New@example.invalid","name":"가상 신청자","organization":"CLIPS","password":"signup-password-1"}','org-test')->>'ok')::boolean,'가입 신청';
 assert (hub.api_signup('{"email":"org-new@example.invalid","name":"가상 신청자","organization":"CLIPS","password":"signup-password-1"}','org-test')->>'ok')::boolean,'중복 신청도 같은 응답';
 assert hub.api_login('org-new@example.invalid','signup-password-1',decode(repeat('97',32),'hex'),'org-test')->>'code'='invalid_credentials','승인 전 로그인 불가';
 assert hub.api_org(g,'signups','{}')->>'code'='forbidden','LGE 가입 승인 목록 차단';
 assert hub.api_org(a,'signups','{}')->>'code'='forbidden','aSSIST 가입 승인 목록 차단';
 r:=hub.api_org(l,'signups','{}');
 select (x->>'id')::uuid into v from jsonb_array_elements(r->'rows') x where x->>'email'='org-new@example.invalid';
 assert not (r::text like '%password%'),'가입 목록에 비밀번호 해시 제외';
 assert hub.api_org(g,'decide_signup',jsonb_build_object('id',v,'decision','approve'))->>'code'='forbidden','LGE 가입 승인 불가';
 assert (hub.api_org(l,'decide_signup',jsonb_build_object('id',v,'decision','approve'))->>'ok')::boolean,'LAB4DX 가입 승인';
 r:=hub.api_login('org-new@example.invalid','signup-password-1',decode(repeat('97',32),'hex'),'org-test');assert (r->>'ok')::boolean,'승인 후 로그인';
 r:=hub.api_me(decode(repeat('97',32),'hex'));
 assert r->'operator'->>'organization'='CLIPS' and r->'operator'->>'role'='member' and not (r->'operator'->>'review_requests')::boolean,'신규 계정은 CLIPS 일반 권한';
 assert hub.api_save(decode(repeat('97',32),'hex'),'instructor','{"name":"우회 등록","subjects":[]}')->>'code'='forbidden','기관 계정 직접 강사 수정 차단';
 begin perform hub.read_catalog(null,'options','{}');raise exception '이전 조회 함수 공개';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
