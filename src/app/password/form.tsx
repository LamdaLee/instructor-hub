"use client";
import { useState } from "react";
import { post } from "@/lib/client";
export default function PasswordForm() {
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <main className="login">
      <div className="brand">
        LG전자 K-뉴딜 아카데미 <small>계정</small>
      </div>
      <h1>비밀번호 변경</h1>
      <p>
        <a href="/">포털로 돌아가기</a>
      </p>
      {done ? (
        <p role="status">
          비밀번호를 변경했습니다. 다른 기기의 로그인은 만료되었습니다.
        </p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            const d = new FormData(e.currentTarget);
            if (d.get("next") !== d.get("confirm")) {
              setError("새 비밀번호 확인이 일치하지 않습니다.");
              return;
            }
            setBusy(true);
            try {
              await post("password", {
                current: d.get("current"),
                next: d.get("next"),
              });
              setDone(true);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            현재 비밀번호
            <input
              name="current"
              type="password"
              required
              maxLength={200}
              autoComplete="current-password"
            />
          </label>
          <label>
            새 비밀번호
            <input
              name="next"
              type="password"
              required
              minLength={10}
              maxLength={72}
              autoComplete="new-password"
            />
            <small>10자 이상, 현재 비밀번호와 달라야 합니다.</small>
          </label>
          <label>
            새 비밀번호 확인
            <input
              name="confirm"
              type="password"
              required
              minLength={10}
              maxLength={72}
              autoComplete="new-password"
            />
          </label>
          <button disabled={busy}>{busy ? "변경 중…" : "비밀번호 변경"}</button>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </form>
      )}
    </main>
  );
}
