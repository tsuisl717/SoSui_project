"use client";

/**
 * Treasury admin page.
 *
 * Gate: connected wallet address must equal config.treasury.
 * Action: transfer SUI from the treasury wallet to any destination.
 * Since SUI fees go straight to a regular wallet (no contract custody),
 * "withdraw" is just a `Coin<SUI>` transfer PTB.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { SUI_CHAIN, useSignAndExec } from "@/lib/useSignAndExec";
import {
  TREASURY,
  explorerAddressUrl,
  explorerTxUrl,
  mistToSui,
  suiToMist,
} from "@/lib/constants";
import { buildWithdrawTx } from "@/lib/program";
import { fetchConfig } from "@/lib/onchain";
import { DisputeQueue } from "@/components/DisputeQueue";

const GAS_RESERVE_MIST = 10_000_000n; // 0.01 SUI

export default function AdminPage() {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExec();

  const [treasury, setTreasury] = useState<string | null>(TREASURY);

  // Pull the live treasury from on-chain Config. Falls back to env.
  useEffect(() => {
    fetchConfig(client).then((c) => {
      if (c?.treasury) setTreasury(c.treasury);
    });
  }, [client]);

  const isAuthorized =
    !!(account && treasury && account.address.toLowerCase() === treasury.toLowerCase());

  if (!treasury) {
    return (
      <NoticeCard tone="error" title="Admin not configured">
        <p>
          <code>NEXT_PUBLIC_SUI_TREASURY</code> is missing and the on-chain
          Config could not be read. Set it in <code>.env.local</code> or run{" "}
          <code>npm run publish</code> in <code>move/</code>.
        </p>
      </NoticeCard>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin · Treasury</h1>
        <p className="text-sm text-muted">
          Withdraw SUI fees collected by <code>create_room</code>. Only the
          treasury wallet can sign.
        </p>
      </div>

      <div className="space-y-1 rounded-2xl border border-line bg-panel/60 p-4 text-xs text-muted">
        <Row label="Treasury wallet" value={treasury} link />
      </div>

      {!account ? (
        <NoticeCard tone="info" title="Connect wallet">
          <p>Connect the treasury wallet to continue.</p>
        </NoticeCard>
      ) : !isAuthorized ? (
        <NoticeCard tone="error" title="Unauthorized">
          <p className="mb-2">
            This wallet is not the treasury. Disconnect and reconnect with the
            right wallet.
          </p>
          <p>
            connected: <code className="break-all">{account.address}</code>
          </p>
          <p>
            expected: <code className="break-all">{treasury}</code>
          </p>
        </NoticeCard>
      ) : (
        <>
          <WithdrawForm
            address={account.address}
            getBalance={async () => {
              const { totalBalance } = await client.getBalance({
                owner: account.address,
              });
              return BigInt(totalBalance);
            }}
            submit={async (tx) => {
              const res = await signAndExecute({ transaction: tx, chain: SUI_CHAIN });
              await client.waitForTransaction({ digest: res.digest });
              return res.digest;
            }}
          />
          <DisputeQueue
            client={client}
            adminAddress={account.address}
            signAndExecute={(input) =>
              signAndExecute({ transaction: input.transaction, chain: SUI_CHAIN })
            }
          />
        </>
      )}
    </div>
  );
}

// ---------------- withdraw form ----------------

function WithdrawForm({
  address,
  getBalance,
  submit,
}: {
  address: string;
  getBalance: () => Promise<bigint>;
  submit: (tx: import("@mysten/sui/transactions").Transaction) => Promise<string>;
}) {
  const [balanceMist, setBalanceMist] = useState<bigint | null>(null);
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [drain, setDrain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successDigest, setSuccessDigest] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setBalanceMist(await getBalance());
    } catch {
      setBalanceMist(0n);
    }
  }, [getBalance]);

  useEffect(() => {
    refresh();
  }, [refresh, successDigest]);

  const balanceSui =
    balanceMist === null ? null : mistToSui(balanceMist);

  async function handleWithdraw() {
    setError(null);
    setSuccessDigest(null);

    if (!destination.trim().startsWith("0x")) {
      setError("destination must be a Sui address (0x…)");
      return;
    }

    setBusy(true);
    try {
      const bal = await getBalance();
      let amountMist: bigint;
      if (drain) {
        amountMist = bal > GAS_RESERVE_MIST ? bal - GAS_RESERVE_MIST : 0n;
      } else {
        const parsed = Number(amount);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          throw new Error("enter a positive amount, or check Drain");
        }
        amountMist = suiToMist(parsed);
      }
      if (amountMist === 0n) throw new Error("treasury is empty");
      if (amountMist + GAS_RESERVE_MIST > bal) {
        throw new Error(
          `amount exceeds spendable balance (${mistToSui(bal)} SUI, leave ${mistToSui(GAS_RESERVE_MIST)} SUI for gas)`,
        );
      }

      const tx = buildWithdrawTx({
        to: destination.trim(),
        amountMist,
      });
      const digest = await submit(tx);
      setSuccessDigest(digest);
      setAmount("");
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "withdraw failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-panel/60 p-5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs uppercase tracking-wider text-muted">
          balance
        </span>
        <span className="font-mono text-2xl">
          {balanceSui === null ? "…" : balanceSui.toFixed(4)} SUI
        </span>
      </div>

      <label className="block">
        <span className="text-xs uppercase tracking-wider text-muted">
          destination wallet
        </span>
        <input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="paste a Sui address (0x…)"
          spellCheck={false}
          className="mt-1 block w-full rounded-lg border border-line bg-ink px-3 py-2 font-mono text-xs outline-none focus:border-accent"
        />
      </label>

      <div className="space-y-2">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted">
            amount (SUI)
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.0001"
            min="0"
            value={amount}
            disabled={drain}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 0.5"
            className="mt-1 block w-full rounded-lg border border-line bg-ink px-3 py-2 font-mono text-sm outline-none focus:border-accent disabled:opacity-50"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={drain}
            onChange={(e) => setDrain(e.target.checked)}
          />
          drain (withdraw everything, leaves 0.01 SUI for gas)
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {successDigest && (
        <div className="rounded-lg border border-accent2/30 bg-accent2/10 px-3 py-2 text-xs text-accent2">
          ✓ withdraw confirmed —{" "}
          <a
            href={explorerTxUrl(successDigest)}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            view on explorer
          </a>
        </div>
      )}

      <button
        disabled={busy || !destination || (!drain && !amount)}
        onClick={handleWithdraw}
        className="w-full rounded-lg bg-gradient-to-br from-accent to-accent2 py-3 text-sm font-semibold text-ink disabled:opacity-50"
      >
        {busy
          ? "sending…"
          : drain
            ? "drain treasury"
            : amount
              ? `withdraw ${amount} SUI`
              : "enter amount"}
      </button>
    </div>
  );
}

// ---------------- bits ----------------

function Row({
  label,
  value,
  link,
}: {
  label: string;
  value: string;
  link?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="shrink-0">{label}</span>
      {link ? (
        <a
          href={explorerAddressUrl(value)}
          target="_blank"
          rel="noreferrer"
          className="truncate font-mono text-[11px] text-accent2 hover:underline"
        >
          {value}
        </a>
      ) : (
        <span className="truncate font-mono text-[11px]">{value}</span>
      )}
    </div>
  );
}

function NoticeCard({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "info" | "error";
  children: React.ReactNode;
}) {
  const border =
    tone === "error"
      ? "border-red-500/30 bg-red-500/10 text-red-300"
      : "border-accent2/30 bg-accent2/10 text-accent2";
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin · Treasury</h1>
      </div>
      <div className={`rounded-2xl border p-5 text-sm ${border}`}>
        <div className="mb-1 font-semibold">{title}</div>
        <div className="space-y-1 text-xs">{children}</div>
        <div className="mt-3 text-[11px] text-muted">
          <Link href="/" className="hover:underline">
            ← back home
          </Link>
        </div>
      </div>
    </div>
  );
}
