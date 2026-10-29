import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { callApi } from "@/lib/db";
import { COOKIE, hashToken } from "@/lib/session";
import Hub from "./hub";
export const dynamic = "force-dynamic";
export default async function Page() {
  const raw = (await cookies()).get(COOKIE)?.value;
  const me =
    raw && /^[0-9a-f]{64}$/.test(raw)
      ? await callApi("api_me", [hashToken(raw)])
      : null;
  // 로그인하지 않으면 어떤 정보도 보여주지 않는다.
  if (!me?.ok) redirect("/admin/login");
  return (
    <Suspense fallback={<p>불러오는 중…</p>}>
      <Hub
        operator={me.operator as { name: string; role: string }}
      />
    </Suspense>
  );
}
