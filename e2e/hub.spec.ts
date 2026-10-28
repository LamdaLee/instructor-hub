import { test, expect } from "@playwright/test";
import pg from "pg";
import { randomUUID, randomBytes } from "node:crypto";
const origin = "http://localhost:3000";
const adminId = randomUUID(),
  classId = randomUUID(),
  person = randomUUID();
const email = `browser-${adminId}@example.invalid`,
  password = randomBytes(20).toString("hex");
let db: pg.Client;
test.beforeAll(async () => {
  if (
    !process.env.DATABASE_ADMIN_URL ||
    !["localhost", "127.0.0.1"].includes(
      new URL(process.env.DATABASE_ADMIN_URL).hostname,
    )
  )
    throw new Error("로컬 DB에서만 브라우저 테스트를 실행하세요.");
  db = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  await db.connect();
  await db.query(
    "INSERT INTO hub.operators(id,email,name,password_hash,role) VALUES($1,$2,'가상 브라우저 관리자',extensions.crypt($3,extensions.gen_salt('bf')),'admin')",
    [adminId, email, password],
  );
  await db.query(
    "INSERT INTO hub.classes(id,region,cohort,track,name) VALUES($1,'대전',998,'E2E','가상 브라우저 반')",
    [classId],
  );
  await db.query(
    "INSERT INTO hub.instructors(id,name,organization,phone) VALUES($1,'E2E 가상 강사','LGE','TEST-PRIVATE')",
    [person],
  );
});
test.afterAll(async () => {
  if (!db) return;
  await db.query("DELETE FROM hub.sessions WHERE operator_id=$1", [adminId]);
  await db.query("DELETE FROM hub.audit_logs WHERE operator_id=$1", [adminId]);
  await db.query("DELETE FROM hub.slots WHERE class_id=$1", [classId]);
  await db.query("DELETE FROM hub.classes WHERE id=$1", [classId]);
  await db.query("DELETE FROM hub.instructors WHERE id=$1", [person]);
  await db.query("DELETE FROM hub.operators WHERE id=$1", [adminId]);
  await db.query(
    "DELETE FROM hub.subjects WHERE name='E2E 과목' AND NOT EXISTS(SELECT 1 FROM hub.slots WHERE subject='E2E 과목')",
  );
  await db.query("DELETE FROM hub.rate_limits WHERE key=$1", [
    "email:" + email,
  ]);
  await db.end();
});
test("데스크톱·모바일: 로그인, 시간표 편집·붙여 넣기, 강사 상세, 집계·관리", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "운영 대시보드" }),
  ).toBeVisible();
  await page.goto(
    `/?view=slots&cohort=998&class_id=${classId}&from=2099-01-05`,
  );
  await expect(
    page.getByRole("heading", { name: "주간 시간표" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "시간표 추가", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "반", exact: true })
    .selectOption(classId);
  await dialog.getByLabel("날짜", { exact: true }).fill("2099-01-06");
  await dialog.getByLabel("과목", { exact: true }).fill("E2E 과목");
  await dialog.getByLabel("모듈", { exact: true }).fill("E2E 모듈");
  await dialog.getByLabel("시수", { exact: true }).fill("8");
  await dialog
    .getByRole("combobox", { name: "강사", exact: true })
    .selectOption(person);
  await dialog
    .getByRole("combobox", { name: "기관", exact: true })
    .selectOption("LGE");
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("cell", { name: "E2E 과목", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "수정", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("장소", { exact: true }).fill("E2E 검증 교실");
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("cell", { name: "E2E 검증 교실" })).toBeVisible();
  await page
    .getByRole("button", { name: "엑셀 붙여 넣기", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("엑셀 데이터")
    .fill("2099-01-07\tE2E 과목\tE2E 가상 강사\tLGE\t가상 교실\t가상 메모");
  await dialog.getByRole("button", { name: "미리보기", exact: true }).click();
  await expect(dialog.getByRole("cell", { name: "2099-01-07" })).toBeVisible();
  await dialog.getByRole("button", { name: "1건 저장" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "2099-01-07" })).toBeVisible();
  await page.goto(
    "/?view=instructors&q=" + encodeURIComponent("E2E 가상 강사"),
  );
  await expect(
    page.getByRole("link", { name: "E2E 가상 강사", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("TEST-PRIVATE", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "E2E 가상 강사", exact: true }).click();
  await expect(page.getByText("TEST-PRIVATE", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "수업 달력" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `/?view=slots&cohort=998&class_id=${classId}&from=2099-01-05`,
  );
  await expect(page.getByRole("cell", { name: "E2E 검증 교실" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto("/?view=reports&cohort=998");
  await expect(
    page.getByRole("heading", { name: "강사별 수업일수" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "시간표 CSV 다운로드" }),
  ).toBeVisible();
  await page.goto("/?view=admin");
  await expect(
    page.getByRole("button", { name: "계정 추가", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "반", exact: true }).click();
  await expect(page.getByRole("heading", { name: "반 관리" })).toBeVisible();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page).toHaveURL(origin + "/login");
});
