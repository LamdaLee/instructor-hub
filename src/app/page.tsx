import { cookies } from "next/headers";
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
  return (
    <Suspense fallback={<p>불러오는 중…</p>}>
      <Hub
        operator={
          me?.ok ? (me.operator as { name: string; role: string }) : null
        }
      />
    </Suspense>
  );
}
