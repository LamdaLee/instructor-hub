begin;
insert into hub.operators(id,email,name,password_hash,role) values
 ('00000000-0000-0000-0000-000000000061','venue-admin@example.invalid','가상 관리자','unused','admin'),
 ('00000000-0000-0000-0000-000000000062','venue-member@example.invalid','가상 운영진','unused','member');
insert into hub.sessions values(decode(repeat('61',32),'hex'),'00000000-0000-0000-0000-000000000061',now()+interval '1 hour'),(decode(repeat('62',32),'hex'),'00000000-0000-0000-0000-000000000062',now()+interval '1 hour');
insert into hub.classes(id,region,cohort,track,name,room,manager) values
 ('00000000-0000-0000-0000-000000000063','대전',96,'TEST-VENUE','가상 장소 검증 반','대전 기본 강의장','가상 매니저');
insert into hub.slots(class_id,day,kind,place,module,hours)
 select '00000000-0000-0000-0000-000000000063',d::date,'수업','','기존 모듈',8
 from generate_series(date '2098-01-04',date '2098-01-09',interval '1 day') d;
update hub.slots set place='대전 별도 강의장' where class_id='00000000-0000-0000-0000-000000000063' and day='2098-01-06';
set local role hub_app;
do $$
declare a bytea:=decode(repeat('61',32),'hex');m bytea:=decode(repeat('62',32),'hex');cid uuid:='00000000-0000-0000-0000-000000000063';
 payload jsonb:=jsonb_build_object('class_id',cid,'starts_on','2098-01-05','ends_on','2098-01-07','room','평택 러닝센터','note','1주차 입소');
 r jsonb;v uuid;items jsonb;slot jsonb;begin
 assert hub.api_save(null,'venue_override',payload)->>'code'='session_expired','비로그인 등록 차단';
 assert hub.api_save(m,'venue_override',payload)->>'code'='forbidden','일반 운영진 등록 차단';
 assert hub.api_save(a,'venue_override',payload||'{"ends_on":"2098-01-04"}')->>'code'='bad_request','역전 기간 차단';
 r:=hub.api_save(a,'venue_override',payload);assert (r->>'ok')::boolean,'예외 기간 등록';v:=(r->>'id')::uuid;
 assert hub.api_save(a,'venue_override',payload||'{"starts_on":"2098-01-07","ends_on":"2098-01-08"}')->>'code'='venue_overlap','경계 날짜 중복 차단';
 r:=hub.api_save(a,'venue_override',payload||jsonb_build_object('id',v,'note','기간 메모 수정'));assert (r->>'ok')::boolean,'자기 기간 수정 허용';
 assert hub.api_read(a,'options','{}')->'venue_overrides' @> jsonb_build_array(jsonb_build_object('id',v)),'관리자 예외 목록';
 assert not (hub.api_read(null,'options','{}') ? 'venue_overrides'),'공개 응답에는 관리 메모 목록 제외';
 items:=hub.api_read(null,'slots',jsonb_build_object('class_id',cid))->'rows';
 select x into slot from jsonb_array_elements(items) x where x->>'day'='2098-01-04';
 assert slot->>'effective_place'='대전 기본 강의장' and slot->>'effective_start_time'='09:00:00' and slot->>'effective_end_time'='18:00:00','기간 전 기본 강의장·시간';
 select x into slot from jsonb_array_elements(items) x where x->>'day'='2098-01-05';
 assert slot->>'effective_place'='평택 러닝센터' and slot->>'effective_start_time' is null,'시작일 포함·평택 시간 미추정';
 r:=hub.api_save(a,'slots',jsonb_build_object('overwrite',true,'rows',jsonb_build_array(jsonb_build_object('id',slot->>'id','class_id',cid,'day','2098-01-05','period','','kind','수업','start_time','10:00','end_time','17:00'))));
 assert (r->>'ok')::boolean,'평택 수업 시간 지정';
 items:=hub.api_read(null,'slots',jsonb_build_object('class_id',cid))->'rows';
 select x into slot from jsonb_array_elements(items) x where x->>'day'='2098-01-05';
 assert slot->>'effective_start_time'='10:00:00' and slot->>'effective_end_time'='17:00:00','지정 시간 표시';
 assert slot->>'module'='기존 모듈' and (slot->>'hours')::numeric=8,'편집 필드에서 제거한 기존 모듈·시수 보존';
 r:=hub.api_save(a,'slots',jsonb_build_object('overwrite',true,'rows',jsonb_build_array(jsonb_build_object('id',slot->>'id','class_id',cid,'day','2098-01-05','period','','kind','수업','start_time','18:00','end_time','09:00'))));
 assert r->>'code'='bad_request','역전 시간 차단';
 select x into slot from jsonb_array_elements(items) x where x->>'day'='2098-01-06';
 assert slot->>'effective_place'='대전 별도 강의장' and slot->>'effective_start_time'='09:00:00','수업별 장소 우선';
 select x into slot from jsonb_array_elements(items) x where x->>'day'='2098-01-07';
 assert slot->>'effective_place'='평택 러닝센터','종료일 포함';
 select x into slot from jsonb_array_elements(items) x where x->>'day'='2098-01-08';
 assert slot->>'effective_place'='대전 기본 강의장','종료 후 기본 강의장';
 assert hub.api_save(m,'delete_venue_override',jsonb_build_object('id',v))->>'code'='forbidden','비관리자 삭제 차단';
 r:=hub.api_save(a,'delete_venue_override',jsonb_build_object('id',v));assert (r->>'ok')::boolean,'기간 삭제';
 items:=hub.api_read(null,'slots',jsonb_build_object('class_id',cid))->'rows';
 select x into slot from jsonb_array_elements(items) x where x->>'day'='2098-01-07';
 assert slot->>'effective_place'='대전 기본 강의장','삭제 후 기본 강의장 복구';
 assert jsonb_array_length(items)=6,'삭제 후 수업 보존';
 assert exists(select 1 from jsonb_array_elements(hub.api_read(a,'audit','{}')->'rows') x where x->>'action'='delete_venue_override' and x->'before_value'->>'room'='평택 러닝센터'),'삭제 이력 보존';
 begin perform 1 from hub.venue_overrides;raise exception '테이블 직접 접근 허용';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
