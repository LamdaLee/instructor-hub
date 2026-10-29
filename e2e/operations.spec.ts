import { test, expect } from "@playwright/test";
import pg from "pg";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { today } from "../src/lib/client";
const db = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
const users = ["admin", "LAB4DX", "LGE"].map(role => ({
  id: randomUUID(), role, raw: randomBytes(32).toString("hex"),
}));
const classes = ["대구", "부산", "대전"].map(region => ({ id: randomUUID(), region }));
const person = randomUUID();
const signup = randomUUID();
test.beforeAll(async () => {
  if (!process.env.DATABASE_ADMIN_URL || new URL(process.env.DATABASE_ADMIN_URL).hostname !== "127.0.0.1") throw Error("로컬 테스트 전용");
  await db.connect();
  for (const u of users) {
    await db.query("INSERT INTO hub.operators(id,email,name,password_hash,role,organization) VALUES($1,$2,$3,'unused',$4,$5)", [u.id, `ops-${u.id}@example.invalid`, `가상 ${u.role}`, u.role === "admin" ? "admin" : "member", u.role === "admin" ? null : u.role]);
    await db.query("INSERT INTO hub.sessions VALUES($1,$2,now()+interval '1 hour')", [createHmac("sha256", process.env.SESSION_SECRET!).update(u.raw).digest(), u.id]);
  }
  await db.query("INSERT INTO hub.instructors(id,name,organization) VALUES($1,'가상 운영 강사','LGE')", [person]);
  for (const [i, c] of classes.entries()) {
    await db.query("INSERT INTO hub.classes(id,region,cohort,track,name) VALUES($1,$2,976,'OPS','가상 운영 반')", [c.id, c.region]);
    await db.query("INSERT INTO hub.slots(class_id,day,instructor_id,organization,kind,review_reason) VALUES($1,$2,$3,'LGE','수업',$4)", [c.id, today(), i < 2 ? person : null, i === 2 ? "가상 확인 사유" : null]);
  }
  await db.query("INSERT INTO hub.signup_requests(id,email,name,password_hash,organization) VALUES($1,$2,'가상 승인 대상','unused','LAB4DX')", [signup, `signup-${signup}@example.invalid`]);
});
test.afterAll(async () => {
  const ids = users.map(u => u.id);
  await db.query("DELETE FROM hub.sessions WHERE operator_id=ANY($1::uuid[])", [ids]);
  await db.query("DELETE FROM hub.audit_logs WHERE operator_id=ANY($1::uuid[]) OR target_id=$2", [ids, signup]);
  await db.query("DELETE FROM hub.signup_requests WHERE id=$1", [signup]);
  await db.query("DELETE FROM hub.slots WHERE class_id=ANY($1::uuid[])", [classes.map(c => c.id)]);
  await db.query("DELETE FROM hub.classes WHERE id=ANY($1::uuid[])", [classes.map(c => c.id)]);
  await db.query("DELETE FROM hub.instructors WHERE id=$1", [person]);
  await db.query("DELETE FROM hub.operators WHERE id=ANY($1::uuid[]) OR email=$2", [ids, `signup-${signup}@example.invalid`]);
  await db.end();
});
async function login(context: any, role: string) {
  const u = users.find(u => u.role === role)!;
  await context.addCookies([{ name: "hub_session", value: u.raw, domain: "localhost", path: "/", httpOnly: true, sameSite: "Strict" }]);
}

