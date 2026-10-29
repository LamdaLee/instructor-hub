import type { Row } from "./client";
import { regionRank } from "./regions";

/** 기수는 카드에 남기고, 같은 지역·트랙의 날짜 칸을 공유한다. */
export function scheduleGroups(rows: Row[]) {
  const groups = new Map<string, { key: string; region: string; track: string; rows: Row[] }>();
  for (const row of rows) {
    const key = JSON.stringify([row.region, row.track]);
    if (!groups.has(key)) groups.set(key, { key, region: row.region, track: row.track, rows: [] });
    groups.get(key)!.rows.push(row);
  }
  return [...groups.values()].sort((a, b) => regionRank(a.region) - regionRank(b.region) || String(a.track).localeCompare(String(b.track), "ko"));
}
