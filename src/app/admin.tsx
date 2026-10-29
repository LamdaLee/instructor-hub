"use client";
import DatePicker from "./date-picker";
import { orgLabel } from "@/lib/organizations";
import { useEffect, useState } from "react";
import { type Row, api, post } from "@/lib/client";
import { DataTable, Modal } from "./components";
export default function Admin({
  options,
  onDone,
  revision,
}: {
  options: Row;
  onDone: () => void;
  revision: number;
}) {
  const [tab, setTab] = useState("operators"),
    [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<Row>(),
    [kind, setKind] = useState(""),
    [offset, setOffset] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    if (["operators", "audit"].includes(tab))
      api(tab, tab === "audit" ? { offset: String(offset) } : {})
        .then((r) => {
          if (active) setRows(r.rows);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [tab, revision, offset]);
  const open = (k: string, row: Row = {}) => {
    setKind(k);
    setEditing(row);
    setError("");
  };
  return (
    <>
      <div className="toolbar">
        {[
          ["operators", "운영진 계정"],
          ["classes", "반"],
          ["organizations", "기관"],
          ["subjects", "과목"],
          ["audit", "변경 기록"],
        ].map(([v, label]) => (
          <button
            key={v}
            className={tab === v ? "" : "secondary"}
            onClick={() => {
              setTab(v);
              setOffset(0);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {tab === "operators" && (
        <>
          <div className="title-row">
            <h2>운영진 계정</h2>
            <button onClick={() => open("operator")}>계정 추가</button>
          </div>
          <DataTable
            rows={rows}
            columns={[
              ["name", "이름"],
              ["email", "이메일"],
              [
                "role",
                "권한",
                (r) => (r.role === "admin" ? "관리자" : "운영진"),
              ],
              ["organization", "소속 기관", (r) => r.organization ?? "—"],
              ["active", "상태", (r) => (r.active ? "활성" : "비활성")],
              [
                "edit",
                "관리",
                (r) => (
                  <button
                    className="secondary"
                    onClick={() => open("operator", r)}
                  >
                    수정 / 비밀번호 초기화
                  </button>
                ),
              ],
            ]}
          />
        </>
      )}
      {tab === "classes" && (
        <>
          <div className="title-row">
            <h2>반 관리</h2>
            <button onClick={() => open("class")}>반 추가</button>
          </div>
          <DataTable
            rows={options.classes}
            columns={[
              ["name", "반"],
              ["region", "지역"],
              ["cohort", "기수"],
              ["track", "트랙"],
              ["manager", "담당 매니저", (r) => r.manager || "미등록"],
              ["room", "기본 강의장", (r) => r.room || "미등록"],
              ["starts_on", "시작일"],
              ["ends_on", "종료일"],
              ["active", "상태", (r) => (r.active ? "활성" : "비활성")],
              [
                "edit",
                "관리",
                (r) => (
                  <button
                    className="secondary"
                    onClick={() => open("class", r)}
                  >
                    수정
                  </button>
                ),
              ],
            ]}
          />
        </>
      )}
      {tab === "organizations" && (
        <>
          <div className="title-row">
            <h2>기관 관리</h2>
            <button onClick={() => open("organization")}>기관 추가</button>
          </div>
          <p>
            기존 시간표의 기관 코드는 유지됩니다. 새로운 기관을 등록하면
            강사·시간표에서 선택할 수 있습니다.
          </p>
          <DataTable
            rows={options.organizations.map((name: string) => ({ name }))}
            columns={[["name", "기관"]]}
          />
        </>
      )}
      {tab === "subjects" && (
        <>
          <div className="title-row">
            <h2>과목 관리</h2>
            <button onClick={() => open("subject")}>과목 추가</button>
          </div>
          <DataTable
            rows={options.subjects.filter((s: Row) => !s.archived_at)}
            columns={[
              ["name", "과목"],
              ["track", "트랙"],
              [
                "edit",
                "관리",
                (r) => (
                  <div className="inline">
                    <button
                      className="secondary"
                      onClick={() => open("subject", r)}
                    >
                      수정
                    </button>
                    <button
                      className="secondary"
                      onClick={async () => {
                        if (
                          !confirm(
                            "과목을 보관할까요? 기존 수업·자료와 변경 기록은 보존됩니다.",
                          )
                        )
                          return;
                        try {
                          await post("save", {
                            kind: "archive_subject",
                            data: { old_name: r.name },
                          });
                          onDone();
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      보관
                    </button>
                  </div>
                ),
              ],
            ]}
          />
        </>
      )}
      {tab === "audit" && (
        <>
          <h2>변경 기록</h2>
          <p>
            최신 기록부터 200건씩 표시합니다. 로그인·내보내기와 변경 전후 값이
            기록됩니다.
          </p>
          <DataTable
            rows={rows}
            columns={[
              [
                "created_at",
                "시각",
                (r) =>
                  new Date(r.created_at).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  }),
              ],
              ["actor_email", "운영진"],
              ["action", "작업"],
              ["target_table", "대상"],
              ["summary", "요약"],
              [
                "changes",
                "변경 전후",
                (r) => (
                  <details>
                    <summary>자세히</summary>
                    <pre>
                      {JSON.stringify(
                        { before: r.before_value, after: r.after_value },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                ),
              ],
            ]}
          />
          <div className="toolbar">
            <button
              className="secondary"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - 200))}
            >
              이전
            </button>
            <span>{offset + 1}번째부터</span>
            <button
              className="secondary"
              disabled={rows.length < 200}
              onClick={() => setOffset((o) => o + 200)}
            >
              다음
            </button>
          </div>
        </>
      )}
      {editing && (
        <Modal
          title={
            {
              operator: "운영진 계정",
              class: "반",
              organization: "기관",
              subject: "과목",
            }[kind] +
            " " +
            (editing.id ? "수정" : "등록")
          }
          close={() => setEditing(undefined)}
        >
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const d: Row = Object.fromEntries(new FormData(e.currentTarget));
              try {
                if (kind === "class") {
                  d.cohort = Number(d.cohort);
                  d.active = d.active === "on";
                }
                if (kind === "operator") d.active = d.active === "on";
                await post("save", {
                  kind:
                    kind === "subject" &&
                    editing.name &&
                    d.name !== editing.name
                      ? "rename_subject"
                      : kind,
                  data: { ...d, id: editing.id, old_name: editing.name },
                });
                onDone();
                setEditing(undefined);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              이름
              <input
                name="name"
                defaultValue={editing.name ?? ""}
                required
                maxLength={200}
              />
            </label>
            {kind === "operator" && (
              <>
                <label>
                  이메일
                  <input
                    name="email"
                    type="email"
                    required
                    defaultValue={editing.email ?? ""}
                    autoComplete="off"
                  />
                </label>
                <label>
                  권한
                  <select name="role" defaultValue={editing.role ?? "member"}>
                    <option value="member">운영진</option>
                    <option value="admin">관리자</option>
                  </select>
                </label>
                <label>
                  소속 기관
                  <select
                    name="organization"
                    defaultValue={editing.organization ?? ""}
                  >
                    <option value="">없음</option>
                    {["aSSIST", "CLIPS", "LGE", "LAB4DX"].map((o) => (
                      <option key={o} value={o}>{orgLabel(o)}</option>
                    ))}
                  </select>
                  <small>
                    LGE·Lab4dx는 전체 기관 강사 변경 신청을 승인·반려하고,
                    Lab4dx는 가입 신청을 승인합니다.
                  </small>
                </label>
                <label>
                  새 비밀번호{editing.id ? " (비워두면 유지)" : ""}
                  <input
                    name="password"
                    type="password"
                    minLength={10}
                    required={!editing.id}
                    autoComplete="new-password"
                  />
                  <small>
                    10자 이상 · UTF-8 72바이트 이하. 초기화하면 기존 세션이
                    만료됩니다.
                  </small>
                </label>
              </>
            )}
            {kind === "class" && (
              <>
                <label>
                  지역
                  <select name="region" defaultValue={editing.region ?? "대전"}>
                    {options.regions.map((r: string) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <label>
                  기수
                  <input
                    type="number"
                    name="cohort"
                    min={1}
                    max={9999}
                    defaultValue={editing.cohort ?? 1}
                    required
                  />
                </label>
              </>
            )}
            {["class", "subject"].includes(kind) && (
              <label>
                트랙
                <input
                  name="track"
                  defaultValue={editing.track ?? ""}
                  required={kind === "class"}
                  maxLength={200}
                />
              </label>
            )}
            {kind === "class" && (
              <>
                <label>
                  시작일
                  <DatePicker

                    name="starts_on"
                    defaultValue={editing.starts_on ?? ""}
                  />
                </label>
                <label>
                  종료일
                  <DatePicker

                    name="ends_on"
                    defaultValue={editing.ends_on ?? ""}
                  />
                </label>
              </>
            )}
            {kind === "class" && (
              <>
                <label>
                  담당 매니저
                  <input
                    name="manager"
                    defaultValue={editing.manager || ""}
                    maxLength={200}
                  />
                </label>
                <label>
                  강의장
                  <input
                    name="room"
                    defaultValue={editing.room || ""}
                    maxLength={200}
                  />
                </label>
              </>
            )}
            {["class", "operator"].includes(kind) && (
              <label className="inline">
                <input
                  name="active"
                  type="checkbox"
                  defaultChecked={editing.active ?? true}
                />
                활성
              </label>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button disabled={busy}>{busy ? "저장 중…" : "저장"}</button>
          </form>
        </Modal>
      )}
    </>
  );
}
