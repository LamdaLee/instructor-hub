-- 같은 과정명을 쓰는 서로 다른 지역·기수의 반을 구분한다.
begin;
create or replace view hub.slot_view as
 select s.*,concat(c.region,' ',c.track,' ',c.cohort,'기 · ',c.name) class_name,c.region,c.cohort,c.track,i.name linked_name,
 exists(select 1 from hub.slots x where x.id<>s.id and x.day=s.day and x.class_id<>s.class_id and x.instructor_id=s.instructor_id) conflict
 from hub.slots s join hub.classes c on c.id=s.class_id left join hub.instructors i on i.id=s.instructor_id;
commit;
