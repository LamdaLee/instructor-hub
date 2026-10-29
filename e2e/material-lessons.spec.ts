import { test, expect } from "@playwright/test";
import pg from "pg";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
const db = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
const user = randomUUID(), raw = randomBytes(32).toString("hex");
const people = [randomUUID(), randomUUID(), randomUUID()];
const classes = [randomUUID(), randomUUID()];
const slots = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const subject = "가상 반복 프로젝트 " + randomUUID();
const changed = "가상 수정 과목 " + randomUUID();
const day = "2099-03-02", nextDay = "2099-03-03";
const directory = process.env.MATERIALS_DIR!;
test.beforeAll(async () => {
  if (new URL(process.env.DATABASE_ADMIN_URL!).hostname !== "127.0.0.1" || !directory?.startsWith("/workspace/")) throw Error("로컬 검증 전용");
  await db.connect();
  await db.query("INSERT INTO hub.operators(id,email,name,password_hash,role,organization) VALUES($1,$2,'가상 교재 담당자','unused','member','CLIPS')", [user, `lesson-${user}@example.invalid`]);
  await db.query("INSERT INTO hub.sessions VALUES($1,$2,now()+interval '1 hour')", [createHmac("sha256", process.env.SESSION_SECRET!).update(raw).digest(), user]);
  for (const name of [subject, changed]) await db.query("INSERT INTO hub.subjects(name) VALUES($1)", [name]);
  for (const [i, id] of people.entries()) await db.query("INSERT INTO hub.instructors(id,name,organization) VALUES($1,$2,$3)", [id, `가상 프로젝트 강사${i + 1}`, i === 2 ? "LGE" : "CLIPS"]);
  for (const [i, id] of classes.entries()) await db.query("INSERT INTO hub.classes(id,region,cohort,track,name) VALUES($1,'대전',$2,'AX',$3)", [id, i + 1, `가상 프로젝트 ${i + 1}반`]);
  const fixture = [
    [slots[0], classes[0], day, people[0], "CLIPS", ""],
    [slots[1], classes[0], nextDay, people[0], "CLIPS", ""],
    [slots[2], classes[1], day, people[1], "CLIPS", ""],
    [slots[3], classes[1], day, people[2], "LGE", "별도 수업"],
  ];
  for (const row of fixture) await db.query("INSERT INTO hub.slots(id,class_id,day,instructor_id,organization,period,subject,kind) VALUES($1,$2,$3,$4,$5,$6,$7,'수업')", [...row, subject]);
});
test.afterAll(async () => {
  const files = (await db.query("SELECT disk_key FROM hub.materials WHERE instructor_id=ANY($1::uuid[])", [people])).rows;
  await db.query("DELETE FROM hub.audit_logs WHERE operator_id=$1", [user]);
  await db.query("DELETE FROM hub.materials WHERE instructor_id=ANY($1::uuid[])", [people]);
  await db.query("DELETE FROM hub.slots WHERE id=ANY($1::uuid[])", [slots]);
  await db.query("DELETE FROM hub.classes WHERE id=ANY($1::uuid[])", [classes]);
  await db.query("DELETE FROM hub.instructors WHERE id=ANY($1::uuid[])", [people]);
  await db.query("DELETE FROM hub.subjects WHERE name=ANY($1::text[])", [[subject, changed]]);
  await db.query("DELETE FROM hub.sessions WHERE operator_id=$1", [user]);
  await db.query("DELETE FROM hub.operators WHERE id=$1", [user]);
  await db.query("DELETE FROM hub.rate_limits WHERE key='upload:unknown'");
  for (const file of files) await unlink(join(directory, file.disk_key)).catch(() => {});
  await db.end();
});
async function openForm(page: any, date: string) {
  await page.getByRole("button", { name: "교재 업로드", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("수업 날짜", { exact: true }).fill(date);
  await dialog.getByRole("combobox", { name: "지역", exact: true }).selectOption("대전");
  await dialog.getByRole("combobox", { name: "트랙", exact: true }).selectOption("AX");
  await dialog.getByLabel("등록자 이름").fill("가상 등록자");
  await dialog.getByLabel("변경 사유").fill("교재 등록 검증");
  return dialog;
}
test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "hub_session", value: raw, domain: "localhost", path: "/", httpOnly: true, sameSite: "Strict" }]);
});
test("기수 선택·여러 교재·반복 프로젝트 날짜 구분과 등록 당시 정보 보존", async ({ page }) => {
  await page.goto("/?view=materials");
  let dialog = await openForm(page, day);
  const selector = dialog.getByRole("combobox", { name: "수업 선택 (기수·반)", exact: true });
  await expect(selector.locator("option")).toHaveCount(3);
  await expect(selector).toHaveValue("");
  await selector.selectOption(slots[0]);
  await expect(dialog.getByLabel("과목", { exact: true })).toHaveValue(subject);
  await expect(dialog.getByLabel("강사", { exact: true })).toHaveValue("가상 프로젝트 강사1");
  await dialog.locator('input[type="file"]').setInputFiles([
    { name: "프로젝트.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 first") },
    { name: "프로젝트.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 second") },
  ]);
  await dialog.getByRole("button", { name: "업로드", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".material-row")).toHaveCount(2);
  dialog = await openForm(page, nextDay);
  await expect(dialog.getByRole("combobox", { name: "수업 선택 (기수·반)", exact: true })).toHaveValue(slots[1]);
  await dialog.locator('input[type="file"]').setInputFiles({ name: "프로젝트.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 third") });
  await dialog.getByRole("button", { name: "업로드", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".material-row")).toHaveCount(3);
  await expect(page.locator(".material-table thead th")).toHaveText(["날짜", "트랙", "지역", "과목", "강사", "파일 이름", "관리"]);
  const saved = (await db.query("SELECT id,slot_id,disk_key,lesson_day::text AS day,filename FROM hub.materials WHERE instructor_id=$1", [people[0]])).rows;
  expect(saved).toHaveLength(3);
  expect(new Set(saved.map(r => r.disk_key)).size).toBe(3);
  expect(saved.filter(r => r.day === day)).toHaveLength(2);
  expect(saved.filter(r => r.day === nextDay)).toHaveLength(1);
  await db.query("UPDATE hub.slots SET subject=$1,instructor_id=$2 WHERE id=$3", [changed, people[1], slots[0]]);
  await db.query("UPDATE hub.classes SET region='부산',track='DM' WHERE id=$1", [classes[0]]);
  await db.query("DELETE FROM hub.slots WHERE id=$1", [slots[0]]);
  await page.reload();
  const original = page.locator(".material-row").filter({ hasText: day }).first();
  await expect(original).toContainText("대전");
  await expect(original).toContainText("AX");
  await expect(original).toContainText(subject);
  await expect(original).toContainText("가상 프로젝트 강사1");
  await original.getByRole("button", { name: "파일 수정", exact: true }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("과목", { exact: true })).toHaveValue(subject);
  await dialog.getByLabel("작업자 이름").fill("가상 수정자");
  await dialog.getByLabel("변경 사유").fill("등록 정보 유지 확인");
  await dialog.getByRole("button", { name: "변경 저장", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".material-row")).toHaveCount(3);
});
test("여러 파일 중 일부 실패 후 재시도해도 성공한 파일을 중복 등록하지 않음", async ({ page }) => {
  await page.goto("/?view=materials");
  const dialog = await openForm(page, day);
  await dialog.getByRole("combobox", { name: "수업 선택 (기수·반)", exact: true }).selectOption(slots[2]);
  let requests = 0;
  await page.route("**/api/materials", async route => {
    if (route.request().method() !== "POST") return route.continue();
    requests++;
    if (requests === 2) return route.fulfill({ status: 500, json: { ok: false, code: "server_error" } });
    await route.continue();
  });
  await dialog.locator('input[type="file"]').setInputFiles([
    { name: "재시도-A.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 retry-a") },
    { name: "재시도-B.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 retry-b") },
  ]);
  await dialog.getByRole("button", { name: "업로드", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("1/2개 저장 완료");
  await dialog.getByRole("button", { name: "남은 파일 다시 업로드" }).click();
  await expect(dialog).toHaveCount(0);
  expect(requests).toBe(3);
  const result = await db.query("SELECT filename FROM hub.materials WHERE instructor_id=$1 ORDER BY filename", [people[1]]);
  expect(result.rows.map(r => r.filename)).toEqual(["재시도-A.pdf", "재시도-B.pdf"]);
});
