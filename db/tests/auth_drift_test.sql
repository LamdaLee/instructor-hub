-- 과거 공개 함수가 내부 호출 경로에 남은 상태에서도 최종 권한 경계를 보장한다.
begin;
insert into hub.operators(id,email,name,password_hash,role,organization) values
 ('00000000-0000-0000-0000-000000000041','drift-admin@example.invalid','가상 관리자','unused','admin',null),
 ('00000000-0000-0000-0000-000000000042','drift-clips@example.invalid','가상 클립스','unused','member','CLIPS'),
 ('00000000-0000-0000-0000-000000000043','drift-expired@example.invalid','가상 만료 계정','unused','member','LGE');
insert into hub.sessions values
 (decode(repeat('41',32),'hex'),'00000000-0000-0000-0000-000000000041',now()+interval '1 hour'),
 (decode(repeat('42',32),'hex'),'00000000-0000-0000-0000-000000000042',now()+interval '1 hour'),
 (decode(repeat('43',32),'hex'),'00000000-0000-0000-0000-000000000043',now()-interval '1 hour');
create or replace function hub.read_before_main_venues(p_token bytea,p_view text,p_filter jsonb default '{}') returns jsonb
language sql security definer set search_path=hub,pg_temp as $$
 select '{"ok":true,"rows":[{"organization":"LGE","instructor_id":"00000000-0000-0000-0000-000000000044","instructor_name":"가상 타 기관 강사","linked_name":"가상 타 기관 강사","phone":"TEST-PRIVATE"}],"instructors":[{"organization":"LGE","name":"가상 타 기관 강사"},{"organization":"CLIPS","name":"가상 자기 기관 강사"}],"instructor":{"organization":"LGE","phone":"TEST-PRIVATE"}}'::jsonb
$$;
set local role hub_app;
do $$ declare v text;r jsonb;a bytea:=decode(repeat('41',32),'hex');c bytea:=decode(repeat('42',32),'hex');expired bytea:=decode(repeat('43',32),'hex');begin
 foreach v in array array['options','slots','dashboard','instructors','instructor','materials','announcements','operators','audit','export'] loop
  assert hub.api_read(null,v,'{}')->>'code'='session_expired','이전 공개 함수의 비로그인 우회 차단';
  assert hub.api_read(expired,v,'{}')->>'code'='session_expired','만료 토큰 우회 차단';
 end loop;
 assert (hub.api_read(a,'options','{}')->>'ok')::boolean,'관리자 로그인 조회 유지';
 r:=hub.api_read(c,'slots','{}');
 assert r->'rows'->0->>'instructor_name'='' and not (r->'rows'->0 ? 'phone'),'과거 함수에서도 타 기관 이름·연락처 숨김';
 r:=hub.api_read(c,'options','{}');
 assert jsonb_array_length(r->'instructors')=1 and r->'instructors'->0->>'organization'='CLIPS','기관별 필터 권한 유지';
 assert hub.api_read(c,'instructor','{}')->>'code'='not_found','타 기관 상세 차단';
 assert hub.api_read(c,'audit','{}')->>'code'='forbidden','관리자 조회 경계 유지';
 begin perform hub.read_before_main_venues(null,'options','{}');raise exception '내부 함수 접근 허용';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
