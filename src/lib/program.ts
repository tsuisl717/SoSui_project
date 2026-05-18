/**
 * PTB builders for the on-chain `sosui_media::ephemeral_chat` module.
 *
 * Each function returns a `Transaction` ready to be passed into
 * `useSignAndExecuteTransaction`'s `transaction` argument.
 */
import { Transaction } from "@mysten/sui/transactions";
import { CONFIG_ID, SUI_CLOCK_ID, moveTarget } from "@/lib/constants";

const enc = new TextEncoder();
const bytesOf = (s: string): number[] => Array.from(enc.encode(s));

export function buildCreateRoomTx(args: {
  roomId: Uint8Array; // 16 bytes
  name: string;
  description: string;
  ownerPubkeyHex: string;
  isPublic: boolean;
  /** 32 bytes. Real AES key for public rooms; 32 zero bytes for private. */
  roomKey: Uint8Array;
  /** Amount in MIST to split off the gas coin for the fee. 0 for free rooms. */
  feeMist: bigint;
}): Transaction {
  if (args.roomId.length !== 16) throw new Error("roomId must be 16 bytes");
  if (args.roomKey.length !== 32) throw new Error("roomKey must be 32 bytes");

  const tx = new Transaction();
  // Split the fee from the gas coin. The Move side splits it again to the
  // treasury and refunds any remainder to the sender — for free rooms this
  // is a 0-value coin that the contract destroy_zero's.
  const [payment] = tx.splitCoins(tx.gas, [args.feeMist]);
  tx.moveCall({
    target: moveTarget("create_room"),
    arguments: [
      tx.object(CONFIG_ID),
      tx.pure.vector("u8", Array.from(args.roomId)),
      tx.pure.vector("u8", bytesOf(args.name)),
      tx.pure.vector("u8", bytesOf(args.description)),
      tx.pure.vector("u8", bytesOf(args.ownerPubkeyHex)),
      tx.pure.bool(args.isPublic),
      tx.pure.vector("u8", Array.from(args.roomKey)),
      payment,
      tx.object(SUI_CLOCK_ID),
    ],
  });
  return tx;
}

export function buildAddMessageTx(args: {
  roomObjectId: string;
  cid: string;
  contentHash: Uint8Array; // 32 bytes
}): Transaction {
  if (args.contentHash.length !== 32) {
    throw new Error("contentHash must be 32 bytes");
  }
  const tx = new Transaction();
  tx.moveCall({
    target: moveTarget("add_message"),
    arguments: [
      tx.object(CONFIG_ID),
      tx.object(args.roomObjectId),
      tx.pure.vector("u8", bytesOf(args.cid)),
      tx.pure.vector("u8", Array.from(args.contentHash)),
      tx.object(SUI_CLOCK_ID),
    ],
  });
  return tx;
}

export function buildCloseRoomTx(roomObjectId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: moveTarget("close_room"),
    arguments: [tx.object(roomObjectId), tx.object(SUI_CLOCK_ID)],
  });
  return tx;
}

export function buildBurnRoomKeyTx(roomObjectId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: moveTarget("burn_room_key"),
    arguments: [tx.object(roomObjectId)],
  });
  return tx;
}

/** Treasury owner sends SUI from their wallet to a destination. */
export function buildWithdrawTx(args: {
  to: string;
  amountMist: bigint;
}): Transaction {
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [args.amountMist]);
  tx.transferObjects([coin], args.to);
  return tx;
}

// ---------- helpers ----------

export function freshRoomId(): Uint8Array {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return buf;
}
