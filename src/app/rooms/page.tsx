"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import {
  Activity,
  Compass,
  Cpu,
  Hash,
  PlusCircle,
  RefreshCw,
  Terminal,
} from "lucide-react";
import { listRoomsOnChain, OnchainRoom } from "@/lib/onchain";
import { loadRoomKey } from "@/lib/crypto";

type Filter = "all" | "public" | "private";

export default function RoomsPage() {
  const client = useSuiClient();
  const [rooms, setRooms] = useState<OnchainRoom[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    try {
      setRefreshing(true);
      setError(null);
      const rs = await listRoomsOnChain(client);
      setRooms(rs);
    } catch (e: any) {
      setError(e.message ?? "failed to load");
      setRooms([]);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const filtered = useMemo(() => {
    if (!rooms) return null;
    if (filter === "all") return rooms;
    return rooms.filter((r) => r.visibility === filter);
  }, [rooms, filter]);

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-4xl md:text-5xl font-black italic tracking-tighter mb-2">
            Room Explorer
          </h1>
          <p className="text-sm text-white/40 max-w-lg leading-relaxed">
            Scanning available ephemeral tunnels across the Sui network.
            Public rooms — anyone joins. Private — invite link required.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-sui-blue">
            <Terminal size={14} />
            <span>SCAN_MODE: ACTIVE</span>
          </div>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl border border-border-bright bg-surface-dark px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/60 transition-all hover:border-sui-blue/40 hover:text-white disabled:opacity-50"
          >
            <RefreshCw
              size={12}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
          <Link
            href="/rooms/create"
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-black transition-all hover:bg-sui-blue glow-blue"
          >
            <PlusCircle size={12} />
            New Room
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-border-bright bg-border-dim/50 p-1">
          {(["all", "public", "private"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                filter === f
                  ? "bg-border-bright text-white"
                  : "text-white/40 hover:text-white"
              }`}
            >
              {f}
              {rooms && f !== "all" && (
                <span
                  className={`ml-1.5 font-mono ${
                    filter === f ? "text-sui-blue" : "text-white/30"
                  }`}
                >
                  {rooms.filter((r) => r.visibility === f).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
          {error}
        </div>
      )}

      {filtered === null ? (
        <EmptyShell label="loading from chain…" />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-bright bg-surface-dark/60 p-12 text-center">
          <Compass className="mx-auto mb-4 text-white/20" size={40} />
          <div className="text-sm text-white/40">
            no {filter !== "all" ? filter + " " : ""}rooms yet.{" "}
            <Link
              href="/rooms/create"
              className="text-sui-blue hover:underline"
            >
              initialize one →
            </Link>
          </div>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((r) => (
            <RoomCard key={r.objectId} room={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyShell({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border-bright bg-surface-dark/40 p-12 text-center text-sm text-white/40">
      <RefreshCw className="mx-auto mb-3 animate-spin text-sui-blue" size={20} />
      {label}
    </div>
  );
}

function RoomCard({ room }: { room: OnchainRoom }) {
  const [hasKey, setHasKey] = useState(false);
  useEffect(() => {
    setHasKey(!!loadRoomKey(room.objectId));
  }, [room.objectId]);

  const isBurned = room.status === "burned";
  const isClosed = room.status === "closed" || isBurned;

  return (
    <li>
      <Link
        href={`/rooms/${room.objectId}`}
        className="group flex h-full flex-col rounded-2xl border border-border-bright bg-surface-dark p-6 transition-all hover:border-sui-blue/40"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="rounded-xl bg-white/5 p-3">
            <Hash
              className={
                room.visibility === "public"
                  ? "text-sui-blue"
                  : "text-sui-aqua"
              }
              size={20}
            />
          </div>
          <div className="flex flex-col items-end gap-1">
            <span
              className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                room.visibility === "public"
                  ? "bg-sui-blue/15 text-sui-blue"
                  : "bg-sui-aqua/15 text-sui-aqua"
              }`}
            >
              {room.visibility}
            </span>
            <span
              className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                isClosed
                  ? "bg-red-500/15 text-red-400"
                  : "bg-sui-blue/15 text-sui-blue"
              }`}
            >
              {isBurned ? "burned" : isClosed ? "closed" : "open"}
            </span>
          </div>
        </div>

        <h3 className="mb-1 truncate text-lg font-bold transition-colors group-hover:text-sui-blue">
          #{room.name || room.objectId.slice(0, 8)}
        </h3>
        <p className="mb-5 line-clamp-2 min-h-[2.5rem] text-sm text-white/40">
          {room.description || "—"}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border-mid pt-4">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40">
            <Activity size={12} className="text-sui-blue" />
            {room.messageCount} msgs
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40">
            <Cpu size={12} className="text-sui-aqua" />
            {new Date(room.createdAtMs).toLocaleDateString()}
          </div>
          {hasKey && room.visibility === "private" && (
            <div className="ml-auto rounded-md bg-sui-aqua/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-sui-aqua">
              joined
            </div>
          )}
        </div>
        <div className="mt-3 truncate font-mono text-[10px] text-white/20">
          {room.objectId}
        </div>
      </Link>
    </li>
  );
}
