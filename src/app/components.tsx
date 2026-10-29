"use client";
import DatePicker from "./date-picker";
import { orgLabel } from "@/lib/organizations";
import { useState, useEffect, useRef } from "react";
import { type Row, post, api, classLabel } from "@/lib/client";
import { parseTsv } from "@/lib/input.mjs";
export function DataTable({
  rows,
  columns,
  caption,
}: {
  rows: Row[];
  columns: [string, string, ((r: Row) => React.ReactNode)?][];
  caption?: string;
}) {
  return (
    <div className="table-wrap">
      <table>
        <caption>{caption ?? `${rows.length}건`}</caption>
        <thead>
          <tr>
            {columns.map(([k, title]) => (
              <th key={k} scope="col">
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? i}>
              {columns.map(([k, title, render]) => (
                <td key={k} data-label={title}>
                  {render
                    ? render(r)
                    : Array.isArray(r[k])
                      ? r[k].join(", ")
                      : String(r[k] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="empty">조건에 맞는 데이터가 없습니다.</p>}
    </div>
  );
}
export const slotColumns: [string, string, ((r: Row) => React.ReactNode)?][] = [
  ["day", "날짜"],
  ["class_name", "반"],
  ["subject", "교과목"],
  ["module", "모듈"],
  ["hours", "시수"],
  [
    "instructor_name",
    "강사",
    (r) =>
      r.instructor_id ? (
        <a href={"/?view=instructor&id=" + r.instructor_id}>
          {r.linked_name || r.instructor_name}
        </a>
      ) : (
        <span>
          {r.instructor_name || (r.instructor_hidden ? "비공개" : "미배정")}
          {r.review_reason && <small className="warning"> 확인 필요</small>}
        </span>
      ),
  ],
  ["organization", "기관"],
  ["place", "장소", (r) => r.effective_place || r.place || "미등록"],
  ["period", "시간", (r) => r.effective_start_time && r.effective_end_time ? `${r.effective_start_time.slice(0, 5)}~${r.effective_end_time.slice(0, 5)}` : r.period || "시간 확인 필요"],
  ["note", "메모"],
  ["review_reason", "확인 필요"],
  [
    "conflict",
    "중복",
    (r) => (r.conflict ? <span className="warning">동일 날짜 중복</span> : "—"),
  ],
];
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      d?.close();
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            close();
        }
      }}
    >
      <div className="title-row">
        <h2>{title}</h2>
        <button type="button" className="secondary" onClick={close}>
          닫기
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function SlotEditor({
  slot,
  options,
  onDone,
  close,
}: {
  slot?: Row;
  options: Row;
  onDone: () => void;
  close: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const editing = !!slot?.id;
  const additional = !!slot?.additional_instructor;
  return (
    <Modal title={additional ? "담당 강사 추가" : editing ? "시간표 수정" : "시간표 추가"} close={close}>
      <form
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const d = Object.fromEntries(new FormData(e.currentTarget));
          const name = String(d.instructor_name || "").trim();
          const matches = (options.instructors as Row[]).filter(
            (i) => i.name === name || `${i.name} · ${orgLabel(i.organization)}` === name,
          );
          const unchanged = !!slot?.instructor_id && name === (slot.linked_name || slot.instructor_name);
          if (!unchanged && matches.length > 1) {
            setError("같은 이름의 강사가 여러 명입니다. 목록에서 기관을 포함한 이름을 선택하세요.");
            setBusy(false);
            return;
          }
          const selected = unchanged ? { id: slot.instructor_id, name: slot.linked_name || slot.instructor_name } : matches[0];
          if (additional && !selected) {
            setError("추가할 강사를 목록에서 선택하세요. 강사가 없으면 강사 정보에서 먼저 등록하세요.");
            setBusy(false);
            return;
          }
          const row = {
            ...d,
            instructor_id: selected?.id || "",
            id: slot?.id,
            class_id: slot?.class_id ?? d.class_id,
            day: slot?.day ?? d.day,
            instructor_name: selected?.name || name,
            period: slot?.period ?? "",
            ...(additional ? { organization: selected?.organization || d.organization } : {}),
          };
          if (!!d.start_time !== !!d.end_time || (d.start_time && String(d.end_time) <= String(d.start_time))) {
            setError("시작·종료 시간을 함께 입력하고 종료 시간을 더 늦게 지정하세요.");
            setBusy(false);
            return;
          }
          try {
            const r = await post("save", {
              kind: "slots",
              data: { rows: [row], overwrite: editing },
            });
            if (r.conflicts)
              alert(
                "저장했습니다. 같은 날짜에 다른 반에도 배정된 강사가 있습니다.",
              );
            onDone();
            close();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {additional && <p className="muted wide">같은 날짜·반·과목에 담당 강사를 추가합니다. 기존 강사는 유지됩니다. 각 강사의 담당 시간을 입력하고 기존 강사의 시간도 나누어 설정하세요.</p>}
        <label>
          반
          <select
            name="class_id"
            defaultValue={slot?.class_id ?? ""}
            required
            disabled={editing || additional}
          >
            <option value="">반 선택</option>
            {options.classes.map((c: Row) => (
              <option key={c.id} value={c.id}>
                {classLabel(c)}
              </option>
            ))}
          </select>
        </label>
        <label>
          날짜
          <DatePicker
            name="day"

            defaultValue={slot?.day ?? ""}
            required
            disabled={editing || additional}
          />
        </label>
        <label>
          {additional ? "담당 시작 시간" : "시작 시간 (선택)"}
          <input name="start_time" type="time" required={additional} defaultValue={slot?.start_time?.slice(0, 5) || ""} />
        </label>
        <label>
          {additional ? "담당 종료 시간" : "종료 시간 (선택)"}
          <input name="end_time" type="time" required={additional} defaultValue={slot?.end_time?.slice(0, 5) || ""} />
        </label>
        <p className="muted wide">시간을 모두 비우면 평택 외 수업은 09:00~18:00으로 표시합니다. 평택은 실제 시간을 별도로 입력하세요.</p>
        <label>
          과목
          <input
            name="subject"
            list="subject-options"
            defaultValue={slot?.subject ?? ""}
            maxLength={200}
          />
        </label>
        <label>
          강사 이름
          <input name="instructor_name" list="slot-instructor-options"
            defaultValue={slot?.linked_name || slot?.instructor_name || ""}
            maxLength={200} placeholder="강사 이름 입력 또는 선택" />
          <datalist id="slot-instructor-options">
            {options.instructors.map((i: Row) => <option key={i.id} value={`${i.name} · ${orgLabel(i.organization)}`} />)}
          </datalist>
        </label>
        <label>
          기관
          <select name="organization" defaultValue={slot?.organization ?? ""}>
            <option value="">없음</option>
            {options.organizations.map((o: string) => (
              <option key={o} value={o}>{orgLabel(o)}</option>
            ))}
          </select>
        </label>
        <p className="muted wide">공휴일·휴강일은 구분을 휴일로 선택하고 메모에 사유를 남기세요. 새 과정은 과정·변경 기록에서 반을 먼저 추가하세요.</p>
        <label>
          구분
          <select name="kind" defaultValue={slot?.kind ?? "수업"}>
            {["수업", "공통", "휴일", "없음"].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          강사 배정 상태
          <select
            name="assignment_status"
            defaultValue={slot?.assignment_status || "임시"}
          >
            <option>임시</option>
            <option>변경예정</option>
            <option>확정</option>
          </select>
        </label>
        <label>
          수업별 장소 (선택)
          <input
            name="place"
            defaultValue={slot?.place ?? ""}
            placeholder="비우면 날짜별 강의장 또는 기본 강의장 적용"
            maxLength={200}
          />
        </label>
        <label>
          메모
          <textarea
            name="note"
            defaultValue={slot?.note ?? ""}
            maxLength={2000}
          />
        </label>
        <label className="wide">
          확인 필요 사유
          <input
            name="review_reason"
            defaultValue={slot?.review_reason ?? ""}
            maxLength={2000}
          />
          <small>확인이 끝났을 때만 비워서 저장하세요.</small>
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button disabled={busy}>{busy ? "저장 중…" : "저장"}</button>
      </form>
    </Modal>
  );
}
export function InstructorEditor({
  instructor,
  options,
  onDone,
  close,
}: {
  instructor?: Row;
  options: Row;
  onDone: () => void;
  close: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={instructor ? "강사 정보 수정" : "강사 추가"} close={close}>
      <form
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const d = Object.fromEntries(new FormData(e.currentTarget));
          try {
            await post("save", {
              kind: "instructor",
              data: {
                ...d,
                id: instructor?.id,
                subjects: String(d.subjects)
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
                archived_at:
                  d.archived === "on"
                    ? (instructor?.archived_at ?? new Date().toISOString())
                    : null,
              },
            });
            onDone();
            close();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="muted wide">이름만 먼저 등록해도 됩니다. 연락처·담당 과목·메모는 나중에 이 화면에서 보완할 수 있습니다. 기존 강사 정보를 수정하며 시간표 배정은 유지됩니다.</p>
        <label>
          이름
          <input
            name="name"
            defaultValue={instructor?.name ?? ""}
            required
            maxLength={200}
          />
        </label>
        <label>
          기관
          <select
            name="organization"
            defaultValue={instructor?.organization ?? ""}
          >
            <option value="">없음</option>
            {options.organizations.map((o: string) => (
              <option key={o} value={o}>{orgLabel(o)}</option>
            ))}
          </select>
        </label>
        <label>
          전화번호
          <input
            name="phone"
            type="tel"
            maxLength={50}
            autoComplete="off"
            defaultValue={instructor?.phone ?? ""}
          />
        </label>
        <label>
          이메일
          <input
            name="email"
            maxLength={254}
            type="email"
            autoComplete="off"
            defaultValue={instructor?.email ?? ""}
          />
        </label>
        <label className="wide">
          담당 과목 (쉼표 구분)
          <input
            name="subjects"
            defaultValue={instructor?.subjects?.join(", ") ?? ""}
          />
        </label>
        <label className="wide">
          메모
          <textarea name="memo" defaultValue={instructor?.memo ?? ""} />
        </label>
        {instructor && (
          <label className="inline">
            <input
              type="checkbox"
              name="archived"
              defaultChecked={!!instructor.archived_at}
            />
            보관 (목록에서 숨김)
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
  );
}
export function PasteEditor({
  options,
  classId,
  onDone,
  close,
}: {
  options: Row;
  classId: string;
  onDone: () => void;
  close: () => void;
}) {
  const [text, setText] = useState("");
  const [selected, setSelected] = useState(classId);
  const [preview, setPreview] = useState<Row[]>([]);
  const [overwrite, setOverwrite] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const previewRows = async () => {
    setError("");
    setPreview([]);
    try {
      if (!selected) throw new Error("반을 선택하세요.");
      const parsed = parseTsv(text);
      const key = (v: string) => (v ?? "").normalize("NFC").replace(/\s/g, "");
      const orgMap: Record<string, string> = {
        LG: "LGE",
        LG전자: "LGE",
        클립스: "CLIPS",
        어시스트: "aSSIST",
        랩포디엑스: "LAB4DX",
      };
      const values = parsed.map((r) => {
        let org = orgMap[r.organization] ?? r.organization;
        const kind = ["공통", "휴일"].includes(org)
          ? org
          : !org || ["-", "없음"].includes(org)
            ? "없음"
            : "수업";
        if (kind !== "수업") org = "";
        if (org && !options.organizations.includes(org))
          throw new Error(
            "등록되지 않은 기관이 있습니다. 관리에서 추가하거나 표기를 확인하세요.",
          );
        const people = options.instructors.filter(
          (i: Row) => key(i.name) === key(r.instructor_name),
        );
        const same = people.filter((i: Row) => i.organization === org);
        const person =
          people.length === 1 ? people[0] : same.length === 1 ? same[0] : null;
        return {
          ...r,
          class_id: selected,
          organization: org,
          instructor_id: person?.id ?? null,
          kind,
          review: !person && !!r.instructor_name,
        };
      });
      if (new Set(values.map((r) => r.day)).size !== values.length)
        throw new Error(
          "붙여 넣은 데이터 안에 같은 날짜가 두 번 있습니다. 시간 구분은 개별 추가 화면을 사용하세요.",
        );
      const existing = await api("slots", {
        class_id: selected,
        from: values.map((r) => r.day).sort()[0],
        to: values
          .map((r) => r.day)
          .sort()
          .at(-1)!,
      });
      setPreview(
        values.map((r) => ({
          ...r,
          existing: existing.rows.some(
            (s: Row) => s.day === r.day && !s.period,
          ),
        })),
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <Modal title="엑셀 붙여 넣기" close={close}>
      <p>
        열 순서: 날짜 · 과목 · 강사 · 기관 · 장소 · 메모. 탭으로 구분하고 날짜는
        YYYY-MM-DD로 입력하세요.
      </p>
      <label>
        반
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setPreview([]);
          }}
        >
          <option value="">반 선택</option>
          {options.classes.map((c: Row) => (
            <option key={c.id} value={c.id}>
              {classLabel(c)}
            </option>
          ))}
        </select>
      </label>
      <label>
        엑셀 데이터
        <textarea
          rows={7}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPreview([]);
          }}
        />
      </label>
      <button className="secondary" onClick={previewRows}>
        미리보기
      </button>
      {preview.length > 0 && (
        <>
          <DataTable
            rows={preview}
            columns={[
              ["day", "날짜"],
              ["subject", "과목"],
              ["instructor_name", "강사"],
              ["organization", "기관"],
              ["place", "장소"],
              ["note", "메모"],
              [
                "review",
                "연결",
                (r) => (r.review ? "확인 필요" : "연결 / 미배정"),
              ],
              [
                "existing",
                "기존 데이터",
                (r) => (r.existing ? "덮어쓰기 대상" : "신규"),
              ],
            ]}
          />
          <label className="inline">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
            />
            같은 반·날짜의 기존 시간표를 덮어씁니다.
          </label>
          <button
            disabled={busy || (preview.some((r) => r.existing) && !overwrite)}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await post("save", {
                  kind: "slots",
                  data: { rows: preview, overwrite },
                });
                if (r.conflicts)
                  alert("같은 날짜에 다른 반에도 배정된 강사가 있습니다.");
                onDone();
                close();
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "저장 중…" : `${preview.length}건 저장`}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </Modal>
  );
}
