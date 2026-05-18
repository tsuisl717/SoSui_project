"use client";

/**
 * Sign + execute helper with hybrid wallet compatibility.
 *
 *   path A (preferred): wallet.signTransaction → dApp executes via SuiClient
 *     ✓ network routing is controlled by the dApp (NEXT_PUBLIC_SUI_RPC),
 *       so wallet's current network doesn't matter
 *     ✗ requires the wallet to implement `sui:signTransaction` cleanly
 *
 *   path B (fallback): wallet.signAndExecuteTransaction (wallet does it all)
 *     ✓ wider wallet compatibility — works on wallets whose signTransaction
 *       feature is broken or missing (e.g. OKX wallet at time of writing)
 *     ✗ tx hits whichever network the wallet UI is on — user MUST have
 *       their wallet switched to the same chain as `NEXT_PUBLIC_SUI_NETWORK`
 *
 * We try A first. If signTransaction throws (and the user didn't explicitly
 * reject the prompt), we fall back to B. The fallback may cause the user to
 * see a second wallet popup — annoying but unavoidable when the first
 * popup's decoder crashes.
 */
import {
  useSignAndExecuteTransaction,
  useSignTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import type { Transaction } from "@mysten/sui/transactions";
import { NETWORK } from "@/lib/constants";

export const SUI_CHAIN = `sui:${NETWORK}` as `sui:${string}`;

interface ExecInput {
  transaction: Transaction;
  chain?: `sui:${string}`;
}

export function useSignAndExec() {
  const client = useSuiClient();
  const signOnly = useSignTransaction();
  const walletExec = useSignAndExecuteTransaction();

  const mutateAsync = async (
    input: ExecInput,
  ): Promise<{ digest: string }> => {
    const chain = input.chain ?? SUI_CHAIN;

    // ---- Path A: signTransaction + dApp execute ----
    try {
      const { bytes, signature } = await signOnly.mutateAsync({
        transaction: input.transaction,
        chain,
      });
      const res = await client.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showRawEffects: true,
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
        },
      });
      return { digest: res.digest };
    } catch (e: any) {
      const msg = String(e?.message ?? e ?? "");

      // User explicitly rejected the prompt — don't trigger another popup.
      // Narrow patterns so generic "rejected" text in other errors doesn't
      // short-circuit the fallback.
      if (/user (rejected|denied)/i.test(msg)) {
        throw e;
      }

      console.warn(
        "[useSignAndExec] signTransaction path failed, falling back to wallet-side execute:",
        e,
      );

      // ---- Path B: wallet.signAndExecuteTransaction ----
      const res = await walletExec.mutateAsync({
        transaction: input.transaction,
        chain,
      });
      return { digest: res.digest };
    }
  };

  return { mutateAsync };
}
