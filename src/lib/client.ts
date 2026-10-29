export type Row = Record<string, any>;
export const messages: Record<string, string> = {
  venue_overlap: "이 반에 이미 등록된 강의장 예외 기간과 겹칩니다. 기간을 확인하세요.",
  lesson_required: "날짜·지역·트랙을 선택하고 연결할 수업을 골라주세요.",
  lesson_unavailable: "연결할 수업을 찾을 수 없거나 접근 권한이 없습니다. 시간표를 다시 선택하세요.",
  invalid_credentials: "이메일 또는 비밀번호를 확인하세요.",
  rate_limited: "요청이 많습니다. 15분 뒤 다시 시도하세요.",
  session_expired: "로그인이 만료되었습니다.",
  forbidden: "이 작업을 수행할 권한이 없습니다.",
  overwrite_required:
    "같은 반·날짜의 시간표가 있습니다. 미리보기를 확인하고 덮어쓰기를 선택하세요.",
  bad_request: "입력값을 확인하세요.",
  duplicate: "같은 내용으로 처리 대기 중인 신청이나 계정이 이미 있습니다.",
  already_decided: "이미 처리된 신청입니다. 목록을 새로고침하세요.",
  last_admin: "마지막 활성 관리자는 비활성화하거나 권한을 변경할 수 없습니다.",
  weak_password: "비밀번호는 10자 이상, UTF-8 기준 72바이트 이하여야 합니다.",
  invalid_file: "PDF 또는 PPTX 파일 형식과 내용을 확인하세요.",
  file_too_large: "파일은 50 MB 이하로 올려주세요.",
  storage_full: "자료실 저장 공간이 부족합니다. 관리자에게 문의하세요.",
  server_error: "요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요.",
};
let redirecting = false;
export function redirectToLogin() {
  if (typeof window === "undefined" || redirecting || ["/admin/login", "/login", "/signup"].includes(window.location.pathname)) return;
  redirecting = true;
  window.location.replace("/admin/login?expired=1&next=" + encodeURIComponent(window.location.pathname + window.location.search));
}
export async function readResponse(res: Response) {
  const result = await res.json();
  if (!result.ok) {
    if (result.code === "session_expired") redirectToLogin();
    throw new Error(messages[result.code] ?? messages.server_error);
  }
  return result;
}

export async function api(view: string, filter: Record<string, string> = {}) {
  const query = new URLSearchParams({
    view,
    ...Object.fromEntries(
      Object.entries(filter).filter(([, value]) => value !== ""),
    ),
  });
  const res = await fetch("/api/read?" + query, { cache: "no-store" });
  return readResponse(res);
}
export async function post(action: string, data: unknown) {
  const res = await fetch("/api/" + action, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return readResponse(res);
}
export function today() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(
    new Date(),
  );
}
export function moveDay(day: string, n: number) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function monday(day: string) {
  const d = new Date(day + "T00:00:00Z");
  return moveDay(day, -((d.getUTCDay() + 6) % 7));
}

export function classLabel(c: Row): string {
  return `${c.region} ${c.track} ${c.cohort}기 · ${c.source_code ?? c.name}`;
}
