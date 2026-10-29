// 실제 도메인이 현재 커밋과 로그인 필수 API를 제공하는지 확인한다.
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
export async function verifyDeployment({ origin, expectedRevision, fetchImpl = fetch, log = console.log }) {
  const base = new URL(origin).origin;
  if (!expectedRevision) throw new Error("검증할 커밋이 필요합니다.");
  const get = path => fetchImpl(base + path, {
    signal: AbortSignal.timeout(15000), redirect: "manual", cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });
  const health = await get("/api/health");
  if (health.status !== 200) throw new Error("/api/health 응답 " + health.status);
  const status = await health.json();
  if (!status.ok) throw new Error("상태 API 점검 실패");
  if (status.revision !== expectedRevision) {
    throw new Error(`도메인이 최신 배포를 제공하지 않습니다. 기대 커밋: ${expectedRevision}, 도메인 커밋: ${status.revision || "버전 표시 없음"}. 현재 컨테이너의 버전과 Caddy 연결 대상을 확인하세요.`);
  }
  log("운영 점검 통과: 배포 버전", status.revision);
  const login = await get("/admin/login");
  if (login.status !== 200) throw new Error("/admin/login 응답 " + login.status);
  for (const path of ["/api/read?view=options", "/api/read?view=dashboard", "/api/read?view=materials"]) {
    const response = await get(path);
    if (response.status !== 401) throw new Error(path + " 비로그인 응답 " + response.status);
    log("운영 점검 통과: 비로그인 차단", path);
  }
  for (const path of ["/", "/admin", "/org"]) {
    const response = await get(path);
    const location = response.headers.get("location");
    const target = location ? new URL(location, base) : null;
    if (![303, 307, 308].includes(response.status) || target?.origin !== base || target.pathname !== "/admin/login") {
      throw new Error(path + " 로그인 보호를 확인하세요.");
    }
  }
  log("운영 점검 통과: 화면 로그인 보호");
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await verifyDeployment({ origin: process.env.APP_ORIGIN, expectedRevision: process.argv[2] });
}
