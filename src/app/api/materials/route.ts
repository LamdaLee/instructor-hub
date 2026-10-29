import { saveMaterial } from "@/lib/materials";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  return saveMaterial(req);
}
