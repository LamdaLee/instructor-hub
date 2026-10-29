export function isDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const d = new Date(value + "T00:00:00Z");
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === value;
}
export const isUuid = (v) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function validFilter(f) {
  if (!f || typeof f !== "object" || Array.isArray(f)) return false;
  const allowed = new Set([
    "region",
    "cohort",
    "track",
    "organization",
    "class_id",
    "instructor_id",
    "subject",
    "from",
    "to",
    "id",
    "q",
    "archived",
    "contacts",
    "offset",
  ]);
  for (const [k, v] of Object.entries(f)) {
    if (!allowed.has(k) || typeof v !== "string" || v.length > 300)
      return false;
    if (v && ["from", "to"].includes(k) && !isDate(v)) return false;
    if (v && ["id", "class_id", "instructor_id"].includes(k) && !isUuid(v))
      return false;
    if (v && k === "cohort" && !/^[1-9]\d{0,3}$/.test(v)) return false;
    if (v && k === "offset" && !/^\d{1,6}$/.test(v)) return false;
    if (
      v &&
      ["archived", "contacts"].includes(k) &&
      !["true", "false"].includes(v)
    )
      return false;
  }
  return !(f.from && f.to && f.from > f.to);
}
// 엑셀의 따옴표·탭·여러 줄 셀을 읽는다.
export function parseTsv(text) {
  const rows = [];
  let row = [],
    cell = "",
    quote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && (quote || cell === "")) {
      if (quote && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quote = !quote;
    } else if (!quote && (c === "\t" || c === "\n" || c === "\r")) {
      row.push(cell);
      cell = "";
      if (c !== "\t") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        if (row.some((x) => x.trim())) rows.push(row);
        row = [];
      }
    } else cell += c;
  }
  if (quote) throw new Error("따옴표가 닫히지 않은 셀이 있습니다.");
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  if (rows[0]?.[0].trim() === "날짜") rows.shift();
  if (!rows.length || rows.length > 500)
    throw new Error("1~500행을 입력하세요.");
  return rows.map((r, i) => {
    if (r.length < 4 || r.length > 6 || !isDate(r[0].trim()))
      throw new Error(`${i + 1}행: 날짜(YYYY-MM-DD)와 4~6개 열을 확인하세요.`);
    return {
      day: r[0].trim(),
      subject: r[1].trim(),
      instructor_name: r[2].trim(),
      organization: r[3].trim(),
      place: r[4]?.trim() ?? "",
      note: r[5]?.trim() ?? "",
    };
  });
}
export function csvCell(value) {
  const s = String(value ?? "");
  const safe = /^[\s]*[=+@-]/.test(s) ? "'" + s : s;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function validSave(kind, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  if (data.id && !isUuid(data.id)) return false;
  if (["archive_subject", "rename_subject"].includes(kind))
    return (
      typeof data.old_name === "string" &&
      data.old_name.length > 0 &&
      data.old_name.length <= 200 &&
      (kind === "archive_subject" ||
        (typeof data.name === "string" &&
          data.name.trim().length > 0 &&
          data.name.length <= 200))
    );
  if (kind === "delete_venue_override") return isUuid(data.id);
  if (kind === "venue_override")
    return (
      (!data.id || isUuid(data.id)) && isUuid(data.class_id) &&
      isDate(data.starts_on) && isDate(data.ends_on) && data.starts_on <= data.ends_on &&
      typeof data.room === "string" && data.room.trim().length > 0 && data.room.length <= 200 &&
      typeof data.note === "string" && data.note.length <= 2000
    );
  if (kind === "class_settings")
    return (
      isUuid(data.id) &&
      ["manager", "room"].every(
        (k) => typeof data[k] === "string" && data[k].length <= 200,
      )
    );
  if (kind === "announcement")
    return (
      (!!data.id && data.delete === true) ||
      (typeof data.title === "string" &&
        data.title.trim().length > 0 &&
        data.title.length <= 200 &&
        typeof data.body === "string" &&
        data.body.trim().length > 0 &&
        data.body.length <= 10000 &&
        (!data.region || ["대전", "대구", "부산"].includes(data.region)) &&
        typeof data.important === "boolean")
    );
  if (kind === "delete_slot") return isUuid(data.id);
  if (kind === "slots")
    return (
      Array.isArray(data.rows) &&
      data.rows.length > 0 &&
      data.rows.length <= 500 &&
      data.rows.every(
        (r) =>
          r &&
          typeof r === "object" &&
          isUuid(r.class_id) &&
          isDate(r.day) &&
          (r.hours == null ||
            (typeof r.hours === "number" &&
              Number.isFinite(r.hours) &&
              r.hours >= 0 &&
              r.hours <= 24)) &&
          (!r.id || isUuid(r.id)) &&
          (!r.instructor_id || isUuid(r.instructor_id)) &&
          [
            "period",
            "module",
            "review_reason",
            "subject",
            "instructor_name",
            "organization",
            "place",
            "note",
          ].every(
            (k) =>
              r[k] == null || (typeof r[k] === "string" && r[k].length <= 2000),
          ) &&
          ((r.start_time === undefined && r.end_time === undefined) ||
            (((r.start_time === "" || r.start_time === null) && (r.end_time === "" || r.end_time === null)) ||
              (typeof r.start_time === "string" && typeof r.end_time === "string" &&
                /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(r.start_time) &&
                /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(r.end_time) && r.end_time > r.start_time))) &&
          (!r.assignment_status ||
            ["임시", "변경예정", "확정"].includes(r.assignment_status)) &&
          (!r.kind || ["수업", "공통", "휴일", "없음"].includes(r.kind)),
      )
    );
  if (
    !["instructor", "class", "operator", "organization", "subject"].includes(
      kind,
    ) ||
    typeof data.name !== "string" ||
    !data.name.trim() ||
    data.name.length > 200
  )
    return false;
  if (kind === "instructor")
    return (
      (!data.archived_at || !Number.isNaN(Date.parse(data.archived_at))) &&
      Array.isArray(data.subjects) &&
      data.subjects.every((s) => typeof s === "string" && s.length <= 200) &&
      ["phone", "email", "memo", "organization"].every(
        (k) =>
          data[k] == null ||
          (typeof data[k] === "string" && data[k].length <= 10000),
      )
    );
  if (kind === "class")
    return (
      typeof data.region === "string" &&
      typeof data.track === "string" &&
      Number.isInteger(data.cohort) &&
      data.cohort > 0 &&
      data.cohort < 10000 &&
      (!data.starts_on || isDate(data.starts_on)) &&
      (!data.ends_on || isDate(data.ends_on)) &&
      !(data.starts_on && data.ends_on && data.starts_on > data.ends_on)
    );
  if (kind === "operator")
    return (
      typeof data.email === "string" &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) &&
      data.email.length <= 320 &&
      ["admin", "member"].includes(data.role) &&
      (data.organization == null || text(data.organization, 200)) &&
      typeof data.active === "boolean" &&
      (!data.password ||
        (typeof data.password === "string" &&
          new TextEncoder().encode(data.password).length <= 72))
    );
  return true;
}
const ORGS = ["aSSIST", "CLIPS", "LGE", "LAB4DX"];
const text = (v, max, required = false) =>
  v == null
    ? !required
    : typeof v === "string" && v.length <= max && (!required || !!v.trim());
