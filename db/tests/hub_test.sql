-- 모든 테스트는 가상 인물·계정으로 수행하고 롤백한다.
begin;
insert into hub.operators(id,email,name,password_hash,role) values
 ('00000000-0000-0000-0000-000000000001','hub-test-admin@example.invalid','테스트 관리자',extensions.crypt('test-password-2026',extensions.gen_salt('bf')),'admin'),
 ('00000000-0000-0000-0000-000000000002','hub-test-member@example.invalid','테스트 운영진',extensions.crypt('test-password-2026',extensions.gen_salt('bf')),'member');
insert into hub.classes(id,region,cohort,track,name) values
 ('00000000-0000-0000-0000-000000000011','대전',99,'TEST','테스트 반1'),('00000000-0000-0000-0000-000000000012','대구',99,'TEST','테스트 반2');
insert into hub.instructors(id,name,organization,phone,email) values ('00000000-0000-0000-0000-000000000021','가상강사','LGE','가상연락처','private@example.invalid');
set local role hub_app;
do $$ declare r jsonb; a bytea:=decode(repeat('11',32),'hex'); m bytea:=decode(repeat('22',32),'hex'); payload jsonb; begin
 -- 앱 역할은 직접 테이블 및 내부 함수를 실행할 수 없다.
 begin perform 1 from hub.instructors; raise exception '직접 테이블 조회 허용됨'; exception when insufficient_privilege then null; end;
 begin perform hub.actor(a); raise exception '내부 함수 실행 허용됨'; exception when insufficient_privilege then null; end;
 r:=hub.api_read(a,'instructors','{}');assert (r->>'ok')::boolean,'공개 강사 조회';
 r:=hub.api_login('hub-test-admin@example.invalid','wrong',a,'test-ip');assert r->>'code'='invalid_credentials','비밀번호 검증';
 r:=hub.api_login('hub-test-admin@example.invalid','test-password-2026',a,'test-ip');assert (r->>'ok')::boolean,'관리자 로그인';
 r:=hub.api_login('hub-test-member@example.invalid','test-password-2026',m,'test-ip');assert (r->>'ok')::boolean,'운영진 로그인';
 r:=hub.api_read(m,'operators','{}');assert r->>'code'='forbidden','운영진 계정 조회 권한';
 r:=hub.api_save(m,'organization','{"name":"권한없음"}');assert r->>'code'='forbidden','운영진 관리 변경 차단';
 r:=hub.api_read(m,'instructors','{"q":"가상강사","archived":""}');assert not (r->'rows'->0 ? 'phone') and not (r->'rows'->0 ? 'email'),'목록 연락처 비공개';
 r:=hub.api_read(m,'instructor','{"id":"00000000-0000-0000-0000-000000000021"}');assert r->'instructor'->>'phone'='가상연락처','상세 연락처';
 payload:='{"rows":[{"class_id":"00000000-0000-0000-0000-000000000011","day":"2099-01-05","subject":"테스트 과목","module":"테스트 모듈","hours":8,"review_reason":"엑셀 검토 사유","instructor_id":"00000000-0000-0000-0000-000000000021","organization":"LGE"}]}';
 r:=hub.api_save(a,'slots',payload);assert (r->>'ok')::boolean,'시간표 저장';
 r:=hub.api_save(a,'slots',payload);assert r->>'code'='overwrite_required','덮어쓰기 확인 요구';
 r:=hub.api_save(a,'slots',jsonb_set(payload,'{rows,0}',(payload->'rows'->0)-'module'-'hours'-'review_reason')||'{"overwrite":true}');assert (r->>'ok')::boolean,'확인 후 덮어쓰기';
 r:=hub.api_read(m,'slots','{"cohort":"99","region":"대전"}');assert r->'rows'->0->>'module'='테스트 모듈' and (r->'rows'->0->>'hours')::numeric=8,'부분 편집 시 모듈·시수 보존';
 assert r->'rows'->0->>'review_reason'='엑셀 검토 사유','일반 수정 시 검토 사유 보존';
 r:=hub.api_save(a,'slots',jsonb_set(payload,'{rows,0,hours}','25')||'{"overwrite":true}');assert r->>'code'='bad_request','잘못된 시수 차단';
 r:=hub.api_save(a,'slots','{"rows":[{"class_id":"00000000-0000-0000-0000-000000000012","day":"2099-01-05","instructor_id":"00000000-0000-0000-0000-000000000021","organization":"LGE"}]}');
 assert (r->>'conflicts')::int=1,'다른 반 같은 날 충돌 경고';
 r:=hub.api_read(m,'slots','{"region":"대전","cohort":"99","track":"TEST","from":"2099-01-05","to":"2099-01-05"}');assert jsonb_array_length(r->'rows')=1,'복합 필터';
 r:=hub.api_read(m,'export','{"cohort":"99"}');assert not (r->'rows'->0 ? 'phone'),'CSV 기본 연락처 제외';
 r:=hub.api_read(m,'export','{"cohort":"99","contacts":true}');assert r->'rows'->0->>'phone'='가상연락처','CSV 선택 연락처';
 r:=hub.api_save(a,'operator','{"id":"00000000-0000-0000-0000-000000000002","email":"hub-test-member@example.invalid","name":"테스트 운영진","role":"member","active":false}');assert (r->>'ok')::boolean,'운영진 비활성';
 r:=hub.api_me(m);assert r->>'code'='session_expired','비활성 계정 세션 차단';
 r:=hub.api_read(a,'audit','{}');assert exists(select 1 from jsonb_array_elements(r->'rows') x where x->>'target_table'='slots' and x->>'action'='save'),'변경 기록';
 r:=hub.api_logout(a);assert (r->>'ok')::boolean,'로그아웃';assert hub.api_me(a)->>'code'='session_expired','세션 폐기';
 for n in 1..11 loop r:=hub.api_login('no-account@example.invalid','wrong',decode(repeat('33',32),'hex'),'rate-test');end loop;
 assert r->>'code'='rate_limited','실패 횟수 제한';
end $$;
reset role;
do $$ begin
 assert exists(select 1 from hub.audit_logs where action='save' and target_table='slots' and after_value->>'subject'='테스트 과목'),'변경 전후 기록 저장';
 assert not exists(select 1 from hub.audit_logs where after_value ? 'password_hash'),'감사 기록에 비밀번호 해시 없음';
end $$;
rollback;
