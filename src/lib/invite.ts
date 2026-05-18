/**
 * Invite envelope: shareable string that encodes everything a new member needs
 * to join a private room.
 *
 * Format: base64url(JSON({
 *   roomObjectId, roomId, name, ownerPubkeyHex, roomKey (hex)
 * }))
 *
 * NOTE: the room key is embedded directly. That's intentional for MVP — only
 * the link holder can decrypt, and the link should be passed over a secure
 * out-of-band channel (Signal, DM, etc). For Phase 2, replace with an ECDH
 * wrap targeting the joiner's identity key.
 */
export interface InvitePayload {
  roomObjectId: string;
  roomId: string; // hex of 16-byte room_id
  name: string;
  ownerPubkeyHex: string;
  roomKeyHex: string;
}

export function encodeInvite(p: InvitePayload): string {
  const json = JSON.stringify(p);
  if (typeof window === "undefined") return "";
  const b64 = btoa(json);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeInvite(s: string): InvitePayload | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "===".slice((b64.length + 3) % 4);
    const json = atob(padded);
    return JSON.parse(json) as InvitePayload;
  } catch {
    return null;
  }
}
