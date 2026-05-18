"use client";

/**
 * Admin queue: lists every DISPUTED bounty and lets the AdminCap holder
 * resolve each with a custom claimer/poster split + verdict text.
 *
 * The AdminCap is looked up dynamically from the connected wallet — no env
 * var required. If the connected wallet has no AdminCap (i.e. caller isn't
 * the admin), the panel shows a clear "not authorized" notice instead.
 */
import { useCallback, useEffect, useState } from "react";
import type { SuiClient } from "@mysten/sui/client";
import type { Transaction } from "@mysten/sui/transactions";
import {
  AlertTriangle,
  CheckCircle2,
  Gavel,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import {
  type OnchainBounty,
  buildResolveDisputeTx,
  findAdminCap,
  listDisputedBounties,
} from "@/lib/bounty";
import {
  MIST_PER_SUI,
  explorerAddressUrl,
  explorerObjectUrl,
  explorerTxUrl,
} from "@/lib/constants";

interface Props {
  client: SuiClient;
  adminAddress: string;
  signAndExecute: (i: { transaction: Transaction }) => Promise<{
    digest: string;
  }>;
}

export function DisputeQueue({ client, adminAddress, signAndExecute }: Props) {
  const [bounties, setBounties] = useState<OnchainBounty[]>([]);
  const [adminCapId, setAdminCapId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [list, cap] = await Promise.all([
        listDisputedBounties(client),
        findAdminCap(client, adminAddress),
      ]);
      setBounties(list);
      setAdminCapId(cap);
    } finally {
      setLoading(false);
    }
  }, [client, adminAddress]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-panel/60 p-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gavel size={16} className="text-accent2" />
          <h2 className="text-sm font-bold uppercase tracking-widest">
            Disputed Bounties
          </h2>
          <span className="rounded-md border border-line bg-ink/40 px-2 py-0.5 font-mono text-[10px] text-muted">
            {loading ? "…" : bounties.length}
          </span>
        </div>
        <button
          onClick={refresh}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:text-white"
          title="refresh"
        >
          <RefreshCcw size={12} />
        </button>
      </header>

      {!adminCapId && !loading && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <AlertTriangle size={14} />
            No AdminCap in this wallet
          </div>
          <p className="text-[11px]">
            The connected wallet ({short(adminAddress)}) does not own an
            AdminCap object — it cannot resolve disputes. Reconnect with the
            wallet that ran <code>npm run publish</code>.
          </p>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-xs text-muted">loading…</div>
      ) : bounties.length === 0 ? (
        <div className="py-10 text-center text-xs text-muted">
          No bounties currently disputed.
        </div>
      ) : (
        <ul className="space-y-4">
          {bounties.map((b) => (
            <li key={b.objectId}>
              <DisputeCard
                bounty={b}
                client={client}
                adminCapId={adminCapId}
                signAndExecute={signAndExecute}
                onResolved={refresh}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------- card ----------------

function DisputeCard({
  bounty,
  client,
  adminCapId,
  signAndExecute,
  onResolved,
}: {
  bounty: OnchainBounty;
  client: SuiClient;
  adminCapId: string | null;
  signAndExecute: (i: { transaction: Transaction }) => Promise<{
    digest: string;
  }>;
  onResolved: () => Promise<void>;
}) {
  const totalMist = bounty.amountMist;
  const [toClaimerSui, setToClaimerSui] = useState(
    (bounty.amountSui / 2).toFixed(4),
  );
  const [verdict, setVerdict] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successDigest, setSuccessDigest] = useState<string | null>(null);

  const toClaimerMist = (() => {
    const n = Number(toClaimerSui);
    if (!Number.isFinite(n) || n < 0) return null;
    const m = BigInt(Math.round(n * MIST_PER_SUI));
    if (m > totalMist) return null;
    return m;
  })();
  const toPosterMist =
    toClaimerMist === null ? null : totalMist - toClaimerMist;

  const claimerPct =
    toClaimerMist === null
      ? null
      : Number((toClaimerMist * 10000n) / totalMist) / 100;

  async function resolve() {
    setErr(null);
    setSuccessDigest(null);

    if (!adminCapId) {
      setErr("missing AdminCap");
      return;
    }
    if (toClaimerMist === null || toPosterMist === null) {
      setErr("invalid split — must be 0 ≤ to_claimer ≤ amount");
      return;
    }
    if (!verdict.trim()) {
      setErr("verdict text required (anchored on chain)");
      return;
    }
    if (verdict.length > 96) {
      setErr("verdict must be ≤96 chars");
      return;
    }

    setBusy(true);
    try {
      const tx = buildResolveDisputeTx({
        adminCapId,
        bountyObjectId: bounty.objectId,
        roomObjectId: bounty.room,
        toClaimerMist,
        toPosterMist,
        verdictCid: verdict.trim(),
      });
      const res = await signAndExecute({ transaction: tx });
      await client.waitForTransaction({ digest: res.digest });
      setSuccessDigest(res.digest);
      await onResolved();
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "resolve failed");
    } finally {
      setBusy(false);
    }
  }

  function quickSplit(claimerPctTarget: number) {
    const claimerAmt = (bounty.amountSui * claimerPctTarget) / 100;
    setToClaimerSui(claimerAmt.toFixed(4));
  }

  return (
    <div className="space-y-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={explorerObjectUrl(bounty.objectId)}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[10px] text-muted hover:underline"
          >
            {bounty.objectId.slice(0, 8)}…{bounty.objectId.slice(-6)} ↗
          </a>
          <h3 className="mt-1 truncate text-sm font-semibold text-white">
            {bounty.title || "(untitled)"}
          </h3>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-xl font-bold text-accent2">
            {bounty.amountSui.toFixed(4)}
          </div>
          <div className="text-[9px] uppercase tracking-widest text-muted">
            SUI locked
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-[11px]">
        <Info label="Poster">
          <a
            href={explorerAddressUrl(bounty.poster)}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-accent hover:underline"
          >
            {short(bounty.poster)}
          </a>
        </Info>
        <Info label="Claimer">
          {bounty.claimer ? (
            <a
              href={explorerAddressUrl(bounty.claimer)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-accent2 hover:underline"
            >
              {short(bounty.claimer)}
            </a>
          ) : (
            <span className="text-muted">—</span>
          )}
        </Info>
        {bounty.briefCid && (
          <Info label="Brief" span={2}>
            <span className="break-words text-white/70">{bounty.briefCid}</span>
          </Info>
        )}
        {bounty.submissionCid && (
          <Info label="Submission" span={2}>
            <span className="break-words text-white/70">
              {bounty.submissionCid}
            </span>
          </Info>
        )}
      </div>

      <div className="space-y-2 rounded-lg border border-line bg-ink/40 p-3">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted">
          <span>Award split</span>
          <span className="font-mono">
            {claimerPct === null
              ? "?"
              : `claimer ${claimerPct.toFixed(1)}% · poster ${(100 - claimerPct).toFixed(1)}%`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex-1">
            <span className="text-[9px] uppercase tracking-widest text-muted">
              To claimer (SUI)
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.0001"
              min="0"
              max={bounty.amountSui}
              value={toClaimerSui}
              onChange={(e) => setToClaimerSui(e.target.value)}
              className="mt-1 block w-full rounded-md border border-line bg-ink px-2 py-1.5 font-mono text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="flex-1">
            <span className="text-[9px] uppercase tracking-widest text-muted">
              To poster (SUI)
            </span>
            <input
              readOnly
              value={
                toPosterMist === null
                  ? "—"
                  : (Number(toPosterMist) / MIST_PER_SUI).toFixed(4)
              }
              className="mt-1 block w-full rounded-md border border-line bg-ink/60 px-2 py-1.5 font-mono text-sm text-muted"
            />
          </label>
        </div>
        <div className="flex gap-2 pt-1">
          {[0, 25, 50, 75, 100].map((pct) => (
            <button
              key={pct}
              onClick={() => quickSplit(pct)}
              className="rounded-md border border-line bg-panel/60 px-2 py-1 font-mono text-[10px] text-muted hover:text-white"
            >
              C{pct}%
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="text-[10px] uppercase tracking-widest text-muted">
          Verdict (≤96 chars, anchored on chain)
        </span>
        <input
          value={verdict}
          onChange={(e) => setVerdict(e.target.value)}
          placeholder='e.g. "submission incomplete, claimer awarded 60% for partial work"'
          maxLength={96}
          className="mt-1 block w-full rounded-md border border-line bg-ink px-3 py-2 text-xs outline-none focus:border-accent"
        />
      </label>

      {err && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
          {err}
        </div>
      )}

      {successDigest && (
        <div className="flex items-center gap-2 rounded-md border border-accent2/30 bg-accent2/10 px-3 py-2 text-[11px] text-accent2">
          <CheckCircle2 size={14} />
          Resolved —{" "}
          <a
            href={explorerTxUrl(successDigest)}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            view tx
          </a>
        </div>
      )}

      <button
        onClick={resolve}
        disabled={busy || !adminCapId}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-accent to-accent2 py-2.5 text-xs font-bold uppercase tracking-widest text-ink disabled:opacity-50"
      >
        {busy ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Gavel size={14} />
        )}
        {busy ? "resolving…" : "Resolve Dispute"}
      </button>
    </div>
  );
}

// ---------------- bits ----------------

function Info({
  label,
  children,
  span = 1,
}: {
  label: string;
  children: React.ReactNode;
  span?: 1 | 2;
}) {
  return (
    <div className={span === 2 ? "col-span-2" : ""}>
      <div className="mb-0.5 text-[9px] uppercase tracking-widest text-muted">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function short(addr: string) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
