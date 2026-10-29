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
test("기관 계정 입력 검사", async () => {
  const { validOrg, validSignup } = await import("../src/lib/input.mjs");
  const id = "00000000-0000-0000-0000-000000000001";
  assert.ok(validOrg("instructors", { q: "김" }, false));
  assert.ok(!validOrg("instructors", { organization: "CLIPS" }, false));
  assert.ok(!validOrg("submit", { kind: "register", name: "가상" }, true));
  assert.ok(validOrg("submit", { kind: "register", name: "가상", note: "신규" }, true));
  assert.ok(validOrg("submit", { kind: "remove", instructor_id: id, note: "종료" }, true));
  assert.ok(!validOrg("decide", { id, decision: "reject" }, true));
  assert.ok(validOrg("decide", { id, decision: "approve" }, true));
  assert.ok(!validOrg("signups", {}, true));
  assert.ok(validOrg("counts", {}, false));
  assert.ok(validOrg("decide_signup", { id, decision: "reject", note: "가상 사유" }, true));
  assert.ok(validOrg("decide_signup", { id, decision: "approve", organization: "CLIPS" }, true));
  assert.ok(!validOrg("decide_signup", { id, decision: "approve", organization: "기타" }, true));
  assert.ok(!validOrg("decide_signup", { id, decision: "approve", confirm_privileged: "true" }, true));
  const signup = { name: "가상", email: "a@example.invalid", organization: "CLIPS", password: "long-password" };
  assert.ok(validSignup(signup));
  assert.ok(!validSignup({ ...signup, organization: "기타" }));
  assert.ok(!validSignup({ ...signup, email: "not-email" }));
  assert.ok(!validSignup({ ...signup, password: "short" }));
  assert.ok(!validSignup({ ...signup, extra: "x" }));
});
