import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyDeployment } from "../scripts/verify-deployment.mjs";
const revision = "f".repeat(40);
function server({ live = revision, anonymous = 401, redirect = "/admin/login" } = {}) {
  return async url => {
    const path = new URL(url).pathname;
    if (path === "/api/health") return Response.json({ ok: true, ...(live === null ? {} : { revision: live }) });
    if (path === "/admin/login") return new Response("login");
    if (path === "/api/read") return Response.json({ ok: anonymous === 200 }, { status: anonymous });
    return new Response(null, { status: 307, headers: { Location: redirect } });
  };
}
const verify = options => verifyDeployment({ origin: "https://hub.example.invalid", expectedRevision: revision, fetchImpl: server(options), log: () => {} });
test("도메인이 현재 커밋과 로그인 보호를 제공하면 배포 점검 통과", async () => {
  await verify();
});
test("건강 상태가 정상이어도 이전 커밋 또는 버전 없는 컨테이너는 배포 완료로 처리하지 않음", async () => {
  await assert.rejects(verify({ live: "a".repeat(40) }), /최신 배포/);
  await assert.rejects(verify({ live: null }), /버전 표시 없음/);
});
test("현재 커밋이라도 비로그인 조회나 다른 사이트로 로그인 이동 시 배포 점검 실패", async () => {
  await assert.rejects(verify({ anonymous: 200 }), /비로그인 응답 200/);
  await assert.rejects(verify({ redirect: "https://other.example.invalid/admin/login" }), /로그인 보호/);
});
