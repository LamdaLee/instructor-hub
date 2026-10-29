"use client";
import { useRef, useState, type InputHTMLAttributes, type ChangeEvent } from "react";
import { today } from "@/lib/client";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;
const monthStart = (day: string) => day.slice(0, 7) + "-01";
export default function DatePicker(props: Props) {
  const input = useRef<HTMLInputElement>(null), dialog = useRef<HTMLDialogElement>(null);
  const [local, setLocal] = useState(String(props.defaultValue || ""));
  const selected = props.value === undefined ? local : String(props.value || "");
  const [month, setMonth] = useState(monthStart(selected || today()));
  const [year, monthIndex] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthIndex - 1, 1)).getUTCDay();
  const count = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const open = () => {
    setMonth(monthStart(selected || today()));
    dialog.current?.showModal();
  };
  const choose = (value: string) => {
    if (input.current) {
      input.current.value = value;
      setLocal(value);
      props.onChange?.({ target: input.current, currentTarget: input.current } as ChangeEvent<HTMLInputElement>);
    }
    dialog.current?.close();
  };
  const shift = (amount: number) => {
    const date = new Date(Date.UTC(year, monthIndex - 1 + amount, 1));
    setMonth(date.toISOString().slice(0, 10));
  };
  const unavailable = (day: string) => !!(props.min && day < String(props.min) || props.max && day > String(props.max));
  return <span className="date-picker">
    <input {...props} ref={input} type="date" className="date-native" tabIndex={-1} onInvalid={event => { event.preventDefault(); open(); }} />
    <button type="button" className="date-trigger" disabled={props.disabled} aria-label={props["aria-label"] || "날짜 선택"} aria-haspopup="dialog" onClick={event => { event.preventDefault(); open(); }}>
      <span>{selected ? selected.replaceAll("-", ". ") + "." : "날짜 선택"}</span><span aria-hidden="true">▦</span>
    </button>
    <dialog ref={dialog} className="calendar-dialog" aria-label="날짜 선택 달력" onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.current?.close(); } }}>
      <div className="calendar-heading"><strong>날짜 선택</strong><button type="button" className="secondary" aria-label="달력 닫기" onClick={() => dialog.current?.close()}>닫기</button></div>
      <div className="calendar-month"><button type="button" className="secondary" aria-label="이전 달" onClick={() => shift(-1)}>‹</button><span aria-live="polite">{year}년 {monthIndex}월</span><button type="button" className="secondary" aria-label="다음 달" onClick={() => shift(1)}>›</button></div>
      <div className="calendar-grid">
        {["일", "월", "화", "수", "목", "금", "토"].map(day => <small key={day}>{day}</small>)}
        {Array.from({ length: start }, (_, index) => <span key={`empty-${index}`} />)}
        {Array.from({ length: count }, (_, index) => {
          const day = `${month.slice(0, 7)}-${String(index + 1).padStart(2, "0")}`;
          return <button type="button" key={day} disabled={unavailable(day)} className={day === selected ? "selected" : day === today() ? "today" : ""} aria-label={`${year}년 ${monthIndex}월 ${index + 1}일`} aria-pressed={day === selected} aria-current={day === today() ? "date" : undefined} onClick={() => choose(day)}>{index + 1}</button>;
        })}
      </div>
      <div className="calendar-footer"><button type="button" className="secondary" disabled={unavailable(today())} onClick={() => choose(today())}>오늘</button>{!props.required && <button type="button" className="secondary" onClick={() => choose("")}>날짜 지우기</button>}</div>
    </dialog>
  </span>;
}
