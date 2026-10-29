import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseTsv,
  isDate,
  validFilter,
  validSave,
  csvCell,
} from "../src/lib/input.mjs";
test("엑셀 붙여 넣기: 한글 헤더·CRLF·따옴표·여러 줄 셀", () => {
  const rows = parseTsv(
    '날짜\t과목\t강사\t기관\t장소\t메모\r\n2026-10-28\t과목\t가상강사\tLGE\t교실\t"여러\n줄"\r\n',
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].note, "여러\n줄");
  assert.throws(() => parseTsv("2026-02-30\t과목\t강사\tLGE"));
  assert.throws(() => parseTsv('2026-10-28\t"안 닫힘'));
});
test("필터와 입력은 유효 날짜·UUID만 허용", () => {
  assert.equal(isDate("2026-02-30"), false);
  assert.equal(isDate("2028-02-29"), true);
  assert.equal(validFilter({ from: "2026-10-30", to: "2026-10-01" }), false);
  assert.equal(validFilter({ class_id: "'; DROP TABLE hub.slots;" }), false);
  assert.equal(validFilter({ region: "대전", cohort: "2" }), true);
  assert.equal(validSave("slots", { rows: [] }), false);
  assert.equal(
    validSave("operator", {
      name: "가상",
      email: "invalid",
      active: true,
      role: "admin",
    }),
    false,
  );
});
test("CSV 따옴표와 스프레드시트 수식 주입 방어", () => {
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  assert.equal(csvCell(" @SUM(A1)"), '"\' @SUM(A1)"');
});

test("강의장 예외 기간과 수업 시간 입력 검증", () => {
  const data = { class_id: "00000000-0000-0000-0000-000000000063", starts_on: "2026-11-02", ends_on: "2026-11-06", room: "평택 러닝센터", note: "1주차" };
  assert.equal(validSave("venue_override", data), true);
  assert.equal(validSave("venue_override", { ...data, ends_on: "2026-11-01" }), false);
  assert.equal(validSave("venue_override", { ...data, room: " " }), false);
  assert.equal(validSave("venue_override", { ...data, starts_on: "2026-02-30" }), false);
  const row = { class_id: data.class_id, day: data.starts_on };
  assert.equal(validSave("slots", { rows: [{ ...row, start_time: "10:00", end_time: "17:00" }] }), true);
  assert.equal(validSave("slots", { rows: [{ ...row, start_time: "18:00", end_time: "09:00" }] }), false);
  assert.equal(validSave("slots", { rows: [{ ...row, start_time: "09:00", end_time: "" }] }), false);
  assert.equal(validSave("slots", { rows: [{ ...row, start_time: "", end_time: "" }] }), true);
});
