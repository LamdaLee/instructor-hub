begin;
insert into hub.operators(id,email,name,password_hash,role,organization) values
 ('00000000-0000-0000-0000-000000000001','materials-admin@example.invalid','가상 관리자','unused','admin',null),
 ('00000000-0000-0000-0000-000000000002','materials-lge@example.invalid','가상 엘지','unused','member','LGE'),
 ('00000000-0000-0000-0000-000000000003','materials-lab@example.invalid','가상 랩','unused','member','LAB4DX'),
 ('00000000-0000-0000-0000-000000000004','materials-clips@example.invalid','가상 클립스','unused','member','CLIPS'),
 ('00000000-0000-0000-0000-000000000005','materials-assist@example.invalid','가상 어시스트','unused','member','aSSIST');
insert into hub.sessions select decode(repeat('0'||i,32),'hex'),('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,now()+interval '1 hour' from generate_series(1,5) i;
insert into hub.subjects(name) values('기관 권한 검증 과목');
insert into hub.instructors(id,name,organization) values
 ('00000000-0000-0000-0000-000000000011','가상 엘지 강사','LGE'),
 ('00000000-0000-0000-0000-000000000012','가상 랩 강사','LAB4DX'),
 ('00000000-0000-0000-0000-000000000013','가상 클립스 강사','CLIPS'),
 ('00000000-0000-0000-0000-000000000014','가상 어시스트 강사','aSSIST');
insert into hub.materials(id,subject,instructor_id,organization,filename,disk_key,bytes,mime,uploader)
 select ('00000000-0000-0000-0000-'||lpad((i+20)::text,12,'0'))::uuid,'기관 권한 검증 과목',x.id,x.organization,'가상 교재.pdf',gen_random_uuid(),10,'application/pdf','가상 등록자'
 from (values (1,'00000000-0000-0000-0000-000000000011'::uuid),(2,'00000000-0000-0000-0000-000000000012'::uuid),(3,'00000000-0000-0000-0000-000000000013'::uuid),(4,'00000000-0000-0000-0000-000000000014'::uuid)) v(i,id)
 join hub.instructors x on x.id=v.id;
insert into hub.materials(id,subject,instructor_id,organization,filename,disk_key,bytes,mime,uploader,published) values
 ('00000000-0000-0000-0000-000000000025','기관 권한 검증 과목','00000000-0000-0000-0000-000000000011','LGE','가상 비공개.pdf',gen_random_uuid(),10,'application/pdf','가상 등록자',false),
 ('00000000-0000-0000-0000-000000000026','기관 권한 검증 과목','00000000-0000-0000-0000-000000000011',null,'가상 미분류.pdf',gen_random_uuid(),10,'application/pdf','가상 등록자',true);
set local role hub_app;
do $$ declare a bytea:=decode(repeat('01',32),'hex');g bytea:=decode(repeat('02',32),'hex');l bytea:=decode(repeat('03',32),'hex');c bytea:=decode(repeat('04',32),'hex');s bytea:=decode(repeat('05',32),'hex');r jsonb;payload jsonb;begin
 assert hub.api_read(null,'materials','{}')->>'code'='session_expired','비로그인 차단';
 assert jsonb_array_length(hub.api_read(a,'materials','{"subject":"기관 권한 검증 과목"}')->'rows')=6,'관리자 전체·미분류·비공개 접근';
 assert jsonb_array_length(hub.api_read(g,'materials','{"subject":"기관 권한 검증 과목"}')->'rows')=5,'LG전자 모든 기관의 공개 교재';
 assert jsonb_array_length(hub.api_read(l,'materials','{"subject":"기관 권한 검증 과목"}')->'rows')=5,'랩포디엑스 모든 기관의 공개 교재';
 r:=hub.api_read(c,'materials','{"subject":"기관 권한 검증 과목"}');assert jsonb_array_length(r->'rows')=1 and r->'rows'->0->>'organization'='CLIPS','클립스 자기 기관만';
 assert not (r->'rows'->0 ? 'disk_key'),'목록에서 디스크 경로 비공개';
 r:=hub.api_read(s,'materials','{"subject":"기관 권한 검증 과목"}');assert jsonb_array_length(r->'rows')=1 and r->'rows'->0->>'organization'='aSSIST','어시스트 자기 기관만';
 assert jsonb_array_length(hub.api_read(c,'materials','{"organization":"LGE"}')->'rows')=0,'기관 필터 변조 우회 차단';
 assert hub.api_material(c,'file','{"id":"00000000-0000-0000-0000-000000000024"}')->>'code'='not_found','다른 기관 파일 ID 직접 다운로드 차단';
 assert (hub.api_material(g,'file','{"id":"00000000-0000-0000-0000-000000000024"}')->>'ok')::boolean,'LG전자 다른 기관 파일 접근';
 assert hub.api_material(g,'file','{"id":"00000000-0000-0000-0000-000000000025"}')->>'code'='not_found','기존 관리자 비공개 정책 유지';
 payload:='{"id":"00000000-0000-0000-0000-000000000023","subject":"기관 권한 검증 과목","instructor_id":"00000000-0000-0000-0000-000000000013","actor":"가상 작업자","reason":"권한 검증","organization":"CLIPS"}';
 assert hub.api_material(s,'update',payload)->>'code'='not_found','타 기관 수정 차단';
 assert hub.api_material(s,'delete',payload)->>'code'='not_found','타 기관 삭제 차단';
 assert hub.api_material(c,'update',payload||'{"organization":"LGE","instructor_id":"00000000-0000-0000-0000-000000000011"}')->>'code'='forbidden','자기 교재를 타 기관으로 이동하는 우회 차단';
 assert (hub.api_material(c,'update',payload)->>'ok')::boolean,'자기 교재 수정';
 assert hub.api_material(c,'upload',payload||jsonb_build_object('id',gen_random_uuid(),'uploader','가상 등록자','organization','LGE','instructor_id','00000000-0000-0000-0000-000000000011','filename','가상.pdf','disk_key',gen_random_uuid(),'bytes',10,'mime','application/pdf'))->>'code'='forbidden','업로드 기관 변조 차단';
 begin perform hub.read_before_material_orgs(c,'materials','{}');raise exception '이전 목록 함수 호출 우회';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- 강사 소속이 바뀌어도 기존 교재의 기관이 자동으로 바뀌지 않는다.
update hub.instructors set organization='LGE' where id='00000000-0000-0000-0000-000000000013';
set local role hub_app;
do $$ begin
 assert (hub.api_material(decode(repeat('04',32),'hex'),'file','{"id":"00000000-0000-0000-0000-000000000023"}')->>'ok')::boolean,'강사 이동 후에도 교재 원래 기관 보존';
end $$;
reset role;
rollback;
