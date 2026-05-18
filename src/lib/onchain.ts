/**
 * Sui RPC readers — Config + Room object fetching, room listing via
 * RoomCreated events, message history via per-room transaction queries.
 *
 * Chain is the source of truth; localStorage is just plaintext cache.
 */
import type { SuiClient } from "@mysten/sui/client";
import {
  CONFIG_ID,
  EVENT_TYPE,
  MIST_PER_SUI,
  MODULE_NAME,
  PACKAGE_ID,
} from "@/lib/constants";

// ---------- Room ----------

export interface OnchainRoom {
  objectId: string;
  /** Hex of the 16-byte room_id field. */
  roomId: string;
  owner: string;
  name: string;
  description: string;
  ownerPubkeyHex: string;
  feePaidSui: number;
  status: "open" | "closed" | "burned";
  visibility: "public" | "private";
  messageCount: number;
  createdAtMs: number;
  closedAtMs?: number;
  expiresAtMs?: number;
  version: number;
  /** Public open rooms: 32 bytes. Private/burned: undefined. */
  roomKey?: Uint8Array;
  /** Bounties in non-terminal state. close_room is blocked while > 0. */
  activeBountyCount: number;
}

export interface OnchainConfig {
  treasury: string;
  roomCount: number;
  version: number;
  publicFeeSui: number;
  privateFeeSui: number;
  publicTtlMs: number;
  privateTtlMs: number;
  maxMessages: number;
}

export interface OnchainMessage {
  cid: string;
  sender: string;
  digest: string;
  blockTimeMs: number;
  contentHashHex: string;
  index: number;
}

// ---------- Decoders ----------

/** Parse bytes coming back from Sui RPC — usually a hex/base64 string or u8 array. */
function parseBytes(v: unknown): Uint8Array {
  if (!v) return new Uint8Array(0);
  if (typeof v === "string") {
    const hex = v.startsWith("0x") ? v.slice(2) : v;
    if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
      return Uint8Array.from(
        hex.match(/.{1,2}/g)!.map((h) => parseInt(h, 16)),
      );
    }
    // base64 fallback
    try {
      return Uint8Array.from(atob(v), (c) => c.charCodeAt(0));
    } catch {
      /* not base64 */
    }
    return new Uint8Array(0);
  }
  if (Array.isArray(v)) return Uint8Array.from(v.map((n) => Number(n) & 0xff));
  return new Uint8Array(0);
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

function decodeRoomFields(objectId: string, f: any): OnchainRoom {
  const roomKeyBytes = parseBytes(f.room_key);
  const status = Number(f.status);
  const visibility = Number(f.visibility);
  return {
    objectId,
    roomId: bytesToHex(parseBytes(f.room_id)),
    owner: f.owner,
    name: f.name,
    description: f.description,
    ownerPubkeyHex: f.owner_pubkey_hex,
    feePaidSui: Number(f.fee_paid) / MIST_PER_SUI,
    status: status === 0 ? "open" : status === 2 ? "burned" : "closed",
    visibility: visibility === 0 ? "public" : "private",
    messageCount: Number(f.message_count),
    createdAtMs: Number(f.created_at_ms),
    closedAtMs: Number(f.closed_at_ms) > 0 ? Number(f.closed_at_ms) : undefined,
    expiresAtMs: Number(f.expires_at_ms),
    version: Number(f.version),
    roomKey: roomKeyBytes.length === 32 ? roomKeyBytes : undefined,
    activeBountyCount: Number(f.active_bounty_count ?? 0),
  };
}

// ---------- Config ----------

export async function fetchConfig(
  client: SuiClient,
): Promise<OnchainConfig | null> {
  if (!CONFIG_ID) return null;
  try {
    const obj = await client.getObject({
      id: CONFIG_ID,
      options: { showContent: true },
    });
    const content = obj.data?.content;
    if (!content || content.dataType !== "moveObject") return null;
    const f = content.fields as any;
    return {
      treasury: f.treasury,
      roomCount: Number(f.room_count),
      version: Number(f.version),
      publicFeeSui: Number(f.public_fee) / MIST_PER_SUI,
      privateFeeSui: Number(f.private_fee) / MIST_PER_SUI,
      publicTtlMs: Number(f.public_ttl_ms),
      privateTtlMs: Number(f.private_ttl_ms),
      maxMessages: Number(f.max_messages),
    };
  } catch (e) {
    console.error("fetchConfig failed", e);
    return null;
  }
}

