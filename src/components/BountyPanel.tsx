"use client";

/**
 * Bounty panel rendered below the chat in a room. Lists every bounty posted
 * in the room (newest first), and surfaces role-aware actions:
 *
 *   - Anyone (not poster) on OPEN  → Claim
 *   - Poster on OPEN               → Cancel
 *   - Claimer on CLAIMED           → Submit work
 *   - Poster on CLAIMED|SUBMITTED  → Dispute
 *   - Claimer on CLAIMED|SUBMITTED → Dispute
 *   - Poster on SUBMITTED          → Release
 *   - Claimer on SUBMITTED (after review_deadline) → Self-release
 *   - Anyone on CLAIMED (after claim_deadline)     → Reopen
 *   - Anyone on OPEN|CLAIMED|SUBMITTED after room close → Resolve (sweep)
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SuiClient } from "@mysten/sui/client";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  Coins,
  Loader2,
  Plus,
  RefreshCcw,
  RotateCcw,
  Send,
  XCircle,
} from "lucide-react";
import {
  type OnchainBounty,
  buildCancelBountyTx,
  buildClaimAfterTimeoutTx,
  buildClaimBountyTx,
  buildDisputeBountyTx,
  buildPostBountyTx,
  buildReleaseBountyTx,
  buildReopenExpiredTx,
  buildSubmitWorkTx,
  encryptBountyContent,
  listBountiesByRoom,
  statusLabel,
  statusTone,
} from "@/lib/bounty";
import {
  MIST_PER_SUI,
  explorerAddressUrl,
  explorerObjectUrl,
} from "@/lib/constants";
import { decryptCid } from "@/lib/chat";
import type { Transaction } from "@mysten/sui/transactions";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

interface Props {
  client: SuiClient;
  roomObjectId: string;
  roomIsOpen: boolean;
  account: { address: string } | null;
  signAndExecute: (input: { transaction: Transaction }) => Promise<{
    digest: string;
  }>;
}

export function BountyPanel({
  client,
  roomObjectId,
  roomIsOpen,
  account,
  signAndExecute,
}: Props) {
  const [bounties, setBounties] = useState<OnchainBounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const list = await listBountiesByRoom(client, roomObjectId);
      setBounties(list);
    } finally {
      setLoading(false);
    }
  }, [client, roomObjectId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 12_000);
    return () => clearInterval(id);
  }, [refresh]);

  const sorted = useMemo(() => {
    // active first (open / claimed / submitted / disputed), then terminal.
    const live = (s: OnchainBounty["status"]) =>
      s === "open" ||
      s === "claimed" ||
      s === "submitted" ||
      s === "disputed";
    return [...bounties].sort((a, b) => {
      const la = live(a.status) ? 0 : 1;
      const lb = live(b.status) ? 0 : 1;
      if (la !== lb) return la - lb;
      return b.createdAtMs - a.createdAtMs;
    });
  }, [bounties]);

  const liveCount = sorted.filter(
    (b) =>
      b.status === "open" ||
      b.status === "claimed" ||
      b.status === "submitted" ||
      b.status === "disputed",
  ).length;

  return (
    <section className="rounded-3xl border border-border-bright bg-surface-dark">
      <header className="flex items-center justify-between gap-3 border-b border-border-mid px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-bright text-sui-aqua">
            <Award size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-white">
              Bounties
            </h3>
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/30">
              {loading
                ? "loading…"
                : `${liveCount} active · ${sorted.length} total`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-bright text-white/40 transition-all hover:border-sui-blue/40 hover:text-white"
            title="refresh"
          >
            <RefreshCcw size={13} />
          </button>
          {account && roomIsOpen && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-2 rounded-xl bg-sui-aqua px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-black transition-all hover:scale-105"
            >
              <Plus size={12} />
              Post Bounty
            </button>
          )}
        </div>
      </header>

      {showForm && account && roomIsOpen && (
        <PostBountyForm
          roomObjectId={roomObjectId}
          account={account}
          onClose={() => setShowForm(false)}
          onSuccess={async () => {
            setShowForm(false);
            await refresh();
          }}
          signAndExecute={signAndExecute}
          client={client}
        />
      )}

      {loading && sorted.length === 0 ? (
        <div className="px-6 py-12 text-center text-xs text-white/30">
          loading bounties from chain…
        </div>
      ) : sorted.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-border-bright text-white/20">
            <Award size={20} />
          </div>
          <div className="text-xs text-white/40">
            No bounties yet in this room.
          </div>
          {!account && (
            <div className="mt-2 text-[10px] text-white/30">
              Connect a wallet to post one.
            </div>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-border-mid">
          {sorted.map((b) => (
            <li key={b.objectId}>
              <BountyCard
                bounty={b}
                now={now}
                account={account}
                roomObjectId={roomObjectId}
                roomIsOpen={roomIsOpen}
                client={client}
                signAndExecute={signAndExecute}
                onAction={refresh}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------- Bounty card ----------------

function BountyCard({
  bounty,
  now,
  account,
  roomObjectId,
  roomIsOpen,
  client,
  signAndExecute,
  onAction,
}: {
  bounty: OnchainBounty;
  now: number;
  account: { address: string } | null;
  roomObjectId: string;
  roomIsOpen: boolean;
  client: SuiClient;
  signAndExecute: (i: { transaction: Transaction }) => Promise<{
    digest: string;
  }>;
  onAction: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [briefPlain, setBriefPlain] = useState<string | null>(null);
  const [submissionPlain, setSubmissionPlain] = useState<string | null>(null);
  const tone = statusTone(bounty.status);

  const isPoster = !!account && account.address === bounty.poster;
  const isClaimer = !!account && account.address === bounty.claimer;

  // Brief + submission CIDs point at encrypted IPFS envelopes — fetch +
  // decrypt with the local room key. Falls back to raw CID display if the key
  // is missing or the blob can't be fetched.
  useEffect(() => {
    if (!bounty.briefCid) {
      setBriefPlain(null);
      return;
    }
    let cancelled = false;
    decryptCid(roomObjectId, bounty.briefCid).then((p) => {
      if (!cancelled) setBriefPlain(p);
    });
    return () => {
      cancelled = true;
    };
  }, [bounty.briefCid, roomObjectId]);

  useEffect(() => {
    if (!bounty.submissionCid) {
      setSubmissionPlain(null);
      return;
    }
    let cancelled = false;
    decryptCid(roomObjectId, bounty.submissionCid).then((p) => {
      if (!cancelled) setSubmissionPlain(p);
    });
    return () => {
      cancelled = true;
    };
  }, [bounty.submissionCid, roomObjectId]);

  const claimExpired =
    bounty.status === "claimed" &&
    bounty.claimDeadlineMs > 0 &&
    now >= bounty.claimDeadlineMs;
  const reviewExpired =
    bounty.status === "submitted" &&
    bounty.reviewDeadlineMs > 0 &&
    now >= bounty.reviewDeadlineMs;

  const run = async (label: string, builder: () => Transaction) => {
    setErr(null);
    setBusy(label);
    try {
      const tx = builder();
      const res = await signAndExecute({ transaction: tx });
      await client.waitForTransaction({ digest: res.digest });
      await onAction();
    } catch (e: any) {
      console.error(`${label} failed`, e);
      setErr(e?.message ?? `${label} failed`);
    } finally {
      setBusy(null);
    }
  };

  // What action buttons can this user take right now?
  const actions: Array<{
    label: string;
    danger?: boolean;
    primary?: boolean;
    onClick: () => Promise<void>;
    icon: typeof Send;
  }> = [];

  // Once room is closed/burned, no more bounty actions are possible — the
  // contract blocks close_room while active_bounty_count > 0, so all bounties
  // are necessarily terminal (RELEASED / CANCELLED) by the time the room closes.
  if (roomIsOpen) {
    if (bounty.status === "open") {
      if (isPoster) {
        actions.push({
          label: "Cancel",
          danger: true,
          icon: XCircle,
          onClick: () =>
            run("cancel", () =>
              buildCancelBountyTx({
                bountyObjectId: bounty.objectId,
                roomObjectId,
              }),
            ),
        });
      } else if (account) {
        actions.push({
          label: "Claim",
          primary: true,
          icon: Award,
          onClick: () => run("claim", () => buildClaimBountyTx(bounty.objectId)),
        });
      }
    }

    if (bounty.status === "claimed") {
      if (isClaimer && !claimExpired) {
        actions.push({
          label: "Submit Work",
          primary: true,
          icon: Send,
          onClick: async () => {
            const text = prompt(
              "Submission (will be encrypted with the room key and uploaded):",
              "",
            );
            if (!text || !text.trim() || !account) return;
            setErr(null);
            setBusy("submit");
            try {
              const cid = await encryptBountyContent({
                roomObjectId,
                sender: account.address,
                plaintext: text.trim(),
              });
              const tx = buildSubmitWorkTx({
                bountyObjectId: bounty.objectId,
                submissionCid: cid,
              });
              const res = await signAndExecute({ transaction: tx });
              await client.waitForTransaction({ digest: res.digest });
              await onAction();
            } catch (e: any) {
              console.error("submit failed", e);
              setErr(e?.message ?? "submit failed");
            } finally {
              setBusy(null);
            }
          },
        });
      }
      if (claimExpired) {
        actions.push({
          label: "Reopen (expired)",
          icon: RotateCcw,
          onClick: () =>
            run("reopen", () => buildReopenExpiredTx(bounty.objectId)),
        });
      }
      if (isPoster || isClaimer) {
        actions.push({
          label: "Dispute",
          danger: true,
          icon: AlertTriangle,
          onClick: () => disputeFlow(bounty, run),
        });
      }
    }

    if (bounty.status === "submitted") {
      if (isPoster) {
        actions.push({
          label: "Release",
          primary: true,
          icon: CheckCircle2,
          onClick: () =>
            run("release", () =>
              buildReleaseBountyTx({
                bountyObjectId: bounty.objectId,
                roomObjectId,
              }),
            ),
        });
      }
      if (isClaimer && reviewExpired) {
        actions.push({
          label: "Self-release (poster ghosted)",
          primary: true,
          icon: CheckCircle2,
          onClick: () =>
            run("self-release", () =>
              buildClaimAfterTimeoutTx({
                bountyObjectId: bounty.objectId,
                roomObjectId,
              }),
            ),
        });
      }
      if (isPoster || isClaimer) {
        actions.push({
          label: "Dispute",
          danger: true,
          icon: AlertTriangle,
          onClick: () => disputeFlow(bounty, run),
        });
      }
    }
  }

  return (
    <div className="px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${tone.bg} ${tone.text} ${tone.border}`}
            >
              {statusLabel(bounty.status)}
            </span>
            <a
              href={explorerObjectUrl(bounty.objectId)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] text-white/30 hover:text-sui-blue hover:underline"
            >
              {bounty.objectId.slice(0, 6)}…{bounty.objectId.slice(-4)} ↗
            </a>
          </div>
          <h4 className="truncate text-base font-semibold text-white">
            {bounty.title || "(untitled bounty)"}
          </h4>
          {bounty.briefCid && (
            <p className="mt-1 break-words text-xs text-white/50">
              {briefPlain !== null ? (
                briefPlain
              ) : (
                <span className="italic text-white/30">
                  [encrypted — no room key on this device]
                </span>
              )}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="flex items-center justify-end gap-1.5 font-mono text-xl font-bold text-sui-aqua">
            <Coins size={16} />
            {bounty.amountSui.toFixed(4)}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-white/30">
            SUI bounty
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-[11px] sm:grid-cols-3">
        <Field label="Poster">
          <a
            href={explorerAddressUrl(bounty.poster)}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-sui-blue hover:underline"
          >
            {short(bounty.poster)}
          </a>
        </Field>
        <Field label="Claimer">
          {bounty.claimer ? (
            <a
              href={explorerAddressUrl(bounty.claimer)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-sui-aqua hover:underline"
            >
              {short(bounty.claimer)}
            </a>
          ) : (
            <span className="text-white/30">—</span>
          )}
        </Field>
        <Field label="Locked">
          <span className="font-mono">
            {(Number(bounty.lockedMist) / MIST_PER_SUI).toFixed(4)} SUI
          </span>
        </Field>
        {bounty.status === "claimed" && bounty.claimDeadlineMs > 0 && (
          <Field label="Submit deadline" span={3}>
            <Deadline target={bounty.claimDeadlineMs} now={now} />
          </Field>
        )}
        {bounty.status === "submitted" && bounty.reviewDeadlineMs > 0 && (
          <Field label="Review deadline" span={3}>
            <Deadline target={bounty.reviewDeadlineMs} now={now} />
          </Field>
        )}
        {bounty.submissionCid && (
          <Field label="Submission" span={3}>
            <span className="break-words text-white/80">
              {submissionPlain !== null ? (
                submissionPlain
              ) : (
                <span className="italic text-white/30">
                  [encrypted — no room key on this device]
                </span>
              )}
            </span>
          </Field>
        )}
      </div>

      {bounty.status === "disputed" && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-[11px] text-red-300">
          <AlertTriangle size={14} />
          Awaiting admin verdict — funds frozen.
        </div>
      )}

      {actions.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={() => {
                void a.onClick();
              }}
              disabled={busy !== null}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 ${
                a.primary
                  ? "bg-sui-aqua text-black hover:scale-105"
                  : a.danger
                    ? "border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                    : "border border-border-bright bg-background-deep text-white/80 hover:border-sui-blue/40 hover:text-white"
              }`}
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <a.icon size={12} />}
              {a.label}
            </button>
          ))}
        </div>
      )}

      {err && (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-[11px] text-red-300">
          {err}
        </div>
      )}
    </div>
  );
}

function disputeFlow(
  bounty: OnchainBounty,
  run: (label: string, builder: () => Transaction) => Promise<void>,
) {
  const reason = prompt(
    "Dispute reason (max ~90 chars). This is anchored on chain.",
    "",
  );
  if (!reason || !reason.trim()) return Promise.resolve();
  return run("dispute", () =>
    buildDisputeBountyTx({
      bountyObjectId: bounty.objectId,
      reasonCid: reason.trim(),
    }),
  );
}

// ---------------- Post form ----------------

function PostBountyForm({
  roomObjectId,
  account,
  onClose,
  onSuccess,
  signAndExecute,
  client,
}: {
  roomObjectId: string;
  account: { address: string };
  onClose: () => void;
  onSuccess: () => Promise<void>;
  signAndExecute: (i: { transaction: Transaction }) => Promise<{
    digest: string;
  }>;
  client: SuiClient;
}) {
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [amountSui, setAmountSui] = useState("");
  const [claimHours, setClaimHours] = useState("24");
  const [reviewHours, setReviewHours] = useState("72");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    const amt = Number(amountSui);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr("Amount must be > 0");
      return;
    }
    const ch = Number(claimHours);
    const rh = Number(reviewHours);
    if (!Number.isFinite(ch) || ch <= 0 || !Number.isFinite(rh) || rh <= 0) {
      setErr("Windows must be positive");
      return;
    }
    if (!title.trim()) {
      setErr("Title required");
      return;
    }
    if (title.length > 96) {
      setErr("Title must be ≤96 chars");
      return;
    }

    setBusy(true);
    try {
      // Encrypt the brief with the room key + upload — the on-chain field
      // stores only the resulting IPFS CID. Empty brief skips encryption.
      const briefCid = brief.trim()
        ? await encryptBountyContent({
            roomObjectId,
            sender: account.address,
            plaintext: brief.trim(),
          })
        : "";

      const tx = buildPostBountyTx({
        roomObjectId,
        amountMist: BigInt(Math.round(amt * MIST_PER_SUI)),
        title: title.trim(),
        briefCid,
        claimWindowMs: Math.round(ch * HOUR_MS),
        reviewWindowMs: Math.round(rh * HOUR_MS),
      });
      const res = await signAndExecute({ transaction: tx });
      await client.waitForTransaction({ digest: res.digest });
      await onSuccess();
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "post failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-border-mid bg-background-deep/60 px-6 py-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Labeled label="Title (≤96 chars)" span={2}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Fix login redirect bug"
            maxLength={96}
            className="block w-full rounded-lg border border-border-mid bg-background-deep px-3 py-2 text-sm text-white outline-none focus:border-sui-blue/50"
          />
        </Labeled>
        <Labeled label="Brief (encrypted with room key)" span={2}>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="What needs to be done? Acceptance criteria, links, anything…"
            rows={3}
            maxLength={2000}
            className="block w-full rounded-lg border border-border-mid bg-background-deep px-3 py-2 text-xs text-white outline-none focus:border-sui-blue/50"
          />
        </Labeled>
        <Labeled label="Amount (SUI)">
          <input
            type="number"
            inputMode="decimal"
            step="0.0001"
            min="0"
            value={amountSui}
            onChange={(e) => setAmountSui(e.target.value)}
            placeholder="5"
            className="block w-full rounded-lg border border-border-mid bg-background-deep px-3 py-2 font-mono text-sm text-white outline-none focus:border-sui-blue/50"
          />
        </Labeled>
        <Labeled label="Submit window (hours)">
          <input
            type="number"
            min="1"
            value={claimHours}
            onChange={(e) => setClaimHours(e.target.value)}
            className="block w-full rounded-lg border border-border-mid bg-background-deep px-3 py-2 font-mono text-sm text-white outline-none focus:border-sui-blue/50"
          />
        </Labeled>
        <Labeled label="Review window (hours)" span={2}>
          <input
            type="number"
            min="1"
            value={reviewHours}
            onChange={(e) => setReviewHours(e.target.value)}
            className="block w-full rounded-lg border border-border-mid bg-background-deep px-3 py-2 font-mono text-sm text-white outline-none focus:border-sui-blue/50"
          />
        </Labeled>
      </div>

      {err && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-[11px] text-red-300">
          {err}
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          disabled={busy}
          className="rounded-lg border border-border-bright bg-background-deep px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white/60 hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="flex items-center gap-2 rounded-lg bg-sui-aqua px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-black hover:scale-105 disabled:opacity-50"
        >
          {busy && <Loader2 size={12} className="animate-spin" />}
          {busy ? "posting…" : "Post & Lock Funds"}
        </button>
      </div>
    </div>
  );
}

// ---------------- bits ----------------

function Field({
  label,
  children,
  span = 1,
}: {
  label: string;
  children: React.ReactNode;
  span?: 1 | 2 | 3;
}) {
  const spanClass =
    span === 3 ? "sm:col-span-3" : span === 2 ? "sm:col-span-2" : "";
  return (
    <div className={spanClass}>
      <div className="mb-0.5 text-[9px] font-bold uppercase tracking-widest text-white/30">
        {label}
      </div>
      <div className="text-[11px]">{children}</div>
    </div>
  );
}

function Labeled({
  label,
  children,
  span = 1,
}: {
  label: string;
  children: React.ReactNode;
  span?: 1 | 2;
}) {
  return (
    <label className={`block ${span === 2 ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/40">
        {label}
      </span>
      {children}
    </label>
  );
}

function Deadline({ target, now }: { target: number; now: number }) {
  const ms = target - now;
  if (ms <= 0)
    return (
      <span className="font-mono text-red-400">
        <Clock size={11} className="inline mr-1 -mt-0.5" />
        expired
      </span>
    );
  const color =
    ms < HOUR_MS
      ? "text-yellow-300"
      : ms < DAY_MS
        ? "text-amber-300"
        : "text-emerald-300";
  return (
    <span className={`font-mono ${color}`}>
      <Clock size={11} className="inline mr-1 -mt-0.5" />
      {formatRemaining(ms)}
    </span>
  );
}

function short(addr: string) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "expired";
  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
