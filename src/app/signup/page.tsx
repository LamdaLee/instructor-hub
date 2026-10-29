"use client";
import { orgLabel } from "@/lib/organizations";
import { useState } from "react";
import { post } from "@/lib/client";
export default function Signup() {
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <main className="login">
      <div className="brand">
        LG전자 K-뉴딜 아카데미 <small>기관 계정</small>
      </div>
      <h1>기관 계정 가입 신청</h1>
      <p>
        이메일·이름·소속 기관과 비밀번호를 입력해 가입을 요청하세요. Lab4dx
        담당자가 승인하면 이 이메일과 비밀번호로 로그인합니다.
      </p>
      <p>
        <a href="/admin/login">로그인으로 돌아가기</a>
      </p>
      {done ? (
        <p role="status">
          가입 요청을 접수했습니다. Lab4dx 담당자가 승인하면 입력한 이메일과
          비밀번호로 로그인할 수 있습니다. 이미 계정이 있다면 기존 비밀번호로
          로그인하세요.
        </p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            const d = new FormData(e.currentTarget);
            if (d.get("password") !== d.get("confirm")) {
              setError("비밀번호 확인이 일치하지 않습니다.");
              return;
            }
            setBusy(true);
            try {
              await post("signup", {
                name: d.get("name"),
                email: d.get("email"),
                organization: d.get("organization"),
                password: d.get("password"),
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
            이메일
            <input
              name="email"
              type="email"
              required
              maxLength={320}
              autoComplete="email"
            />
          </label>
          <label>
            이름
            <input name="name" required maxLength={80} autoComplete="name" />
          </label>
          <label>
            소속 기관
            <select name="organization" required defaultValue="">
              <option value="" disabled>
                선택
              </option>
              <option value="aSSIST">aSSIST</option>
              <option value="CLIPS">CLIPS</option>
              <option value="LGE">LGE</option>
              <option value="LAB4DX">Lab4dx</option>
            </select>
          </label>
          <label>
            비밀번호
            <input
              name="password"
              type="password"
              required
              minLength={10}
              maxLength={72}
              autoComplete="new-password"
            />
            <small>10자 이상</small>
          </label>
          <label>
            비밀번호 확인
            <input
              name="confirm"
              type="password"
              required
              minLength={10}
              maxLength={72}
              autoComplete="new-password"
            />
          </label>
          <button disabled={busy}>{busy ? "접수 중…" : "가입 요청"}</button>
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
