import {
  saveMaterial,
  download,
  token,
  sameOrigin,
  fail,
} from "@/lib/materials";
import { callApi } from "@/lib/db";
import { isUuid } from "@/lib/input.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(req: Request, ctx: Context) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return fail("bad_request");
  return download(req, id);
}
export async function POST(req: Request, ctx: Context) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return fail("bad_request");
  return saveMaterial(req, id);
}
export async function DELETE(req: Request, ctx: Context) {
  if (!sameOrigin(req)) return fail("forbidden", 403);
  const { id } = await ctx.params;
  if (!isUuid(id)) return fail("bad_request");
  let data;
  try {
    data = await req.json();
  } catch {
    return fail("bad_request");
  }
  if (
    typeof data.actor !== "string" ||
    !data.actor.trim() ||
    data.actor.length > 80 ||
    typeof data.reason !== "string" ||
    !data.reason.trim() ||
    data.reason.length > 1000
  )
    return fail("bad_request");
  const r = await callApi("api_material", [
    token(req),
    "delete",
    { id, actor: data.actor.trim(), reason: data.reason.trim() },
  ]);
  return Response.json(r, {
    status: r.ok
      ? 200
      : r.code === "not_found"
        ? 404
        : r.code === "bad_request"
          ? 400
          : 403,
  });
}
