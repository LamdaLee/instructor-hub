import { test, expect } from "@playwright/test";
import { today, moveDay } from "../src/lib/client";

// 가상 응답으로 기수·날짜 선택과 좁은 화면의 실제 배치를 검증한다.
const classes = [
  { id: "today-first", name: "대전 AX", region: "대전", cohort: 1, track: "AX", active: true },
  { id: "today-second", name: "부산 SF", region: "부산", cohort: 2, track: "SF", active: true },
  { id: "tomorrow", name: "내일 수업", region: "대구", cohort: 2, track: "DM", active: true },
  { id: "holiday", name: "휴강 반", region: "대구", cohort: 2, track: "DM", active: true },
];
const slots = classes.map((c, i) => ({
  id: c.id, class_id: c.id, day: i === 2 ? moveDay(today(), 1) : today(),
  kind: i === 3 ? "휴일" : "수업", subject: `가상 과목 ${i + 1}`,
  linked_name: "가상 강사", organization: "LGE", hours: 8,
}));
for (const width of [320, 390, 768, 1440]) {
  test(`오늘 수업과 반응형 배치 (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/read?**", async route => {
      const url = new URL(route.request().url());
      let data: object = { ok: true, rows: [] };
      if (url.searchParams.get("view") === "options") {
        data = { ok: true, classes, regions: ["대전", "대구", "부산"], organizations: ["LGE"] };
      } else if (url.searchParams.get("view") === "slots") {
        data = { ok: true, rows: slots.filter(r =>
          r.day === url.searchParams.get("from") &&
          (!url.searchParams.get("cohort") || String(classes.find(c => c.id === r.class_id)?.cohort) === url.searchParams.get("cohort"))) };
      }
      await route.fulfill({ json: data });
    });
    await page.goto("/");
    await expect(page.getByRole("combobox", { name: "기수", exact: true })).toHaveValue("all");
    await expect(page.locator(".course-card")).toHaveCount(2);
    await expect(page.locator(".course-card").first()).toContainText("가상 과목 1");
    await expect(page.locator(".course-card").nth(1)).toContainText("가상 과목 2");
    const bounds = await page.locator(".portal-filters select").evaluateAll(selects => {
      return selects.map(el => {
        const rect = el.getBoundingClientRect();
        const label = el.parentElement!.getBoundingClientRect();
        return { fits: rect.left >= label.left && rect.right <= label.right + 1, width: rect.width };
      });
    });
    expect(bounds.every(b => b.fits && b.width >= 90)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`portal-${width}.png`), fullPage: true });
    await page.getByRole("combobox", { name: "기수", exact: true }).selectOption("1");
    await expect(page.locator(".course-card")).toHaveCount(1);
    await page.getByRole("button", { name: "필터 초기화" }).click();
    await expect(page.locator(".course-card")).toHaveCount(2);
    await page.getByLabel("수업 조회 날짜", { exact: true }).fill(moveDay(today(), 1));
    await expect(page.locator(".course-card")).toHaveCount(1);
    await expect(page.locator(".course-card")).toContainText("가상 과목 3");
    await page.getByLabel("수업 조회 날짜", { exact: true }).fill(moveDay(today(), 2));
    await expect(page.locator(".course-card")).toHaveCount(0);
    await expect(page.getByText("선택한 날짜와 조건에 맞는 수업이 없습니다.")).toBeVisible();
  });
}
