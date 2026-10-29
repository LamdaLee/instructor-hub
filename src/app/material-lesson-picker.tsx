"use client";
import DatePicker from "./date-picker";
import { useEffect, useState } from "react";
import { api, today, type Row } from "@/lib/client";
import { regionRank } from "@/lib/regions";
export default function MaterialLessonPicker({ organization }: { organization: string }) {
  const [day, setDay] = useState(today());
  const [region, setRegion] = useState("");
  const [track, setTrack] = useState("");
  const [slot, setSlot] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setRows([]); setSlot(""); setRegion(""); setTrack(""); setError(""); setLoading(false);
    if (!day || !organization) return;
    setLoading(true);
    api("material_lessons", { from: day, to: day, organization }).then(r => {
      if (active) setRows(r.rows || []);
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [day, organization]);
  useEffect(() => {
    const matches = rows.filter(r => r.region === region && r.track === track);
    setSlot(current => matches.length === 1 ? matches[0].id : matches.some(r => r.id === current) ? current : "");
  }, [rows, region, track]);
  const regions = [...new Set(rows.map(r => r.region as string))].sort((a, b) => regionRank(a) - regionRank(b));
  const tracks = [...new Set(rows.filter(r => r.region === region).map(r => r.track as string))].sort();
  const matches = rows.filter(r => r.region === region && r.track === track);
  const selected = matches.find(r => r.id === slot);
  return <>
    <label>수업 날짜<DatePicker  value={day} required onChange={e => { setDay(e.target.value); setRows([]); setRegion(""); setTrack(""); setSlot(""); }} /></label>
    <label>지역<select value={region} required onChange={e => { setRegion(e.target.value); setTrack(""); setSlot(""); }}>
      <option value="">지역 선택</option>{regions.map(r => <option key={r}>{r}</option>)}
    </select></label>
    <label>트랙<select value={track} required onChange={e => { setTrack(e.target.value); setSlot(""); }}>
      <option value="">트랙 선택</option>{tracks.map(t => <option key={t}>{t}</option>)}
    </select></label>
    <label>수업 선택 (기수·반)<select name="slot_id" value={slot} required onChange={e => setSlot(e.target.value)}>
      <option value="">수업 선택</option>{matches.map(r => <option key={r.id} value={r.id}>{r.cohort}기 · {r.class_name} · {r.subject} · {r.instructor_name}{r.period ? ` · ${r.period}` : ""}</option>)}
    </select></label>
    <label>과목<input name="subject" value={selected?.subject || ""} readOnly placeholder="수업 선택 시 자동 입력" /></label>
    <label>강사<input value={selected?.instructor_name || ""} readOnly placeholder="수업 선택 시 자동 입력" /></label>
    <input type="hidden" name="instructor_id" value={selected?.instructor_id || ""} />
    {loading && <p className="muted wide" role="status">해당 날짜의 수업을 불러오는 중…</p>}
    {error && <p className="error wide" role="alert">{error}</p>}
    {!organization && <p className="muted wide">자료 기관을 먼저 선택하세요.</p>}
    {!loading && organization && day && !rows.length && !error && <p className="muted wide">등록 가능한 수업이 없습니다. 과목과 강사가 배정된 시간표를 먼저 등록해 주세요.</p>}
    {matches.length > 1 && <p className="muted wide">같은 날짜·트랙의 수업이 여러 개입니다. 기수·반을 확인하고 선택하세요.</p>}
    <p className="muted wide">같은 수업에 여러 교재를 등록할 수 있습니다. 과목명이 같아도 날짜·기수·반으로 구분하며 등록 당시 정보를 보존합니다.</p>
  </>;
}
