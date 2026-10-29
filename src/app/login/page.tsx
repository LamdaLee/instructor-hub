"use client";
import { useState } from "react";
import { post } from "@/lib/client";
export default function Login() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="login">
      <div className="brand">
        LG전자 K-뉴딜 아카데미 <small>관리자</small>
      </div>
      <h1>관리자 로그인</h1>
      <p>관리자 계정으로 일정과 자료를 관리합니다.</p>
      <a href="/">공개 화면으로</a>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const d = new FormData(e.currentTarget);
          try {
            const result = await post("login", {
              email: d.get("email"),
              password: d.get("password"),
            });
            if (result.operator?.role !== "admin") {
              await post("logout", {});
              throw new Error("관리자 권한이 필요합니다.");
            }
            location.assign("/admin");
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          이메일
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            maxLength={320}
          />
        </label>
        <label>
          비밀번호
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={200}
          />
        </label>
        <button disabled={busy}>{busy ? "확인 중…" : "로그인"}</button>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
