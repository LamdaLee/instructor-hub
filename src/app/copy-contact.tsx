"use client";
import { useState } from "react";

export default function CopyContact({ value, label }: { value?: string; label: string }) {
  const [status, setStatus] = useState("");
  if (!value) return <span>미등록</span>;
  return <span className="copy-contact">
    <span>{value}</span>
    <button type="button" className="secondary" aria-label={`${label} 복사`} onClick={async () => {
      try {
        await navigator.clipboard.writeText(value);
        setStatus("복사했습니다.");
      } catch {
        setStatus("복사하지 못했습니다. 연락처를 선택해 복사해 주세요.");
      }
    }}>복사</button>
    <small role="status">{status}</small>
  </span>;
}
