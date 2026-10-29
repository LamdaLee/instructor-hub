"use client";
import { useEffect, useState } from "react";
import { api, post, messages, type Row } from "@/lib/client";
import { Modal } from "./components";
import { Org } from "./hub";
export function TeacherModal({ id, close }: { id: string; close: () => void }) {
  const [data, setData] = useState<Row>(),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api("instructor", { id })
      .then((r) => {
        if (active) setData(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  const p = data?.instructor;
  return (
    <Modal title="강사 상세 정보" close={close}>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {p ? (
        <div className="teacher-modal">
          <div className="teacher-avatar">{p.name.slice(0, 1)}</div>
          <h3>{p.name}</h3>
          <Org name={p.organization} />
          <dl>
            <dt>소속</dt>
            <dd>{p.organization || "미등록"}</dd>
            <dt>메일주소</dt>
            <dd>{p.email || "미등록"}</dd>
            <dt>전화번호</dt>
            <dd>{p.phone || "미등록"}</dd>
            <dt>담당 과목</dt>
            <dd>
              {[
                ...new Set([
                  ...(p.subjects || []),
                  ...(data.rows || [])
                    .map((r: Row) => r.subject)
                    .filter(Boolean),
                ]),
              ].join(", ") || "미등록"}
            </dd>
            <dt>메모</dt>
            <dd>{p.memo || "없음"}</dd>
          </dl>
        </div>
      ) : (
        !error && <p role="status">불러오는 중…</p>
      )}
    </Modal>
  );
}
export function AnnouncementEditor({
  row,
  onDone,
  close,
}: {
  row?: Row;
  onDone: () => void;
  close: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title={row ? "공지 수정" : "공지 등록"} close={close}>
      <form
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const d = new FormData(e.currentTarget);
          try {
            await post("save", {
              kind: "announcement",
              data: {
                id: row?.id,
                title: d.get("title"),
                body: d.get("body"),
                region: d.get("region"),
                important: d.get("important") === "on",
              },
            });
            onDone();
            close();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          제목
          <input
            name="title"
            required
            maxLength={200}
            defaultValue={row?.title}
          />
        </label>
        <label>
          지역
          <select name="region" defaultValue={row?.region || ""}>
            <option value="">전체</option>
            {["대전", "대구", "부산"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="wide">
          내용
          <textarea
            name="body"
            aria-label="내용"
            required
            maxLength={10000}
            defaultValue={row?.body}
          />
        </label>
        <label className="inline">
          <input
            name="important"
            type="checkbox"
            defaultChecked={row?.important}
          />
          중요
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button disabled={busy}>저장</button>
      </form>
    </Modal>
  );
}
export function Materials({
  options,
  admin,
  query,
  onTeacher,
}: {
  options: Row;
  admin: boolean;
  query: string;
  onTeacher: (id: string) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]),
    [editing, setEditing] = useState<Row | null>(),
    [deleting, setDeleting] = useState<Row>(),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [search, setSearch] = useState(query),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setSearch(query);
  }, [query]);
  useEffect(() => {
    let active = true;
    api("materials", { q: search })
      .then((r) => {
        if (active) {
          setRows(r.rows);
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [revision, search]);
  const refresh = () => setRevision((n) => n + 1);
  return (
    <>
      <div className="toolbar">
        <label>
          자료 검색
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="과목 또는 파일명"
          />
        </label>
        <button
          onClick={() => {
            setError("");
            setEditing(null);
          }}
        >
          교재 업로드
        </button>
      </div>
      <p className="privacy-info">
        누구나 PDF·PPTX 교재를 올리고 수정·삭제할 수 있습니다. 파일당 최대 50
        MB.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="material-grid">
        {rows.map((m) => (
          <article className="material-card" key={m.id}>
            <div className="file-icon">
              {m.mime === "application/pdf" ? "PDF" : "PPTX"}
            </div>
            <h3>{m.subject}</h3>
            <button
              className="teacher-link"
              onClick={() => onTeacher(m.instructor_id)}
            >
              {options.instructors.find((p: Row) => p.id === m.instructor_id)
                ?.name || "강사 정보"}
            </button>
            <p className="file-name">{m.filename}</p>
            <small>
              {(Number(m.bytes) / 1024 / 1024).toFixed(2)} MB ·{" "}
              {new Date(m.updated_at).toLocaleDateString("ko-KR", {
                timeZone: "Asia/Seoul",
              })}
            </small>
            <p className="muted">
              등록자 {m.uploader} {m.published ? "" : "· 비공개"}
            </p>
            <a
              className="secondary file-download"
              href={"/api/materials/" + m.id}
            >
              교재 내려받기
            </a>
            <div className="material-actions">
              <button
                className="secondary"
                onClick={() => {
                  setError("");
                  setEditing(m);
                }}
              >
                파일 수정
              </button>
              <button
                className="secondary danger"
                onClick={() => {
                  setError("");
                  setDeleting(m);
                }}
              >
                삭제
              </button>
            </div>
          </article>
        ))}
      </div>
      {loaded && !rows.length && (
        <p className="empty">등록된 자료가 없습니다.</p>
      )}
      {deleting && (
        <Modal
          title="교재 삭제"
          close={() => {
            if (!busy) setDeleting(undefined);
          }}
        >
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const d = new FormData(e.currentTarget);
              try {
                const res = await fetch("/api/materials/" + deleting.id, {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    actor: d.get("actor"),
                    reason: d.get("reason"),
                  }),
                });
                const r = await res.json();
                if (!r.ok)
                  throw new Error(messages[r.code] || messages.server_error);
                refresh();
                setDeleting(undefined);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="wide file-name">{deleting.filename}</p>
            <p className="wide">
              이 자료를 삭제할까요? 삭제 후 자료실과 다운로드에서 제외되며 변경
              기록은 남습니다.
            </p>
            <label>
              작업자 이름
              <input name="actor" required maxLength={80} />
            </label>
            <label>
              삭제 사유
              <input name="reason" required maxLength={1000} />
            </label>
            {error && (
              <p role="alert" className="error wide">
                {error}
              </p>
            )}
            <button
              className="secondary"
              type="button"
              onClick={() => setDeleting(undefined)}
            >
              취소
            </button>
            <button disabled={busy}>{busy ? "처리 중…" : "삭제 확인"}</button>
          </form>
        </Modal>
      )}
      {editing !== undefined && (
        <Modal
          title={editing ? "교재 파일 수정" : "교재 업로드"}
          close={() => {
            if (!busy) setEditing(undefined);
          }}
        >
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const data = new FormData(e.currentTarget);
              try {
                const file = data.get("file") as File;
                if (file?.size > 50 * 1024 * 1024)
                  throw new Error(messages.file_too_large);
                const res = await fetch(
                  "/api/materials" + (editing ? "/" + editing.id : ""),
                  { method: "POST", body: data },
                );
                const d = await res.json();
                if (!d.ok)
                  throw new Error(messages[d.code] || messages.server_error);
                refresh();
                setEditing(undefined);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="wide">
              교과목
              <select name="subject" defaultValue={editing?.subject} required>
                <option value="">과목 선택</option>
                {options.subjects.map((s: Row) => (
                  <option key={s.name}>{s.name}</option>
                ))}
              </select>
            </label>
            <label>
              강사
              <select
                name="instructor_id"
                defaultValue={editing?.instructor_id}
                required
              >
                <option value="">강사 선택</option>
                {options.instructors.map((p: Row) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.organization}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {editing ? "작업자 이름" : "등록자 이름"}
              <input
                name={editing ? "actor" : "uploader"}
                required
                maxLength={80}
              />
            </label>
            {admin && (
              <label>
                공개 여부
                <select
                  name="published"
                  defaultValue={editing?.published === false ? "false" : "true"}
                >
                  <option value="true">공개</option>
                  <option value="false">비공개</option>
                </select>
              </label>
            )}
            {editing && (
              <p className="wide file-name">현재 파일: {editing.filename}</p>
            )}
            <label className="wide">
              {editing ? "교체 파일 (선택)" : "PDF · PPTX 파일"}
              <input
                name="file"
                type="file"
                accept=".pdf,.pptx"
                required={!editing}
              />
            </label>
            <label className="wide">
              변경 사유
              <input name="reason" required maxLength={1000} />
            </label>
            {error && (
              <p className="error wide" role="alert">
                {error}
              </p>
            )}
            <button disabled={busy}>
              {busy ? "저장 중…" : editing ? "변경 저장" : "업로드"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function InstructorPaste({
  options,
  onDone,
  close,
}: {
  options: Row;
  onDone: () => void;
  close: () => void;
}) {
  const [text, setText] = useState(""),
    [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(0);
  return (
    <Modal
      title="강사 엑셀 붙여 넣기"
      close={() => {
        if (!busy) close();
      }}
    >
      <p>
        열 순서: 이름 · 기관 · 메일주소 · 전화번호 · 메모 (탭 구분, 최대 100행).
        기존 강사는 이름·기관이 정확히 일치하면 수정합니다.
      </p>
      <textarea
        aria-label="강사 엑셀 내용"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setRows([]);
          setDone(0);
        }}
      />
      <button
        className="secondary"
        onClick={() => {
          try {
            const lines = text.trim().split(/\r?\n/).filter(Boolean);
            if (lines[0]?.split("\t")[0] === "이름") lines.shift();
            if (!lines.length || lines.length > 100)
              throw new Error("1~100행을 입력하세요.");
            const parsed = lines.map((line, i) => {
              const [name, organization, email = "", phone = "", memo = ""] =
                line.split("\t");
              if (
                !name?.trim() ||
                !options.organizations.includes(organization)
              )
                throw new Error(`${i + 1}행 이름·기관을 확인하세요.`);
              const matches = options.instructors.filter(
                (p: Row) =>
                  p.name === name.trim() && p.organization === organization,
              );
              if (matches.length > 1)
                throw new Error(`${i + 1}행 동명이인: 개별 수정이 필요합니다.`);
              return {
                id: matches[0]?.id,
                name: name.trim(),
                organization,
                email,
                phone,
                memo,
                subjects: [],
              };
            });
            if (
              new Set(parsed.map((r) => r.name + "|" + r.organization)).size !==
              parsed.length
            )
              throw new Error("동일 이름·기관의 중복 행을 제거하세요.");
            setRows(parsed);
            setError("");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        미리보기
      </button>
      {rows.length > 0 && (
        <>
          <p>
            {rows.length}명 · 기존 강사 {rows.filter((r) => r.id).length}명 /
            신규 {rows.filter((r) => !r.id).length}명
          </p>
          <ul>
            {rows.map((r, i) => (
              <li key={i}>
                {r.name} · {r.organization}
              </li>
            ))}
          </ul>
          <button
            disabled={busy || done === rows.length}
            onClick={async () => {
              setBusy(true);
              try {
                for (let i = done; i < rows.length; i++) {
                  const r = rows[i];
                  const existing = r.id
                    ? (await api("instructor", { id: r.id })).instructor
                    : null;
                  await post("save", {
                    kind: "instructor",
                    data: { ...r, subjects: existing?.subjects || [] },
                  });
                  setDone(i + 1);
                }
                onDone();
                close();
              } catch (e) {
                setError(
                  (e as Error).message +
                    " · 완료 " +
                    done +
                    "행 이후부터 재시도하세요.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            반영
          </button>
        </>
      )}
      {busy && <p role="status">{done}행 저장 완료</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </Modal>
  );
}
