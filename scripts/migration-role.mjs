// PostgreSQL 16 이상에서 마이그레이션 관리자에게 앱 역할 전환만 허용한다.
// 앱 역할의 테이블·함수 권한이나 기존 INHERIT/ADMIN 설정은 바꾸지 않는다.
export async function ensureMigrationRole(client, log = console.log) {
  const status = async () => (await client.query("SELECT current_user AS role,CASE WHEN current_setting('server_version_num')::integer>=160000 THEN pg_has_role(current_user,'hub_app','SET') ELSE pg_has_role(current_user,'hub_app','MEMBER') END AS can_set,pg_has_role(current_user,'hub_app','USAGE') AS can_inherit,current_setting('server_version_num')::integer AS version")).rows[0];
  const before = await status();
  if (before.can_set) {
    log("[DB_ROLE] role=hub_app action=already_available");
    return;
  }
  const option = before.version >= 160000 ? " WITH SET TRUE" : "";
  const { rows } = await client.query("SELECT format('GRANT hub_app TO %I',current_user) AS ddl");
  // 명시적인 역할 관리 권한이 없으면 PostgreSQL이 거절한다. 예외를 우회하지 않는다.
  if (before.version >= 160000) {
    // 다른 grantor의 기존 멤버십은 유지하고 새 멤버십이 상속 권한을 넓히지 않게 한다.
    await client.query(rows[0].ddl + " WITH INHERIT " + (before.can_inherit ? "TRUE" : "FALSE"));
  }
  await client.query(rows[0].ddl + option);
  if (!(await status()).can_set) throw new Error("App role switch permission could not be verified");
  log("[DB_ROLE] role=hub_app action=set_permission_granted");
}
