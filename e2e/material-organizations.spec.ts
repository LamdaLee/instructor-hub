import { test, expect } from "@playwright/test";
import pg from "pg";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
const db = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
const users = ["LGE", "LAB4DX", "CLIPS", "aSSIST"].map(org => ({ org, id: randomUUID(), raw: randomBytes(32).toString("hex") }));
const materials = users.map(u => ({ org: u.org, id: randomUUID(), person: randomUUID(), key: randomUUID() }));
const labels: Record<string, string> = { CLIPS: "클립스", aSSIST: "어시스트", LGE: "LG전자", LAB4DX: "랩포디엑스" };
const subject = "가상 기관 교재 " + randomUUID();
const pdf = Buffer.from("%PDF-1.4 TEST MATERIAL");
const directory = process.env.MATERIALS_DIR!;
test.beforeAll(async () => {
  if (new URL(process.env.DATABASE_ADMIN_URL!).hostname !== "127.0.0.1" || !directory?.startsWith("/workspace/")) throw Error("로컬 검증 전용");
  await db.connect();
  await mkdir(directory, { recursive: true });
  await db.query("INSERT INTO hub.subjects(name) VALUES($1)", [subject]);
  for (const u of users) {
    await db.query("INSERT INTO hub.operators(id,email,name,password_hash,role,organization) VALUES($1,$2,'가상 기관 사용자','unused','member',$3)", [u.id, `material-${u.id}@example.invalid`, u.org]);
    await db.query("INSERT INTO hub.sessions VALUES($1,$2,now()+interval '1 hour')", [createHmac("sha256", process.env.SESSION_SECRET!).update(u.raw).digest(), u.id]);
  }
  for (const m of materials) {
    await db.query("INSERT INTO hub.instructors(id,name,organization) VALUES($1,$2,$3)", [m.person, "가상 " + m.org + " 강사", m.org]);
    await db.query("INSERT INTO hub.materials(id,subject,instructor_id,organization,filename,disk_key,bytes,mime,uploader) VALUES($1,$2,$3,$4,$5,$6,$7,'application/pdf','가상 등록자')", [m.id, subject, m.person, m.org, `${m.org}-교재.pdf`, m.key, pdf.length]);
    await writeFile(join(directory, m.key), pdf, { flag: "wx", mode: 0o600 });
  }
});
test.afterAll(async () => {
  const ids = users.map(u => u.id), people = materials.map(m => m.person);
  const files = (await db.query("SELECT disk_key FROM hub.materials WHERE instructor_id=ANY($1::uuid[])", [people])).rows;
  await db.query("DELETE FROM hub.audit_logs WHERE operator_id=ANY($1::uuid[])", [ids]);
  await db.query("DELETE FROM hub.materials WHERE instructor_id=ANY($1::uuid[])", [people]);
  await db.query("DELETE FROM hub.instructors WHERE id=ANY($1::uuid[])", [people]);
  await db.query("DELETE FROM hub.subjects WHERE name=$1", [subject]);
  await db.query("DELETE FROM hub.sessions WHERE operator_id=ANY($1::uuid[])", [ids]);
  await db.query("DELETE FROM hub.operators WHERE id=ANY($1::uuid[])", [ids]);
  await db.query("DELETE FROM hub.rate_limits WHERE key='upload:unknown'");
  for (const f of files) await unlink(join(directory, f.disk_key)).catch(() => {});
  await db.end();
});
async function login(context: any, org: string) {
  await context.addCookies([{ name: "hub_session", value: users.find(u => u.org === org)!.raw, domain: "localhost", path: "/", httpOnly: true, sameSite: "Strict" }]);
}
test("LG전자·랩포디엑스는 네 기관 탭과 모든 기관 파일을 조회", async ({ page, context }) => {
  for (const org of ["LGE", "LAB4DX"]) {
    await login(context, org);
    await page.goto("/?view=materials");
    await expect(page.locator(".material-card")).toHaveCount(4);
    const tabs = page.getByRole("tablist", { name: "교재 기관" });
    for (const m of materials) {
      await tabs.getByRole("tab", { name: labels[m.org], exact: true }).click();
      await expect(page.locator(".material-card")).toHaveCount(1);
      await expect(page.locator(".material-card")).toContainText(`${m.org}-교재.pdf`);
      expect((await page.request.get("/api/materials/" + m.id)).status()).toBe(200);
    }
  }
});
test("클립스·어시스트는 자기 기관만 보고 ID·기관 위조로 다른 교재를 변경하지 못함", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const org of ["CLIPS", "aSSIST"]) {
    await login(context, org);
    await page.goto("/?view=materials");
    await expect(page.getByRole("tab")).toHaveCount(1);
    await expect(page.getByRole("tab", { name: labels[org], exact: true })).toBeVisible();
    await expect(page.locator(".material-card")).toHaveCount(1);
    await expect(page.locator(".material-card")).toContainText(`${org}-교재.pdf`);
    const foreign = materials.find(m => m.org === "LGE")!;
    const list = await page.request.get("/api/read?view=materials&organization=LGE");
    expect((await list.json()).rows).toEqual([]);
    expect((await page.request.get("/api/materials/" + foreign.id)).status()).toBe(404);
    const headers = { Origin: "http://localhost:3000" };
    expect((await page.request.delete("/api/materials/" + foreign.id, { headers, data: { actor: "가상 사용자", reason: "권한 검증" } })).status()).toBe(404);
    expect((await page.request.post("/api/materials/" + foreign.id, { headers, multipart: { subject, organization: org, instructor_id: foreign.person, actor: "가상 사용자", reason: "권한 검증" } })).status()).toBe(404);
    expect((await page.request.post("/api/materials", { headers, multipart: { subject, organization: "LGE", instructor_id: foreign.person, uploader: "가상 사용자", reason: "권한 검증", file: { name: "가상.pdf", mimeType: "application/pdf", buffer: pdf } } })).status()).toBe(403);
    const own = materials.find(m => m.org === org)!;
    const uploaded = await page.request.post("/api/materials", { headers, multipart: { subject, organization: org, instructor_id: own.person, uploader: "가상 사용자", reason: "자기 기관 업로드 검증", file: { name: "가상.pdf", mimeType: "application/pdf", buffer: pdf } } });
    expect(uploaded.status()).toBe(200);
    const id = (await uploaded.json()).id;
    expect((await page.request.get("/api/materials/" + id)).status()).toBe(200);
    expect((await page.request.delete("/api/materials/" + id, { headers, data: { actor: "가상 사용자", reason: "검증 자료 정리" } })).status()).toBe(200);
  }
});
