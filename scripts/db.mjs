import pg from "pg";
import { readdir, readFile } from "node:fs/promises";
const mode = process.argv[2];
if (!["migrate", "test"].includes(mode) || !process.env.DATABASE_ADMIN_URL)
  throw new Error("DATABASE_ADMIN_URL과 migrate/test 명령이 필요합니다.");
const client = new pg.Client({
  connectionString: process.env.DATABASE_ADMIN_URL,
  ssl:
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: true }
      : undefined,
});
await client.connect();
try {
  if (mode === "migrate") {
    await client.query("SELECT pg_advisory_lock(8734033)");
    await client.query("CREATE SCHEMA IF NOT EXISTS hub_meta");
    await client.query("REVOKE ALL ON SCHEMA hub_meta FROM PUBLIC");
    await client.query(
      "CREATE TABLE IF NOT EXISTS hub_meta.migrations(name text primary key, sha256 text not null)",
    );
  }
  const { createHash } = await import("node:crypto");
  for (const name of (
    await readdir(`db/${mode === "migrate" ? "migrations" : "tests"}`)
  )
    .filter((x) => x.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(
      `db/${mode === "migrate" ? "migrations" : "tests"}/${name}`,
      "utf8",
    );
    const hash = createHash("sha256").update(sql).digest("hex");
    if (mode === "migrate") {
      const { rows } = await client.query(
        "SELECT sha256 FROM hub_meta.migrations WHERE name=$1",
        [name],
      );
      if (rows.length) {
        if (rows[0].sha256 !== hash)
          throw new Error("적용된 마이그레이션 변경 금지: " + name);
        console.log("이미 적용:", name);
        continue;
      }
    }
    if (mode === "migrate") {
      // SQL 변경과 적용 기록을 한 트랜잭션으로 묶는다.
      const body = sql.replace(/^begin;\s*$/gim, "").replace(/^commit;\s*$/gim, "");
      await client.query("BEGIN");
      await client.query(body);
      await client.query("INSERT INTO hub_meta.migrations VALUES($1,$2)", [name, hash]);
      await client.query("COMMIT");
    } else {
      await client.query(sql);
    }
    console.log("통과:", name);
  }
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("DB 작업 실패:", e.code ?? "오류");
  process.exitCode = 1;
} finally {
  await client.end();
}
