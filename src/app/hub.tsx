"use client";
import { REGIONS, regionRank } from "@/lib/regions";
import { usePendingCounts } from "./pending-counts";
import { Dashboard } from "./overview";
import AccountMenu from "./account-menu";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, post, today, monday, moveDay, type Row } from "@/lib/client";
import { isDate } from "@/lib/input.mjs";
import { DataTable, Modal, SlotEditor, InstructorEditor, PasteEditor } from "./components";
import Admin from "./admin";
import ClassSettings from "./class-settings";
import {
  Materials,
  AnnouncementEditor,
  TeacherModal,
  InstructorPaste,
} from "./portal-editors";
const trackName = (t: string) =>
  t.startsWith("AX")
    ? "AX Workflow"
    : t === "SF"
      ? "Smart Factory"
      : t === "DM"
        ? "Digital Marketing"
        : t;
export function Org({ name }: { name?: string }) {
  return (
    <span
      className={
        "org-badge org-" +
        (name === "LGE"
          ? "lge"
          : name === "LAB4DX"
            ? "lab"
            : name === "CLIPS"
              ? "clips"
              : name === "aSSIST"
                ? "assist"
                : "other")
      }
    >
      {name === "LGE" ? "LG전자" : name || "소속 미등록"}
    </span>
  );
}
const days = (from: string, to: string) => {
  const list = [];
  for (let d = from; d <= to && list.length < 366; d = moveDay(d, 1))
    list.push(d);
  return list;
};
const weekday = (d: string) =>
  ["일", "월", "화", "수", "목", "금", "토"][
    new Date(d + "T12:00:00Z").getUTCDay()
  ];