// ---------- Rooms ----------

export async function fetchRoom(
  client: SuiClient,
  objectId: string,
): Promise<OnchainRoom | null> {
  try {
    const obj = await client.getObject({
      id: objectId,
      options: { showContent: true },
    });
    const content = obj.data?.content;
    if (!content || content.dataType !== "moveObject") return null;
    return decodeRoomFields(objectId, content.fields as any);
  } catch (e) {
    console.error("fetchRoom failed", e);
    return null;
  }
}

export async function listRoomsOnChain(
  client: SuiClient,
): Promise<OnchainRoom[]> {
  if (!PACKAGE_ID) return [];
  try {
    const evs = await client.queryEvents({
      query: { MoveEventType: EVENT_TYPE.roomCreated },
      limit: 50,
      order: "descending",
    });
    const roomIds = evs.data
      .map((e) => (e.parsedJson as any)?.room)
      .filter((x): x is string => typeof x === "string");
    if (roomIds.length === 0) return [];

    const objs = await client.multiGetObjects({
      ids: roomIds,
      options: { showContent: true },
    });
    const rooms: OnchainRoom[] = [];
    for (const o of objs) {
      const content = o.data?.content;
      if (!content || content.dataType !== "moveObject") continue;
      try {
        rooms.push(decodeRoomFields(o.data!.objectId, content.fields as any));
      } catch {
        /* skip malformed */
      }
    }
    rooms.sort((a, b) => b.createdAtMs - a.createdAtMs);
    return rooms;
  } catch (e) {
    console.error("listRoomsOnChain failed", e);
    return [];
  }
}

// ---------- Messages ----------

/**
 * Walk every transaction that took this Room object as input, then extract
 * `MessageAdded` events from those tx's event lists. Far cheaper than scanning
 * all MessageAdded events globally (which we'd then have to filter client-side).
 *
 * Returns messages in chronological order (oldest → newest) within the page.
 */
export async function fetchMessagesPage(
  client: SuiClient,
  roomObjectId: string,
  opts: { cursor?: any; limit?: number } = {},
): Promise<{ messages: OnchainMessage[]; nextCursor: any }> {
  if (!PACKAGE_ID) return { messages: [], nextCursor: null };
  const limit = opts.limit ?? 50;
  const msgEventType = EVENT_TYPE.messageAdded;

  try {
    const txs = await client.queryTransactionBlocks({
      filter: { InputObject: roomObjectId },
      options: { showEvents: true },
      cursor: opts.cursor,
      limit,
      order: "descending",
    });

    const out: OnchainMessage[] = [];
    for (const tx of txs.data) {
      for (const e of tx.events ?? []) {
        if (e.type !== msgEventType) continue;
        const j = e.parsedJson as any;
        if (j?.room !== roomObjectId) continue;
        out.push({
          cid: j.cid,
          sender: j.sender,
          digest: tx.digest,
          blockTimeMs: Number(tx.timestampMs ?? 0),
          contentHashHex: bytesToHex(parseBytes(j.content_hash)),
          index: Number(j.index),
        });
      }
    }

    // queryTransactionBlocks returns newest-first; reverse for display.
    out.reverse();
    return {
      messages: out,
      nextCursor: txs.hasNextPage ? txs.nextCursor : null,
    };
  } catch (e) {
    console.error("fetchMessagesPage failed", e);
    return { messages: [], nextCursor: null };
  }
}

// ---------- "Subscription" (polling) ----------

/**
 * Poll the Room every `intervalMs` and fire `onChange` whenever message_count
 * or status changes. Returns a cleanup function.
 *
 * No websocket subscription yet — devnet/testnet fullnodes are flaky over WS
 * and the polling approach works against every RPC.
 */
export function subscribeRoom(
  client: SuiClient,
  roomObjectId: string,
  onChange: (r: OnchainRoom) => void,
  intervalMs = 5000,
): () => void {
  let lastVersion = "";
  let cancelled = false;

  const tick = async () => {
    if (cancelled) return;
    try {
      const r = await fetchRoom(client, roomObjectId);
      if (r) {
        const sig = `${r.status}:${r.messageCount}:${r.version}:${r.activeBountyCount}`;
        if (sig !== lastVersion) {
          lastVersion = sig;
          onChange(r);
        }
      }
    } catch {
      /* swallow */
    }
  };
  tick();
  const timer = setInterval(tick, intervalMs);
  return () => {
    cancelled = true;
    clearInterval(timer);
  };
}
