"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { SUI_CHAIN, useSignAndExec } from "@/lib/useSignAndExec";
import {
  ArrowLeft,
  Flame,
  Info,
  Lock,
  Power,
  Send,
  Share2,
} from "lucide-react";
import {
  destroyRoomKey,
  fromHex,
  loadRoomKey,
  saveRoomKey,
  toHex,
} from "@/lib/crypto";
import { decryptCid, sendMessage } from "@/lib/chat";
import {
  buildBurnRoomKeyTx,
  buildCloseRoomTx,
} from "@/lib/program";
import {
  fetchConfig,
  fetchMessagesPage,
  fetchRoom,
  OnchainConfig,
  OnchainMessage,
  OnchainRoom,
  subscribeRoom,
} from "@/lib/onchain";
import { wipePlaintext } from "@/lib/plaintextCache";
import { decodeInvite, encodeInvite } from "@/lib/invite";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/constants";
import { BountyPanel } from "@/components/BountyPanel";

type Msg = OnchainMessage & { plaintext: string | null };

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const roomObjectId = params.id;
  const client = useSuiClient();
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExec();

  const [room, setRoom] = useState<OnchainRoom | null>(null);
  const [config, setConfig] = useState<OnchainConfig | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCopied, setShowCopied] = useState(false);
  const [joinKey, setJoinKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [oldestCursor, setOldestCursor] = useState<any>(null);
  const msgKey = (m: { digest: string; index: number }) =>
    `${m.digest}:${m.index}`;
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetchConfig(client).then(setConfig);
  }, [client]);

  const isOwner = useMemo(
    () => !!(account && room && room.owner === account.address),
    [account, room],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const inv = u.searchParams.get("invite");
    if (inv) {
      const decoded = decodeInvite(inv);
      if (decoded && decoded.roomObjectId === roomObjectId) {
        saveRoomKey(decoded.roomObjectId, fromHex(decoded.roomKeyHex));
        u.searchParams.delete("invite");
        window.history.replaceState({}, "", u.toString());
      }
    }
    setHasKey(!!loadRoomKey(roomObjectId));
  }, [roomObjectId]);

  const refresh = useCallback(async () => {
    try {
      const r = await fetchRoom(client, roomObjectId);
      setRoom(r);
      if (!r) {
        setMessages([]);
        return;
      }

      // Public rooms publish the AES key on chain — copy it into localStorage
      // the first time we see this room so the user can decrypt without an
      // invite link.
      if (r.visibility === "public" && !loadRoomKey(r.objectId)) {
        if (r.roomKey && r.roomKey.length === 32) {
          saveRoomKey(r.objectId, r.roomKey);
        }
      }

      // Private room closed → wipe our local copy of the key.
      if (r.status === "closed" && r.visibility === "private") {
        destroyRoomKey(roomObjectId);
        wipePlaintext(roomObjectId);
      }
      setHasKey(!!loadRoomKey(r.objectId));

      const page = await fetchMessagesPage(client, roomObjectId, { limit: 50 });
      const decrypted = await Promise.all(
        page.messages.map(async (m) => ({
          ...m,
          plaintext: await decryptCid(roomObjectId, m.cid),
        })),
      );
      const seen = new Set<string>();
      const deduped = decrypted.filter((m) => {
        const k = msgKey(m);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      setMessages(deduped);
      setOldestCursor(page.nextCursor);
    } catch (e) {
      console.error("refresh failed", e);
    } finally {
      setLoading(false);
    }
  }, [client, roomObjectId]);

  const refreshDelta = useCallback(async () => {
    try {
      const r = await fetchRoom(client, roomObjectId);
      setRoom(r);
      if (!r) return;

      // Latest page only — dedup by digest:index against current state.
      const page = await fetchMessagesPage(client, roomObjectId, { limit: 20 });
      if (page.messages.length === 0) return;

      const decrypted = await Promise.all(
        page.messages.map(async (m) => ({
          ...m,
          plaintext: await decryptCid(roomObjectId, m.cid),
        })),
      );
      setMessages((prev) => {
        const seen = new Set(prev.map(msgKey));
        const fresh = decrypted.filter((m) => !seen.has(msgKey(m)));
        return fresh.length === 0 ? prev : [...prev, ...fresh];
      });
    } catch (e) {
      console.error("refreshDelta failed", e);
    }
  }, [client, roomObjectId]);

  async function loadOlder() {
    if (!oldestCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await fetchMessagesPage(client, roomObjectId, {
        cursor: oldestCursor,
        limit: 50,
      });
      const decrypted = await Promise.all(
        page.messages.map(async (m) => ({
          ...m,
          plaintext: await decryptCid(roomObjectId, m.cid),
        })),
      );
      setMessages((prev) => {
        const seen = new Set(prev.map(msgKey));
        const fresh = decrypted.filter((m) => !seen.has(msgKey(m)));
        return fresh.length === 0 ? prev : [...fresh, ...prev];
      });
      setOldestCursor(page.nextCursor);
    } catch (e) {
      console.error("loadOlder failed", e);
    } finally {
      setLoadingOlder(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (room?.status !== "burned") return;
    destroyRoomKey(roomObjectId);
    wipePlaintext(roomObjectId);
    setHasKey(false);
    setMessages((prev) => prev.map((m) => ({ ...m, plaintext: null })));
  }, [room?.status, roomObjectId]);

  const refreshDeltaRef = useRef(refreshDelta);
  useEffect(() => {
    refreshDeltaRef.current = refreshDelta;
  }, [refreshDelta]);

  useEffect(() => {
    const unsub = subscribeRoom(client, roomObjectId, () => {
      refreshDeltaRef.current();
    });
    return unsub;
  }, [client, roomObjectId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  async function handleSend() {
    if (!room || !account || !input.trim()) return;
    setSending(true);
    const text = input.trim();
    setInput("");
    try {
      await sendMessage({
        roomObjectId: room.objectId,
        sender: account.address,
        signAndExecute: async (tx) => {
          const res = await signAndExecute({ transaction: tx, chain: SUI_CHAIN });
          await client.waitForTransaction({ digest: res.digest });
          return { digest: res.digest };
        },
        plaintext: text,
      });
      await refreshDelta();
    } catch (e) {
      console.error(e);
      alert((e as Error).message);
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  async function handleClose() {
    if (!room || !account) return;
    if (room.activeBountyCount > 0) {
      alert(
        `Can't close: ${room.activeBountyCount} active bounty${room.activeBountyCount > 1 ? "s" : ""} still in this room. Cancel, release, or resolve each one first.`,
      );
      return;
    }
    const msg =
      room.visibility === "public"
        ? "Close this public room? It blocks new messages on chain. Past messages stay readable (public keys are derivable forever)."
        : "Close this private room? Blocks new messages on chain. Use 'burn local key' separately to wipe this device's copy of the key.";
    if (!confirm(msg)) return;
    try {
      const tx = buildCloseRoomTx(room.objectId);
      const res = await signAndExecute({ transaction: tx, chain: SUI_CHAIN });
      await client.waitForTransaction({ digest: res.digest });
      await refreshDelta();
    } catch (e) {
      console.error(e);
      alert((e as Error).message);
    }
  }

  async function handleBurnKey() {
    if (!room || !account || !isOwner) return;
    if (room.visibility !== "public") return;
    if (room.status !== "closed") return;
    if (!room.roomKey || room.roomKey.length !== 32) return;

    if (
      !confirm(
        "Burn the room key on-chain? Empties the room_key field — no new visitor reading the chain can recover it. This tx is permanent.",
      )
    )
      return;

    try {
      const tx = buildBurnRoomKeyTx(room.objectId);
      const res = await signAndExecute({ transaction: tx, chain: SUI_CHAIN });
      await client.waitForTransaction({ digest: res.digest });
    } catch (e) {
      console.error(e);
      alert((e as Error).message);
      return;
    }

    destroyRoomKey(room.objectId);
    wipePlaintext(room.objectId);
    setHasKey(false);
    setMessages((prev) => prev.map((m) => ({ ...m, plaintext: null })));
    setRoom((prev) =>
      prev ? { ...prev, status: "burned", roomKey: undefined } : prev,
    );
  }

  function copyInvite() {
    if (!room) return;
    const raw = loadRoomKey(room.objectId);
    if (!raw) {
      alert("no room key on this device");
      return;
    }
    const invite = encodeInvite({
      roomObjectId: room.objectId,
      roomId: room.roomId,
      name: room.name,
      ownerPubkeyHex: room.ownerPubkeyHex,
      roomKeyHex: toHex(raw),
    });
    const url = `${window.location.origin}/rooms/${room.objectId}?invite=${invite}`;
    navigator.clipboard.writeText(url);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  }

  function manualJoin() {
    const raw = joinKey.trim();
    if (!raw) return;

    let token = raw;
    try {
      const u = new URL(raw);
      const inv = u.searchParams.get("invite");
      if (inv) token = inv;
    } catch {}

    const decoded = decodeInvite(token);
    if (!decoded) {
      alert("invalid invite — paste the full link the owner shared");
      return;
    }
    if (decoded.roomObjectId !== roomObjectId) {
      alert("this invite is for a different room");
      return;
    }
    saveRoomKey(roomObjectId, fromHex(decoded.roomKeyHex));
    setHasKey(true);
    setJoinKey("");
    refresh();
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border-bright bg-surface-dark/60 p-12 text-center text-sm text-white/40">
        loading from chain…
      </div>
    );
  }

  if (!room) {
    return (
      <div className="rounded-2xl border border-border-bright bg-surface-dark p-12 text-center">
        <div className="text-sm text-white/60">room not found on-chain.</div>
        <div className="mt-2 font-mono text-[10px] text-white/30">
          {roomObjectId}
        </div>
      </div>
    );
  }

  const cap = config?.maxMessages ?? 0;
  const capReached = cap > 0 && room.messageCount >= cap;
  const expired = !!room.expiresAtMs && now >= room.expiresAtMs;
  const ttlMs = room.expiresAtMs ? Math.max(0, room.expiresAtMs - now) : null;
  const isBurned = room.status === "burned";
  const canSend = room.status === "open" && !expired && !capReached && hasKey;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* MAIN CHAT */}
      <div className="flex flex-col rounded-3xl border border-border-bright bg-surface-dark overflow-hidden">
        <header className="flex items-center justify-between gap-4 border-b border-border-mid bg-background-deep/60 px-6 py-4 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/rooms"
              aria-label="back to rooms"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-bright text-white/50 transition-all hover:border-sui-blue/40 hover:text-white"
            >
              <ArrowLeft size={16} />
            </Link>
            <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-bold">
                #{(room.name || room.objectId.slice(0, 8)).toLowerCase()}
              </h2>
              <span
                className={`rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                  room.visibility === "public"
                    ? "border-sui-blue/40 bg-sui-blue/15 text-sui-blue"
                    : "border-sui-aqua/40 bg-sui-aqua/15 text-sui-aqua"
                }`}
              >
                {room.visibility}
              </span>
              {isBurned && (
                <span className="rounded-md bg-yellow-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-yellow-300">
                  burned
                </span>
              )}
            </div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/30">
              Protocol: SoSui_v1 // Tunnel: {room.status.toUpperCase()}
            </p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            {ttlMs !== null && (
              <div className="text-right">
                <div className="text-[9px] font-bold uppercase tracking-widest text-white/30">
                  Self-Destruct In
                </div>
                <div
                  className={`font-mono text-xl font-bold tracking-tight ${
                    expired
                      ? "text-red-500"
                      : ttlMs < 3600_000
                        ? "text-yellow-300"
                        : "text-sui-blue"
                  }`}
                >
                  {formatRemaining(ttlMs)}
                </div>
              </div>
            )}
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border-bright text-white/40">
              <Lock size={18} />
            </div>
          </div>
        </header>

        <div
          ref={scrollRef}
          className="scrollbar-hide h-[480px] space-y-4 overflow-y-auto px-6 py-6"
        >
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center opacity-20">
              <Lock size={56} />
              <div className="font-mono text-xs uppercase tracking-[0.3em]">
                Tunnel Initialized
              </div>
            </div>
          ) : (
            <ul className="space-y-4">
              {oldestCursor && (
                <li>
                  <button
                    onClick={loadOlder}
                    disabled={loadingOlder}
                    className="w-full rounded-xl border border-border-mid bg-background-deep px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white/40 transition-all hover:text-white disabled:opacity-50"
                  >
                    {loadingOlder ? "loading…" : "load older messages"}
                  </button>
                </li>
              )}
              {messages.map((m) => {
                const me = !!account && m.sender === account.address;
                const palette = me ? null : colorFor(m.sender);
                return (
                  <li
                    key={`${m.digest}:${m.index}`}
                    className={`flex gap-3 ${me ? "flex-row-reverse" : ""}`}
                  >
                    <Avatar address={m.sender} me={me} palette={palette} />
                    <div
                      className={`max-w-[78%] space-y-1 ${me ? "text-right" : ""}`}
                    >
                      <div
                        className={`flex items-center gap-2 ${
                          me ? "justify-end" : ""
                        }`}
                      >
                        {me ? (
                          <span className="text-[10px] font-bold text-white">
                            You
                          </span>
                        ) : (
                          <a
                            href={explorerAddressUrl(m.sender)}
                            target="_blank"
                            rel="noreferrer"
                            title={m.sender}
                            className={`font-mono text-[10px] hover:underline ${palette!.name}`}
                          >
                            {shortAddr(m.sender)} ↗
                          </a>
                        )}
                        <span className="font-mono text-[9px] text-white/30">
                          {new Date(m.blockTimeMs).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div
                        className={`whitespace-pre-wrap break-words rounded-2xl border p-3.5 text-sm leading-relaxed ${
                          me
                            ? "rounded-tr-none border-sui-aqua/30 bg-sui-aqua/10 text-left text-white"
                            : `rounded-tl-none ${palette!.bubble} text-white/90`
                        }`}
                      >
                        {me && (
                          <span className="mr-2 text-[10px] uppercase tracking-widest text-sui-aqua/60">
                            [enc]
                          </span>
                        )}
                        {m.plaintext ?? (
                          <span className="italic text-white/40">
                            [unable to decrypt — key missing or destroyed]
                          </span>
                        )}
                      </div>
                      <div
                        className={`flex flex-wrap items-center gap-3 text-[9px] text-white/30 ${
                          me ? "justify-end" : ""
                        }`}
                      >
                        <a
                          href={explorerTxUrl(m.digest)}
                          target="_blank"
                          rel="noreferrer"
                          title={m.digest}
                          className="font-mono text-sui-blue hover:underline"
                        >
                          tx: {shortSig(m.digest)} ↗
                        </a>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="border-t border-border-mid bg-background-deep/40 px-6 py-5">
          {canSend ? (
            <>
              <div className="mb-3 flex justify-center">
                <div className="rounded-full border border-border-bright bg-border-dim px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-white/30">
                  Ephemeral keys enforced
                </div>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-3 rounded-2xl border border-border-bright bg-background-deep p-3 focus-within:border-sui-blue/40 transition-colors"
              >
                <Lock size={18} className="text-white/30 shrink-0" />
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Write encrypted message…"
                  disabled={!account || sending}
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
                />
                <button
                  type="submit"
                  disabled={!account || sending || !input.trim()}
                  className="flex items-center justify-center rounded-xl bg-sui-blue px-4 py-2 text-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed glow-blue"
                >
                  <Send size={16} />
                </button>
              </form>
            </>
          ) : room.status === "open" && (expired || capReached) ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300">
              {expired
                ? "this room has expired (TTL reached). new messages are blocked on-chain."
                : "this room hit the message cap. owner can close to free key (private only)."}
            </div>
          ) : room.status === "open" && !hasKey ? (
            <div className="space-y-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-xs text-yellow-300">
              <div className="flex items-center gap-2">
                <Info size={14} />
                no room key on this device. paste the invite link to join.
              </div>
              <div className="flex gap-2">
                <input
                  value={joinKey}
                  onChange={(e) => setJoinKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && manualJoin()}
                  placeholder="https://.../rooms/...?invite=..."
                  className="flex-1 rounded-lg border border-border-mid bg-background-deep px-3 py-2 font-mono text-[11px] text-white outline-none focus:border-sui-blue/50"
                />
                <button
                  onClick={manualJoin}
                  className="rounded-lg bg-sui-blue px-4 text-xs font-bold uppercase tracking-widest text-black"
                >
                  join
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-center text-xs text-red-300">
              tunnel sealed · no new messages accepted
            </div>
          )}
        </footer>
      </div>

      {/* SIDEBAR */}
      <aside className="space-y-4">
        <div className="rounded-2xl border border-border-bright bg-surface-dark p-5">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
            Room Manifest
          </div>
          <SideItem label="Object ID" value={room.objectId} linkAddr />
          <SideItem label="Owner" value={room.owner} linkAddr />
          <SideItem
            label="Messages"
            value={`${room.messageCount}${cap > 0 ? ` / ${cap}` : ""}`}
            mono
          />
          <SideItem label="Fee paid" value={`${room.feePaidSui} SUI`} mono />
          <SideItem
            label="Active bounties"
            value={`${room.activeBountyCount}`}
            mono
            tone={room.activeBountyCount > 0 ? "yellow" : "default"}
          />
          {ttlMs !== null && (
            <SideItem
              label="TTL"
              value={expired ? "expired" : formatRemaining(ttlMs)}
              mono
              tone={expired ? "red" : ttlMs < 3600_000 ? "yellow" : "default"}
            />
          )}
        </div>

        {room.status === "open" && (
          <button
            onClick={() => {
              if (room.visibility === "public") {
                const url = `${window.location.origin}/rooms/${room.objectId}`;
                navigator.clipboard.writeText(url);
                setShowCopied(true);
                setTimeout(() => setShowCopied(false), 2000);
              } else if (hasKey) {
                copyInvite();
              }
            }}
            disabled={room.visibility === "private" && !hasKey}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-bright bg-surface-dark px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white/70 transition-all hover:border-sui-blue/40 hover:text-white disabled:opacity-50"
          >
            <Share2 size={12} />
            {showCopied
              ? "Copied ✓"
              : room.visibility === "public"
                ? "Copy room link"
                : "Copy invite link"}
          </button>
        )}

        {isOwner && room.status === "open" && (
          <button
            onClick={handleClose}
            disabled={room.activeBountyCount > 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-red-300 transition-all hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-red-500/10"
            title={
              room.activeBountyCount > 0
                ? `Blocked: ${room.activeBountyCount} active bounty${room.activeBountyCount > 1 ? "s" : ""}. Resolve them first.`
                : "On-chain action: locks new messages."
            }
          >
            <Power size={12} />
            {room.activeBountyCount > 0
              ? `Close blocked · ${room.activeBountyCount} bounty${room.activeBountyCount > 1 ? "s" : ""}`
              : "Close Room (on-chain)"}
          </button>
        )}

        {isOwner &&
          room.status === "closed" &&
          room.visibility === "public" &&
          !!room.roomKey &&
          room.roomKey.length === 32 && (
            <button
              onClick={handleBurnKey}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-yellow-300 transition-all hover:bg-yellow-500/20"
              title="Empties room_key on chain. No new viewer can decrypt afterwards."
            >
              <Flame size={12} />
              Burn Key (on-chain)
            </button>
          )}
      </aside>
      </div>

      <BountyPanel
        client={client}
        roomObjectId={roomObjectId}
        roomIsOpen={room.status === "open"}
        account={account}
        signAndExecute={(input) =>
          signAndExecute({ transaction: input.transaction, chain: SUI_CHAIN })
        }
      />
    </div>
  );
}

type Palette = { avatar: string; name: string; bubble: string };

const PALETTE: Palette[] = [
  {
    avatar: "bg-gradient-to-br from-cyan-400 to-blue-500 text-black",
    name: "text-cyan-300",
    bubble: "border-cyan-500/30 bg-cyan-500/5",
  },
  {
    avatar: "bg-gradient-to-br from-pink-400 to-rose-500 text-black",
    name: "text-pink-300",
    bubble: "border-pink-500/30 bg-pink-500/5",
  },
  {
    avatar: "bg-gradient-to-br from-amber-400 to-orange-500 text-black",
    name: "text-amber-300",
    bubble: "border-amber-500/30 bg-amber-500/5",
  },
  {
    avatar: "bg-gradient-to-br from-emerald-400 to-teal-500 text-black",
    name: "text-emerald-300",
    bubble: "border-emerald-500/30 bg-emerald-500/5",
  },
  {
    avatar: "bg-gradient-to-br from-fuchsia-400 to-pink-500 text-black",
    name: "text-fuchsia-300",
    bubble: "border-fuchsia-500/30 bg-fuchsia-500/5",
  },
  {
    avatar: "bg-gradient-to-br from-sky-400 to-indigo-500 text-black",
    name: "text-sky-300",
    bubble: "border-sky-500/30 bg-sky-500/5",
  },
  {
    avatar: "bg-gradient-to-br from-lime-400 to-green-500 text-black",
    name: "text-lime-300",
    bubble: "border-lime-500/30 bg-lime-500/5",
  },
  {
    avatar: "bg-gradient-to-br from-violet-400 to-indigo-500 text-black",
    name: "text-violet-300",
    bubble: "border-violet-500/30 bg-violet-500/5",
  },
];

function colorFor(address: string): Palette {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < address.length; i++) {
    h ^= address.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}

function Avatar({
  address,
  me,
  palette,
}: {
  address: string;
  me: boolean;
  palette: Palette | null;
}) {
  // Sui addresses start with 0x — skip it for a more recognizable initial.
  const initial = address.startsWith("0x")
    ? address.slice(2, 6).toUpperCase()
    : address.slice(0, 4);
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[10px] font-black italic tracking-tight ${
        me
          ? "bg-gradient-to-br from-sui-aqua to-sui-blue text-black"
          : palette!.avatar
      }`}
    >
      {initial}
    </div>
  );
}

function SideItem({
  label,
  value,
  linkAddr,
  mono,
  tone = "default",
}: {
  label: string;
  value: string;
  linkAddr?: boolean;
  mono?: boolean;
  tone?: "default" | "red" | "yellow";
}) {
  const toneClass =
    tone === "red"
      ? "text-red-400"
      : tone === "yellow"
        ? "text-yellow-300"
        : "text-white";
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/30">
        {label}
      </div>
      {linkAddr ? (
        <a
          href={explorerAddressUrl(value)}
          target="_blank"
          rel="noreferrer"
          className="block break-all font-mono text-[10px] text-sui-blue hover:underline"
        >
          {value} ↗
        </a>
      ) : (
        <div
          className={`${mono ? "font-mono text-[11px]" : "text-sm"} ${toneClass}`}
        >
          {value}
        </div>
      )}
    </div>
  );
}

function shortSig(s: string) {
  if (s.length < 14) return s;
  return s.slice(0, 6) + "…" + s.slice(-6);
}

function shortAddr(s: string) {
  if (s.length < 10) return s;
  return s.slice(0, 6) + "…" + s.slice(-4);
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "expired";
  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
