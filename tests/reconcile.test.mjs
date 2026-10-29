import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPlan,
  pickPerson,
  personKey,
} from "../scripts/reconcile-data.mjs";
const classId = "00000000-0000-0000-0000-000000000101",
  personId = "00000000-0000-0000-0000-000000000102",
  slotId = "00000000-0000-0000-0000-000000000103";
function fixture() {
  const c = {
    id: classId,
    cohort: 1,
    region: "대전",
    track: "AX",
    name: "가상 1기 반",
    active: true,
  };
  const p = {
    id: personId,
    name: "가상 강사",
    organization: "LGE",
    phone: null,
    email: null,
    subjects: [],
    memo: "기존 메모",
    archived_at: null,
  };
  const s = {
    id: slotId,
    class_id: classId,
    day: new Date("2026-09-14T00:00:00Z"),
    period: "",
    subject: "가상 과목",
    instructor_id: null,
    instructor_name: "가상 강사",
    organization: "LGE",
    kind: "수업",
    note: "운영 메모",
    place: "운영 장소",
    assignment_status: "확정",
    review_reason: "강사 연결 확인 필요",
    hours: "8.00",
    module: "모듈",
  };
  const bundle = {
    format: "instructor-hub-reviewed-v1",
    classes: [
      {
        key: "one",
        source_id: classId,
        cohort: 1,
        region: "대전",
        track: "AX",
      },
    ],
    people: [
      {
        name: "가상 강사",
        organization: "LGE",
        phone: "01000000000",
        email: "test@example.invalid",
        subjects: ["가상 과목"],
      },
    ],
    slots: [
      {
        class_key: "one",
        cohort: 1,
        day: "2026-09-14",
        subject: "가상 과목",
        instructor_name: "가상 강사",
        organization: "LGE",
        kind: "수업",
        note: "과거 메모",
        place: "과거 장소",
      },
    ],
  };
  return { baseline: { classes: [c], instructors: [p], slots: [s] }, bundle };
}
test("CSV 중복은 새 행을 만들지 않고 빈 연락처와 명확한 강사 연결만 보충", () => {
  const { bundle, baseline } = fixture();
  const p = buildPlan(bundle, baseline);
  assert.equal(p.stats.new_slots, 0);
  assert.equal(p.stats.new_instructors, 0);
  assert.equal(p.stats.phone_filled, 1);
  assert.equal(p.changes.slots[0].after.instructor_id, personId);
  assert.equal(p.changes.slots[0].after.note, "운영 메모");
  assert.equal(p.changes.slots[0].after.place, "운영 장소");
  assert.equal(p.changes.slots[0].after.assignment_status, "확정");
  assert.equal(baseline.slots[0].instructor_id, null);
});
test("서로 다른 연락처와 기존 수업 내용은 과거 CSV로 덮어쓰지 않는다", () => {
  const { bundle, baseline } = fixture();
  baseline.instructors[0].phone = "01011111111";
  baseline.slots[0].subject = "운영에서 수정한 과목";
  const p = buildPlan(bundle, baseline);
  assert.equal(p.changes.slots.length, 0);
  assert.equal(p.changes.instructors[0].after.phone, "01011111111");
  assert.equal(p.stats.existing_contact_conflicts, 1);
  assert.equal(p.stats.slot_conflicts, 1);
});
test("최신 통합본 숫자 8과 PostgreSQL numeric 8.00은 같은 시수", () => {
  const { bundle, baseline } = fixture();
  bundle.classes[0].cohort = 2;
  baseline.classes[0].cohort = 2;
  Object.assign(bundle.slots[0], { cohort: 2, hours: 8, module: "모듈" });
  const p = buildPlan(bundle, baseline);
  assert.equal(p.stats.slot_conflicts, 0);
});
test("반영 결과로 다시 계획하면 추가/수정할 행이 없다", () => {
  const { bundle, baseline } = fixture();
  const p = buildPlan(bundle, baseline);
  for (const [table, changes] of Object.entries(p.changes))
    for (const c of changes) {
      const index = baseline[table].findIndex((r) => r.id === c.after.id);
      if (index >= 0) baseline[table][index] = c.after;
      else baseline[table].push(c.after);
    }
  const again = buildPlan(bundle, baseline);
  assert.equal(again.changes.instructors.length, 0);
  assert.equal(again.changes.slots.length, 0);
});
test("소속이 다르면 같은 이름도 합치지 않고 동명이인 연락처 상충은 보류", () => {
  const rows = [
    { id: "a", name: "동명 강사", organization: "LGE", phone: "01011111111" },
    { id: "b", name: "동명 강사", organization: "LGE", phone: "01022222222" },
  ];
  assert.equal(pickPerson(rows, "동명 강사", "CLIPS").person, null);
  assert.equal(pickPerson(rows, "동명 강사", "LGE").ambiguous, true);
  assert.equal(pickPerson(rows, "동명 강사", "LGE", "b").person.id, "b");
  assert.equal(personKey("(사외)가상 강사 코치"), "가상강사");
});
test("같은 반/날짜 중복과 잘못된 날짜는 DB 쓰기 전에 차단", () => {
  const { bundle, baseline } = fixture();
  bundle.slots.push({ ...bundle.slots[0] });
  assert.throws(() => buildPlan(bundle, baseline));
  bundle.slots.pop();
  bundle.slots[0].day = "2026-02-30";
  assert.throws(() => buildPlan(bundle, baseline));
});
test("연락처도 식별 근거도 없는 동명이인 중복은 임의 ID로 연결하지 않는다", () => {
  const rows = [
    { id: "a", name: "동명 강사", organization: "LGE" },
    { id: "b", name: "동명 강사", organization: "LGE" },
  ];
  assert.equal(pickPerson(rows, "동명 강사", "LGE").ambiguous, true);
  assert.equal(pickPerson(rows, "동명 강사", "LGE", "a").person.id, "a");
});
