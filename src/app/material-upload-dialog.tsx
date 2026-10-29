"use client";
import { orgLabel } from "@/lib/organizations";
import { useState } from "react";
import { messages, readResponse, type Row } from "@/lib/client";
import { Modal } from "./components";
import MaterialLessonPicker from "./material-lesson-picker";
export default function MaterialUploadDialog({ editing, options, admin, allowedOrgs, initialOrg, done, close }: {
  editing: Row | null; options: Row; admin: boolean; allowedOrgs: string[][]; initialOrg: string;
  done: () => void; close: () => void;
}) {
  const [org, setOrg] = useState(initialOrg);
  const [linkLesson, setLinkLesson] = useState(!editing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [retry, setRetry] = useState<{ data: FormData; files: File[]; completed: number; total: number }>();
  return <Modal title={editing ? "교재 파일 수정" : "교재 업로드"} close={() => { if (!busy) close(); }}>
    <form className="form-grid" onSubmit={async e => {
      e.preventDefault();
      const data = retry?.data || new FormData(e.currentTarget);
      if ((!editing || linkLesson) && !data.get("slot_id")) { setError(messages.lesson_required); return; }
      const files = retry?.files || data.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
      if (files.some(f => f.size > 50 * 1024 * 1024)) { setError(messages.file_too_large); return; }
      if (!editing && !files.length) { setError(messages.invalid_file); return; }
      setBusy(true); setError("");
      if (editing) {
        try {
          await readResponse(await fetch("/api/materials/" + editing.id, { method: "POST", body: data }));
          done(); close();
        } catch (e) { setError((e as Error).message); }
        finally { setBusy(false); }
        return;
      }
      const completed = retry?.completed || 0;
      const total = retry?.total || files.length;
      let index = 0;
      try {
        for (; index < files.length; index++) {
          const payload = new FormData();
          for (const [key, value] of data) if (key !== "file") payload.append(key, value);
          payload.append("file", files[index]);
          setProgress(`${completed + index + 1}/${total}개 교재 저장 중…`);
          await readResponse(await fetch("/api/materials", { method: "POST", body: payload }));
        }
        setRetry(undefined); done(); close();
      } catch (e) {
        const saved = completed + index;
        setRetry({ data, files: files.slice(index), completed: saved, total });
        setProgress(`${saved}/${total}개 저장 완료. 남은 파일만 다시 시도합니다.`);
        setError((e as Error).message);
        if (index > 0) done();
      } finally { setBusy(false); }
    }}>
      <fieldset className="material-fields" disabled={busy || !!retry}>
        <label className="wide">자료 기관
          <select name="organization" value={org} required disabled={!!editing?.lesson_day && !linkLesson} onChange={e => setOrg(e.target.value)}>
            <option value="">기관 선택</option>{allowedOrgs.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {editing && <button type="button" className="secondary wide" onClick={() => setLinkLesson(v => !v)}>{linkLesson ? "기존 연결 유지" : "시간표 수업 연결·변경"}</button>}
        {linkLesson ? <MaterialLessonPicker key={org} organization={org} /> : editing?.lesson_day ? <>
          <p className="privacy-info wide">등록된 수업: {editing.lesson_day} · {editing.lesson_region} · {editing.lesson_track} · {editing.lesson_cohort}기 · {editing.lesson_class_name}</p>
          <label>과목<input readOnly value={editing.lesson_subject || editing.subject} /></label>
          <label>강사<input readOnly value={editing.lesson_instructor || ""} /></label>
          <input type="hidden" name="subject" value={editing.subject} />
          <input type="hidden" name="instructor_id" value={editing.instructor_id} />
          <p className="muted wide">파일만 교체하면 등록 당시 수업 정보는 유지됩니다. 수업을 바꾸려면 ‘시간표 수업 연결·변경’을 선택하세요.</p>
        </> : <>
          <p className="muted wide">기존 교재는 수업 미연결 상태로 보존했습니다. 위 버튼으로 실제 수업에 연결할 수 있습니다.</p>
          <label>교과목<select name="subject" defaultValue={editing?.subject} required><option value="">과목 선택</option>{options.subjects.map((s: Row) => <option key={s.name}>{s.name}</option>)}</select></label>
          <label>강사<select key={org} name="instructor_id" defaultValue={options.instructors.some((p: Row) => p.id === editing?.instructor_id && p.organization === org) ? editing?.instructor_id : ""} required><option value="">강사 선택</option>{options.instructors.filter((p: Row) => p.organization === org).map((p: Row) => <option key={p.id} value={p.id}>{p.name} · {orgLabel(p.organization)}</option>)}</select></label>
        </>}
        <label>{editing ? "작업자 이름" : "등록자 이름"}<input name={editing ? "actor" : "uploader"} required maxLength={80} /></label>
        {admin && <label>공개 여부<select name="published" defaultValue={editing?.published === false ? "false" : "true"}><option value="true">기관 권한에 따라 공개</option><option value="false">관리자만 보기</option></select></label>}
        {editing && <p className="wide file-name">현재 파일: {editing.filename}</p>}
        <label className="wide">{editing ? "교체 파일 (선택)" : "PDF · PPTX 파일"}
          <input name="file" type="file" accept=".pdf,.pptx" multiple={!editing} required={!editing} />
          {!editing && <small>파일을 여러 개 선택하면 같은 수업의 교재로 각각 등록합니다. 같은 파일명도 기존 자료를 덮어쓰지 않습니다.</small>}
        </label>
        <label className="wide">변경 사유<input name="reason" required maxLength={1000} /></label>
      </fieldset>
      {progress && <p className="muted wide" role="status">{progress}</p>}
      {error && <p className="error wide" role="alert">{error}</p>}
      <button disabled={busy}>{busy ? "저장 중…" : retry ? "남은 파일 다시 업로드" : editing ? "변경 저장" : "업로드"}</button>
    </form>
  </Modal>;
}