export function validSignup(d) {
  return (
    !!d &&
    typeof d === "object" &&
    !Array.isArray(d) &&
    typeof d.email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email) &&
    d.email.length <= 320 &&
    text(d.name, 80, true) &&
    ORGS.includes(d.organization) &&
    typeof d.password === "string" &&
    d.password.length >= 10 &&
    new TextEncoder().encode(d.password).length <= 72 &&
    Object.keys(d).every((k) =>
      ["email", "name", "organization", "password"].includes(k),
    )
  );
}
// 기관 계정 API: 조회(GET)와 신청·처리(POST)를 나눠 검사한다.
export function validOrg(action, d, mutation) {
  if (!d || typeof d !== "object" || Array.isArray(d)) return false;
  if (!mutation)
    return (
      ["instructors", "requests", "signups", "counts"].includes(action) &&
      Object.entries(d).every(([k, v]) => k === "q" && text(v, 100))
    );
  if (action === "submit")
    return (
      text(d.note, 2000, true) &&
      ((d.kind === "remove" && isUuid(d.instructor_id)) ||
        (d.kind === "register" &&
          text(d.name, 100, true) &&
          text(d.phone, 50) &&
          text(d.email, 254) &&
          (d.organization == null || ORGS.includes(d.organization))))
    );
  if (["decide", "decide_signup"].includes(action))
    return (
      isUuid(d.id) &&
      ["approve", "reject"].includes(d.decision) &&
      (action !== "decide_signup" || ((d.organization == null || ORGS.includes(d.organization)) && (d.confirm_privileged == null || typeof d.confirm_privileged === "boolean"))) &&
      text(d.note, 2000, d.decision === "reject")
    );
  return false;
}
