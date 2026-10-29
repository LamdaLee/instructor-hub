import pg from "pg";
import { readFile, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { buildPlan } from "./reconcile-data.mjs";
const file = process.argv[2],
  apply = process.argv.includes("--apply");
const reportArg = process.argv.indexOf("--report-file");
const reportFile = reportArg >= 0 ? process.argv[reportArg + 1] : null;
if (!file || !process.env.DATABASE_ADMIN_URL) {
  console.error(
    "사용법: node --env-file=.env scripts/import-reconciled.mjs 검토묶음.json[.gz] [--apply] [--report-file 경로]",
  );
  process.exit(1);
}
const db = new pg.Client({
  connectionString: process.env.DATABASE_ADMIN_URL,
  ssl:
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: true }
      : undefined,
  connectionTimeoutMillis: 10000,
});
try {
  if ((await stat(file)).size > 20 * 1024 * 1024)
    throw new Error("자료 크기 검증 실패");
  const raw = await readFile(file),
    bytes = file.endsWith(".gz")
      ? gunzipSync(raw, { maxOutputLength: 20 * 1024 * 1024 })
      : raw;
  const bundle = JSON.parse(bytes.toString("utf8")),
    digest = createHash("sha256").update(bytes).digest("hex");
  await db.connect();
  await db.query("BEGIN");
  await db.query("set local lock_timeout='15s'");
  await db.query("set local statement_timeout='120s'");
  await db.query("select pg_advisory_xact_lock(8734032)");
  const previous = await db.query(
    "select counts from hub.import_runs where digest=$1",
    [digest],
  );
  if (previous.rowCount) {
    console.log(
      "이미 적용된 검토 자료:",
      JSON.stringify(previous.rows[0].counts),
    );
    await db.query("ROLLBACK");
  } else {
    // 조회·실제 반영 사이에 다른 운영 수정이 끼어들지 않게 쓰기만 짧게 잠근다.
    await db.query(
      "LOCK TABLE hub.classes,hub.instructors,hub.slots,hub.workbook_instructors IN SHARE ROW EXCLUSIVE MODE",
    );
    const baseline = {};
    for (const table of [
      "classes",
      "instructors",
      "slots",
      "workbook_instructors",
    ]) {
      baseline[table] = (
        await db.query(
          "select * from hub." +
            table +
            " order by " +
            (table === "workbook_instructors" ? "source_id" : "id"),
        )
      ).rows;
    }
    const plan = buildPlan(bundle, baseline);
    const report = {
      format: "instructor-hub-reconcile-report-v1",
      digest,
      applied: false,
      counts: plan.stats,
      issues: [...(bundle.issues || []), ...plan.issues],
    };
    if (reportFile)
      await writeFile(reportFile, JSON.stringify(report, null, 2), {
        mode: 0o600,
      });
    console.log(
      apply ? "반영 계획:" : "검증 결과 (아직 반영하지 않음):",
      JSON.stringify(plan.stats),
    );
    if (!apply) await db.query("ROLLBACK");
    else {
      const groups = plan.changes;
      const organizations = [
        ...new Set(
          groups.instructors
            .map((x) => x.after.organization)
            .concat(groups.slots.map((x) => x.after.organization))
            .filter(Boolean),
        ),
      ];
      await db.query(
        "insert into hub.organizations(name) select value from jsonb_array_elements_text($1::jsonb) on conflict do nothing",
        [JSON.stringify(organizations)],
      );
      const subjects = [
        ...new Set(groups.slots.map((x) => x.after.subject).filter(Boolean)),
      ];
      await db.query(
        "insert into hub.subjects(name) select value from jsonb_array_elements_text($1::jsonb) on conflict do nothing",
        [JSON.stringify(subjects)],
      );
      if (groups.classes.length)
        await db.query(
          `insert into hub.classes(id,region,cohort,track,name,starts_on,ends_on,active,source_code,cohort_label,manager,room)
    select r.id,r.region,r.cohort,r.track,r.name,r.starts_on,r.ends_on,r.active,r.source_code,r.cohort_label,r.manager,r.room from jsonb_array_elements($1::jsonb) x cross join lateral jsonb_populate_record(null::hub.classes,x->'after') r`,
          [JSON.stringify(groups.classes)],
        );
      if (groups.instructors.length)
        await db.query(
          `insert into hub.instructors(id,name,organization,phone,email,subjects,memo,archived_at)
    select r.id,r.name,r.organization,r.phone,r.email,r.subjects,r.memo,r.archived_at from jsonb_array_elements($1::jsonb) x cross join lateral jsonb_populate_record(null::hub.instructors,x->'after') r
    on conflict(id) do update set phone=excluded.phone,email=excluded.email,subjects=excluded.subjects`,
          [JSON.stringify(groups.instructors)],
        );
      if (groups.slots.length)
        await db.query(
          `insert into hub.slots(id,class_id,day,period,subject,instructor_id,instructor_name,organization,kind,place,note,review_reason,module,hours,assignment_status)
    select r.id,r.class_id,r.day,r.period,r.subject,r.instructor_id,r.instructor_name,r.organization,r.kind,r.place,r.note,r.review_reason,r.module,r.hours,r.assignment_status from jsonb_array_elements($1::jsonb) x cross join lateral jsonb_populate_record(null::hub.slots,x->'after') r
    on conflict(id) do update set instructor_id=excluded.instructor_id,review_reason=excluded.review_reason`,
          [JSON.stringify(groups.slots)],
        );
      for (const table of ["classes", "instructors", "slots"])
        if (groups[table].length)
          await db.query(
            `insert into hub.audit_logs(actor_email,action,target_table,target_id,summary,before_value,after_value)
    select '검토자료 가져오기','import_reconciled',$2,x->'after'->>'id','원본 우선순위 검증 / 기존 운영 수정 보존 / '||coalesce((x->'sources')::text,''),x->'before',x->'after' from jsonb_array_elements($1::jsonb) x`,
            [JSON.stringify(groups[table]), table],
          );
      await db.query(
        "insert into hub.import_runs(digest,counts,source) values($1,$2,'reviewed_files')",
        [digest, plan.stats],
      );
      await db.query(
        "insert into hub.audit_logs(actor_email,action,target_table,target_id,summary,after_value) values('검토자료 가져오기','import_reconciled_summary','import_runs',$1,'검토 묶음 반영 / 충돌은 기존 값 보존',$2)",
        [digest, plan.stats],
      );
      await db.query("COMMIT");
      report.applied = true;
      if (reportFile)
        await writeFile(reportFile, JSON.stringify(report, null, 2), {
          mode: 0o600,
        }).catch(() =>
          console.warn("반영은 완료됐으나 결과 보고서 저장에 실패했습니다."),
        );
      console.log(
        "반영 완료. 1·2기 기존 수업, 운영 메모·장소·배정 상태, 계정과 변경 기록을 보존했습니다.",
      );
    }
  }
} catch (e) {
  await db.query("ROLLBACK").catch(() => {});
  console.error("검토자료 가져오기 실패:", e.code || "검증 오류");
  process.exitCode = 1;
} finally {
  await db.end().catch(() => {});
}
