/**
 * Per-room plaintext cache keyed by CID. Pure UX optimization so we don't
 * refetch+decrypt every message on each page mount. Chain is still source
 * of truth for "what messages exist."
 *
 * Wiped when the room is closed.
 */
const KEY = (roomPda: string) => `sosui:plaintext:${roomPda}`;

function read(roomPda: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY(roomPda));
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function getPlaintext(roomPda: string, cid: string): string | null {
  return read(roomPda)[cid] ?? null;
}

export function setPlaintext(roomPda: string, cid: string, plaintext: string) {
  if (typeof window === "undefined") return;
  const obj = read(roomPda);
  obj[cid] = plaintext;
  localStorage.setItem(KEY(roomPda), JSON.stringify(obj));
}

export function wipePlaintext(roomPda: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY(roomPda));
}
