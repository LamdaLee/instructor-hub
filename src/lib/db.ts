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
  const { rows } = await pool.query<{ result: Result }>(
    `select hub.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) result`,
    args,
  );
  return rows[0].result;
}