test("1440px 헤더·관리 메뉴 분리와 운영 점검·오늘 강조·지역 순서", async ({ page, context }) => {
  await login(context, "admin");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin?view=operations&cohort=976");
  await expect(page.getByRole("heading", { name: "이번 주 운영 현황" })).toBeVisible();
  await expect(page.locator(".stats")).toContainText("2주 내 강사 미배정");
  await expect(page.getByRole("heading", { name: "동일 날짜 중복 배정" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "관리 메뉴", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "수업 집계", exact: true })).toHaveCount(0);
  const fits = await page.locator(".portal-header").evaluate(el => {
    const outer = el.getBoundingClientRect();
    return [...el.children].every(child => { const r = child.getBoundingClientRect(); return r.right <= outer.right && r.left >= outer.left; });
  });
  expect(fits).toBe(true);
  await page.locator(".account-menu summary").click();
  await expect(page.getByRole("link", { name: "비밀번호 변경", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "로그아웃", exact: true })).toBeVisible();
  await page.goto(`/admin?view=slots&cohort=976&from=${today()}&to=${today()}`);
  await expect(page.locator(".schedule-table tbody .region-row")).toHaveText(["대전", "대구", "부산"]);
  await expect(page.locator(".schedule-table thead .is-today")).toContainText("오늘");
  await expect(page.locator(".schedule-table td.is-today")).toHaveCount(3);
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.locator(".portal-filters select").evaluateAll(items => items.every(el => {
    const r = el.getBoundingClientRect(), p = el.parentElement!.getBoundingClientRect(); return r.left >= p.left && r.right <= p.right + 1;
  }))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("모바일 LGE 변경 신청 메뉴와 LAB4DX 가입 승인·기관 정정", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(context, "LGE");
  await page.goto("/org");
  const mobile = page.getByRole("navigation", { name: "모바일 기관 메뉴" });
  await mobile.getByRole("button", { name: "강사 변경 신청" }).click();
  await expect(page.getByRole("heading", { name: "강사 변경 신청", exact: true })).toBeVisible();
  await expect(mobile.getByRole("button", { name: "가입 승인" })).toHaveCount(0);
  await login(context, "LAB4DX");
  await page.goto("/org");
  await expect(mobile.getByRole("button", { name: /가입 승인/ })).toContainText("1");
  await mobile.getByRole("button", { name: /가입 승인/ }).click();
  await expect(page.getByText("승인 권한이 부여되는 기관")).toBeVisible();
  await page.getByRole("button", { name: "승인", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("전체 기관 열람·강사 변경 승인·가입 승인 권한이 부여됩니다.")).toBeVisible();
  await expect(dialog.getByRole("checkbox")).not.toBeChecked();
  await dialog.getByLabel("승인할 소속 기관", { exact: true }).selectOption("CLIPS");
  await expect(dialog.getByRole("checkbox")).toHaveCount(0);
  await dialog.getByRole("button", { name: "승인", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(mobile.getByRole("button", { name: /가입 승인/ })).not.toContainText("1");
  const result = await db.query("SELECT organization FROM hub.operators WHERE email=$1", [`signup-${signup}@example.invalid`]);
  expect(result.rows[0].organization).toBe("CLIPS");
});

test("만료된 기관 화면은 포커스를 되찾으면 재로그인으로 이동", async ({ page, context }) => {
  await login(context, "LGE");
  await page.goto("/org");
  await expect(page.getByRole("heading", { name: "강사 명단", exact: true })).toBeVisible();
  await db.query("UPDATE hub.sessions SET expires_at=now()-interval '1 second' WHERE operator_id=$1", [users.find(u => u.role === "LGE")!.id]);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page).toHaveURL(/\/admin\/login\?expired=1&next=%2Forg/);
  await expect(page.getByLabel("이메일", { exact: true })).toBeVisible();
});

test("DB 최종 함수가 과거 공개 정의로 바뀌어도 HTTP는 비로그인 요청을 거절", async ({ request }) => {
  const definition = (await db.query("SELECT pg_get_functiondef('hub.api_read(bytea,text,jsonb)'::regprocedure) AS definition")).rows[0].definition;
  try {
    await db.query(`CREATE OR REPLACE FUNCTION hub.api_read(p_token bytea,p_view text,p_filter jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=hub,pg_temp AS $$ SELECT '{"ok":true,"rows":[]}'::jsonb $$`);
    expect((await db.query("SELECT hub.api_read(null,'options','{}') AS result")).rows[0].result.ok).toBe(true);
    for (const view of ["options", "dashboard", "materials"]) {
      const anonymous = await request.get(`/api/read?view=${view}`);
      expect(anonymous.status()).toBe(401);
      expect(await anonymous.json()).toEqual({ ok: false, code: "session_expired" });
      const invalid = await request.get(`/api/read?view=${view}`, { headers: { Cookie: `hub_session=${"ff".repeat(32)}` } });
      expect(invalid.status()).toBe(401);
    }
  } finally {
    await db.query(definition);
  }
});
