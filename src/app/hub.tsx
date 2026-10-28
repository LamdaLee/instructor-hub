"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api, post, today, monday, moveDay, classLabel, type Row } from "@/lib/client";
import {
  DataTable,
  slotColumns,
  SlotEditor,
  InstructorEditor,
  PasteEditor,
} from "./components";
import { Dashboard, Reports } from "./overview";
import Admin from "./admin";
export default function Hub({
  operator,
}: {
  operator: { name: string; role: string };
}) {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.toString();
  const view = params.get("view") ?? "dashboard";
  const [options, setOptions] = useState<Row>();
  const [data, setData] = useState<Row>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<{ kind: string; row?: Row }>();
  const [compare, setCompare] = useState(false);
  const baseFilter = Object.fromEntries(
    ["region", "cohort", "track", "organization"].map((k) => [
      k,
      params.get(k) ?? "",
    ]),
  );
  const week = params.get("from") ?? monday(today());
  const update = (change: Record<string, string>) => {
    const p = new URLSearchParams(query);
    for (const [k, v] of Object.entries(change)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    router.replace("/?" + p);
  };
  const refresh = () => setRevision((r) => r + 1);
  useEffect(() => {
    let active = true;
    api("options")
      .then((d) => {
        if (active) setOptions(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const filter = { ...baseFilter };
    let target = view;
    if (view === "slots") {
      filter.from = week;
      filter.to = moveDay(week, 6);
      filter.class_id = params.get("class_id") ?? "";
    }
    if (view === "instructors") {
      filter.q = params.get("q") ?? "";
      filter.subject = params.get("subject") ?? "";
      filter.archived = params.get("archived") ?? "";
    }
    if (view === "instructor") {
      filter.id = params.get("id") ?? "";
    }
    if (view === "dashboard") {
      filter.from = monday(today());
      filter.to = moveDay(monday(today()), 6);
    }
    if (view === "reports") {
      filter.from = params.get("from") ?? "";
      filter.to = params.get("to") ?? "";
    }
    if (view === "admin") {
      setData({});
      setLoading(false);
      return () => {
        active = false;
      };
    }
    if (
      !["slots", "instructors", "instructor", "dashboard", "reports"].includes(
        view,
      )
    )
      target = "slots";
    api(target, filter)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setData(undefined);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query, revision]); // URL 필터가 조회와 공유의 기준이다.
  const nav = (v: string) =>
    "/?" + new URLSearchParams({ ...baseFilter, view: v });
  const rows: Row[] = data?.rows ?? [];
  const classNames = new Map(rows.map(r => [r.class_id, r.class_name]));
  const instructorColumns: [string, string, ((r: Row) => React.ReactNode)?][] =
    [
      [
        "name",
        "이름",
        (r) => (
          <a href={"/?view=instructor&id=" + r.id}>
            {r.name}
            {r.archived_at ? " (보관)" : ""}
          </a>
        ),
      ],
      ["organization", "기관"],
      [
        "subjects",
        "담당 과목",
        (r) => [...new Set([...r.subjects, ...r.taught_subjects])].join(", "),
      ],
      ["regions", "지역"],
      ["classes", "반"],
      ["total_days", "수업일수"],
      ["last_day", "최근 수업"],
      ["next_day", "다음 수업"],
    ];
  const group = params.get("group") ?? "";
  const groups: Record<string, Row[]> = {};
  if (view === "instructors" && group)
    for (const r of rows) {
      const keys =
        group === "organization"
          ? [r.organization ?? "기관 없음"]
          : [...new Set([...r.subjects, ...r.taught_subjects])];
      for (const key of keys.length ? keys : ["과목 없음"])
        (groups[String(key)] ??= []).push(r);
    }
  return (
    <>
      <header>
        <div>
          <a className="brand" href="/">
            강사 허브
          </a>
          <small>내부 운영진</small>
        </div>
        <div className="inline">
          <span>{operator.name}</span>
          <button
            className="secondary"
            onClick={async () => {
              try {
                await post("logout", {});
                location.assign("/login");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            로그아웃
          </button>
        </div>
      </header>
      <nav aria-label="주 메뉴">
        {[
          ["dashboard", "대시보드"],
          ["slots", "시간표"],
          ["instructors", "강사"],
          ["reports", "집계"],
          ...(operator.role === "admin" ? [["admin", "관리"]] : []),
        ].map(([v, label]) => (
          <a key={v} className={view === v ? "active" : ""} href={nav(v)}>
            {label}
          </a>
        ))}
      </nav>
      <main>
        <section className="filters" aria-label="공통 필터">
          {options && (
            <>
              {[
                ["region", "지역", options.regions],
                [
                  "cohort",
                  "기수",
                  [
                    ...new Set(
                      options.classes.map((c: Row) => String(c.cohort)),
                    ),
                  ].sort(),
                ],
                [
                  "track",
                  "트랙",
                  [...new Set(options.classes.map((c: Row) => c.track))].sort(),
                ],
                ["organization", "기관", options.organizations],
              ].map(([key, label, values]) => (
                <label key={String(key)}>
                  {String(label)}
                  <select
                    value={params.get(String(key)) ?? ""}
                    onChange={(e) => update({ [String(key)]: e.target.value })}
                  >
                    <option value="">전체</option>
                    {(values as string[]).map((v) => (
                      <option key={v} value={v}>
                        {v}
                        {key === "cohort" ? "기" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </>
          )}
        </section>
        {error && (
          <p role="alert" className="error">
            {error}{" "}
            <button className="secondary" onClick={refresh}>
              다시 시도
            </button>
          </p>
        )}
        {loading && <p role="status">불러오는 중…</p>}
        {view === "dashboard" && data && <Dashboard data={data} />}
        {view === "reports" && options && (
          <Reports
            data={data ?? { rows: [] }}
            options={options}
            filter={{
              ...baseFilter,
              from: params.get("from") ?? "",
              to: params.get("to") ?? "",
            }}
            update={update}
          />
        )}
        {view === "admin" &&
          options &&
          (operator.role === "admin" ? (
            <Admin options={options} onDone={refresh} revision={revision} />
          ) : (
            <p role="alert" className="error">
              관리자만 접근할 수 있습니다.
            </p>
          ))}
        {view === "slots" && options && (
          <>
            <div className="title-row">
              <div>
                <h1>주간 시간표</h1>
                <p>
                  {week} — {moveDay(week, 6)}
                </p>
              </div>
              <div className="inline">
                <button onClick={() => setEditor({ kind: "slot" })}>
                  시간표 추가
                </button>
                <button
                  className="secondary"
                  onClick={() => setEditor({ kind: "paste" })}
                >
                  엑셀 붙여 넣기
                </button>
              </div>
            </div>
            <section className="toolbar">
              <button
                className="secondary"
                onClick={() => update({ from: moveDay(week, -7) })}
              >
                ← 이전 주
              </button>
              <button
                className="secondary"
                onClick={() => update({ from: monday(today()) })}
              >
                오늘
              </button>
              <button
                className="secondary"
                onClick={() => update({ from: moveDay(week, 7) })}
              >
                다음 주 →
              </button>
              <label>
                주간 날짜
                <input
                  type="date"
                  value={week}
                  onChange={(e) => {
                    if (e.target.value)
                      update({ from: monday(e.target.value) });
                  }}
                />
              </label>
              <label>
                반
                <select
                  value={params.get("class_id") ?? ""}
                  onChange={(e) => update({ class_id: e.target.value })}
                >
                  <option value="">모든 반</option>
                  {options.classes
                    .filter(
                      (c: Row) =>
                        (!baseFilter.region ||
                          c.region === baseFilter.region) &&
                        (!baseFilter.cohort ||
                          String(c.cohort) === baseFilter.cohort) &&
                        (!baseFilter.track || c.track === baseFilter.track),
                    )
                    .map((c: Row) => (
                      <option key={c.id} value={c.id}>
                        {classLabel(c)}
                      </option>
                    ))}
                </select>
              </label>
              <label className="inline">
                <input
                  type="checkbox"
                  checked={compare}
                  onChange={(e) => setCompare(e.target.checked)}
                />
                여러 반 비교
              </label>
            </section>
            {!compare ? (
              <DataTable
                rows={rows}
                columns={[
                  ...slotColumns,
                  [
                    "edit",
                    "편집",
                    (r) => (
                      <button
                        className="secondary"
                        onClick={() => setEditor({ kind: "slot", row: r })}
                      >
                        수정
                      </button>
                    ),
                  ],
                ]}
              />
            ) : (
              <div className="comparison">
                <table>
                  <caption>지역·반별 같은 날짜 비교</caption>
                  <thead>
                    <tr>
                      <th>날짜</th>
                      {[...classNames.keys()].map((c) => (
                        <th key={c}>{classNames.get(c)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 7 }, (_, n) => moveDay(week, n)).map(
                      (day) => (
                        <tr key={day}>
                          <th>{day}</th>
                          {[...classNames.keys()].map(
                            (c) => (
                              <td key={c} data-label={classNames.get(c)}>
                                {rows
                                  .filter(
                                    (r) => r.day === day && r.class_id === c,
                                  )
                                  .map((r) => (
                                    <div key={r.id}>
                                      <b>{r.subject || r.kind}</b>
                                      <p>
                                        {r.instructor_id ? (
                                          <a
                                            href={
                                              "/?view=instructor&id=" +
                                              r.instructor_id
                                            }
                                          >
                                            {r.linked_name || r.instructor_name}
                                          </a>
                                        ) : (
                                          r.instructor_name || "미배정"
                                        )}{" "}
                                        · {r.organization ?? r.kind}
                                      </p>
                                      <button
                                        className="secondary"
                                        onClick={() =>
                                          setEditor({ kind: "slot", row: r })
                                        }
                                      >
                                        수정
                                      </button>
                                    </div>
                                  ))}
                              </td>
                            ),
                          )}
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
                {!rows.length && <p>조건에 맞는 데이터가 없습니다.</p>}
              </div>
            )}
          </>
        )}
        {view === "instructors" && options && (
          <>
            <div className="title-row">
              <h1>
                강사 <small>{rows.length}명</small>
              </h1>
              <button onClick={() => setEditor({ kind: "instructor" })}>
                강사 추가
              </button>
            </div>
            <form
              className="toolbar"
              onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                update({ q: String(d.get("q")) });
              }}
            >
              <label>
                이름 검색
                <input name="q" defaultValue={params.get("q") ?? ""} />
              </label>
              <button className="secondary">검색</button>
              <label>
                과목
                <select
                  value={params.get("subject") ?? ""}
                  onChange={(e) => update({ subject: e.target.value })}
                >
                  <option value="">전체</option>
                  {options.subjects.map((s: Row) => (
                    <option key={s.name}>{s.name}</option>
                  ))}
                </select>
              </label>
              <label>
                묶어 보기
                <select
                  value={group}
                  onChange={(e) => update({ group: e.target.value })}
                >
                  <option value="">전체 목록</option>
                  <option value="organization">기관별</option>
                  <option value="subject">과목별</option>
                </select>
              </label>
              <label className="inline">
                <input
                  type="checkbox"
                  checked={params.get("archived") === "true"}
                  onChange={(e) =>
                    update({ archived: e.target.checked ? "true" : "" })
                  }
                />
                보관 포함
              </label>
            </form>
            {group ? (
              Object.entries(groups)
                .sort(([a], [b]) => a.localeCompare(b, "ko"))
                .map(([key, list]) => (
                  <section key={key}>
                    <h2>
                      {key} <small>{list.length}명</small>
                    </h2>
                    <DataTable rows={list} columns={instructorColumns} />
                  </section>
                ))
            ) : (
              <DataTable rows={rows} columns={instructorColumns} />
            )}
          </>
        )}
        {view === "instructor" && data?.instructor && (
          <>
            <div className="title-row">
              <div>
                <a href={nav("instructors")}>← 강사 목록</a>
                <h1>
                  {data.instructor.name}{" "}
                  <small>
                    {data.instructor.organization}
                    {data.instructor.archived_at ? " · 보관됨" : ""}
                  </small>
                </h1>
              </div>
              <button
                onClick={() =>
                  setEditor({ kind: "instructor", row: data.instructor })
                }
              >
                강사 수정
              </button>
            </div>
            <section className="detail">
              <dl>
                <dt>연락처</dt>
                <dd>{data.instructor.phone || "미등록"}</dd>
                <dt>이메일</dt>
                <dd>{data.instructor.email || "미등록"}</dd>
                <dt>담당 과목</dt>
                <dd>
                  {[
                    ...new Set([
                      ...data.instructor.subjects,
                      ...rows.map((r) => r.subject).filter(Boolean),
                    ]),
                  ].join(", ") || "미등록"}
                </dd>
                <dt>메모</dt>
                <dd>{data.instructor.memo || "없음"}</dd>
              </dl>
            </section>
            <h2>반별 수업일수</h2>
            <div className="stats">
              {[...classNames.keys()].map((c) => (
                <div key={c}>
                  <strong>
                    {
                      new Set(
                        rows
                          .filter((r) => r.class_id === c)
                          .map((r) => r.day),
                      ).size
                    }
                    일
                  </strong>
                  {classNames.get(c)}
                </div>
              ))}
            </div>
            <h2>수업 달력</h2>
            <InstructorCalendar rows={rows} />
            <h2>전체 수업 일정</h2>
            <DataTable rows={rows} columns={slotColumns} />
          </>
        )}
        <datalist id="subject-options">
          {options?.subjects.map((s: Row) => (
            <option key={s.name} value={s.name} />
          ))}
        </datalist>
        {editor?.kind === "slot" && options && (
          <SlotEditor
            slot={editor.row}
            options={options}
            onDone={refresh}
            close={() => setEditor(undefined)}
          />
        )}
        {editor?.kind === "paste" && options && (
          <PasteEditor
            options={options}
            classId={params.get("class_id") ?? ""}
            onDone={refresh}
            close={() => setEditor(undefined)}
          />
        )}
        {editor?.kind === "instructor" && options && (
          <InstructorEditor
            instructor={editor.row}
            options={options}
            onDone={refresh}
            close={() => setEditor(undefined)}
          />
        )}
      </main>
      <footer>강사 허브 · 운영진 전용</footer>
    </>
  );
}
function InstructorCalendar({ rows }: { rows: Row[] }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const start = month + "-01";
  const next = new Date(start + "T00:00:00Z");
  next.setUTCMonth(next.getUTCMonth() + 1);
  const days = Number(moveDay(next.toISOString().slice(0, 10), -1).slice(-2));
  const offset = (new Date(start + "T00:00:00Z").getUTCDay() + 6) % 7;
  return (
    <>
      <label>
        조회 월
        <input
          type="month"
          value={month}
          onChange={(e) => {
            if (e.target.value) setMonth(e.target.value);
          }}
        />
      </label>
      <div className="calendar">
        {["월", "화", "수", "목", "금", "토", "일"].map((d) => (
          <b key={d}>{d}</b>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <div key={"empty" + i} />
        ))}
        {Array.from({ length: days }, (_, n) => {
          const day = month + "-" + String(n + 1).padStart(2, "0");
          return (
            <div key={day} className={day === today() ? "today" : ""}>
              <b>{n + 1}</b>
              {rows
                .filter((r) => r.day === day)
                .map((r) => (
                  <p key={r.id}>
                    {r.class_name}
                    <br />
                    {r.subject}
                  </p>
                ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
