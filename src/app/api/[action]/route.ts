import { NextResponse } from "next/server";
import { callApi, type Result } from "@/lib/db";
import { COOKIE, hashToken, newToken } from "@/lib/session";
import { validFilter, validSave, csvCell } from "@/lib/input.mjs";
export const dynamic = "force-dynamic";
const statuses: Record<string, number> = {
  bad_request: 400,
  invalid_credentials: 401,
  session_expired: 401,
  forbidden: 403,
  not_found: 404,
  rate_limited: 429,
  overwrite_required: 409,
  last_admin: 409,
  weak_password: 422,
};
function response(r: Result) {
  return NextResponse.json(r, {
    status: r.ok ? 200 : (statuses[r.code ?? ""] ?? 500),
    headers: { "Cache-Control": "no-store" },
  });
}
function cookie(req: Request) {
  const raw = req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  return raw && /^[0-9a-f]{64}$/.test(raw) ? raw : null;
}
function originAllowed(req: Request) {
  try {
    const expected =
      process.env.APP_ORIGIN ||
      (process.env.NODE_ENV === "production" ? "" : new URL(req.url).origin);
    return !!expected && req.headers.get("origin") === new URL(expected).origin;
  } catch {
    return false;
  }
}
async function handle(
  req: Request,
  ctx: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await ctx.params;
    const url = new URL(req.url);
    const mutation = req.method === "POST";
    if (mutation && !originAllowed(req))
      return response({ ok: false, code: "forbidden" });
    if (
      mutation &&
      !req.headers.get("content-type")?.startsWith("application/json")
    )
      return response({ ok: false, code: "bad_request" });
    let data: Record<string, unknown> = {};
    if (mutation) {
      const text = await req.text();
      if (text.length > 1_000_000)
        return response({ ok: false, code: "bad_request" });
      try {
        data = JSON.parse(text);
        if (!data || typeof data !== "object" || Array.isArray(data)) throw 0;
      } catch {
        return response({ ok: false, code: "bad_request" });
      }
    }
    if (action === "login" && mutation) {
      if (
        typeof data.email !== "string" ||
        typeof data.password !== "string" ||
        data.email.length > 320 ||
        data.password.length > 200
      )
        return response({ ok: false, code: "bad_request" });
      const raw = newToken();
      const result = await callApi("api_login", [
        data.email,
        data.password,
        hashToken(raw),
        req.headers.get("x-real-ip") ?? "unknown",
      ]);
      const res = response(result);
      if (result.ok)
        res.cookies.set(COOKIE, raw, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/",
          maxAge: 28800,
        });
      return res;
    }
    const raw = cookie(req);
    if (!raw) return response({ ok: false, code: "session_expired" });
    const token = hashToken(raw);
    if (action === "me" && !mutation)
      return response(await callApi("api_me", [token]));
    if (action === "logout" && mutation) {
      const res = response(await callApi("api_logout", [token]));
      res.cookies.set(COOKIE, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 0,
      });
      return res;
    }
    if (action === "save" && mutation) {
      if (typeof data.kind !== "string" || !validSave(data.kind, data.data))
        return response({ ok: false, code: "bad_request" });
      return response(await callApi("api_save", [token, data.kind, data.data]));
    }
    if (["read", "export"].includes(action) && !mutation) {
      const filter = Object.fromEntries(
        [...url.searchParams].filter(([k]) => k !== "view"),
      );
      if (!validFilter(filter))
        return response({ ok: false, code: "bad_request" });
      const view =
        action === "export" ? "export" : url.searchParams.get("view");
      if (
        !view ||
        ![
          "options",
          "slots",
          "dashboard",
          "reports",
          "export",
          "instructors",
          "instructor",
          "operators",
          "audit",
        ].includes(view)
      )
        return response({ ok: false, code: "bad_request" });
      const result = await callApi("api_read", [token, view, filter]);
      if (!result.ok || action !== "export") return response(result);
      const columns = [
        "day",
        "class_name",
        "region",
        "cohort",
        "track",
        "subject",
        "instructor_name",
        "organization",
        "place",
        "note",
        ...(filter.contacts === "true" ? ["phone", "email"] : []),
      ];
      const labels = [
        "날짜",
        "반",
        "지역",
        "기수",
        "트랙",
        "과목",
        "강사",
        "기관",
        "장소",
        "메모",
        ...(filter.contacts === "true" ? ["연락처", "이메일"] : []),
      ];
      const rows = result.rows as Record<string, unknown>[];
      const text =
        "\ufeff" +
        [
          labels.map(csvCell).join(","),
          ...rows.map((r) => columns.map((k) => csvCell(r[k])).join(",")),
        ].join("\r\n");
      return new Response(text, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="hub-schedules.csv"',
          "Cache-Control": "no-store",
        },
      });
    }
    return response({ ok: false, code: "bad_request" });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code && ["22", "23"].some((prefix) => code.startsWith(prefix)))
      return response({ ok: false, code: "bad_request" });
    console.error("허브 API 실패", code ?? "internal");
    return response({ ok: false, code: "server_error" });
  }
}
export const GET = handle;
export const POST = handle;
