// 자격증명과 업무 데이터 없이 연결 역할·객체 소유권·권한만 확인한다.
import pg from "pg";
export async function inspectAccess(source, connectionString, log = console.log) {
  const db = new pg.Client({ connectionString, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined });
  try {
    await db.connect();
    const identity = (await db.query("SELECT current_user AS role,rolsuper AS superuser,rolcreaterole AS create_role,current_setting('server_version_num') AS server_version_num,CASE WHEN current_setting('server_version_num')::integer>=160000 THEN pg_has_role(current_user,'hub_app','SET') ELSE pg_has_role(current_user,'hub_app','MEMBER') END AS app_role_set FROM pg_roles WHERE rolname=current_user")).rows[0];
    log("[DB_IDENTITY]", JSON.stringify({ source, ...identity }));
    if (source === "DATABASE_URL") return true;
    for (const schema of ["hub", "hub_meta"]) {
      const rows = (await db.query("SELECT nspname AS schema,pg_get_userbyid(nspowner) AS owner,has_schema_privilege(current_user,oid,'USAGE') AS usage,has_schema_privilege(current_user,oid,'CREATE') AS create,pg_has_role(current_user,nspowner,'USAGE') AS owner_role FROM pg_namespace WHERE nspname=$1", [schema])).rows;
      for (const row of rows) log("[DB_SCHEMA]", JSON.stringify({ source, ...row }));
    }
    const tables = (await db.query("SELECT n.nspname||'.'||c.relname AS object,pg_get_userbyid(c.relowner) AS owner,pg_has_role(current_user,c.relowner,'USAGE') AS owner_role,has_table_privilege(current_user,c.oid,'SELECT') AS select,has_table_privilege(current_user,c.oid,'REFERENCES') AS references FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('hub','hub_meta') AND c.relkind='r' ORDER BY n.nspname,c.relname")).rows;
    for (const row of tables) {
      if (["hub.materials", "hub.slots", "hub_meta.migrations"].includes(row.object) || !row.select || (!identity.superuser && !row.owner_role)) log("[DB_TABLE]", JSON.stringify({ source, ...row }));
    }
    const functions = (await db.query("SELECT p.proname AS function,pg_get_userbyid(p.proowner) AS owner,pg_has_role(current_user,p.proowner,'USAGE') AS owner_role,has_function_privilege(current_user,p.oid,'EXECUTE') AS execute FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='hub' AND p.proname=ANY($1::text[]) ORDER BY p.proname", [["api_read", "api_material", "api_me", "api_save", "material_before_schedule", "material_org_allowed", "read_before_material_schedule"]])).rows;
    for (const row of functions) log("[DB_FUNCTION]", JSON.stringify({ source, ...row }));
    const history = tables.find(row => row.object === "hub_meta.migrations");
    if (history?.select) {
      const names = (await db.query("SELECT name FROM hub_meta.migrations ORDER BY name")).rows.map(row => row.name);
      log("[DB_MIGRATIONS]", JSON.stringify({ source, count: names.length, latest: names.slice(-5) }));
    }
    return true;
  } catch (error) {
    log("[DB_ACCESS_ERROR]", JSON.stringify({ source, code: error.code || "unknown", ...(error.code === "42501" ? { message: error.message } : {}) }));
    return false;
  } finally { await db.end().catch(() => {}); }
}
if (process.argv[1]?.endsWith("check-db-access.mjs")) {
  for (const source of ["DATABASE_ADMIN_URL", "DATABASE_URL"]) {
    if (!process.env[source]) { console.log("[DB_ACCESS_ERROR]", JSON.stringify({ source, code: "variable_missing" })); process.exitCode = 1; continue; }
    if (!await inspectAccess(source, process.env[source])) process.exitCode = 1;
  }
}
