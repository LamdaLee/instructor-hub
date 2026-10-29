// 로컬 전용 가상 계정으로 HTTP 인증·조회·편집을 검증한다.
import pg from "pg";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
if (
  !["localhost", "127.0.0.1"].includes(new URL(origin).hostname) ||
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_ADMIN_URL).hostname,
  )
)
  throw new Error("스모크 테스트는 로컬 환경에서만 실행하세요.");
const db = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
await db.connect();
const id = randomUUID(),
  person = randomUUID(),
  classId = randomUUID(),
  email = `smoke-${id}@example.invalid`,
  password = randomBytes(20).toString("hex");
let cookie = "";
async function request(path, data, withCookie = true, customOrigin = origin) {
  const res = await fetch(origin + path, {
    method: data ? "POST" : "GET",
    headers: {
      ...(data
        ? { "Content-Type": "application/json", Origin: customOrigin }
        : {}),
      ...(withCookie ? { Cookie: cookie } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  return res;
}
async function json(path, data) {
  const res = await request(path, data);
  const r = await res.json();
  assert.equal(r.ok, true, `실패: ${path} (${r.code ?? res.status})`);
  return r;
}
try {
  await db.query(
    "INSERT INTO hub.operators(id,email,name,password_hash,role) VALUES($1,$2,'가상 테스트 관리자',extensions.crypt($3,extensions.gen_salt('bf')),'admin')",
    [id, email, password],
  );
  await db.query(
    "INSERT INTO hub.classes(id,region,cohort,track,name) VALUES($1,'대전',999,'SMOKE','가상 검증 반')",
    [classId],
  );
  let res = await request("/api/read?view=instructors", null, false);
  assert.equal(res.status, 200);
  res = await request(
    "/api/login",
    { email, password },
    false,
    "https://foreign.example",
  );
  assert.equal(res.status, 403);
  res = await request("/api/login", { email, password }, false);
  assert.equal(res.status, 200);
  const header = res.headers.get("set-cookie");
  assert.ok(
    header.includes("HttpOnly") &&
      header.includes("SameSite=strict") &&
      header.includes("Secure"),
    "운영 세션 쿠키 보안",
  );
  cookie = header.split(";")[0];
  await json("/api/me");
  const page = await request("/");
  assert.equal(page.status, 200);
  assert.ok((await page.text()).includes("LG전자 K-뉴딜 아카데미"));
  await json("/api/read?view=options");
  await json("/api/save", {
    kind: "instructor",
    data: {
      id: person,
      name: "가상 스모크 강사",
      organization: "LGE",
      subjects: [],
      phone: "TEST-ONLY",
      email: "test@example.invalid",
      memo: "테스트",
    },
  });
  const list = await json(
    "/api/read?view=instructors&q=" + encodeURIComponent("가상 스모크 강사"),
  );
  assert.equal(list.rows.length, 1);
  assert.equal("phone" in list.rows[0], false);
  const detail = await json("/api/read?view=instructor&id=" + person);
  assert.equal(detail.instructor.phone, "TEST-ONLY");
  const row = {
    class_id: classId,
    day: "2099-01-06",
    subject: "스모크 과목",
    module: "스모크 모듈",
    hours: 8,
    instructor_id: person,
    organization: "LGE",
    place: "가상 교실",
    note: "=1+1",
  };
  await json("/api/save", { kind: "slots", data: { rows: [row] } });
  res = await request("/api/save", { kind: "slots", data: { rows: [row] } });
  assert.equal(res.status, 409);
  await json("/api/save", {
    kind: "slots",
    data: { rows: [{ ...row, place: "수정 교실" }], overwrite: true },
  });
  const slots = await json("/api/read?view=slots&class_id=" + classId);
  assert.equal(slots.rows[0].place, "수정 교실");
  assert.equal(slots.rows[0].module, "스모크 모듈");
  assert.equal(slots.rows[0].hours, 8);
  res = await request("/api/read?view=slots&from=2026-02-30");
  assert.equal(res.status, 400);
  await json("/api/read?view=dashboard&cohort=999");
  await json("/api/read?view=reports&class_id=" + classId);
  await json("/api/read?view=operators");
  const audit = await json("/api/read?view=audit");
  assert.ok(
    audit.rows.some((r) => r.operator_id === id || r.action === "save"),
  );
  res = await request("/api/export?class_id=" + classId);
  assert.equal(res.status, 200);
  let csv = await res.text();
  assert.ok(csv.includes("'=1+1"), "CSV 수식 주입 방어");
  assert.equal(csv.includes("TEST-ONLY"), false, "CSV 기본 연락처 숨김");
  res = await request("/api/export?class_id=" + classId + "&contacts=true");
  csv = await res.text();
  assert.ok(csv.includes("TEST-ONLY"), "CSV 선택 연락처 포함");
  await json("/api/logout", {});
  res = await request("/api/me");
  assert.equal(res.status, 401);
  console.log(
    "HTTP 스모크 통과: CSRF·보안 쿠키·로그인·보호 페이지·목록/상세·시간표 편집·덮어쓰기·로그아웃",
  );
} finally {
  await db.query("DELETE FROM hub.sessions WHERE operator_id=$1", [id]);
  await db.query("DELETE FROM hub.audit_logs WHERE operator_id=$1", [id]);
  await db.query("DELETE FROM hub.slots WHERE class_id=$1", [classId]);
  await db.query("DELETE FROM hub.classes WHERE id=$1", [classId]);
  await db.query("DELETE FROM hub.instructors WHERE id=$1", [person]);
  await db.query("DELETE FROM hub.operators WHERE id=$1", [id]);
  await db.query(
    "DELETE FROM hub.subjects WHERE name='스모크 과목' AND NOT EXISTS(SELECT 1 FROM hub.slots WHERE subject='스모크 과목')",
  );
  await db.query("DELETE FROM hub.rate_limits WHERE key=$1", [
    "email:" + email,
  ]);
  await db.end();
}
