/**
 * Sui frontend constants. Values come from .env.local — populated by
 * `cd move && npm run publish`.
 */

export type Network = "mainnet" | "testnet" | "devnet" | "localnet";

export const NETWORK: Network =
  ((process.env.NEXT_PUBLIC_SUI_NETWORK ?? "devnet") as Network);

export const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SUI_RPC ?? "https://fullnode.devnet.sui.io:443";

export const PACKAGE_ID = process.env.NEXT_PUBLIC_SUI_PACKAGE_ID ?? "";
export const CONFIG_ID = process.env.NEXT_PUBLIC_SUI_CONFIG_ID ?? "";

/** Treasury address (where SUI fees go). May be overridden by on-chain Config. */
export const TREASURY = process.env.NEXT_PUBLIC_SUI_TREASURY ?? null;

/** True once `npm run publish` has populated the IDs. */
export const PACKAGE_DEPLOYED = !!(PACKAGE_ID && CONFIG_ID);

export const MIST_PER_SUI = 1_000_000_000;

export const MODULE_NAME = "ephemeral_chat";
export const BOUNTY_MODULE_NAME = "bounty";

/** Shared Clock object — same address on every Sui network. */
export const SUI_CLOCK_ID = "0x6";

export function moveTarget(fn: string): `${string}::${string}::${string}` {
  return `${PACKAGE_ID}::${MODULE_NAME}::${fn}` as `${string}::${string}::${string}`;
}

export function bountyTarget(fn: string): `${string}::${string}::${string}` {
  return `${PACKAGE_ID}::${BOUNTY_MODULE_NAME}::${fn}` as `${string}::${string}::${string}`;
}

/** Fully qualified `0xPKG::ephemeral_chat::AdminCap` for owned-object filters. */
export const ADMIN_CAP_TYPE = `${PACKAGE_ID}::${MODULE_NAME}::AdminCap`;

export const EVENT_TYPE = {
  roomCreated: `${PACKAGE_ID}::${MODULE_NAME}::RoomCreated`,
  messageAdded: `${PACKAGE_ID}::${MODULE_NAME}::MessageAdded`,
  roomClosed: `${PACKAGE_ID}::${MODULE_NAME}::RoomClosed`,
  bountyPosted: `${PACKAGE_ID}::${BOUNTY_MODULE_NAME}::BountyPosted`,
  bountyClaimed: `${PACKAGE_ID}::${BOUNTY_MODULE_NAME}::BountyClaimed`,
  bountyReopened: `${PACKAGE_ID}::${BOUNTY_MODULE_NAME}::BountyReopened`,
  bountySubmitted: `${PACKAGE_ID}::${BOUNTY_MODULE_NAME}::BountySubmitted`,
  bountyReleased: `${PACKAGE_ID}::${BOUNTY_MODULE_NAME}::BountyReleased`,
  bountyCancelled: `${PACKAGE_ID}::${BOUNTY_MODULE_NAME}::BountyCancelled`,
  bountyDisputed: `${PACKAGE_ID}::${BOUNTY_MODULE_NAME}::BountyDisputed`,
  disputeResolved: `${PACKAGE_ID}::${BOUNTY_MODULE_NAME}::DisputeResolved`,
};

export function suiToMist(sui: number): bigint {
  return BigInt(Math.round(sui * MIST_PER_SUI));
}

export function mistToSui(mist: bigint | number | string): number {
  const n = typeof mist === "bigint" ? mist : BigInt(mist.toString());
  return Number(n) / MIST_PER_SUI;
}

// ---------- explorer URLs (Suiscan) ----------

export function explorerTxUrl(digest: string): string {
  return `https://suiscan.xyz/${NETWORK}/tx/${digest}`;
}

export function explorerAddressUrl(addr: string): string {
  return `https://suiscan.xyz/${NETWORK}/account/${addr}`;
}

export function explorerObjectUrl(id: string): string {
  return `https://suiscan.xyz/${NETWORK}/object/${id}`;
}

// ---------- faucet ----------

export const FAUCET_URL =
  NETWORK === "devnet"
    ? "https://faucet.sui.io/?network=devnet"
    : NETWORK === "testnet"
      ? "https://faucet.sui.io/?network=testnet"
      : null;
