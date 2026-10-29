import { randomUUID } from "node:crypto";
import { canonicalOrg } from "./workbook.mjs";
import { isDate, isUuid } from "../src/lib/input.mjs";
export const personKey = (value) =>
  String(value ?? "")
    .normalize("NFC")
    .trim()
    .replace(/^\(사외\)\s*/, "")
    .replace(/\s+코치$/, "")
    .replace(/\s/g, "");
export const contactKey = (field, value) =>
  field === "phone"
    ? String(value ?? "").replace(/\D/g, "")
    : String(value ?? "")
        .trim()
        .toLowerCase();
const day = (value) =>
  value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value ?? "").slice(0, 10);
const org = (value) => canonicalOrg(value);
const empty = (value) =>
  value == null || ["", "-", "미등록", "없음"].includes(String(value).trim());
export function compatiblePeople(rows) {
  return ["phone", "email"].every(
    (k) =>
      new Set(rows.filter((p) => !empty(p[k])).map((p) => contactKey(k, p[k])))
        .size <= 1,
  );
}
export function pickPerson(rows, name, organization, boundId) {
  const same = rows.filter(
    (p) =>
      personKey(p.name) === personKey(name) && p.organization === organization,
  );
  const bound = same.find((p) => p.id === boundId);
  if (bound) return { person: bound, matches: same };
  if (same.length === 1) return { person: same[0], matches: same };
  const evidence = same.some(
    (p) =>
      /^[0-9]{8,}$/.test(contactKey("phone", p.phone)) ||
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactKey("email", p.email)),
  );
  if (same.length > 1 && evidence && compatiblePeople(same))
    return {
      person: [...same].sort(
        (a, b) =>
          Number(!!a.archived_at) - Number(!!b.archived_at) ||
          Number(empty(a.phone) && empty(a.email)) -
            Number(empty(b.phone) && empty(b.email)) ||
          a.id.localeCompare(b.id),
      )[0],
      matches: same,
    };
  return { person: null, matches: same, ambiguous: same.length > 1 };
}
export function validateBundle(bundle) {
  if (
    bundle?.format !== "instructor-hub-reviewed-v1" ||
    !Array.isArray(bundle.classes) ||
    !Array.isArray(bundle.people) ||
    !Array.isArray(bundle.slots) ||
    bundle.slots.length > 10000 ||
    bundle.people.length > 3000
  )
    throw new Error("검토 묶음 형식을 확인하세요.");
  const classes = new Set(),
    people = new Set(),
    slots = new Set();
  for (const c of bundle.classes) {
    if (
      !c.key ||
      classes.has(c.key) ||
      ![1, 2].includes(c.cohort) ||
      !["대전", "대구", "부산"].includes(c.region) ||
      !["AX", "AX1", "AX2", "SF", "DM"].includes(c.track)
    )
      throw new Error("반 식별자 검증 실패");
    classes.add(c.key);
  }
  for (const p of bundle.people) {
    const k = personKey(p.name) + "|" + p.organization;
    if (!p.name || !p.organization || people.has(k))
      throw new Error("강사 식별자 검증 실패");
    people.add(k);
    for (const field of ["phone", "email"])
      if (
        p[field] != null &&
        (typeof p[field] !== "string" || p[field].length > 320)
      )
        throw new Error("연락처 검증 실패");
  }
  for (const s of bundle.slots) {
    const k = s.class_key + "|" + s.day + "|" + (s.period || "");
    if (
      !classes.has(s.class_key) ||
      !isDate(s.day) ||
      slots.has(k) ||
      !["수업", "공통", "휴일", "없음"].includes(s.kind) ||
      (s.hours != null &&
        (!Number.isFinite(s.hours) || s.hours < 0 || s.hours > 24))
    )
      throw new Error("시간표 날짜·중복·시수 검증 실패");
    slots.add(k);
  }
  return bundle;
}
function slotDifference(old, s) {
  const fields = ["subject", "instructor_name", "organization", "kind"];
  if (s.cohort === 2) fields.push("module", "hours");
  return fields.filter((k) =>
    k === "hours"
      ? (old[k] == null) != (s[k] == null) ||
        (old[k] != null && Number(old[k]) !== Number(s[k]))
      : k === "instructor_name"
        ? personKey(old[k]) !== personKey(s[k])
        : k === "organization"
          ? org(old[k]) !== org(s[k])
          : String(old[k] ?? "") !== String(s[k] ?? ""),
  );
}
export function buildPlan(input, baseline) {
  const bundle = validateBundle(input),
    changes = { classes: [], instructors: [], slots: [] },
    issues = [];
  const people = baseline.instructors.map((p) => ({ ...p })),
    classes = baseline.classes.map((c) => ({ ...c })),
    slots = baseline.slots.map((s) => ({ ...s, day: day(s.day) }));
  const stats = {
    source_cohort1: bundle.slots.filter((s) => s.cohort === 1).length,
    source_cohort2: bundle.slots.filter((s) => s.cohort === 2).length,
    new_classes: 0,
    new_instructors: 0,
    updated_instructors: 0,
    phone_filled: 0,
    email_filled: 0,
    source_contact_conflicts: (bundle.issues || []).filter(
      (x) => x.type === "contact_conflict",
    ).length,
    new_slots: 0,
    updated_slots: 0,
    unchanged_slots: 0,
    slot_conflicts: 0,
    instructor_ambiguous: 0,
    existing_contact_conflicts: 0,
    slot_link_ambiguous: 0,
  };
  const classMap = new Map();
  for (const c of bundle.classes) {
    let match = classes.find(
      (x) =>
        x.id === c.source_id &&
        x.region === c.region &&
        x.cohort === c.cohort &&
        x.track === c.track,
    );
    let candidates = classes.filter(
      (x) =>
        x.region === c.region && x.cohort === c.cohort && x.track === c.track,
    );
    if (!match && c.code)
      match = candidates.find((x) => x.source_code === c.code);
    if (!match && candidates.length === 1) match = candidates[0];
    if (!match && candidates.length > 1) {
      issues.push({ type: "class_ambiguous", class_key: c.key });
      continue;
    }
    if (!match) {
      const sourceFree =
        isUuid(c.source_id) && !classes.some((x) => x.id === c.source_id);
      match = {
        id: sourceFree ? c.source_id : randomUUID(),
        region: c.region,
        cohort: c.cohort,
        track: c.track,
        name: c.name || `${c.region} ${c.track} ${c.cohort}기`,
        starts_on: c.from || null,
        ends_on: c.to || null,
        active: true,
        source_code: c.code || null,
        cohort_label: c.cohort_label || null,
        manager: "",
        room: "",
      };
      classes.push(match);
      changes.classes.push({ before: null, after: match });
      stats.new_classes++;
    }
    classMap.set(c.key, match);
  }
  const workbookMap = new Map(
    (baseline.workbook_instructors || []).map((x) => [
      x.source_id,
      x.instructor_id,
    ]),
  );
  for (const source of bundle.people) {
    const legacy = (source.legacy_ids || []).filter((id) =>
      people.some(
        (p) =>
          p.id === id &&
          personKey(p.name) === personKey(source.name) &&
          p.organization === source.organization,
      ),
    );
    const bound =
      (source.workbook_id ? workbookMap.get(source.workbook_id) : undefined) ||
      (legacy.length === 1 ? legacy[0] : undefined);
    const selected = pickPerson(
      people,
      source.name,
      source.organization,
      bound,
    );
    if (selected.ambiguous) {
      stats.instructor_ambiguous++;
      issues.push({
        type: "instructor_ambiguous",
        name: source.name,
        organization: source.organization,
      });
      continue;
    }
    let targets = selected.person ? [selected.person] : [];
    if (!targets.length) {
      let id =
        (source.legacy_ids || []).find(
          (id) => isUuid(id) && !people.some((p) => p.id === id),
        ) || randomUUID();
      const p = {
        id,
        name: source.name,
        organization: source.organization,
        phone: source.phone || null,
        email: source.email || null,
        subjects: source.subjects || [],
        memo: "",
        archived_at: null,
      };
      people.push(p);
      changes.instructors.push({
        before: null,
        after: p,
        sources: source.sources,
      });
      stats.new_instructors++;
      continue;
    }
    // 같은 이름·소속의 기존 ID는 합치거나 삭제하지 않고 각각 보존한다.
    for (const p of targets) {
      const before = { ...p },
        after = { ...p };
      for (const field of ["phone", "email"])
        if (source[field]) {
          if (empty(p[field])) {
            after[field] = source[field];
            stats[field + "_filled"]++;
          } else if (
            contactKey(field, p[field]) !== contactKey(field, source[field])
          ) {
            stats.existing_contact_conflicts++;
            issues.push({
              type: "existing_contact_conflict",
              name: p.name,
              organization: p.organization,
              field,
              sources: source.sources,
            });
          }
        }
      const subjects = [
        ...new Set([...(p.subjects || []), ...(source.subjects || [])]),
      ];
      after.subjects = subjects;
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        Object.assign(p, after);
        changes.instructors.push({ before, after, sources: source.sources });
        stats.updated_instructors++;
      }
    }
  }
  for (const s of bundle.slots) {
    const c = classMap.get(s.class_key);
    if (!c) continue;
    const matches = slots.filter(
      (x) =>
        x.class_id === c.id &&
        x.day === s.day &&
        (x.period || "") === (s.period || ""),
    );
    if (matches.length > 1) {
      issues.push({
        type: "slot_ambiguous",
        class_key: s.class_key,
        day: s.day,
      });
      stats.slot_conflicts++;
      continue;
    }
    const old = matches[0];
    if (old) {
      const differences = slotDifference(old, s);
      if (differences.length) {
        issues.push({
          type: "slot_conflict",
          class_key: s.class_key,
          day: s.day,
          cohort: s.cohort,
          fields: differences,
          existing: {
            subject: old.subject,
            instructor_name: old.instructor_name,
          },
          source: { subject: s.subject, instructor_name: s.instructor_name },
        });
        stats.slot_conflicts++;
        continue;
      }
    }
    const selected = pickPerson(people, s.instructor_name, s.organization);
    if (!old?.instructor_id && selected.ambiguous) {
      stats.slot_link_ambiguous++;
      issues.push({
        type: "instructor_link_ambiguous",
        class_key: s.class_key,
        day: s.day,
        name: s.instructor_name,
        organization: s.organization,
      });
    }
    const id = old?.instructor_id || selected.person?.id || null;
    const reason =
      [s.review_reason, !id && s.instructor_name ? "강사 연결 확인 필요" : null]
        .filter(Boolean)
        .join(" / ") || null;
    if (!old) {
      const after = {
        id:
          isUuid(s.source_id) && !slots.some((x) => x.id === s.source_id)
            ? s.source_id
            : randomUUID(),
        class_id: c.id,
        day: s.day,
        period: s.period || "",
        subject: s.subject || null,
        instructor_id: id,
        instructor_name: s.instructor_name || "",
        organization: s.organization || null,
        kind: s.kind,
        place: s.place || "",
        note: s.note || "",
        review_reason: reason,
        module: s.module || null,
        hours: s.hours ?? null,
        assignment_status: "임시",
      };
      slots.push(after);
      changes.slots.push({ before: null, after, sources: s.sources });
      stats.new_slots++;
    } else {
      const after = { ...old };
      if (!old.instructor_id && id) {
        after.instructor_id = id;
        after.review_reason =
          String(old.review_reason || "")
            .split(/\s*[/,]\s*/)
            .filter((x) => x && x !== "강사 연결 확인 필요")
            .join(" / ") || null;
      }
      // 기존 운영 메모·장소·배정 상태는 오래된 자료로 덮어쓰지 않는다.
      if (JSON.stringify(old) !== JSON.stringify(after)) {
        changes.slots.push({ before: { ...old }, after, sources: s.sources });
        Object.assign(old, after);
        stats.updated_slots++;
      } else stats.unchanged_slots++;
    }
  }
  return { stats, changes, issues };
}
