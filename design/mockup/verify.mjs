import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
const folder = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 1560, height: 1120 },
  deviceScaleFactor: 1,
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const content = await readFile(resolve(folder, "index.html"));
const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(content);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = "http://127.0.0.1:" + server.address().port;
async function open() {
  await page.goto(url);
  await page.waitForSelector(".track-card");
}
async function screenshot(name, fullPage = true) {
  await page.screenshot({
    path: resolve(folder, "screenshots", name),
    fullPage,
  });
}
async function noOverflow() {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "페이지 가로 넘침 없음",
  );
}
try {
  await open();
  assert.equal(await page.locator(".track-card").count(), 7);
  await noOverflow();
  await screenshot("01-dashboard-desktop.png");
  await page
    .getByRole("button", { name: "김예시", exact: false })
    .first()
    .click();
  await page.getByRole("dialog").waitFor();
  assert.ok(
    (await page.getByRole("dialog").innerText()).includes("010-0000-0000"),
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page
    .locator(".side-nav")
    .getByRole("button", { name: "전체 시간표", exact: true })
    .click();
  assert.equal(await page.locator(".schedule-table tbody tr").count(), 5);
  await screenshot("02-timetable-desktop.png");
  await page
    .getByRole("combobox", { name: "기관 필터", exact: true })
    .selectOption("lab");
  assert.ok(
    (await page.locator(".filter-state").innerText()).includes("LAB4DX"),
  );
  await page.getByRole("button", { name: "필터 초기화", exact: true }).click();
  await page
    .locator(".sidebar-foot")
    .getByRole("button", { name: "관리자 로그인", exact: true })
    .click();
  await page
    .getByRole("button", { name: "관리 화면 미리보기", exact: false })
    .click();
  await page
    .getByRole("heading", { name: "아카데미 운영 관리", exact: true })
    .waitFor();
  await screenshot("03-admin-desktop.png");
  const statusTab = page.getByRole("tab", { name: "임시", exact: true });
  await statusTab.click();
  assert.equal(await statusTab.getAttribute("aria-selected"), "true");
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await page
      .getByRole("tab", { name: "변경예정", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
  assert.notEqual(
    await page
      .locator(".u039-tabs")
      .evaluate((e) => getComputedStyle(e).backgroundColor),
    "rgb(255, 255, 255)",
  );
  await screenshot("07-admin-dark.png");
  await page.evaluate(() => (document.documentElement.dataset.theme = "light"));

  await page
    .getByRole("button", { name: "3기 · 4기 과정 추가", exact: false })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("반 이름", { exact: true }).fill("부산 4기 예시 반");
  await dialog.getByLabel("담당 매니저", { exact: true }).fill("담당자 예시");
  await dialog.getByLabel("강의장", { exact: true }).fill("부산 501호");
  await dialog.getByLabel("기수", { exact: false }).fill("4");
  await dialog.getByRole("button", { name: "과정 추가", exact: true }).click();
  assert.ok(
    await page.getByText("부산 4기 예시 반", { exact: false }).isVisible(),
  );
  await page.getByRole("button", { name: "변경 기록", exact: true }).click();
  assert.ok((await page.locator("main").innerText()).includes("4기"));
  await page.getByRole("button", { name: "운영 개요", exact: true }).click();
  await page
    .getByRole("button", { name: "강사 붙여 넣기", exact: true })
    .click();
  await page.getByRole("button", { name: "미리보기", exact: true }).click();
  assert.equal(await page.locator(".preview-table tbody tr").count(), 1);
  await page.getByRole("button", { name: "목업에 반영", exact: true }).click();
  await page
    .getByRole("button", { name: "시간표", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "노트북 · AI 실습 계정 준비", exact: false })
    .first()
    .click();
  await page.locator("#note-edit").fill("목업 검증용 준비사항");
  await page.getByRole("button", { name: "메모 저장", exact: true }).click();
  assert.ok(
    await page
      .getByRole("button", { name: "목업 검증용 준비사항", exact: false })
      .first()
      .isVisible(),
  );
  await page.setViewportSize({ width: 390, height: 1000 });
  await open();
  await noOverflow();
  await screenshot("04-dashboard-mobile.png", false);
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "시간표", exact: true })
    .click();
  assert.ok(await page.locator(".schedule-mobile").isVisible());
  assert.ok(!(await page.locator(".schedule-shell").isVisible()));
  await noOverflow();
  await screenshot("05-timetable-mobile.png", false);
  await page.getByRole("button", { name: "트랙별 보기", exact: true }).click();
  assert.ok(
    (await page.locator(".day-group summary").first().innerText()).includes(
      "Digital Marketing",
    ),
  );
  await page
    .getByRole("button", { name: "김예시", exact: false })
    .first()
    .click();
  await screenshot("06-teacher-mobile.png", false);
  await page.keyboard.press("Escape");
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "자료실", exact: true })
    .click();
  await page
    .getByRole("button", { name: "교재 내려받기", exact: false })
    .first()
    .click();
  assert.ok(
    (await page.getByRole("dialog").innerText()).includes(
      "실제 교재 파일이 없습니다",
    ),
  );
  await page.keyboard.press("Escape");
  await noOverflow();
  await page.setViewportSize({ width: 375, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open();
  await noOverflow();
  await page
    .getByRole("button", { name: "김예시", exact: false })
    .first()
    .click();
  await page.getByRole("dialog").waitFor();
  assert.equal(
    await page.getByRole("dialog").getAttribute("aria-hidden"),
    "false",
  );
  await noOverflow();
  await page.keyboard.press("j");
  assert.ok((await page.locator(".u273-ix").innerText()).startsWith("2"));
  await page.keyboard.press("k");
  assert.ok((await page.locator(".u273-ix").innerText()).startsWith("1"));
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.locator(".top-actions [data-admin-login]").click();
  await page
    .getByRole("button", { name: "관리 화면 미리보기", exact: false })
    .click();
  await noOverflow();
  await page.getByRole("tab", { name: "임시", exact: true }).click();
  assert.equal(
    await page
      .getByRole("tab", { name: "임시", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  await page.evaluate(() =>
    window.notifyLucian("모션 줄이기 · 저장 알림 확인"),
  );
  await page.locator(".u070-t").first().waitFor();
  await noOverflow();
  await screenshot("08-admin-mobile.png", false);
  await page
    .getByRole("button", { name: "알림 닫기", exact: true })
    .first()
    .click();
  assert.deepEqual(errors, [], "브라우저 스크립트 오류 없음");
  console.log(
    "목업 검증 통과: 공개 조회·공개 연락처·전체 시간표·기관 필터·관리자 진입·4기 과정 추가·엑셀 미리보기·셀 메모·변경 기록·모바일 전환·자료실 안내. Lucian 039/070/273 · 밝은/어두운 테마 전환 · 375px · 키보드 · 모션 줄이기 통과. 스크린샷 8개 저장.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
