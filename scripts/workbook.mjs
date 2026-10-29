import ExcelJS from "exceljs";
import { stat } from "node:fs/promises";
import { nameKey, organization } from "./backup.mjs";
export function cellValue(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value && typeof value === "object") {
    if ("formula" in value || "sharedFormula" in value)
      return cellValue(value.result ?? null);
    if ("richText" in value) return value.richText.map((x) => x.text).join("");
    if ("text" in value) return value.text;
    throw new Error("지원하지 않는 엑셀 셀 형식");
  }
  return value ?? null;
}
export function sheetRows(book, name, required) {
  const sheet = book.getWorksheet(name);
  if (!sheet) throw new Error("필수 시트 누락");
  const header = Array.from({ length: sheet.columnCount }, (_, i) =>
    String(cellValue(sheet.getRow(1).getCell(i + 1).value) ?? "").trim(),
  );
  if (required.some((k) => !header.includes(k)))
    throw new Error("필수 엑셀 열 누락");
  const rows = [];
  sheet.eachRow((row, index) => {
    if (index > 1 && cellValue(row.getCell(1).value) != null)
      rows.push(
        Object.fromEntries(
          header.map((k, i) => [k, cellValue(row.getCell(i + 1).value)]),
        ),
      );
  });
  return rows;
}
export const canonicalOrg = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (nameKey(raw) === "LG사내강사") return "LGE";
  const normalized = organization(raw);
  return normalized.organization ?? raw;
};
export function workbookData(book) {
  const rawSlots = sheetRows(book, "통합시간표", [
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
  const rawPeople = sheetRows(book, "강사목록", [
    "강사ID",
    "강사명",
    "기관",
    "연락처",
    "이메일",
  ]);
  const rawModules = sheetRows(book, "교과목_모듈", [
    "트랙코드",
    "교과목",
    "모듈명",
    "1일 시수",
  ]);
  if (!rawSlots.length || !rawPeople.length)
    throw new Error("비어 있는 최신 데이터");
  const classes = new Map(),
    seen = new Set();
  const slots = rawSlots.map((r) => {
    const code = String(r["반"]).trim(),
      region = String(r["지역"]).trim(),
      track = String(r["트랙코드"]).trim(),
      cohort = Number(String(r["기수"]).split("-")[0]);
    if (
      cohort !== 2 ||
      !["대전", "대구", "부산"].includes(region) ||
      !["AX", "DM", "SF"].includes(track)
    )
      throw new Error("지원하지 않는 반 매핑");
    const identity = JSON.stringify([region, cohort, track]);
    if (classes.has(code) && classes.get(code).identity !== identity)
      throw new Error("서로 다른 반이 같은 코드를 사용합니다.");
    classes.set(code, {
      code,
      region,
      track,
      cohort,
      cohort_label: String(r["기수"]),
      identity,
    });
    const day = String(r["날짜"]);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      Number.isNaN(Date.parse(day + "T00:00:00Z")) ||
      new Date(day + "T00:00:00Z").toISOString().slice(0, 10) !== day
    )
      throw new Error("잘못된 날짜");
    const key = code + ":" + day;
    if (seen.has(key)) throw new Error("엑셀 안에 같은 반·날짜가 중복됩니다.");
    seen.add(key);
    const kinds = {
      교육: "수업",
      공휴일: "휴일",
      휴강: "휴일",
      수료식: "공통",
    };
    const kind = kinds[r["구분"]];
    if (!kind) throw new Error("지원하지 않는 수업 구분");
    const hours = Number(r["시수"] ?? 0);
    if (!Number.isFinite(hours) || hours < 0 || hours > 24)
      throw new Error("잘못된 시수");
    return {
      source_id: String(r["ID"]),
      code,
      day,
      kind,
      subject: r["교과목"] ? String(r["교과목"]).trim() : null,
      module: r["모듈명"] ? String(r["모듈명"]).trim() : null,
      hours,
      instructor_name: String(r["강사명"] ?? "").trim(),
      organization: canonicalOrg(r["기관"]),
      place: String(r["장소"] ?? ""),
      note: String(r["비고"] ?? ""),
      review_reason: r["검토필요"] ? String(r["검토필요"]) : null,
    };
  });
  const ids = new Set(),
    peopleKeys = new Set();
  const instructors = rawPeople.map((r) => {
    const id = String(r["강사ID"]),
      name = String(r["강사명"] ?? "").trim(),
      org = canonicalOrg(r["기관"]);
    if (!name || ids.has(id) || peopleKeys.has(nameKey(name) + ":" + org))
      throw new Error("강사 식별자 또는 이름·기관 중복");
    ids.add(id);
    peopleKeys.add(nameKey(name) + ":" + org);
    return {
      source_id: id,
      name,
      organization: org,
      phone: String(r["연락처"] ?? "").trim() || null,
      email: String(r["이메일"] ?? "").trim() || null,
      memo: r["비고(입력용)"] ? String(r["비고(입력용)"]) : null,
    };
  });
  const modules = rawModules.map((r) => ({
    track: String(r["트랙코드"]),
    subject: String(r["교과목"]).trim(),
    name: String(r["모듈명"]).trim(),
    hours: Number(r["1일 시수"]),
  }));
  if (
    modules.some(
      (m) =>
        !m.subject ||
        !m.name ||
        !Number.isFinite(m.hours) ||
        m.hours < 0 ||
        m.hours > 24,
    )
  )
    throw new Error("잘못된 모듈 정보");
  const dates = slots.map((s) => s.day).sort();
  return {
    classes: [...classes.values()],
    slots,
    instructors,
    modules,
    from: dates[0],
    to: dates.at(-1),
  };
}
export async function readWorkbook(file) {
  if ((await stat(file)).size > 16 * 1024 * 1024)
    throw new Error("엑셀 크기는 16MB 이하여야 합니다.");
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(file);
  return workbookData(book);
}
export function matchPerson(person, existing) {
  const matches = existing.filter(
    (i) => nameKey(i.name) === nameKey(person.name),
  );
  const same = matches.filter((i) => i.organization === person.organization);
  if (same.length === 1) return same[0];
  if (matches.length === 1) return matches[0];
  if (same.length > 1) {
    const signature = (i) =>
      JSON.stringify([
        (i.phone ?? "").replace(/\D/g, ""),
        (i.email ?? "").trim().toLowerCase(),
      ]);
    const sample = same[0];
    const usable =
      /\d{8,}/.test((sample.phone ?? "").replace(/\D/g, "")) ||
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(sample.email ?? "");
    if (usable && new Set(same.map(signature)).size === 1) {
      const sorted = [...same].sort((a, b) => a.id.localeCompare(b.id));
      return { ...sorted[0], duplicate_ids: sorted.map((i) => i.id) };
    }
  }
  if (matches.length)
    throw new Error("강사 연결이 모호합니다. 이름과 기관을 확인하세요.");
  return null;
}