export default function Hub({
  operator,
  adminMode = false,
}: {
  operator: { name: string; role: string; review_requests?: boolean; review_signups?: boolean; organization?: string | null } | null;
  adminMode?: boolean;
}) {
  const params = useSearchParams(),
    router = useRouter(),
    query = params.toString();
  const requestedView = params.get("view");
  const view =
    requestedView === "instructor"
      ? "instructors"
      : requestedView || (adminMode ? "manage" : "dashboard");
  const [options, setOptions] = useState<Row>(),
    [rows, setRows] = useState<Row[]>([]),
    [notices, setNotices] = useState<Row[]>([]),
    [operationData, setOperationData] = useState<Row>({}),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [editor, setEditor] = useState<{ kind: string; row?: Row }>(),
    [teacher, setTeacher] = useState<string | undefined>(
      params.get("view") === "instructor"
        ? params.get("id") || undefined
        : undefined,
    ),
    [mobile, setMobile] = useState("track");
  const [date, setDate] = useState(today());
  const [from, setFrom] = useState(
      isDate(params.get("from")) ? params.get("from")! : monday(today()),
    ),
    [to, setTo] = useState(
      isDate(params.get("to"))
        ? params.get("to")!
        : moveDay(monday(today()), 4),
    );
  const isAdmin = adminMode && operator?.role === "admin";
  const pending = usePendingCounts(!!(operator?.role === "admin" || operator?.review_requests || operator?.review_signups), revision);
  const filter = Object.fromEntries(
    ["region", "cohort", "track", "organization", "class_id", "q"].map((k) => [
      k,
      params.get(k) || "",
    ]),
  );
  if (filter.cohort === "all") filter.cohort = "";
  if (
    !params.has("cohort") &&
    ["slots", "region"].includes(view) &&
    options
  ) {
    const activeClasses = (options.classes as Row[]).filter((c) => c.active);
    const selected = activeClasses.find((c) => c.id === filter.class_id);
    const latest = Math.max(0, ...activeClasses.map((c) => Number(c.cohort)));
    filter.cohort = selected
      ? String(selected.cohort)
      : latest
        ? String(latest)
        : "";
  }
  const update = (changes: Record<string, string>) => {
    const p = new URLSearchParams(query);
    for (const [k, v] of Object.entries(changes)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    router.replace((adminMode ? "/admin" : "/") + "?" + p);
  };
  const refresh = () => setRevision((n) => n + 1);
  useEffect(() => {
    setFrom(isDate(params.get("from")) ? params.get("from")! : monday(today()));
    setTo(
      isDate(params.get("to"))
        ? params.get("to")!
        : moveDay(monday(today()), 4),
    );
  }, [query]);
  useEffect(() => {
    let active = true;
    api("options")
      .then((d) => {
        if (active) setOptions({ ...d,
          regions: [...d.regions].sort((a: string, b: string) => regionRank(a) - regionRank(b)),
          classes: [...d.classes].sort((a: Row, b: Row) => regionRank(a.region) - regionRank(b.region) || a.region.localeCompare(b.region, "ko") || a.name.localeCompare(b.name, "ko")),
        });
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
    setError("");
    setLoading(true);
    setRows([]);
    const request =
      view === "instructors"
        ? api("instructors", filter)
        : ["dashboard", "slots", "region", "operations"].includes(view)
          ? api(view === "operations" ? "dashboard" : "slots", {
              ...filter,
              from:
                view === "dashboard"
                  ? date
                  : isDate(params.get("from"))
                    ? params.get("from")!
                    : monday(today()),
              to:
                view === "dashboard"
                  ? date
                  : isDate(params.get("to"))
                    ? params.get("to")!
                    : moveDay(monday(today()), 4),
            })
          : Promise.resolve({ rows: [] });
    request.then((d) => {
        if (active) { setRows(d.rows || []); if (view === "operations") setOperationData(d); }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query, revision, date, filter.cohort]);
  useEffect(() => {
    let active = true;
    api("announcements", { region: filter.region }).then(d => { if (active) setNotices(d.rows || []); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [filter.region, revision]);
  const classes: Row[] = (options?.classes || []).filter(
    (c: Row) =>
      c.active &&
      (!filter.region || c.region === filter.region) &&
      (!filter.cohort || String(c.cohort) === filter.cohort) &&
      (!filter.track || c.track === filter.track) &&
      (!filter.class_id || c.id === filter.class_id) &&
      (view !== "dashboard" || rows.some(r => r.class_id === c.id && r.day === date && r.kind === "수업")),
  ).sort((a: Row, b: Row) => regionRank(a.region) - regionRank(b.region) || a.track.localeCompare(b.track, "ko") || a.name.localeCompare(b.name, "ko"));
  const regionOrder = REGIONS;
  const boardRegions = filter.region
    ? [filter.region]
    : [
        ...regionOrder,
        ...[...new Set(classes.map((c) => String(c.region)))]
          .filter((r) => !regionOrder.includes(r))
          .sort(),
      ];
  const navigate = (v: string) => update({ view: v, class_id: "", q: "" });
  const teacherButton = (r: Row) => (
    <button
      className="teacher-link"
      onClick={() => {
        if (r.instructor_id || (r.id && view === "instructors"))
          setTeacher(r.instructor_id || r.id);
      }}
      disabled={!r.instructor_id && view !== "instructors"}
    >
      {r.linked_name ||
        r.instructor_name ||
        r.name ||
        (r.instructor_hidden ? "비공개" : "미배정")}
    </button>
  );
  const noticeCard = (n: Row, i: number) => (
    <article className={"notice-card notice-" + (i % 3)} key={n.id}>
      <div className="notice-top">
        <span>{n.region || "전체"}</span>
        {n.important && <b>중요</b>}
        <small>공지사항</small>
      </div>
      <h3>{n.title}</h3>
      <p>{n.body}</p>
      <small>
        {new Date(n.updated_at).toLocaleDateString("ko-KR", {
          timeZone: "Asia/Seoul",
        })}
      </small>
      {isAdmin && (
        <div className="inline">
          <button
            className="secondary"
            onClick={() => setEditor({ kind: "announcement", row: n })}
          >
            수정
          </button>
          <button
            className="secondary"
            onClick={async () => {
              if (!confirm("이 공지를 삭제할까요?")) return;
              try {
                await post("save", {
                  kind: "announcement",
                  data: { id: n.id, delete: true },
                });
                refresh();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            삭제
          </button>
        </div>
      )}
    </article>
  );
  const lessons = (c: Row, d: string) =>
    rows.filter((r) => r.class_id === c.id && r.day === d);
  const lessonCard = (r: Row) => (
    <div className="lesson-content" key={r.id}>
      <small>
        {r.effective_start_time && r.effective_end_time ? `${r.effective_start_time.slice(0, 5)}~${r.effective_end_time.slice(0, 5)}` : "시간 확인 필요"}
      </small>
      <h3>{r.subject || r.kind}</h3>
      {r.effective_place && <p>{r.effective_place}</p>}
      <div className="lesson-person">
        {teacherButton(r)}
        <Org name={r.organization} />
        <span className="assignment">{r.assignment_status}</span>
      </div>
      {r.conflict && <p className="warning">같은 날짜에 다른 반에도 배정된 강사입니다.</p>}
      {r.note && <div className="cell-note">{r.note}</div>}
      {isAdmin && (
        <div className="session-actions">
          <button
            className="session-action"
            aria-label="수업·메모 수정"
            title="수업·메모 수정"
            onClick={() => setEditor({ kind: "slot", row: r })}
          >
            수정
          </button>
          <button
            className="session-action session-action-delete"
            aria-label="수업 삭제"
            title="수업 삭제"
            onClick={async () => {
              if (!confirm("수업을 삭제할까요? 변경 기록은 보존됩니다."))
                return;
              try {
                await post("save", { kind: "delete_slot", data: { id: r.id } });
                refresh();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            삭제
          </button>
        </div>
      )}
    </div>
  );
  const courseCard = (c: Row, i: number) => (
    <article className={"course-card tone-" + (i % 7)} key={c.id}>
      <div className="course-content">
        <button
          className="course-location"
          onClick={() =>
            update({
              view: "region",
              region: c.region,
              cohort: String(c.cohort),
              track: "",
              class_id: "",
            })
          }
        >
          {c.region} · {c.name} · {c.cohort}기
        </button>
        <h2>{trackName(c.track)}</h2>
        <div className="course-lecture">
          {lessons(c, date).length ? (
            lessons(c, date).map(lessonCard)
          ) : (
            <p>등록된 수업 없음</p>
          )}
        </div>
        <div className="course-info">
          <span>
            담당 매니저<b>{c.manager || "미등록"}</b>
          </span>
          <span>
            강의장
            <b>
              {lessons(c, date).find((r) => r.effective_place)?.effective_place ||
                c.room ||
                "미등록"}
            </b>
          </span>
        </div>
        <div className="course-actions">
          <button
            onClick={() =>
              update({
                view: "materials",
                q: lessons(c, date)[0]?.subject || "",
              })
            }
          >
            교재 확인 →
          </button>
          <button
            onClick={() =>
              update({
                view: "region",
                region: c.region,
                track: c.track,
                cohort: String(c.cohort),
                class_id: c.id,
              })
            }
          >
            반 시간표 →
          </button>
        </div>
      </div>
    </article>
  );
  const displayDates = days(
    isDate(params.get("from")) ? params.get("from")! : monday(today()),
    isDate(params.get("to")) ? params.get("to")! : moveDay(monday(today()), 4),
  );
  const portalNav = [
    ["dashboard", "수업 현황"],
    ["slots", "전체 시간표"],
    ["region", "지역별 시간표"],
    ["instructors", "강사 정보"],
    ["materials", "교재 자료실"],
  ];
  const adminNav = isAdmin ? [
    ["operations", "운영 점검"],
    ["announcements", "공지 관리"],
    ["facilities", "강의장·매니저"],
    ["manage", "과정·변경 기록"],
  ] : [];
  const nav = [...portalNav, ...adminNav];
  return (
    <>
      <header className="portal-header">
        <a className="portal-brand" href="/">
          <b>LG</b>
          <span>
            <strong>LG전자 K-뉴딜 아카데미</strong>
            <small>과정 운영</small>
          </span>
        </a>
        <nav aria-label="주 메뉴">
          {portalNav.map(([v, n]) => (
            <button
              className={view === v ? "active" : ""}
              key={v}
              onClick={() => navigate(v)}
            >
              {n}
            </button>
          ))}
        </nav>
        {adminMode ? (
          <a className="admin-access" href="/">
            포털
          </a>
        ) : (
          operator?.role === "admin" && (
            <a className="admin-access" href="/admin">
              관리자 화면
            </a>
          )
        )}
        <a className="admin-access" href="/org">
          {adminMode ? "기관 승인" : "기관 업무"}{pending.requests + pending.signups > 0 && <span className="count-badge">{pending.requests + pending.signups}</span>}
        </a>
        <AccountMenu name={operator?.name || "내 계정"} />
      </header>
      {isAdmin && <nav className="admin-nav" aria-label="관리 메뉴">
        <span>관리</span>{adminNav.map(([v, n]) => <button key={v} className={view === v ? "active" : ""} onClick={() => navigate(v)}>{n}</button>)}
      </nav>}
      <main
        className={"portal-main " + (view === "dashboard" ? "portal-home" : "")}
      >
        {view === "dashboard" ? (
          <section className="portal-intro">
            <div className="inline centered">
              <label>
                <span className="sr-only">수업 조회 날짜</span>
                <input
                  type="date"
                  aria-label="수업 조회 날짜"
                  value={date}
                  onChange={(e) => {
                    if (e.target.value) setDate(e.target.value);
                  }}
                />
              </label>
              <button onClick={() => navigate("slots")}>전체 시간표 →</button>
              <button className="secondary" onClick={() => navigate("region")}>
                지역별 시간표 →
              </button>
            </div>
          </section>
        ) : (
          <div className="portal-page-title">
            <h1>
              {nav.find(([v]) => v === view)?.[1] || "아카데미 운영 관리"}
            </h1>
            {isAdmin && <small>관리자 · {operator?.name}</small>}
          </div>
        )}
        {!["materials", "announcements", "manage", "facilities"].includes(
          view,
        ) && (
          <section className="filters portal-filters" aria-label="조회 필터">
            {options &&
              [
                ["region", "지역", [...options.regions].sort((a, b) => regionRank(a) - regionRank(b))],
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
                  [...new Set(options.classes.map((c: Row) => c.track))],
                ],
                ["organization", "기관", options.organizations],
              ].map(([key, label, values]) => (
                <label key={String(key)}>
                  {String(label)}
                  <select
                    value={
                      key === "cohort" && !filter.cohort
                        ? "all"
                        : filter[String(key)]
                    }
                    onChange={(e) =>
                      update({ [String(key)]: e.target.value, class_id: "" })
                    }
                  >
                    <option value={key === "cohort" ? "all" : ""}>전체</option>
                    {(values as string[]).map((v) => (
                      <option key={v} value={v}>
                        {String(key) === "cohort" ? v + "기" : v}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            <button
              className="secondary"
              onClick={() =>
                update({
                  region: "",
                  cohort: "",
                  track: "",
                  organization: "",
                  class_id: "",
                  q: "",
                })
              }
            >
              필터 초기화
            </button>
          </section>
        )}
        {error && (
          <p className="error" role="alert">
            {error} <button onClick={refresh}>다시 시도</button>
          </p>
        )}
        {loading && <p role="status">불러오는 중…</p>}
        {isAdmin && view === "operations" && !loading && <Dashboard data={operationData} />}
        {view === "dashboard" && (
          <>
            <div className="dashboard-notices">
              <h2>공지사항</h2>
              <div className="notice-grid">
                {notices.map(noticeCard)}
                {!notices.length && <p>등록된 공지사항 없음</p>}
              </div>
            </div>
            {/* 지역별 세로 열: 대전 왼쪽, 대구 가운데, 부산 오른쪽 */}
            <div
              className="region-board"
              style={
                {
                  "--region-count": boardRegions.length,
                } as React.CSSProperties
              }
            >
              {boardRegions.map((region) => {
                const list = classes.filter((c) => c.region === region);
                return (
                  <section className="region-column" key={region}>
                    <h2 className="region-column-title">
                      {region}
                      <small>{list.length}개 반</small>
                    </h2>
                    {list.map((c) => courseCard(c, classes.indexOf(c)))}
                    {!list.length && (
                      <p className="region-empty">진행 중인 과정 없음</p>
                    )}
                  </section>
                );
              })}
            </div>
            <article className="resource-tile">
              <div>
                <small>교재 자료실</small>
                <h2>PDF · PPTX</h2>
                <p>과목별 · 강사별 자료</p>
              </div>
              <button
                className="secondary"
                onClick={() => navigate("materials")}
              >
                자료실 열기 →
              </button>
            </article>
            {!loading && !classes.length && (
              <p className="empty">조건에 맞는 과정이 없습니다.</p>
            )}
            <section className="portal-regions">
              <h2>지역별 시간표</h2>
              <div>
                {["대전", "대구", "부산"].map((r) => (
                  <button
                    className="secondary"
                    key={r}
                    onClick={() =>
                      update({
                        view: "region",
                        region: r,
                        track: "",
                        class_id: "",
                        cohort: "",
                      })
                    }
                  >
                    {r} →
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
        {["slots", "region"].includes(view) && (
          <>
            {view === "region" && (
              <div className="region-switch">
                {["대전", "대구", "부산"].map((r) => (
                  <button
                    className={filter.region === r ? "" : "secondary"}
                    key={r}
                    onClick={() =>
                      update({ region: r, class_id: "", track: "" })
                    }
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
            <form
              className="schedule-range"
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  from > to ||
                  days(from, to).length > 366 ||
                  (new Date(to).valueOf() - new Date(from).valueOf()) /
                    86400000 >
                    365
                ) {
                  setError("시작일 이후 최대 366일 범위로 설정하세요.");
                  return;
                }
                update({ from, to });
              }}
            >
              <label>
                시작일
                <input
                  type="date"
                  required
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <span>–</span>
              <label>
                종료일
                <input
                  type="date"
                  required
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
              <button>기간 적용</button>
              <button
                type="button"
                className="secondary"
                onClick={() => update({ from, to: moveDay(from, 6) })}
              >
                1주
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  const d = new Date(from + "T12:00:00Z"),
                    day = d.getUTCDate();
                  d.setUTCMonth(d.getUTCMonth() + 1, 1);
                  const last = new Date(
                    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
                  ).getUTCDate();
                  d.setUTCDate(Math.min(day, last));
                  update({
                    from,
                    to: moveDay(d.toISOString().slice(0, 10), -1),
                  });
                }}
              >
                1개월
              </button>
            </form>
            <div className="section-head">
              <div className="inline">
                <button
                  className="secondary"
                  onClick={() =>
                    update({ from: moveDay(from, -7), to: moveDay(to, -7) })
                  }
                >
                  ← 이전 주
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    update({
                      from: monday(today()),
                      to: moveDay(monday(today()), 4),
                    })
                  }
                >
                  이번 주
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    update({ from: moveDay(from, 7), to: moveDay(to, 7) })
                  }
                >
                  다음 주 →
                </button>
              </div>
              <a
                className="secondary"
                href={
                  "/api/export?" + new URLSearchParams({ ...filter, from, to })
                }
              >
                엑셀 CSV 내려받기
              </a>
            </div>
            {isAdmin && (
              <div className="toolbar">
                <button onClick={() => setEditor({ kind: "slot" })}>
                  수업 추가
                </button>
                <button
                  className="secondary"
                  onClick={() => setEditor({ kind: "paste" })}
                >
                  시간표 엑셀 붙여 넣기
                </button>
              </div>
            )}
            <div className="schedule-shell">
              <table className="schedule-table">
                <caption className="sr-only">
                  지역·트랙 행과 날짜·요일 열 시간표
                </caption>
                <thead>
                  <tr>
                    <th>지역</th>
                    <th>트랙 · 반</th>
                    {displayDates.map((d) => (
                      <th key={d} className={d === today() ? "is-today" : undefined} aria-current={d === today() ? "date" : undefined}>
                        {d.slice(5).replace("-", ".")}
                        <small>{weekday(d)}요일{d === today() ? " · 오늘" : ""}</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classes.map((c, i) => (
                    <tr
                      className={
                        i === 0 || classes[i - 1].region !== c.region
                          ? "region-start"
                          : ""
                      }
                      key={c.id}
                    >
                      {(i === 0 || classes[i - 1].region !== c.region) && (
                        <th
                          className="region-row"
                          scope="rowgroup"
                          rowSpan={
                            classes.filter((x) => x.region === c.region).length
                          }
                        >
                          {c.region}
                        </th>
                      )}
                      <th className="track-row" scope="row">
                        {trackName(c.track)}
                        <small>
                          {c.name} · {c.cohort}기
                        </small>
                      </th>
                      {displayDates.map((d) => (
                        <td key={d} className={d === today() ? "is-today" : undefined}>
                          {lessons(c, d).length ? (
                            lessons(c, d).map(lessonCard)
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="schedule-mobile">
              <div className="toolbar">
                <button
                  className={mobile === "track" ? "" : "secondary"}
                  onClick={() => setMobile("track")}
                >
                  트랙별 보기
                </button>
                <button
                  className={mobile === "date" ? "" : "secondary"}
                  onClick={() => setMobile("date")}
                >
                  날짜별 보기
                </button>
              </div>
              {(mobile === "track" ? classes : displayDates).map(
                (item: any, i) => (
                  <details
                    key={mobile === "track" ? item.id : item}
                    open={i === 0}
                  >
                    <summary className={mobile === "date" && item === today() ? "is-today" : undefined}>
                      {mobile === "track"
                        ? `${item.region} · ${trackName(item.track)} · ${item.cohort}기`
                        : item + " " + weekday(item) + "요일" + (item === today() ? " · 오늘" : "")}
                    </summary>
                    {(mobile === "track"
                      ? displayDates.flatMap((d) => lessons(item, d))
                      : classes.flatMap((c) => lessons(c, item))
                    ).map((r) => (
                      <article key={r.id} className={r.day === today() ? "is-today" : undefined}>
                        <small>
                          {r.day} · {r.class_name}
                        </small>
                        {lessonCard(r)}
                      </article>
                    ))}
                  </details>
                ),
              )}
            </div>
            {!loading && !rows.length && (
              <p className="empty">
                선택한 기간·조건에 등록된 수업이 없습니다.
              </p>
            )}
          </>
        )}
        {view === "instructors" && (
          <>
            <form
              className="toolbar"
              onSubmit={(e) => {
                e.preventDefault();
                update({
                  q: String(new FormData(e.currentTarget).get("q") || ""),
                });
              }}
            >
              <label>
                강사 검색
                <input name="q" defaultValue={filter.q} />
              </label>
              <button>검색</button>
              {isAdmin && (
                <>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setEditor({ kind: "instructor" })}
                  >
                    강사 추가
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setEditor({ kind: "instructor-paste" })}
                  >
                    강사 엑셀 붙여 넣기
                  </button>
                </>
              )}
            </form>
            <DataTable rows={rows} columns={[
              ["name", "이름", p => teacherButton(p)],
              ["organization", "기관", p => <Org name={p.organization} />],
              ["subjects", "과목", p => [...new Set([...(p.subjects || []), ...(p.taught_subjects || [])])].join(", ")],
              ["classes", "담당 반", p => (p.classes || []).join(", ") || "—"],
              ["total_days", "총 수업일수", p => `${p.total_days || 0}일`],
              ["last_day", "최근 수업일"],
              ["next_day", "다음 수업일"],
              ["actions", "관리", p => <div className="inline"><button className="secondary" onClick={() => setTeacher(p.id)}>상세 정보</button>{isAdmin && <button className="secondary" onClick={async () => {
                try { const d = await api("instructor", { id: p.id }); setEditor({ kind: "instructor", row: d.instructor }); } catch (e) { setError((e as Error).message); }
              }}>수정·보관</button>}</div>],
            ]} />
          </>
        )}
        {view === "materials" && options && (
          <Materials
            options={options}
            admin={operator?.role === "admin"}
            operator={operator}
            query={filter.q}
            onTeacher={setTeacher}
          />
        )}
        {isAdmin && view === "announcements" && (
          <>
            <div className="section-head">
              <h2>공지사항</h2>
              <button onClick={() => setEditor({ kind: "announcement" })}>
                공지 등록
              </button>
            </div>
            <div className="notice-grid">{notices.map(noticeCard)}</div>
          </>
        )}
        {isAdmin && view === "facilities" && options && (
          <ClassSettings options={options} onDone={refresh} />
        )}
        {isAdmin && view === "manage" && options && (
          <Admin options={options} revision={revision} onDone={refresh} />
        )}
        {options && editor?.kind === "slot" && (
          <SlotEditor
            slot={editor.row}
            options={options}
            onDone={refresh}
            close={() => setEditor(undefined)}
          />
        )}
        {options && editor?.kind === "paste" && (
          <PasteEditor
            options={options}
            classId={filter.class_id}
            onDone={refresh}
            close={() => setEditor(undefined)}
          />
        )}
        {options && editor?.kind === "instructor" && (
          <InstructorEditor
            instructor={editor.row}
            options={options}
            onDone={refresh}
            close={() => setEditor(undefined)}
          />
        )}
        {options && editor?.kind === "instructor-paste" && (
          <InstructorPaste
            options={options}
            onDone={refresh}
            close={() => setEditor(undefined)}
          />
        )}
        {editor?.kind === "announcement" && isAdmin && (
          <AnnouncementEditor
            row={editor.row}
            onDone={refresh}
            close={() => setEditor(undefined)}
          />
        )}
        {teacher && (
          <TeacherModal id={teacher} close={() => setTeacher(undefined)} />
        )}
      </main>
      <nav className="mobile-nav" aria-label="모바일 메뉴">
        {portalNav.map(([v, n]) => (
          <button
            key={v}
            className={view === v ? "active" : ""}
            onClick={() => navigate(v)}
          >
            {n}
          </button>
        ))}
      </nav>
      <footer>LG전자 K-뉴딜 아카데미</footer>
    </>
  );
}
