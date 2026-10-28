import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { callApi } from "@/lib/db";
import { COOKIE, hashToken } from "@/lib/session";
import Hub from "./hub";
export const dynamic = "force-dynamic";
export default async function Page() {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw || !/^[0-9a-f]{64}$/.test(raw)) redirect("/login");
  const me = await callApi("api_me", [hashToken(raw)]);
  if (!me.ok) redirect("/login");
  return (
    <Suspense fallback={<p>불러오는 중…</p>}>
      <Hub operator={me.operator as { name: string; role: string }} />
    </Suspense>
  );
}
