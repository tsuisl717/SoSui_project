/**
 * On-chain bounty layer: types, decoders, queries, and PTB builders for the
 * `sosui_media::bounty` Move module.
 */
import type { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import {
  ADMIN_CAP_TYPE,
  EVENT_TYPE,
  MIST_PER_SUI,
  PACKAGE_ID,
  SUI_CLOCK_ID,
  bountyTarget,
} from "@/lib/constants";
import { encryptMessage, importRoomKey, loadRoomKey } from "@/lib/crypto";
import { envelope, uploadEnvelope } from "@/lib/ipfs";

// ---------- types ----------

export type BountyStatus =
  | "open"
  | "claimed"
  | "submitted"
  | "released"
  | "cancelled"
  | "disputed";

export interface OnchainBounty {
  objectId: string;
  room: string;
  poster: string;
  amountMist: bigint;
  amountSui: number;
  lockedMist: bigint;
  title: string;
  briefCid: string;
  status: BountyStatus;
  claimer?: string;
  submissionCid?: string;
  claimWindowMs: number;
  reviewWindowMs: number;
  claimDeadlineMs: number;
  reviewDeadlineMs: number;
  createdAtMs: number;
}

const STATUS_ORDER: BountyStatus[] = [
  "open",
  "claimed",
  "submitted",
  "released",
  "cancelled",
  "disputed",
];

// ---------- helpers ----------

function decodeOptionString(opt: any): string | undefined {
  if (!opt) return undefined;
  // dapp-kit decodes Option<T> as { vec: [T] } or just T or null depending on version.
  if (Array.isArray(opt?.vec)) return opt.vec[0] ?? undefined;
  if (Array.isArray(opt)) return opt[0] ?? undefined;
  if (typeof opt === "string") return opt;
  return undefined;
}

function decodeOptionAddress(opt: any): string | undefined {
  return decodeOptionString(opt);
}

function decodeBountyFields(objectId: string, f: any): OnchainBounty {
  const statusIdx = Number(f.status);
  return {
    objectId,
    room: f.room,
    poster: f.poster,
    amountMist: BigInt(f.amount),
    amountSui: Number(f.amount) / MIST_PER_SUI,
    lockedMist: BigInt(f.locked ?? 0),
    title: f.title ?? "",
    briefCid: f.brief_cid ?? "",
    status: STATUS_ORDER[statusIdx] ?? "open",
    claimer: decodeOptionAddress(f.claimer),
    submissionCid: decodeOptionString(f.submission_cid),
    claimWindowMs: Number(f.claim_window_ms),
    reviewWindowMs: Number(f.review_window_ms),
    claimDeadlineMs: Number(f.claim_deadline_ms),
    reviewDeadlineMs: Number(f.review_deadline_ms),
    createdAtMs: Number(f.created_at_ms),
  };
}

// ---------- fetchers ----------

export async function fetchBounty(
  client: SuiClient,
  objectId: string,
): Promise<OnchainBounty | null> {
  try {
    const obj = await client.getObject({
      id: objectId,
      options: { showContent: true },
    });
    const content = obj.data?.content;
    if (!content || content.dataType !== "moveObject") return null;
    return decodeBountyFields(objectId, content.fields as any);
  } catch (e) {
    console.error("fetchBounty failed", e);
    return null;
  }
}

/** List all bounties posted in the given Room, newest first. */
export async function listBountiesByRoom(
  client: SuiClient,
  roomObjectId: string,
): Promise<OnchainBounty[]> {
  if (!PACKAGE_ID) return [];
  try {
    const evs = await client.queryEvents({
      query: { MoveEventType: EVENT_TYPE.bountyPosted },
      limit: 100,
      order: "descending",
    });
    const ids = evs.data
      .filter((e) => (e.parsedJson as any)?.room === roomObjectId)
      .map((e) => (e.parsedJson as any)?.bounty)
      .filter((x): x is string => typeof x === "string");
    return await multiGetBounties(client, ids);
  } catch (e) {
    console.error("listBountiesByRoom failed", e);
    return [];
  }
}

/** Admin view: list every bounty currently in DISPUTED state. */
export async function listDisputedBounties(
  client: SuiClient,
): Promise<OnchainBounty[]> {
  if (!PACKAGE_ID) return [];
  try {
    const evs = await client.queryEvents({
      query: { MoveEventType: EVENT_TYPE.bountyDisputed },
      limit: 100,
      order: "descending",
    });
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const e of evs.data) {
      const id = (e.parsedJson as any)?.bounty;
      if (typeof id !== "string" || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    const all = await multiGetBounties(client, ids);
    return all.filter((b) => b.status === "disputed");
  } catch (e) {
    console.error("listDisputedBounties failed", e);
    return [];
  }
}

async function multiGetBounties(
  client: SuiClient,
  ids: string[],
): Promise<OnchainBounty[]> {
  if (ids.length === 0) return [];
  const objs = await client.multiGetObjects({
    ids,
    options: { showContent: true },
  });
  const out: OnchainBounty[] = [];
  for (const o of objs) {
    const c = o.data?.content;
    if (!c || c.dataType !== "moveObject") continue;
    try {
      out.push(decodeBountyFields(o.data!.objectId, c.fields as any));
    } catch {
      /* skip malformed */
    }
  }
  out.sort((a, b) => b.createdAtMs - a.createdAtMs);
  return out;
}

/** Look up the caller's AdminCap object ID (if any). */
export async function findAdminCap(
  client: SuiClient,
  ownerAddress: string,
): Promise<string | null> {
  try {
    const res = await client.getOwnedObjects({
      owner: ownerAddress,
      filter: { StructType: ADMIN_CAP_TYPE },
      options: { showType: true },
      limit: 1,
    });
    const first = res.data[0]?.data?.objectId;
    return first ?? null;
  } catch (e) {
    console.error("findAdminCap failed", e);
    return null;
  }
}

// ---------- content encryption ----------

/**
 * Encrypt a bounty brief / submission with the room's AES-GCM key and upload
 * the ciphertext envelope to blob storage. Returns the CID to stamp on chain.
 *
 * The room key must already be present in localStorage — public rooms
 * auto-load it from the on-chain `room_key` field; private rooms require an
 * invite. Throws "Room key missing" if absent.
 */
export async function encryptBountyContent(args: {
  roomObjectId: string;
  sender: string;
  plaintext: string;
}): Promise<string> {
  const raw = loadRoomKey(args.roomObjectId);
  if (!raw) throw new Error("Room key missing — join the room first");
  const key = await importRoomKey(raw);
  const { ciphertext, iv } = await encryptMessage(key, args.plaintext);
  const env = envelope(ciphertext, iv, args.sender);
  return uploadEnvelope(env);
}

// ---------- PTB builders ----------

const enc = new TextEncoder();
const bytesOf = (s: string): number[] => Array.from(enc.encode(s));

export function buildPostBountyTx(args: {
  roomObjectId: string;
  amountMist: bigint;
  title: string;
  briefCid: string;
  claimWindowMs: number;
  reviewWindowMs: number;
}): Transaction {
  const tx = new Transaction();
  const [payment] = tx.splitCoins(tx.gas, [args.amountMist]);
  tx.moveCall({
    target: bountyTarget("post_bounty"),
    arguments: [
      tx.object(args.roomObjectId),
      payment,
      tx.pure.u64(args.amountMist),
      tx.pure.vector("u8", bytesOf(args.title)),
      tx.pure.vector("u8", bytesOf(args.briefCid)),
      tx.pure.u64(args.claimWindowMs),
      tx.pure.u64(args.reviewWindowMs),
      tx.object(SUI_CLOCK_ID),
    ],
  });
  return tx;
}

export function buildClaimBountyTx(bountyObjectId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: bountyTarget("claim_bounty"),
    arguments: [tx.object(bountyObjectId), tx.object(SUI_CLOCK_ID)],
  });
  return tx;
}

