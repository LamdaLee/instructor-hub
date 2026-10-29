"use client";
import { useEffect, useState } from "react";
import { type Row, messages, post } from "@/lib/client";
import { DataTable, Modal } from "./components";
import { Org } from "./hub";
export type OrgOperator = {
  name: string;
  role: string;
  organization: string | null;
  all_orgs: boolean;
  review_requests: boolean;
  review_signups: boolean;
};
const ORGS = ["aSSIST", "CLIPS", "LGE", "LAB4DX"];
const kindName: Record<string, string> = { register: "등록", remove: "삭제" };
const statusName: Record<string, string> = {
  submitted: "승인 대기",
  approved: "승인",
  rejected: "반려",
};
const when = (v?: string) =>
  v
    ? new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(v))
    : "—";
async function orgRead(action: string, q = "") {
  const query = new URLSearchParams({ action, ...(q ? { q } : {}) });
  const res = await fetch("/api/org?" + query, { cache: "no-store" });
  const r = await res.json();
  if (!r.ok) throw new Error(messages[r.code] ?? messages.server_error);
  return r.rows as Row[];
}
// 기관 계정 화면: 강사 명단, 강사 변경 신청, 가입 승인.
export default function OrgDesk({ operator }: { operator: OrgOperator }) {
  const tabs = [
    ["instructors", "강사 명단"],
    ["requests", "강사 변경 신청"],
    ...(operator.review_signups ? [["signups", "가입 승인"]] : []),
  ];
  const [tab, setTab] = useState("instructors"),
    [rows, setRows] = useState<Row[]>([]),
    [q, setQ] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0),
    [form, setForm] = useState<
      | { kind: "register" }
      | { kind: "remove"; row: Row }
      | { kind: "decide" | "decide_signup"; row: Row; decision: string }
    >();
  useEffect(() => {
    let active = true;
    setError("");
    orgRead(tab, tab === "instructors" ? q : "")
      .then((r) => {
        if (active) setRows(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [tab, q, revision]);
  const submit = async (action: string, data: Row) => {
    setBusy(true);
    setError("");
    try {
      await post("org", { action, data });
      setForm(undefined);
      setRevision((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const decideButtons = (kind: "decide" | "decide_signup", r: Row) =>
    r.status === "submitted" ? (
      <span className="inline">
        <button onClick={() => setForm({ kind, row: r, decision: "approve" })}>
          승인
        </button>
        <button
          className="secondary"
          onClick={() => setForm({ kind, row: r, decision: "reject" })}
        >
          반려
        </button>
      </span>
    ) : (
      <span>
        {statusName[r.status]} · {r.decided_by ?? "—"}
        {r.decision_note && <small> · {r.decision_note}</small>}
      </span>
    );
  return (
    <>
      <header className="portal-header">
        <a className="portal-brand" href="/">
          <b>LG</b>
          <span>
            <strong>LG전자 K-뉴딜 아카데미</strong>
            <small>기관 업무</small>
          </span>
        </a>
        <nav aria-label="기관 메뉴">
          {tabs.map(([v, n]) => (
            <button
              key={v}
              className={tab === v ? "active" : ""}
              onClick={() => setTab(v)}
            >
              {n}
            </button>
          ))}
        </nav>
        {operator.role === "admin" && (
          <a className="admin-access" href="/admin">
            관리자 화면
          </a>
        )}
        <button
          className="admin-access"
          onClick={async () => {
            await post("logout", {});
            location.assign("/");
          }}
        >
          로그아웃
        </button>
      </header>
      <main className="portal-main">
        <div className="portal-page-title">
          <h1>{tabs.find(([v]) => v === tab)?.[1]}</h1>
          <small>
            {operator.name} · {operator.organization ?? "소속 미지정"}
            {operator.all_orgs
              ? " · 전체 기관 열람"
              : " · 자기 기관만 열람"}
            {operator.review_requests ? " · 변경 신청 승인" : ""}
            {operator.review_signups ? " · 가입 승인" : ""}
          </small>
        </div>
        {!operator.all_orgs && !operator.organization && (
          <p className="warning">
            소속 기관이 지정되지 않은 계정입니다. 관리자에게 소속 지정을
            요청하세요.
          </p>
        )}
        {tab === "instructors" && (
          <>
            <div className="title-row">
              <label>
                이름 검색
                <input
                  type="search"
                  value={q}
                  maxLength={100}
                  onChange={(e) => setQ(e.target.value)}
                />
              </label>
              <button onClick={() => setForm({ kind: "register" })}>
                강사 등록 신청
              </button>
            </div>
            <DataTable
              rows={rows}
              columns={[
                ["name", "이름"],
                ["organization", "기관", (r) => <Org name={r.organization} />],
                ["phone", "연락처"],
                ["email", "이메일"],
                [
                  "action",
                  "변경 신청",
                  (r) =>
                    r.pending ? (
                      <span>삭제 승인 대기</span>
                    ) : (
                      <button
                        className="secondary"
                        onClick={() => setForm({ kind: "remove", row: r })}
                      >
                        삭제 신청
                      </button>
                    ),
                ],
              ]}
            />
          </>
        )}
        {tab === "requests" && (
          <>
            <div className="title-row">
              <p>
                {operator.review_requests
                  ? "승인하면 강사 명단에 바로 반영됩니다. 삭제는 기록을 지우지 않고 보관 처리합니다."
                  : "LG전자·LAB4DX 담당자가 승인 또는 반려합니다."}
              </p>
              <button
                className="secondary"
                onClick={() => setRevision((n) => n + 1)}
              >
                새로고침
              </button>
            </div>
            <DataTable
              rows={rows}
              columns={[
                ["created_at", "신청 시각", (r) => when(r.created_at)],
                ["kind", "구분", (r) => kindName[r.kind]],
                ["organization", "기관", (r) => <Org name={r.organization} />],
                ["name", "강사"],
                ["reason", "사유"],
                ["requested_by", "신청자"],
                [
                  "status",
                  "상태",
                  (r) =>
                    operator.review_requests
                      ? decideButtons("decide", r)
                      : statusName[r.status] +
                        (r.decision_note ? " · " + r.decision_note : ""),
                ],
              ]}
            />
          </>
        )}
        {tab === "signups" && (
          <DataTable
            rows={rows}
            columns={[
              ["created_at", "신청 시각", (r) => when(r.created_at)],
              ["name", "이름"],
              ["email", "이메일"],
              ["organization", "기관", (r) => <Org name={r.organization} />],
              ["status", "처리", (r) => decideButtons("decide_signup", r)],
            ]}
          />
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </main>
      {form && (
        <Modal
          title={
            form.kind === "register"
              ? "강사 등록 신청"
              : form.kind === "remove"
                ? "강사 삭제 신청"
                : (form.decision === "approve" ? "승인" : "반려") +
                  " · " +
                  (form.row.name ?? "")
          }
          close={() => setForm(undefined)}
        >
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              const d: Row = Object.fromEntries(new FormData(e.currentTarget));
              if (form.kind === "register")
                submit("submit", { ...d, kind: "register" });
              else if (form.kind === "remove")
                submit("submit", {
                  kind: "remove",
                  instructor_id: form.row.id,
                  note: d.note,
                });
              else
                submit(form.kind, {
                  id: form.row.id,
                  decision: form.decision,
                  note: d.note,
                });
            }}
          >
            {form.kind === "register" && (
              <>
                <label>
                  강사 이름
                  <input name="name" required maxLength={100} />
                </label>
                {operator.all_orgs ? (
                  <label>
                    기관
                    <select
                      name="organization"
                      required
                      defaultValue={operator.organization ?? ""}
                    >
                      {ORGS.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p>기관: {operator.organization}</p>
                )}
                <label>
                  연락처
                  <input name="phone" maxLength={50} />
                </label>
                <label>
                  이메일
                  <input name="email" type="email" maxLength={254} />
                </label>
              </>
            )}
            {form.kind === "remove" && (
              <p className="wide">
                {form.row.name} ({form.row.organization ?? "소속 미등록"})
                강사를 명단에서 제외해 달라고 신청합니다. 기존 시간표 기록은
                보존됩니다.
              </p>
            )}
            {(form.kind === "decide" || form.kind === "decide_signup") &&
              form.row.reason && (
                <p className="wide">신청 사유: {form.row.reason}</p>
              )}
            <label className="wide">
              {form.kind === "register" || form.kind === "remove"
                ? "신청 사유"
                : form.decision === "reject"
                  ? "반려 사유"
                  : "처리 메모 (선택)"}
              <textarea
                name="note"
                maxLength={2000}
                required={
                  form.kind === "register" ||
                  form.kind === "remove" ||
                  ("decision" in form && form.decision === "reject")
                }
              />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button disabled={busy}>
              {busy
                ? "처리 중…"
                : form.kind === "register" || form.kind === "remove"
                  ? "신청"
                  : form.decision === "approve"
                    ? "승인"
                    : "반려"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
