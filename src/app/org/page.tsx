import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { callApi } from "@/lib/db";
import { COOKIE, hashToken } from "@/lib/session";
import OrgDesk, { type OrgOperator } from "../org";
export const dynamic = "force-dynamic";
export default async function Page() {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw || !/^[0-9a-f]{64}$/.test(raw)) redirect("/admin/login");
  const me = await callApi("api_me", [hashToken(raw)]);
  if (!me.ok) redirect("/admin/login");
  return <OrgDesk operator={me.operator as OrgOperator} />;
}
