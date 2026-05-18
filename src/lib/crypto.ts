/**
 * Client-side encryption primitives for ephemeral chat rooms.
 *
 *  - Each room has a symmetric AES-GCM 256-bit "room key".
 *  - Room key is generated in the owner's browser. It NEVER leaves the client
 *    in plaintext.
 *  - To share, the owner wraps the room key for each member with x25519
 *    public-key crypto (ECDH via tweetnacl box).
 *  - When the room is closed on-chain, every client wipes its copy from
 *    localStorage. Messages on IPFS become permanent garbage.
 */
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";

const SUBTLE = typeof window !== "undefined" ? window.crypto?.subtle : undefined;

// ---------- symmetric room key (AES-GCM 256) ----------

export async function generateRoomKey(): Promise<CryptoKey> {
  if (!SUBTLE) throw new Error("WebCrypto unavailable");
  return SUBTLE.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportRoomKey(key: CryptoKey): Promise<Uint8Array> {
  if (!SUBTLE) throw new Error("WebCrypto unavailable");
  const raw = await SUBTLE.exportKey("raw", key);
  return new Uint8Array(raw);
}

/**
 * Public-room key — deterministic 32 bytes derived from the Room object ID.
 * Legacy fallback for pre-v4 rooms only; current rooms publish a random AES
 * key on chain at create_room time and clients read it from there.
 */
export async function derivePublicRoomKey(roomObjectId: string): Promise<Uint8Array> {
  if (!SUBTLE) throw new Error("WebCrypto unavailable");
  const h = await SUBTLE.digest(
    "SHA-256",
    new TextEncoder().encode(`sosui-public-room:${roomObjectId}`)
  );
  return new Uint8Array(h);
}

export async function importRoomKey(raw: Uint8Array): Promise<CryptoKey> {
  if (!SUBTLE) throw new Error("WebCrypto unavailable");
  return SUBTLE.importKey(
    "raw",
    raw,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encryptMessage(
  key: CryptoKey,
  plaintext: string
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  if (!SUBTLE) throw new Error("WebCrypto unavailable");
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const enc = await SUBTLE.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return { ciphertext: new Uint8Array(enc), iv };
}

export async function decryptMessage(
  key: CryptoKey,
  ciphertext: Uint8Array,
  iv: Uint8Array
): Promise<string> {
  if (!SUBTLE) throw new Error("WebCrypto unavailable");
  const dec = await SUBTLE.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(dec);
}

export async function hashBytes(data: Uint8Array): Promise<Uint8Array> {
  if (!SUBTLE) throw new Error("WebCrypto unavailable");
  const h = await SUBTLE.digest("SHA-256", data);
  return new Uint8Array(h);
}

// ---------- asymmetric wrap/unwrap (x25519 box) ----------

export interface KeyPairHex {
  publicKey: string; // hex
  secretKey: string; // hex (local only)
}

export function generateKeyPair(): KeyPairHex {
  const kp = nacl.box.keyPair();
  return {
    publicKey: toHex(kp.publicKey),
    secretKey: toHex(kp.secretKey),
  };
}

export function wrapRoomKey(
  roomKey: Uint8Array,
  recipientPubHex: string,
  senderSecHex: string
): { wrapped: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const wrapped = nacl.box(
    roomKey,
    nonce,
    fromHex(recipientPubHex),
    fromHex(senderSecHex)
  );
  return { wrapped: toHex(wrapped), nonce: toHex(nonce) };
}

export function unwrapRoomKey(
  wrappedHex: string,
  nonceHex: string,
  senderPubHex: string,
  recipientSecHex: string
): Uint8Array {
  const opened = nacl.box.open(
    fromHex(wrappedHex),
    fromHex(nonceHex),
    fromHex(senderPubHex),
    fromHex(recipientSecHex)
  );
  if (!opened) throw new Error("Failed to unwrap room key");
  return opened;
}

// ---------- helpers ----------

export function toHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2) throw new Error("Invalid hex");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function toBase64(arr: Uint8Array): string {
  return naclUtil.encodeBase64(arr);
}

export function fromBase64(b64: string): Uint8Array {
  return naclUtil.decodeBase64(b64);
}

// ---------- localStorage room key vault ----------
//
// Stored under `roomkey:<roomObjectId>`. When the room is closed (private) or
// burned (public) on chain, we wipe the entry — after that the IPFS ciphertext
// becomes permanent garbage.

const VAULT_PREFIX = "roomkey:";
const KP_KEY = "sosui:identity-keypair";

export function saveRoomKey(roomObjectId: string, raw: Uint8Array) {
  if (typeof window === "undefined") return;
  localStorage.setItem(VAULT_PREFIX + roomObjectId, toHex(raw));
}

export function loadRoomKey(roomObjectId: string): Uint8Array | null {
  if (typeof window === "undefined") return null;
  const hex = localStorage.getItem(VAULT_PREFIX + roomObjectId);
  return hex ? fromHex(hex) : null;
}

export function destroyRoomKey(roomObjectId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(VAULT_PREFIX + roomObjectId);
}

/**
 * Get or create a persistent local x25519 identity. Used to wrap room keys
 * for this user — independent of their Sui wallet so a burner is possible.
 */
export function getOrCreateIdentity(): KeyPairHex {
  if (typeof window === "undefined") {
    return { publicKey: "", secretKey: "" };
  }
  const raw = localStorage.getItem(KP_KEY);
  if (raw) return JSON.parse(raw);
  const kp = generateKeyPair();
  localStorage.setItem(KP_KEY, JSON.stringify(kp));
  return kp;
}
