import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  workbookData,
  readWorkbook,
  cellValue,
  matchPerson,
} from "../scripts/workbook.mjs";
function fixture() {
  const b = new ExcelJS.Workbook();
  let s = b.addWorksheet("통합시간표");
  s.addRow([
    "ID",
    "기수",
    "지역",
    "반",
    "트랙코드",
    "날짜",
    "구분",
    "교과목",
    "모듈명",
    "시수",
    "강사명",
    "기관",
  ]);
  s.addRow([
    "S1",
    "2-1",
    "대전",
    "대전1",
    "DM",
    new Date("2026-11-02T00:00:00Z"),
    "교육",
    "가상교과",
    "가상모듈",
    8,
    "가상강사",
    "LG 사내강사",
  ]);
  s = b.addWorksheet("강사목록");
  s.addRow(["강사ID", "강사명", "기관", "연락처", "이메일"]);
  s.addRow(["T1", "가상강사", "LG 사내강사", " ", ""]);
  s = b.addWorksheet("교과목_모듈");
  s.addRow(["트랙코드", "교과목", "모듈명", "1일 시수"]);
  s.addRow(["DM", "가상교과", "가상모듈", 8]);
  return b;
}
test("엑셀의 반·교과목·모듈·시수와 기관을 정확히 읽음", () => {
  const d = workbookData(fixture());
  assert.equal(d.classes[0].cohort, 2);
  assert.equal(d.slots[0].day, "2026-11-02");
  assert.equal(d.slots[0].organization, "LGE");
  assert.equal(d.slots[0].module, "가상모듈");
  assert.equal(d.slots[0].hours, 8);
  assert.equal(d.instructors[0].phone, null);
  assert.equal(d.modules.length, 1);
});
test("엑셀 셀의 수식은 실행하지 않고 캐시된 결과만 읽음", () => {
  assert.equal(
    cellValue({ formula: "UNTRUSTED()", result: "기존 결과" }),
    "기존 결과",
  );
  assert.equal(cellValue({ formula: "UNTRUSTED()" }), null);
});
test("중복 반·날짜와 잘못된 반 연결은 차단", () => {
  const b = fixture();
  b.getWorksheet("통합시간표").addRow([
    "S2",
    "2-1",
    "대전",
    "대전1",
    "DM",
    new Date("2026-11-02T00:00:00Z"),
    "교육",
    "가상교과",
    "가상모듈",
    8,
    "가상강사",
    "LGE",
  ]);
  assert.throws(() => workbookData(b));
  const bad = fixture();
  bad.getWorksheet("통합시간표").getRow(2).getCell(2).value = "1";
  assert.throws(() => workbookData(bad));
});
test("실제 xlsx 파일의 날짜·빈 연락처를 읽는 왕복 검증", async () => {
  const dir = await mkdtemp(tmpdir() + "/hub-xlsx-");
  try {
    const file = dir + "/fixture.xlsx";
    await fixture().xlsx.writeFile(file);
    const d = await readWorkbook(file);
    assert.equal(d.slots.length, 1);
    assert.equal(d.instructors[0].email, null);
  } finally {
    await rm(dir, { recursive: true });
  }
});
test("기존 강사는 연락처까지 동일한 중복만 대표 연결하고 다른 연락처는 추측하지 않음", () => {
  const p = { name: "가상강사", organization: "LGE" },
    one = {
      ...p,
      id: "2",
      phone: "010-0000-1234",
      email: "test@example.invalid",
    },
    two = { ...one, id: "1" };
  assert.equal(matchPerson(p, [one, two]).id, "1");
  assert.throws(() =>
    matchPerson(p, [one, { ...two, phone: "010-0000-5678" }]),
  );
  assert.throws(() =>
    matchPerson(p, [
      { ...one, phone: null, email: null },
      { ...two, phone: null, email: null },
    ]),
  );
});
