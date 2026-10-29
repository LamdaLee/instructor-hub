"use client";
import DatePicker from "./date-picker";
import { useState } from "react";
import { type Row, post, classLabel } from "@/lib/client";
import { Modal } from "./components";

export default function VenueOverrides({ classRow, rows, onDone, close }: {
  classRow: Row; rows: Row[]; onDone: () => void; close: () => void;
}) {
  const [editing, setEditing] = useState<Row>();
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const clear = () => { setEditing(undefined); setVersion(v => v + 1); };
  return <Modal title="날짜별 강의장" close={() => { if (!busy) close(); }}>
    <p className="privacy-info">{classLabel(classRow)} · 기본 강의장: {classRow.room || "미등록"}</p>
    <p>수업별 장소 → 예외 기간 강의장 → 기본 강의장 순서로 표시합니다. 기간의 시작일과 종료일을 모두 포함하며, 같은 반의 기간은 겹칠 수 없습니다.</p>
    <div className="venue-list">
      {rows.map(r => <article className="detail" key={r.id}>
        <strong>{r.starts_on} ~ {r.ends_on} · {r.room}</strong>
        {r.note && <p>{r.note}</p>}
        <div className="toolbar">
          <button type="button" className="secondary" disabled={busy} onClick={() => { setEditing(r); setError(""); setSaved(""); }}>기간 수정</button>
          <button type="button" className="secondary" disabled={busy} onClick={async () => {
            if (!confirm("이 강의장 예외 기간을 삭제할까요? 기본 강의장과 기존 수업은 유지됩니다.")) return;
            setBusy(true); setError("");
            try {
              await post("save", { kind: "delete_venue_override", data: { id: r.id } });
              clear(); setSaved("예외 기간을 삭제하고 변경 기록을 남겼습니다."); onDone();
            } catch (e) { setError((e as Error).message); }
            finally { setBusy(false); }
          }}>기간 삭제</button>
        </div>
      </article>)}
      {!rows.length && <p className="muted">등록된 예외 기간이 없습니다.</p>}
    </div>
    <h3>{editing ? "예외 기간 수정" : "예외 기간 추가"}</h3>
    <form key={(editing?.id || "new") + version} className="form-grid" onSubmit={async e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.currentTarget));
      if (String(d.ends_on) < String(d.starts_on)) { setError("종료일은 시작일보다 빠를 수 없습니다."); return; }
      setBusy(true); setError(""); setSaved("");
      try {
        await post("save", { kind: "venue_override", data: { ...d, id: editing?.id, class_id: classRow.id } });
        clear(); setSaved("예외 기간을 저장하고 변경 기록을 남겼습니다."); onDone();
      } catch (e) { setError((e as Error).message); }
      finally { setBusy(false); }
    }}>
      <label>시작일<DatePicker name="starts_on"  required defaultValue={editing?.starts_on || ""} /></label>
      <label>종료일<DatePicker name="ends_on"  required defaultValue={editing?.ends_on || ""} /></label>
      <label className="wide">변경 강의장<input name="room" required maxLength={200} defaultValue={editing?.room || ""} placeholder="예: 평택 러닝센터" /></label>
      <label className="wide">메모<textarea name="note" maxLength={2000} defaultValue={editing?.note || ""} placeholder="예: 1주차 입소 교육" /></label>
      {error && <p className="error wide" role="alert">{error}</p>}
      {saved && <p className="settings-saved wide" role="status">{saved}</p>}
      <div className="toolbar wide">
        <button disabled={busy}>{busy ? "저장 중…" : "예외 기간 저장"}</button>
        {editing && <button type="button" className="secondary" disabled={busy} onClick={clear}>새 기간 추가</button>}
      </div>
    </form>
  </Modal>;
}
