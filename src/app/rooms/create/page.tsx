"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { SUI_CHAIN, useSignAndExec } from "@/lib/useSignAndExec";
import {
  Globe,
  Hash,
  PlusCircle,
  RefreshCw,
  Shield,
  Timer,
} from "lucide-react";
import {
  exportRoomKey,
  generateRoomKey,
  getOrCreateIdentity,
  saveRoomKey,
} from "@/lib/crypto";
import { buildCreateRoomTx, freshRoomId } from "@/lib/program";
import { suiToMist } from "@/lib/constants";
import { fetchConfig, OnchainConfig } from "@/lib/onchain";
import { EVENT_TYPE } from "@/lib/constants";

export default function CreateRoomPage() {
  const router = useRouter();
  const client = useSuiClient();
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExec();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<OnchainConfig | null>(null);

  useEffect(() => {
    fetchConfig(client).then(setConfig);
  }, [client]);

  const fee = isPublic
    ? (config?.publicFeeSui ?? 0)
    : (config?.privateFeeSui ?? 0.01);
  const ttlDays = isPublic
    ? (config?.publicTtlMs ?? 7 * 86400 * 1000) / (86400 * 1000)
    : (config?.privateTtlMs ?? 30 * 86400 * 1000) / (86400 * 1000);
  const maxMessages = config?.maxMessages ?? 1000;

  async function handleCreate() {
    if (!account) {
      setError("connect wallet first");
      return;
    }
    if (!name.trim()) {
      setError("name required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const roomId = freshRoomId();
      const raw = await exportRoomKey(await generateRoomKey());
      const identity = getOrCreateIdentity();

      const tx = buildCreateRoomTx({
        roomId,
        name,
        description,
        ownerPubkeyHex: isPublic ? "" : identity.publicKey,
        isPublic,
        roomKey: isPublic ? raw : new Uint8Array(32),
        feeMist: suiToMist(fee),
      });

      const result = await signAndExecute({ transaction: tx, chain: SUI_CHAIN });

      // Wait for tx + fetch the RoomCreated event so we can read the new Room's objectId.
      const txDetails = await client.waitForTransaction({
        digest: result.digest,
        options: { showEvents: true },
      });
      const created = (txDetails.events ?? []).find(
        (e) => e.type === EVENT_TYPE.roomCreated,
      );
      const roomObjectId = (created?.parsedJson as any)?.room as
        | string
        | undefined;
      if (!roomObjectId) {
        throw new Error(
          "Room object id not found in tx events (publish may be misconfigured)",
        );
      }

      saveRoomKey(roomObjectId, raw);
      router.push(`/rooms/${roomObjectId}`);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "transaction failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex justify-center px-2 py-6">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-border-bright bg-surface-dark p-8 md:p-12 shadow-2xl">
        <div className="pointer-events-none absolute top-0 right-0 h-40 w-40 -translate-y-12 translate-x-12 rounded-full bg-sui-blue/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 translate-y-12 -translate-x-12 rounded-full bg-sui-aqua/10 blur-3xl" />

        <header className="relative mb-10 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <PlusCircle size={32} className="text-sui-blue" />
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-black italic tracking-tighter mb-2">
            Initialize Tunnel
          </h1>
          <p className="text-sm text-white/40">
            Set the parameters for your ephemeral chat session.
          </p>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          className="relative space-y-6"
        >
          <Field label="Room Hash">
            <div className="relative">
              <Hash
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20"
              />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="late-night-ops"
                maxLength={64}
                className="w-full rounded-xl border border-border-mid bg-background-deep py-4 pl-12 pr-4 font-mono text-sm outline-none transition-colors focus:border-sui-aqua"
              />
            </div>
          </Field>

          <Field label="Description (optional)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="what's this room for?"
              maxLength={256}
              rows={3}
              className="w-full resize-none rounded-xl border border-border-mid bg-background-deep px-4 py-3 text-sm outline-none transition-colors focus:border-sui-aqua"
            />
          </Field>

          <Field label="Visibility">
            <div className="grid grid-cols-2 gap-3">
              <VisibilityOption
                active={isPublic}
                onClick={() => setIsPublic(true)}
                label="Public"
                price={formatFee(config?.publicFeeSui ?? 0)}
                ttl={`${(config?.publicTtlMs ?? 7 * 86400 * 1000) / (86400 * 1000)}d TTL`}
                caption="anyone joins · history readable"
                color="blue"
              />
              <VisibilityOption
                active={!isPublic}
                onClick={() => setIsPublic(false)}
                label="Private"
                price={formatFee(config?.privateFeeSui ?? 0.01)}
                ttl={`${(config?.privateTtlMs ?? 30 * 86400 * 1000) / (86400 * 1000)}d TTL`}
                caption="invite link · key burns on close"
                color="aqua"
              />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Meta
              label="Duration"
              icon={<Timer size={14} className="text-sui-blue" />}
              value={`${ttlDays} days`}
            />
            <Meta
              label="Chain"
              icon={<Globe size={14} className="text-sui-aqua" />}
              value="SUI"
            />
          </div>

          <p className="text-[10px] text-white/30">
            Limit: {maxMessages.toLocaleString()} messages per room, then it
            auto-locks. Expires after TTL.
          </p>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !account}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-white py-5 text-xs font-black uppercase tracking-[0.3em] text-black transition-all hover:bg-sui-blue glow-blue disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? (
              <RefreshCw className="animate-spin" size={16} />
            ) : account ? (
              <>
                <Shield size={14} />
                {fee > 0 ? `Pay ${fee} SUI · ` : ""}Launch Tunnel
              </>
            ) : (
              "Connect Wallet"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function formatFee(sui: number) {
  if (sui === 0) return "FREE";
  return `${sui} SUI`;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="ml-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
        {label}
      </span>
      {children}
    </label>
  );
}

function Meta({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border-mid bg-background-deep p-4">
      <div className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-white/30">
        {label}
      </div>
      <div className="flex items-center gap-2 text-sm font-bold">
        {icon}
        {value}
      </div>
    </div>
  );
}

function VisibilityOption({
  active,
  onClick,
  label,
  price,
  ttl,
  caption,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  price: string;
  ttl: string;
  caption: string;
  color: "aqua" | "blue";
}) {
  const activeRing =
    color === "aqua"
      ? "border-sui-aqua/60 bg-sui-aqua/10 shadow-glow"
      : "border-sui-blue/60 bg-sui-blue/10 shadow-glow";
  const priceTone =
    color === "aqua" ? "text-sui-aqua" : "text-sui-blue";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-xl border p-4 text-left transition-all ${
        active
          ? activeRing
          : "border-border-mid bg-background-deep hover:border-border-bright"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={`text-sm font-bold ${active ? "text-white" : "text-white/60"}`}
        >
          {label}
        </span>
        <span
          className={`font-mono text-xs ${active ? priceTone : "text-white/30"}`}
        >
          {price}
        </span>
      </div>
      <div className="mt-1 text-[10px] font-mono uppercase tracking-widest text-white/30">
        {ttl}
      </div>
      <div className="mt-2 text-[11px] text-white/40">{caption}</div>
    </button>
  );
}
