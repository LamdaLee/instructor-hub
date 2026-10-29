import "server-only";
import { Pool } from "pg";
export type Result = { ok: boolean; code?: string; [key: string]: unknown };
type FunctionName =
  | "api_login"
  | "api_me"
  | "api_logout"
  | "api_read"
  | "api_save"
  | "api_material"
  | "api_org"
  | "api_signup"
  | "api_password";
const globalPool = globalThis as unknown as { hubPool?: Pool };
export async function callApi(
  name: FunctionName,
  args: unknown[],
): Promise<Result> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL 누락");
  const pool = (globalPool.hubPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: true }
        : undefined,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  }));
  const invocation = `hub.${name}(${args.map((_, i) => `$${i + 1}`).join(",")})`;
  // DB의 과거 함수 정의에 의존하지 않고 같은 왕복 안에서 먼저 세션을 확인한다.
  const protectedCall = ["api_read", "api_save", "api_material", "api_org", "api_password"].includes(name);
  const query = protectedCall
    ? `select case when coalesce((hub.api_me($1)->>'ok')::boolean,false) then ${invocation} else '{"ok":false,"code":"session_expired"}'::jsonb end result`
    : `select ${invocation} result`;
  const { rows } = await pool.query<{ result: Result }>(query, args);
  return rows[0].result;
}
