import { NextRequest, NextResponse } from "next/server";
import { backend } from "@/lib/blob-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Real IPFS CIDs start with Qm (v0) or bafy/bafk (v1). Anything else
// (mem_, file_, …) is a legacy local-backend id that won't exist on Pinata,
// so short-circuit to skip a multi-second gateway round-trip.
function isLikelyIpfsCid(cid: string): boolean {
  return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z0-9]+|bafk[a-z0-9]+)$/i.test(cid);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { cid: string } }
) {
  const cid = params.cid;
  const usingPinata = !!process.env.PINATA_JWT;
  if (usingPinata && !isLikelyIpfsCid(cid)) {
    return NextResponse.json(
      { error: "legacy non-IPFS cid (stored in old backend)" },
      { status: 404 }
    );
  }

  const b = await backend().get(cid);
  if (!b) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return new NextResponse(b, {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
