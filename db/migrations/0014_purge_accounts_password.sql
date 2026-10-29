-- 사용자 요청: 기존 계정은 관리자만 남기고 삭제한다. 변경 기록의 이메일 원문은 보존한다.
-- 로그인한 사용자가 직접 비밀번호를 바꾸는 API를 추가한다.
begin;
create temp table removed_operators on commit drop as select id from hub.operators where role<>'admin';
delete from hub.sessions where operator_id in(select id from removed_operators);
update hub.audit_logs set operator_id=null where operator_id in(select id from removed_operators);
update hub.signup_requests set decided_by=null where decided_by in(select id from removed_operators);
update hub.signup_requests set operator_id=null where operator_id in(select id from removed_operators);
update hub.instructor_requests set decided_by=null where decided_by in(select id from removed_operators);
delete from hub.instructor_requests where requested_by in(select id from removed_operators);
delete from hub.operators where id in(select id from removed_operators);
insert into hub.audit_logs(action,target_table,summary) select 'operators_purge','operators','관리자 외 계정 '||count(*)||'개 삭제' from removed_operators;

create function hub.api_password(p_token bytea,p_current text,p_new text) returns jsonb
language plpgsql security definer set search_path=hub,extensions,pg_temp as $$
declare o operators:=actor(p_token); begin
 if o.id is null then return '{"ok":false,"code":"session_expired"}'; end if;
 if rate_hit('password:'||o.id)>10 then return '{"ok":false,"code":"rate_limited"}'; end if;
 if p_current is null or crypt(p_current,o.password_hash) is distinct from o.password_hash then return '{"ok":false,"code":"invalid_credentials"}'; end if;
 if p_new is null or length(p_new)<10 or octet_length(p_new)>72 or p_new=p_current then return '{"ok":false,"code":"weak_password"}'; end if;
 update operators set password_hash=crypt(p_new,gen_salt('bf',12)) where id=o.id;
 -- 다른 기기의 세션은 만료하고 현재 세션만 유지한다.
 delete from sessions where operator_id=o.id and token_hash<>p_token;
 delete from rate_limits where key='password:'||o.id;
 insert into audit_logs(operator_id,actor_email,action,target_table,target_id) values(o.id,o.email,'password_change','operators',o.id::text);
 return '{"ok":true}';
end $$;
revoke all on function hub.api_password(bytea,text,text) from public;
grant execute on function hub.api_password(bytea,text,text) to hub_app;
commit;
