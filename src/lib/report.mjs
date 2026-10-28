// 수업일수: 지역/과목 집계는 반·날짜, 강사 집계는 강사·날짜를 중복 제거한다.
export function matrix(rows, axis, organizations) {
  const map = new Map();
  for (const row of rows) {
    if (row.kind !== "수업") continue;
    const key = row[axis] || "미지정",
      org = row.organization || "기관 없음";
    if (!map.has(key)) map.set(key, new Map());
    const group = map.get(key);
    if (!group.has(org)) group.set(org, new Set());
    group.get(org).add(`${row.class_id}:${row.day}`);
  }
  return [...map]
    .sort(([a], [b]) => a.localeCompare(b, "ko"))
    .map(([name, values]) =>
      Object.fromEntries([
        ["name", name],
        ...organizations.map((org) => [org, values.get(org)?.size ?? 0]),
      ]),
    );
}
export function instructorDays(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (row.kind !== "수업" || !(row.instructor_id || row.instructor_name))
      continue;
    const key =
      row.instructor_id || `${row.organization}:${row.instructor_name}`;
    if (!groups.has(key))
      groups.set(key, {
        name: row.linked_name || row.instructor_name,
        organization: row.organization ?? "기관 없음",
        days: new Set(),
      });
    groups.get(key).days.add(row.day);
  }
  return [...groups.values()]
    .map((r) => ({
      name: r.name,
      organization: r.organization,
      total: r.days.size,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "ko"));
}
export function weeklyCounts(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (row.kind !== "수업" || !(row.instructor_id || row.instructor_name))
      continue;
    const org = row.organization ?? "기관 없음";
    if (!groups.has(org)) groups.set(org, new Set());
    groups
      .get(org)
      .add(
        row.instructor_id ||
          row.instructor_name.normalize("NFC").replace(/\s/g, ""),
      );
  }
  return [...groups].map(([name, people]) => ({ name, total: people.size }));
}
