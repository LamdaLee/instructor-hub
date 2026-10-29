// 마이그레이션 전 hub 데이터 스냅샷. 개인정보를 출력하지 않고 보호 파일로 저장한다.
import pg from "pg";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
if (!process.env.DATABASE_ADMIN_URL)
  throw new Error("DATABASE_ADMIN_URL이 필요합니다.");
const directory = resolve(process.argv[2] || "../hub-snapshots");
await mkdir(directory, { recursive: true, mode: 0o700 });
const db = new pg.Client({
  connectionString: process.env.DATABASE_ADMIN_URL,
  ssl:
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: true }
      : undefined,
});
const file = join(
  directory,
  "hub-data-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json.gz",
);
await db.connect();
async function* snapshot() {
  await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  yield '{"format":"hub-data-snapshot-v1","created_at":' +
    JSON.stringify(new Date().toISOString()) +
    ',"tables":{';
  const { rows: tables } = await db.query(
    "select table_schema,table_name from information_schema.tables where table_schema in ('hub','hub_meta') and table_type='BASE TABLE' order by table_schema,table_name",
  );
  let first = true;
  for (const t of tables) {
    const name = t.table_schema + "." + t.table_name;
    yield (first ? "" : ",") + JSON.stringify(name) + ":[";
    first = false;
    const ident =
      '"' +
      t.table_schema.replaceAll('"', '""') +
      '"."' +
      t.table_name.replaceAll('"', '""') +
      '"';
    await db.query(
      "DECLARE snapshot_cursor NO SCROLL CURSOR FOR SELECT row_to_json(t) AS row FROM " +
        ident +
        " t",
    );
    let firstRow = true;
    while (true) {
      const batch = await db.query("FETCH 500 FROM snapshot_cursor");
      if (!batch.rows.length) break;
      for (const { row } of batch.rows) {
        yield (firstRow ? "" : ",") + JSON.stringify(row);
        firstRow = false;
      }
    }
    await db.query("CLOSE snapshot_cursor");
    yield "]";
  }
  yield "}}";
  await db.query("COMMIT");
}
try {
  await pipeline(
    Readable.from(snapshot()),
    createGzip(),
    createWriteStream(file, { flags: "wx", mode: 0o600 }),
  );
  console.log("hub 데이터 스냅샷 저장 완료:", file);
} catch (e) {
  await db.query("ROLLBACK").catch(() => {});
  console.error("스냅샷 실패:", e.code || "internal");
  process.exitCode = 1;
} finally {
  await db.end();
}
