/**
 * Encrypt → blob → chain on send; chain → blob → decrypt on receive.
 *
 * Source of truth = chain (Room object state + MessageAdded events).
 * Blob storage   = encrypted envelopes, content-addressed by CID.
 * Local cache    = plaintext only, for UX. Wiped on room close.
 */
import {
  decryptMessage,
  encryptMessage,
  hashBytes,
  importRoomKey,
  loadRoomKey,
} from "@/lib/crypto";
import {
  decodeEnvelope,
  envelope,
  fetchEnvelope,
  uploadEnvelope,
} from "@/lib/ipfs";
import { buildAddMessageTx } from "@/lib/program";
import { getPlaintext, setPlaintext } from "@/lib/plaintextCache";
import type { Transaction } from "@mysten/sui/transactions";

export interface SendResult {
  cid: string;
  digest: string;
}

export async function sendMessage(args: {
  roomObjectId: string;
  sender: string;
  signAndExecute: (tx: Transaction) => Promise<{ digest: string }>;
  plaintext: string;
}): Promise<SendResult> {
  const raw = loadRoomKey(args.roomObjectId);
  if (!raw) throw new Error("Room key missing — you may not be a member");

  const key = await importRoomKey(raw);
  const { ciphertext, iv } = await encryptMessage(key, args.plaintext);

  const env = envelope(ciphertext, iv, args.sender);
  const cid = await uploadEnvelope(env);

  const contentHash = await hashBytes(ciphertext);
  const tx = buildAddMessageTx({
    roomObjectId: args.roomObjectId,
    cid,
    contentHash,
  });
  const { digest } = await args.signAndExecute(tx);

  // cache plaintext so we don't decrypt our own message after refresh
  setPlaintext(args.roomObjectId, cid, args.plaintext);

  return { cid, digest };
}

/**
 * Return plaintext for a CID. Checks local cache first; otherwise fetches the
 * encrypted envelope from blob storage and decrypts with the room key.
 * Returns null if the key is gone or the blob is unavailable.
 */
export async function decryptCid(
  roomObjectId: string,
  cid: string,
): Promise<string | null> {
  const cached = getPlaintext(roomObjectId, cid);
  if (cached !== null) return cached;

  const raw = loadRoomKey(roomObjectId);
  if (!raw) return null;

  const env = await fetchEnvelope(cid);
  if (!env) return null;

  try {
    const key = await importRoomKey(raw);
    const { ct, iv } = decodeEnvelope(env);
    const plaintext = await decryptMessage(key, ct, iv);
    setPlaintext(roomObjectId, cid, plaintext);
    return plaintext;
  } catch {
    return null;
  }
}
