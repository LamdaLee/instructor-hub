"use client";
import { post } from "@/lib/client";
export default function AccountMenu({ name }: { name: string }) {
  return <details className="account-menu">
    <summary>{name} <span aria-hidden="true">⌄</span><span className="sr-only"> 계정 메뉴</span></summary>
    <div className="account-panel">
      <a href="/password">비밀번호 변경</a>
      <button type="button" onClick={async () => {
        try { await post("logout", {}); } finally { location.assign("/admin/login"); }
      }}>로그아웃</button>
    </div>
  </details>;
}
