// 로컬 DB에서만 가상 fixture로 실제 일괄 INSERT·감사 기록·재실행을 검사한다.
import pg from "pg";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
const url = process.env.DATABASE_ADMIN_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname))
  throw new Error("로컬 테스트 DB에서만 실행하세요.");
const db = new pg.Client({ connectionString: url });
await db.connect();
const cls = randomUUID(),
  instructor = randomUUID(),
  slot = randomUUID();
const folder = await mkdtemp(join(tmpdir(), "hub-import-test-"));
const bundle = {
  format: "instructor-hub-reviewed-v1",
  classes: [
    {
      key: "test",
      source_id: cls,
      cohort: 1,
      region: "대전",
      track: "AX2",
      name: "가상 가져오기 검증 반",
    },
  ],
  people: [
    {
      name: "가상 가져오기 검증 강사 " + instructor,
      organization: "LGE",
      phone: "01000000000",
      email: "test@example.invalid",
      legacy_ids: [instructor],
      subjects: ["가상 가져오기 검증 과목"],
    },
  ],
  slots: [
    {
      class_key: "test",
      source_id: slot,
      cohort: 1,
      day: "2098-07-09",
      subject: "가상 가져오기 검증 과목",
      instructor_name: "가상 가져오기 검증 강사 " + instructor,
      organization: "LGE",
      kind: "수업",
    },
  ],
};
const bytes = JSON.stringify(bundle),
  digest = createHash("sha256").update(bytes).digest("hex"),
  file = join(folder, "bundle.json");
try {
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from hub.classes where region='대전' and cohort=1 and track='AX2'",
      )
    ).rows[0].n,
    0,
    "기존 반과 겹치지 않는 테스트만 실행",
  );
  await writeFile(file, bytes, { mode: 0o600 });
  const run = () =>
    execFileSync(
      process.execPath,
      ["scripts/import-reconciled.mjs", file, "--apply"],
      { encoding: "utf8", env: process.env },
    );
  assert.ok(run().includes("반영 완료"));
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from hub.slots where id=$1 and instructor_id=$2",
        [slot, instructor],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from hub.audit_logs where action='import_reconciled' and target_id=any($1::text[])",
        [[cls, instructor, slot]],
      )
    ).rows[0].n,
    3,
  );
  assert.ok(run().includes("이미 적용된"));
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from hub.slots where class_id=$1",
        [cls],
      )
    ).rows[0].n,
    1,
  );
  console.log(
    "실제 DB 가져오기 통과: 새 반·강사·수업 INSERT / 변경 전후 기록 / 멱등성",
  );
} finally {
  await db.query("delete from hub.slots where class_id=$1", [cls]);
  await db.query("delete from hub.classes where id=$1", [cls]);
  await db.query("delete from hub.instructors where id=$1", [instructor]);
  await db.query("delete from hub.import_runs where digest=$1", [digest]);
  await db.query("delete from hub.audit_logs where target_id=any($1::text[])", [
    [cls, instructor, slot, digest],
  ]);
  await db.query(
    "delete from hub.subjects where name='가상 가져오기 검증 과목' and not exists(select 1 from hub.slots where subject='가상 가져오기 검증 과목')",
  );
  await db.end();
  await rm(folder, { recursive: true, force: true });
}
