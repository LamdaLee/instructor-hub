import pg from "pg";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { readWorkbook, matchPerson, canonicalOrg } from "./workbook.mjs";
import { nameKey } from "./backup.mjs";
const file = process.argv[2],
  apply = process.argv.includes("--apply");
if (!file || !process.env.DATABASE_ADMIN_URL) {
  console.error(
    "사용법: npm run import-workbook -- 파일.xlsx [--apply] (기본: 검증만)",
  );
  process.exit(1);
}
const db = new pg.Client({
  connectionString: process.env.DATABASE_ADMIN_URL,
  ssl:
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: true }
      : undefined,
});
try {
  const data = await readWorkbook(file),
    digest = createHash("sha256")
      .update(await readFile(file))
      .digest("hex");
  await db.connect();
  await db.query("BEGIN");
  await db.query("SELECT pg_advisory_xact_lock(8734032)");
  const old = await db.query(
    "SELECT counts FROM hub.import_runs WHERE digest=$1",
    [digest],
  );
  if (old.rowCount) {
    console.log("이미 반영된 엑셀:", JSON.stringify(old.rows[0].counts));
    await db.query("ROLLBACK");
  } else {
    const classRows = (
      await db.query("SELECT * FROM hub.classes ORDER BY id FOR UPDATE")
    ).rows;
    const byCode = new Map();
    for (const c of data.classes) {
      const candidates = classRows.filter(
        (x) =>
          x.region === c.region && x.cohort === c.cohort && x.track === c.track,
      );
      if (candidates.length !== 1)
        throw new Error("엑셀 반과 DB 반의 일대일 매핑 필요");
      byCode.set(c.code, { ...c, id: candidates[0].id });
    }
    const ids = [...byCode.values()].map((c) => c.id);
    const previous = (
      await db.query(
        "SELECT * FROM hub.slots WHERE class_id=ANY($1::uuid[]) ORDER BY day,id FOR UPDATE",
        [ids],
      )
    ).rows;
    const existing = (
      await db.query("SELECT * FROM hub.instructors ORDER BY id FOR UPDATE")
    ).rows;
    const mapped = (await db.query("SELECT * FROM hub.workbook_instructors"))
      .rows;
    let added = 0,
      matched = 0,
      duplicates = 0;
    const people = [];
    for (const p of data.instructors) {
      const bound = mapped.find((m) => m.source_id === p.source_id);
      const boundPerson = bound
        ? existing.find((e) => e.id === bound.instructor_id)
        : null;
      const match =
        boundPerson && nameKey(boundPerson.name) === nameKey(p.name)
          ? boundPerson
          : matchPerson(p, existing);
      const person = { ...p, id: match?.id ?? randomUUID() };
      people.push(person);
      if (match) {
        matched++;
        if (match.duplicate_ids) duplicates++;
      } else added++;
    }
    const slots = data.slots.map((s) => {
      const candidates = people.filter(
        (i) =>
          nameKey(i.name) === nameKey(s.instructor_name) &&
          i.organization === s.organization,
      );
      const person = candidates.length === 1 ? candidates[0] : null;
      const reasons = [
        s.review_reason,
        s.instructor_name && !person ? "강사 연결 확인 필요" : null,
      ].filter(Boolean);
      const class_id = byCode.get(s.code).id;
      const oldSlot = previous.find(
        (p) =>
          p.class_id === class_id &&
          p.day.toISOString().slice(0, 10) === s.day &&
          !p.period,
      );
      return {
        ...s,
        id: oldSlot?.id ?? randomUUID(),
        class_id,
        instructor_id: person?.id ?? null,
        review_reason: reasons.join(" / ") || null,
      };
    });
    const counts = {
      classes: byCode.size,
      slots: slots.length,
      workbook_instructors: people.length,
      matched_instructors: matched,
      new_instructors: added,
      identical_duplicate_groups: duplicates,
      modules: data.modules.length,
      replaced_slots: previous.length,
      review: slots.filter((s) => s.review_reason).length,
    };
    console.log(
      apply ? "엑셀 적용 계획:" : "엑셀 검증 (아직 반영하지 않음):",
      JSON.stringify(counts),
    );
    if (!apply) await db.query("ROLLBACK");
    else {
      await db.query(
        "INSERT INTO hub.import_snapshots(digest,slots) VALUES($1,$2)",
        [digest, JSON.stringify(previous)],
      );
      const organizations = [
        ...new Set(
          people
            .map((p) => p.organization)
            .concat(slots.map((s) => s.organization))
            .filter(Boolean),
        ),
      ];
      for (const org of organizations)
        await db.query(
          "INSERT INTO hub.organizations VALUES($1) ON CONFLICT DO NOTHING",
          [org],
        );
      const subjects = [
        ...new Set(
          data.modules
            .map((m) => m.subject)
            .concat(slots.map((s) => s.subject))
            .filter(Boolean),
        ),
      ];
      for (const subject of subjects)
        await db.query(
          "INSERT INTO hub.subjects(name) VALUES($1) ON CONFLICT DO NOTHING",
          [subject],
        );
      await db.query("DELETE FROM hub.modules WHERE track=ANY($1::text[])", [
        [...new Set(data.modules.map((m) => m.track))],
      ]);
      for (const m of data.modules)
        await db.query(
          "INSERT INTO hub.modules(track,subject,name,hours) VALUES($1,$2,$3,$4) ON CONFLICT(track,subject,name) DO UPDATE SET hours=excluded.hours",
          [m.track, m.subject, m.name, m.hours],
        );
      await db.query("DELETE FROM hub.workbook_instructors");
      for (const p of people) {
        const subjects = [
          ...new Set(
            slots
              .filter((s) => s.instructor_id === p.id)
              .map((s) => s.subject)
              .filter(Boolean),
          ),
        ];
        await db.query(
          `INSERT INTO hub.instructors(id,name,organization,phone,email,memo,subjects) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET name=excluded.name,organization=excluded.organization,phone=coalesce(excluded.phone,hub.instructors.phone),email=coalesce(excluded.email,hub.instructors.email),memo=case when excluded.memo<>'' then excluded.memo else hub.instructors.memo end,subjects=array(select distinct unnest(hub.instructors.subjects||excluded.subjects)),archived_at=null`,
          [
            p.id,
            p.name,
            p.organization,
            p.phone,
            p.email,
            p.memo ?? "",
            subjects,
          ],
        );
        await db.query(
          "INSERT INTO hub.workbook_instructors VALUES($1,$2) ON CONFLICT(source_id) DO UPDATE SET instructor_id=excluded.instructor_id",
          [p.source_id, p.id],
        );
      }
      for (const c of byCode.values()) {
        const days = slots
          .filter((s) => s.class_id === c.id)
          .map((s) => s.day)
          .sort();
        await db.query(
          "UPDATE hub.classes SET source_code=$1,cohort_label=$2,starts_on=$3,ends_on=$4 WHERE id=$5",
          [c.code, c.cohort_label, days[0], days.at(-1), c.id],
        );
      }
      await db.query("DELETE FROM hub.slots WHERE class_id=ANY($1::uuid[])", [
        ids,
      ]);
      for (const s of slots)
        await db.query(
          "INSERT INTO hub.slots(id,class_id,day,subject,module,hours,instructor_id,instructor_name,organization,kind,place,note,review_reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
          [
            s.id,
            s.class_id,
            s.day,
            s.subject,
            s.module,
            s.hours,
            s.instructor_id,
            s.instructor_name,
            s.organization,
            s.kind,
            s.place,
            s.note,
            s.review_reason,
          ],
        );
      await db.query(
        "INSERT INTO hub.import_runs(digest,counts,source) VALUES($1,$2,'workbook')",
        [digest, counts],
      );
      await db.query(
        "INSERT INTO hub.audit_logs(action,target_table,target_id,summary,before_value,after_value) VALUES('import_workbook','slots',$1,'최신 통합 엑셀', $2,$3)",
        [
          digest,
          JSON.stringify({ slots: previous.length }),
          JSON.stringify(counts),
        ],
      );
      await db.query("COMMIT");
      console.log(
        "엑셀 반영 완료. 기존 연락처·1기 시간표·계정과 변경 기록을 보존했습니다.",
      );
    }
  }
} catch (e) {
  await db.query("ROLLBACK").catch(() => {});
  console.error(
    "엑셀 가져오기 실패:",
    e.code ?? "열·날짜·반·강사 매핑을 확인하세요.",
  );
  process.exitCode = 1;
} finally {
  await db.end().catch(() => {});
}
