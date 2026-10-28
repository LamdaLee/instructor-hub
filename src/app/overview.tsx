"use client";
import { useState } from "react";
import { DataTable, slotColumns } from "./components";
import { type Row, today } from "@/lib/client";
import { matrix, instructorDays, weeklyCounts } from "@/lib/report.mjs";
export function Dashboard({ data }: { data: Row }) {
  const rows: Row[] = data.rows ?? [],
    current = today();
  const count = weeklyCounts(rows);
  return (
    <>
      <h1>운영 대시보드</h1>
      <p>오늘 {current} · 이번 주 수업과 앞으로 2주간의 미배정을 확인합니다.</p>
      <div className="stats">
        <div>
          <strong>{rows.filter((r) => r.day === current).length}건</strong>오늘
          시간표
        </div>
        <div>
          <strong>{rows.length}건</strong>이번 주 시간표
        </div>
        <div>
          <strong>{data.unassigned?.length ?? 0}건</strong>2주 내 강사 미배정
        </div>
        <div>
          <strong>{data.review ?? 0}건</strong>확인 필요
        </div>
      </div>
      <h2>오늘 수업</h2>
      <DataTable
        rows={rows.filter((r) => r.day === current)}
        columns={slotColumns}
      />
      <h2>기관별 이번 주 투입 강사</h2>
      <DataTable
        rows={count}
        columns={[
          ["name", "기관"],
          ["total", "강사 수"],
        ]}
      />
      <h2>이번 주 수업</h2>
      <DataTable rows={rows} columns={slotColumns} />
      <h2>다가오는 2주 강사 미배정</h2>
      <DataTable rows={data.unassigned ?? []} columns={slotColumns} />
    </>
  );
}
export function Reports({
  data,
  options,
  filter,
  update,
}: {
  data: Row;
  options: Row;
  filter: Record<string, string>;
  update: (d: Record<string, string>) => void;
}) {
  const [contacts, setContacts] = useState(false);
  const rows: Row[] = data.rows ?? [];
  const orgs = [...options.organizations, "기관 없음"];
  const columns: [string, string][] = [
    ["name", "구분"],
    ...orgs.map((o: string): [string, string] => [o, o]),
  ];
  return (
    <>
      <div className="title-row">
        <h1>수업 집계</h1>
        <div className="inline">
          <label className="inline">
            <input
              type="checkbox"
              checked={contacts}
              onChange={(e) => setContacts(e.target.checked)}
            />
            CSV에 연락처 포함
          </label>
          <a
            className="button"
            href={
              "/api/export?" +
              new URLSearchParams({ ...filter, contacts: String(contacts) })
            }
          >
            시간표 CSV 다운로드
          </a>
        </div>
      </div>
      <section className="toolbar">
        <label>
          시작일
          <input
            type="date"
            value={filter.from ?? ""}
            onChange={(e) => update({ from: e.target.value })}
          />
        </label>
        <label>
          종료일
          <input
            type="date"
            value={filter.to ?? ""}
            onChange={(e) => update({ to: e.target.value })}
          />
        </label>
      </section>
      <p>
        지역·과목 집계는 반별 수업 날짜 수이며, 강사별 집계는 중복을 제외한 수업
        날짜 수입니다. 공통·휴일·없음 구분은 집계에서 제외합니다.
      </p>
      <h2>지역 × 기관</h2>
      <DataTable rows={matrix(rows, "region", orgs)} columns={columns} />
      <h2>과목 × 기관</h2>
      <DataTable rows={matrix(rows, "subject", orgs)} columns={columns} />
      <h2>강사별 수업일수</h2>
      <DataTable
        rows={instructorDays(rows)}
        columns={[
          ["name", "강사"],
          ["organization", "기관"],
          ["total", "수업일수"],
        ]}
      />
    </>
  );
}