export function buildReopenExpiredTx(bountyObjectId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: bountyTarget("reopen_expired"),
    arguments: [tx.object(bountyObjectId), tx.object(SUI_CLOCK_ID)],
  });
  return tx;
}

export function buildSubmitWorkTx(args: {
  bountyObjectId: string;
  submissionCid: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: bountyTarget("submit_work"),
    arguments: [
      tx.object(args.bountyObjectId),
      tx.pure.vector("u8", bytesOf(args.submissionCid)),
      tx.object(SUI_CLOCK_ID),
    ],
  });
  return tx;
}

export function buildReleaseBountyTx(args: {
  bountyObjectId: string;
  roomObjectId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: bountyTarget("release_bounty"),
    arguments: [
      tx.object(args.bountyObjectId),
      tx.object(args.roomObjectId),
      tx.object(SUI_CLOCK_ID),
    ],
  });
  return tx;
}

export function buildClaimAfterTimeoutTx(args: {
  bountyObjectId: string;
  roomObjectId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: bountyTarget("claim_after_review_timeout"),
    arguments: [
      tx.object(args.bountyObjectId),
      tx.object(args.roomObjectId),
      tx.object(SUI_CLOCK_ID),
    ],
  });
  return tx;
}

export function buildCancelBountyTx(args: {
  bountyObjectId: string;
  roomObjectId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: bountyTarget("cancel_bounty"),
    arguments: [
      tx.object(args.bountyObjectId),
      tx.object(args.roomObjectId),
      tx.object(SUI_CLOCK_ID),
    ],
  });
  return tx;
}

