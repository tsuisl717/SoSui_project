import { NextRequest, NextResponse } from "next/server";
import { backend } from "@/lib/blob-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 256 * 1024; // 256 KB per blob

export async function POST(req: NextRequest) {
  const body = await req.text();
  if (body.length > MAX_BODY) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }
  try {
    JSON.parse(body); // validate envelope shape is JSON
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }
  try {
    const cid = await backend().put(body);
    return NextResponse.json({ cid });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "put failed" }, { status: 500 });
  }
}
