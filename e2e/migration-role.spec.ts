import { test, expect } from "@playwright/test";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { ensureMigrationRole } from "../scripts/migration-role.mjs";

test("비슈퍼유저·SET 권한 없는 관리자 상태를 재현하고 앱 권한을 넓히지 않고 복구", async () => {
  if (new URL(process.env.DATABASE_ADMIN_URL!).hostname !== "127.0.0.1") throw Error("전용 로컬 DB에서만 검증합니다.");
  const db = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  await db.connect();
  const role = "migration_test_" + randomUUID().replaceAll("-", "");
  try {
    expect((await db.query("SELECT rolsuper FROM pg_roles WHERE rolname=current_user")).rows[0].rolsuper).toBe(true);
    await db.query("BEGIN");
    await db.query(`CREATE ROLE ${role} NOLOGIN CREATEROLE`);
    await db.query(`GRANT hub_app TO ${role} WITH ADMIN OPTION`);
    await db.query(`GRANT hub_app TO ${role} WITH INHERIT FALSE`);
    await db.query(`GRANT hub_app TO ${role} WITH SET FALSE`);
    await db.query(`SET SESSION AUTHORIZATION ${role}`);
    const before = (await db.query("SELECT rolsuper,pg_has_role(current_user,'hub_app','SET') AS can_set FROM pg_roles WHERE rolname=current_user")).rows[0];
    expect(before).toEqual({ rolsuper: false, can_set: false });
    await db.query("SAVEPOINT denied_switch");
    await expect(db.query("SET LOCAL ROLE hub_app")).rejects.toMatchObject({ code: "42501" });
    await db.query("ROLLBACK TO SAVEPOINT denied_switch");
    const logs: string[] = [];
    await ensureMigrationRole(db, (line: string) => logs.push(line));
    expect(logs).toContain("[DB_ROLE] role=hub_app action=set_permission_granted");
    const membership = (await db.query("SELECT bool_or(admin_option) AS admin_option,bool_or(inherit_option) AS inherit_option,bool_or(set_option) AS set_option FROM pg_auth_members WHERE roleid='hub_app'::regrole AND member=current_user::regrole")).rows[0];
    expect(membership).toEqual({ admin_option: true, inherit_option: false, set_option: true });
    expect((await db.query("SELECT pg_has_role(current_user,'hub_app','USAGE') AS inherits")).rows[0].inherits).toBe(false);
    await db.query("SET LOCAL ROLE hub_app");
    const after = (await db.query("SELECT current_user AS role,has_table_privilege(current_user,'hub.materials','SELECT') AS direct_table_access")).rows[0];
    expect(after).toEqual({ role: "hub_app", direct_table_access: false });
    await db.query("RESET ROLE");
    await ensureMigrationRole(db, (line: string) => logs.push(line));
    expect(logs.at(-1)).toBe("[DB_ROLE] role=hub_app action=already_available");
  } finally {
    await db.query("ROLLBACK");
    await db.end();
  }
});
