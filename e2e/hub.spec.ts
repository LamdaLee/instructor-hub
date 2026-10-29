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
  await db.query(
    "INSERT INTO hub.subjects(name) VALUES('E2E 과목') ON CONFLICT DO NOTHING",
  );
});
test.afterAll(async () => {
  if (!db) return;
  await db.query("DELETE FROM hub.sessions WHERE operator_id=$1", [adminId]);
  await db.query("DELETE FROM hub.audit_logs WHERE operator_id=$1", [adminId]);
  await db.query("DELETE FROM hub.materials WHERE instructor_id=$1", [person]);
  await db.query("DELETE FROM hub.announcements WHERE title='E2E 운영 공지'");
  await db.query("DELETE FROM hub.slots WHERE class_id=$1", [classId]);
  await db.query("DELETE FROM hub.venue_overrides WHERE class_id=$1", [classId]);
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
test("공개 포털·기간 시간표·강사 모달·공개 업로드·관리자 변경", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await db.query(
    "INSERT INTO hub.slots(class_id,day,subject,instructor_id,kind) VALUES($1,(now() AT TIME ZONE 'Asia/Seoul')::date,'E2E 과목',$2,'수업')",
    [classId, person],
  );
  await page.goto("/");
  await expect(
    page.getByRole("combobox", { name: "기수", exact: true }),
  ).toHaveValue("all");
  await expect(page.locator(".portal-brand")).toContainText("LG전자 K-뉴딜 아카데미");
  await expect(page.locator(".portal-intro h1")).toHaveCount(0);
  await expect(page.locator(".course-card")).toHaveCount(1);
  const noAuth = await request.post("/api/save", {
    headers: { Origin: origin },
    data: { kind: "instructor", data: { name: "권한 검증", subjects: [] } },
  });
  expect(noAuth.status()).toBe(401);
  await page.goto(
    "/?view=instructors&q=" + encodeURIComponent("E2E 가상 강사"),
  );
  await page
    .getByRole("button", { name: "E2E 가상 강사", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("TEST-PRIVATE");
  await page.screenshot({ path: test.info().outputPath("portal-teacher.png") });
  expect(page.url()).toContain("view=instructors");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const invalidUpload = await request.post("/api/materials", {
    headers: { Origin: origin },
    multipart: {
      subject: "E2E 과목",
      instructor_id: person,
      uploader: "가상 등록자",
      reason: "형식 검증",
      file: {
        name: "fake.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("not a PDF"),
      },
    },
  });
  expect(invalidUpload.status()).toBe(400);
  const foreignUpload = await request.post("/api/materials", {
    headers: { Origin: "https://foreign.example" },
    multipart: { subject: "E2E 과목" },
  });
  expect(foreignUpload.status()).toBe(403);
  await page.goto("/?view=materials");
  await expect(page.getByRole("button", { name: "파일 수정" })).toHaveCount(0);
  await page.getByRole("button", { name: "교재 업로드", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "교과목", exact: true })
    .selectOption("E2E 과목");
  await dialog
    .getByRole("combobox", { name: "강사", exact: true })
    .selectOption(person);
  await dialog.getByLabel("등록자 이름").fill("가상 공개 등록자");
  await dialog.locator("input[type=file]").setInputFiles({
    name: "E2E-교재.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 E2E"),
  });
  await dialog.getByLabel("변경 사유").fill("비로그인 업로드 검증");
  await dialog.getByRole("button", { name: "업로드", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const card = page
    .locator(".material-card")
    .filter({ hasText: "E2E-교재.pdf" });
  await expect(card).toBeVisible();
  const wait = page.waitForEvent("download");
  await card.getByRole("link", { name: "교재 내려받기" }).click();
  expect((await wait).suggestedFilename()).toBe("E2E-교재.pdf");
  await card.getByRole("button", { name: "파일 수정", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("작업자 이름").fill("가상 공개 수정자");
  await dialog.locator("input[type=file]").setInputFiles({
    name: "E2E-교재.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 public edit"),
  });
  await dialog.getByLabel("변경 사유").fill("비로그인 교재 교체");
  await dialog.getByRole("button", { name: "변경 저장", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const material = (
    await db.query(
      "select id from hub.materials where filename='E2E-교재.pdf' and instructor_id=$1",
      [person],
    )
  ).rows[0];
  expect(
    (
      await request.delete("/api/materials/" + material.id, {
        headers: { Origin: origin },
      })
    ).status(),
  ).toBe(400);
  await page.goto("/admin");
  await expect(page).toHaveURL(/admin\/login/);
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin?view=facilities");
  await page
    .getByRole("combobox", { name: "기수", exact: true })
    .selectOption("998");
  await page
    .getByRole("button", { name: "강의장·매니저 수정", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("담당 매니저", { exact: true })
    .fill("E2E 담당 매니저");
  await dialog
    .getByLabel("기본 강의장", { exact: true })
    .fill("E2E 기본 강의장");
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".class-settings")).toContainText(
    "E2E 담당 매니저",
  );
  await expect(page.locator(".class-settings")).toContainText(
    "E2E 기본 강의장",
  );
  await page.getByRole("button", { name: "날짜별 강의장", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("시작일", { exact: true }).fill("2099-01-05");
  await dialog.getByLabel("종료일", { exact: true }).fill("2099-01-09");
  await dialog.getByLabel("변경 강의장", { exact: true }).fill("평택 E2E 강의장");
  await dialog.getByLabel("메모", { exact: true }).fill("1주차 입소 교육");
  await dialog.getByRole("button", { name: "예외 기간 저장", exact: true }).click();
  await expect(dialog.locator(".venue-list")).toContainText("평택 E2E 강의장");
  await page.keyboard.press("Escape");
  await page.goto("/?cohort=998");
  await expect(page.locator(".course-card")).toContainText("E2E 담당 매니저");
  await expect(page.locator(".course-card")).toContainText("E2E 기본 강의장");

  await page.goto(
    `/admin?view=slots&cohort=998&class_id=${classId}&from=2099-01-05&to=2099-01-09`,
  );
  await page.getByRole("button", { name: "수업 추가", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "반", exact: true })
    .selectOption(classId);
  await dialog.getByLabel("날짜", { exact: true }).fill("2099-01-06");
  await dialog.getByLabel("과목", { exact: true }).fill("E2E 과목");
  await dialog.getByLabel("시작 시간 (선택)", { exact: true }).fill("10:00");
  await dialog.getByLabel("종료 시간 (선택)", { exact: true }).fill("17:00");
  await expect(dialog.getByLabel("모듈", { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel("시수", { exact: true })).toHaveCount(0);
  await dialog.getByLabel("강사 이름", { exact: true }).fill("E2E 가상 강사");
  await dialog
    .getByRole("combobox", { name: "기관", exact: true })
    .selectOption("LGE");
  await dialog
    .getByRole("combobox", { name: "강사 배정 상태", exact: true })
    .selectOption("확정");
  await dialog.getByLabel("메모", { exact: true }).fill("가상 준비사항");
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".schedule-table")).toContainText("가상 준비사항");
  await expect(page.locator(".schedule-table")).toContainText("확정");
  await expect(page.locator(".schedule-table")).toContainText("평택 E2E 강의장");
  await expect(page.locator(".schedule-table")).toContainText("10:00~17:00");
  await page.screenshot({
    path: test.info().outputPath("portal-timetable.png"),
    fullPage: true,
  });
  await page.getByLabel("시작일", { exact: true }).fill("2099-01-06");
  await page.getByLabel("종료일", { exact: true }).fill("2099-01-07");
  await page.getByRole("button", { name: "기간 적용", exact: true }).click();
  await expect(page.locator(".schedule-table thead th")).toHaveCount(4);
  await page.goto("/admin?view=materials");
  await page
    .locator(".material-card")
    .filter({ hasText: "E2E-교재.pdf" })
    .getByRole("button", { name: "파일 수정" })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.locator("input[type=file]").setInputFiles({
    name: "E2E-수정.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 updated"),
  });
  await dialog.getByLabel("작업자 이름").fill("가상 관리자");
  await dialog.getByLabel("변경 사유").fill("파일 교체");
  await dialog.getByRole("button", { name: "변경 저장" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".material-grid")).toContainText("E2E-수정.pdf");
  const publicPage = await browser.newPage();
  await publicPage.goto(origin + "/?view=materials");
  await publicPage
    .locator(".material-card")
    .filter({ hasText: "E2E-수정.pdf" })
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  const deletion = publicPage.getByRole("dialog");
  await deletion.getByLabel("작업자 이름").fill("가상 공개 삭제자");
  await deletion.getByLabel("삭제 사유").fill("비로그인 삭제 검증");
  await deletion
    .getByRole("button", { name: "삭제 확인", exact: true })
    .click();
  await expect(publicPage.locator(".material-grid")).not.toContainText(
    "E2E-수정.pdf",
  );
  await publicPage.close();
  await page.goto("/admin?view=announcements");
  await page.getByRole("button", { name: "공지 등록" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("제목").fill("E2E 운영 공지");
  await dialog.getByLabel("내용").fill("가상 운영 공지 내용");
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".notice-grid")).toContainText("E2E 운영 공지");
  await page.goto("/admin?view=manage");
  await page.getByRole("button", { name: "변경 기록", exact: true }).click();
  await expect(page.locator("main")).toContainText("material_update");
  await page.setViewportSize({ width: 375, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(
    `/?view=region&cohort=998&region=대전&from=2099-01-05&to=2099-01-09`,
  );
  await expect(page.locator(".schedule-mobile")).toBeVisible();
  await expect(page.locator(".schedule-shell")).not.toBeVisible();
  await page
    .getByRole("button", { name: "E2E 가상 강사", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText("TEST-PRIVATE");
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
