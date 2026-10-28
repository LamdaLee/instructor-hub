import { NextResponse } from "next/server";
import { callApi } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await callApi("api_me", [Buffer.alloc(32)]);
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
