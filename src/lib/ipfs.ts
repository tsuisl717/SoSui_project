/**
 * Blob storage client. Talks to /api/blob — which itself can be backed by
 * an in-memory map (dev), filesystem (single VPS), or real IPFS via Pinata.
 *
 * Same content-addressed contract: upload returns a CID, fetch returns the
 * envelope or null.
 */
import { toBase64, fromBase64 } from "@/lib/crypto";

export interface CiphertextEnvelope {
  v: 1;
  alg: "AES-GCM-256";
  iv: string; // base64
  ct: string; // base64
  sender: string; // wallet pubkey (base58)
  ts: number;
}

export async function uploadEnvelope(env: CiphertextEnvelope): Promise<string> {
  const res = await fetch("/api/blob", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(env),
  });
  if (!res.ok) {
    throw new Error(`blob upload failed (${res.status}): ${await res.text()}`);
  }
  const { cid } = (await res.json()) as { cid: string };
  return cid;
}

export async function fetchEnvelope(
  cid: string,
  timeoutMs = 5000
): Promise<CiphertextEnvelope | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`/api/blob/${encodeURIComponent(cid)}`, {
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as CiphertextEnvelope;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function envelope(
  ct: Uint8Array,
  iv: Uint8Array,
  sender: string
): CiphertextEnvelope {
  return {
    v: 1,
    alg: "AES-GCM-256",
    iv: toBase64(iv),
    ct: toBase64(ct),
    sender,
    ts: Date.now(),
  };
}

export function decodeEnvelope(env: CiphertextEnvelope): {
  ct: Uint8Array;
  iv: Uint8Array;
} {
  return { ct: fromBase64(env.ct), iv: fromBase64(env.iv) };
}
