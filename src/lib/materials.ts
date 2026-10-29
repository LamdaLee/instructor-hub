import "server-only";
import { mkdir, statfs, writeFile, unlink, open } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { callApi } from "./db";
import { COOKIE, hashToken } from "./session";
export const MAX_FILE = 50 * 1024 * 1024;
const directory = () => process.env.MATERIALS_DIR || "/app/materials";
export function token(req: Request) {
  const raw = req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  return raw && /^[0-9a-f]{64}$/.test(raw) ? hashToken(raw) : null;
}
export function sameOrigin(req: Request) {
  try {
    return (
      req.headers.get("origin") ===
      new URL(
        process.env.APP_ORIGIN ||
          (process.env.NODE_ENV === "production" ? "" : req.url),
      ).origin
    );
  } catch {
    return false;
  }
}
export function fail(code: string, status = 400) {
  return Response.json(
    { ok: false, code },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export async function remove(key: string) {
  if (/^[0-9a-f-]{36}$/.test(key))
    await unlink(join(directory(), key)).catch(() => {});
}
let activeUploads = 0;
export async function saveMaterial(req: Request, id?: string) {
  if (activeUploads >= 2) return fail("rate_limited", 429);
  activeUploads++;
  try {
    return await storeMaterial(req, id);
  } finally {
    activeUploads--;
  }
}
async function storeMaterial(req: Request, id?: string) {
  if (!sameOrigin(req)) return fail("forbidden", 403);
  const auth = token(req);
  // 비로그인 업로드는 본문을 읽기 전에 거절한다.
  const me = auth ? await callApi("api_me", [auth]) : null;
  if (!me?.ok) return fail("session_expired", 401);
  if (id) {
    const existing = await callApi("api_material", [auth, "file", { id }]);
    if (!existing.ok) return fail("not_found", 404);
  }
  // Content-Length 외에 읽는 중에도 요청 크기를 제한한다.
  if (Number(req.headers.get("content-length")) > MAX_FILE + 128 * 1024)
    return fail("file_too_large", 413);
  const reader = req.body?.getReader();
  if (!reader) return fail("bad_request");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const r = await reader.read();
    if (r.done) break;
    size += r.value.byteLength;
    if (size > MAX_FILE + 128 * 1024) {
      await reader.cancel();
      return fail("file_too_large", 413);
    }
    chunks.push(r.value);
  }
  const body = Buffer.concat(chunks);
  let data: FormData;
  try {
    data = await new Response(body, {
      headers: { "Content-Type": req.headers.get("content-type") || "" },
    }).formData();
  } catch {
    return fail("bad_request");
  }
  const subject = String(data.get("subject") || "").trim(),
    instructor_id = String(data.get("instructor_id") || ""),
    uploader = String(data.get("uploader") || "").trim(),
    reason = String(data.get("reason") || "").trim(),
    actor = String(data.get("actor") || data.get("uploader") || "").trim(),
    organization = String(data.get("organization") || "").trim();
  const operator = me.operator as { role: string; organization?: string };
  if (organization && !["CLIPS", "aSSIST", "LGE", "LAB4DX"].includes(organization)) return fail("bad_request");
  if (organization && operator.role !== "admin" && !["LGE", "LAB4DX"].includes(operator.organization || "") && organization !== operator.organization) return fail("forbidden", 403);
  if (
    !subject ||
    subject.length > 200 ||
    !instructor_id.match(/^[0-9a-f-]{36}$/i) ||
    !actor ||
    actor.length > 80 ||
    !reason ||
    reason.length > 1000 ||
    (!id && (!uploader || uploader.length > 80))
  )
    return fail("bad_request");
  const file = data.get("file");
  let key: string | undefined;
  const meta: Record<string, unknown> = {
    id,
    subject,
    instructor_id,
    ...(organization ? { organization } : {}),
    uploader,
    actor,
    reason,
    published: data.get("published") !== "false",
    ip: req.headers.get("x-real-ip") || "unknown",
  };
  try {
    if (file instanceof File && file.size) {
      if (file.size > MAX_FILE) return fail("file_too_large", 413);
      const bytes = Buffer.from(await file.arrayBuffer());
      const pdf =
        /\.pdf$/i.test(file.name) &&
        bytes.subarray(0, 5).toString() === "%PDF-";
      const pptx =
        /\.pptx$/i.test(file.name) &&
        bytes.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4])) &&
        bytes.includes(Buffer.from("[Content_Types].xml")) &&
        bytes.includes(Buffer.from("ppt/"));
      if (!pdf && !pptx) return fail("invalid_file");
      if (file.name.length > 240) return fail("bad_request");
      await mkdir(directory(), { recursive: true, mode: 0o700 });
      const disk = await statfs(directory());
      if (disk.bavail * disk.bsize < file.size + 200 * 1024 * 1024)
        return fail("storage_full", 507);
      key = randomUUID();
      await writeFile(join(directory(), key), bytes, {
        flag: "wx",
        mode: 0o600,
      });
      Object.assign(meta, {
        filename: file.name,
        disk_key: key,
        bytes: file.size,
        mime: pdf
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });
    } else if (!id) return fail("invalid_file");
    const result = await callApi("api_material", [
      auth,
      id ? "update" : "upload",
      meta,
    ]);
    if (!result.ok) {
      if (key) await remove(key);
      return fail(
        result.code || "server_error",
        result.code === "forbidden"
          ? 403
          : result.code === "not_found"
            ? 404
          : result.code === "session_expired"
            ? 401
          : result.code === "rate_limited"
            ? 429
            : result.code === "storage_full"
              ? 507
              : 400,
      );
    }
    if (result.previous_key) await remove(String(result.previous_key));
    return Response.json(
      { ok: true, id: result.id },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (key) await remove(key);
    console.error(
      "교재 저장 실패",
      (error as { code?: string }).code || "internal",
    );
    return fail("server_error", 500);
  }
}
export async function download(req: Request, id: string) {
  const result = await callApi("api_material", [token(req), "file", { id }]);
  if (!result.ok)
    return result.code === "session_expired"
      ? fail("session_expired", 401)
      : fail("not_found", 404);
  const m = result.material as {
    disk_key: string;
    filename: string;
    mime: string;
    bytes: number;
  };
  if (!/^[0-9a-f-]{36}$/.test(m.disk_key)) return fail("not_found", 404);
  try {
    const fd = await open(join(directory(), m.disk_key), "r");
    const stream = fd.readableWebStream({ autoClose: true });
    return new Response(stream as ReadableStream, {
      headers: {
        "Content-Type": m.mime,
        "Content-Length": String(m.bytes),
        "Content-Disposition": `attachment; filename="material.${m.mime === "application/pdf" ? "pdf" : "pptx"}"; filename*=UTF-8''${encodeURIComponent(m.filename).replace(/'/g, "%27")}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return fail("not_found", 404);
  }
}
