import { test } from "node:test";
import assert from "node:assert/strict";
import { matrix, instructorDays, weeklyCounts } from "../src/lib/report.mjs";
const rows = [
  {
    class_id: "c1",
    day: "2026-10-28",
    region: "대전",
    organization: "LGE",
    instructor_id: "i1",
    instructor_name: "가상강사",
    subject: "AI",
    kind: "수업",
  },
  {
    class_id: "c1",
    day: "2026-10-28",
    region: "대전",
    organization: "LGE",
    instructor_id: "i1",
    instructor_name: "가상강사",
    subject: "AI",
    kind: "수업",
  },
  {
    class_id: "c2",
    day: "2026-10-28",
    region: "대전",
    organization: "LGE",
    instructor_id: "i1",
    instructor_name: "가상강사",
    subject: "AI",
    kind: "수업",
  },
  {
    class_id: "c1",
    day: "2026-10-29",
    region: "대전",
    organization: null,
    subject: "휴일",
    kind: "휴일",
  },
];
test("집계는 시간 구분 중복과 휴일을 제외하고 반별 수업 날짜를 센다", () => {
  assert.deepEqual(matrix(rows, "region", ["LGE", "기관 없음"]), [
    { name: "대전", LGE: 2, "기관 없음": 0 },
  ]);
});
test("강사별 수업일수와 주간 투입 인원은 중복 배정을 이중 계산하지 않는다", () => {
  assert.equal(instructorDays(rows)[0].total, 1);
  assert.deepEqual(weeklyCounts(rows), [{ name: "LGE", total: 1 }]);
});