export function buildDisputeBountyTx(args: {
  bountyObjectId: string;
  reasonCid: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: bountyTarget("dispute_bounty"),
    arguments: [
      tx.object(args.bountyObjectId),
      tx.pure.vector("u8", bytesOf(args.reasonCid)),
      tx.object(SUI_CLOCK_ID),
    ],
  });
  return tx;
}

export function buildResolveDisputeTx(args: {
  adminCapId: string;
  bountyObjectId: string;
  roomObjectId: string;
  toClaimerMist: bigint;
  toPosterMist: bigint;
  verdictCid: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: bountyTarget("resolve_dispute"),
    arguments: [
      tx.object(args.adminCapId),
      tx.object(args.bountyObjectId),
      tx.object(args.roomObjectId),
      tx.pure.u64(args.toClaimerMist),
      tx.pure.u64(args.toPosterMist),
      tx.pure.vector("u8", bytesOf(args.verdictCid)),
      tx.object(SUI_CLOCK_ID),
    ],
  });
  return tx;
}

// ---------- formatting helpers (re-used by UI) ----------

export function statusLabel(s: BountyStatus): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function statusTone(s: BountyStatus): {
  bg: string;
  text: string;
  border: string;
} {
  switch (s) {
    case "open":
      return {
        bg: "bg-sui-blue/10",
        text: "text-sui-blue",
        border: "border-sui-blue/30",
      };
    case "claimed":
      return {
        bg: "bg-sui-aqua/10",
        text: "text-sui-aqua",
        border: "border-sui-aqua/30",
      };
    case "submitted":
      return {
        bg: "bg-amber-500/10",
        text: "text-amber-300",
        border: "border-amber-500/30",
      };
    case "released":
      return {
        bg: "bg-emerald-500/10",
        text: "text-emerald-300",
        border: "border-emerald-500/30",
      };
    case "cancelled":
      return {
        bg: "bg-white/5",
        text: "text-white/40",
        border: "border-white/10",
      };
    case "disputed":
      return {
        bg: "bg-red-500/10",
        text: "text-red-300",
        border: "border-red-500/30",
      };
  }
}
