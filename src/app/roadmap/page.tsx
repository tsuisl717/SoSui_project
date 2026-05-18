import { Metadata } from "next";
import { Map as MapIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Roadmap · SoSui",
};

interface Phase {
  tag: string;
  title: string;
  goal: string;
  timeline: string;
  features: string[];
  status: "shipped" | "now" | "next" | "later" | "future";
}

const phases: Phase[] = [
  {
    tag: "PHASE 01",
    title: "Foundation — Encrypted Ephemeral Rooms",
    goal:
      "Ship the privacy-and-self-destruct primitive that every later payment phase composes on.",
    timeline: "Shipped on testnet",
    features: [
      "Pay SUI to create a room — tiered: free (public) / 0.01 SUI (private)",
      "Per-room AES-256 key generated client-side; private rooms are true E2E via invite envelope",
      "Public rooms encrypted-at-rest with on-chain key sharing (any visitor can join — disclosed, not blanket E2E)",
      "Messages encrypted client-side → pinned to IPFS (Pinata) → CID committed to a Sui shared object",
      "TTL enforced on-chain: 7d public, 30d private; per-room message cap (1000) with paginated UI",
      "Live polling subscription (5s) — new messages render across devices",
      "Two-step destruct: owner flips room to Closed → can then burn_room_key to zero the on-chain key (Burned); clients wipe local key on RoomClosed event",
      "Chain is source of truth — frontend pulls room list + history from Sui, not localStorage",
      "Upgradeable Sui Move package via AdminCap (already migrated Config v1 → v2, Room v1 → v4)",
    ],
    status: "shipped",
  },
  {
    tag: "PHASE 02",
    title: "Programmable Private Payments",
    goal:
      "Turn rooms into atomic payment channels. PTB binds SUI transfer + encrypted memo + on-chain commit in one tx — programmable money meets ephemeral privacy.",
    timeline: "Sui Overflow 2026 submission · deadline 2026-06-21",
    features: [
      "PTB-native micropayment — atomic send message + transfer SUI in one tx, no two-step approve",
      "Tip-a-message — recipient gets SUI atomically with the message commit; receipt is non-repudiable on-chain",
      "Paid DM rooms — per-message fee, sender pays per send (creator paid-DM model)",
      "Encrypted payment memo — attach AES-256 encrypted note to any SUI transfer; only counterparty decrypts",
      "Auto fee split — room creation fee atomically splits room owner + protocol treasury via PTB",
      "Mainnet deployment path — Sui mainnet config + Pinata production blob backend (50% prize gated on mainnet)",
    ],
    status: "now",
  },
  {
    tag: "PHASE 03",
    title: "Account Abstraction & Recurring Payments",
    goal:
      "Kill signature fatigue. Stack Sui's native AA primitives — zkLogin, sponsored transactions, session keys, and USDsui gasless transfer — so users tip, subscribe, and stream payments without seeing a wallet popup after the first session approval.",
    timeline: "4 – 6 weeks after Phase 2",
    features: [
      "USDsui gasless transfer — pay and receive in Stripe-issued stablecoin with no SUI required on the user side; gas handled at the protocol level",
      "zkLogin onboarding — sign up with Google / Apple OAuth, no seed phrase, ed25519 keypair derived from the OIDC claim",
      "Sui sponsored transactions — gas station (sui-gas-pool / Shinami) pays SUI gas for add_message and tip txs",
      "Session keys — one wallet popup per room session generates an ephemeral signer scoped to that room",
      "Per-session and per-room spending caps to bound sponsorship cost and abuse",
      "Subscription rooms — monthly USDsui auto-debit via session-key delegation; auto-expire if unpaid",
      "SUI / USDsui streaming payroll — continuous per-second transfer, room as payroll dashboard",
      "Graceful fallback to user-paid mode when relayer is down or session revoked",
    ],
    status: "next",
  },
  {
    tag: "PHASE 04",
    title: "Token Economy & DAO",
    goal:
      "Token flywheel — pay for rooms with $SOSUI at discount, stake to earn free-room allowances, protocol fees buy-back-and-burn.",
    timeline: "4 – 6 weeks after Phase 3",
    features: [
      "Launch $SOSUI (Sui Coin standard) — fair launch, fixed supply",
      "Pay for rooms with $SOSUI at a discount, or stake to unlock free public rooms",
      "Protocol fees auto buy-back & burn $SOSUI",
      "Token-gated VIP rooms (hold N $SOSUI to enter)",
      "DAO governance — vote on fees, TTL, message cap, treasury allocation",
      "Treasury auto-allocation between protocol reserve / LP / buyback",
    ],
    status: "later",
  },
  {
    tag: "PHASE 05",
    title: "Scale & Agent Economy",
    goal:
      "Sui-native decentralized storage + threshold key management, mobile onboarding, and x402-powered API monetization for the AI agent economy.",
    timeline: "8 – 12 weeks after Phase 4 (rolling)",
    features: [
      "Migrate ciphertext storage Pinata → Walrus (Sui-native decentralized blob)",
      "Seal integration — on-chain access control + threshold key management",
      "x402 protocol integration — HTTP 402 payment-required gating on /api endpoints, AI agents pay-per-request in SUI or USDsui",
      "AI-assisted features priced via x402 — chat summary, live translation, cover art, per-room agent memory",
      "Mobile app (React Native) with push notifications and encrypted offline cache",
      "Public dashboard with privacy-friendly on-chain analytics",
      "Cross-chain bridge in — non-Sui users pay into Sui rooms via Wormhole / native bridges",
    ],
    status: "future",
  },
];

const statusStyle: Record<
  Phase["status"],
  { dot: string; label: string; chip: string }
> = {
  shipped: {
    dot: "bg-sui-blue shadow-[0_0_12px_#4DA2FF]",
    label: "shipped",
    chip: "bg-sui-blue/15 text-sui-blue",
  },
  now: {
    dot: "bg-sui-blue shadow-[0_0_12px_#4DA2FF]",
    label: "in progress",
    chip: "bg-sui-blue/15 text-sui-blue",
  },
  next: {
    dot: "bg-sui-aqua shadow-[0_0_12px_#6FBCF0]",
    label: "next up",
    chip: "bg-sui-aqua/15 text-sui-aqua",
  },
  later: {
    dot: "bg-yellow-500/80",
    label: "planned",
    chip: "bg-yellow-500/15 text-yellow-300",
  },
  future: {
    dot: "bg-white/15",
    label: "future",
    chip: "bg-white/5 text-white/40",
  },
};

export default function RoadmapPage() {
  return (
    <div className="space-y-16">
      <header className="space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-sui-aqua/20 bg-sui-aqua/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-sui-aqua">
          <MapIcon size={12} />
          Public Roadmap · v0.1
        </div>
        <h1 className="font-display text-4xl md:text-6xl font-black italic tracking-tighter leading-[0.95]">
          From encrypted rooms to{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-sui-aqua to-sui-blue pr-4">
            programmable private payments
          </span>
          <br />
          on Sui.
        </h1>
        <p className="max-w-3xl text-sm md:text-base text-white/40 leading-relaxed">
          Stripe × Signal, on Sui. Five phases turning PTB-atomic transfers +
          AES-256 ephemeral rooms into the privacy layer for tipping,
          subscriptions, OTC negotiation, and private invoicing. Phase 2 is
          our Sui Overflow 2026 submission — DeFi &amp; Payments core track.
        </p>
      </header>

      <div className="relative space-y-6 md:pl-12">
        {/* timeline rail */}
        <div className="pointer-events-none absolute left-3 top-2 hidden h-[calc(100%-1rem)] w-px bg-gradient-to-b from-sui-blue/70 via-border-bright to-transparent md:block" />

        {phases.map((p, idx) => {
          const style = statusStyle[p.status];
          return (
            <article
              key={p.tag}
              className="group relative rounded-3xl border border-border-bright bg-surface-dark p-6 md:p-8 transition-all hover:border-sui-blue/40"
            >
              <span
                className={`absolute -left-[42px] top-9 hidden h-4 w-4 rounded-full ring-4 ring-background-deep md:block ${style.dot}`}
              />

              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-sui-aqua">
                  {p.tag}
                </span>
                <h2 className="font-display text-xl md:text-2xl font-bold italic tracking-tight">
                  {p.title}
                </h2>
                <span
                  className={`ml-auto rounded-md px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] ${style.chip}`}
                >
                  {style.label}
                </span>
              </div>

              <p className="mt-3 text-sm text-white/60">{p.goal}</p>
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-white/40">
                Timeline: <span className="text-white/70">{p.timeline}</span>
              </p>

              <div className="mt-6">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-sui-blue">
                  Core features
                </div>
                <ul className="grid gap-2 md:grid-cols-2">
                  {p.features.map((it) => (
                    <li
                      key={it}
                      className="flex gap-3 rounded-xl border border-border-mid bg-background-deep p-3 text-sm text-white/85"
                    >
                      <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-sui-blue" />
                      <span className="leading-snug">{it}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {idx === 0 && (
                <div className="mt-6 rounded-xl border border-sui-blue/30 bg-sui-blue/5 p-3 text-xs text-sui-blue">
                  ▲ Live on testnet. Package{" "}
                  <a
                    href="https://suiscan.xyz/testnet/object/0xc991f70da881d7b6c9c02fa54607f032789e39d5a7a42664728b93cef7533cda"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-white"
                  >
                    0xc991…3cda
                  </a>
                  . Config v2 + Room v4 deployed, public/private + TTL + cap all
                  enforced on-chain. Next: PTB-native micropayments + atomic
                  payment memos (Sui Overflow 2026).
                </div>
              )}
            </article>
          );
        })}
      </div>

      <footer className="rounded-3xl border border-border-bright bg-surface-dark p-8 text-sm text-white/60">
        <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-sui-blue">
          Beyond Phase 5
        </div>
        <p className="mt-3 leading-relaxed">
          Long-term vision: become the default private-payment messaging
          layer on Sui — any dApp embeds encrypted, atomic-payment-capable
          rooms, with protocol parameters governed by $SOSUI holders.
        </p>
        <p className="mt-4 leading-relaxed text-white/45">
          Aligned with Sui&apos;s continuing investment in{" "}
          <span className="text-white/70">
            protocol-level gas abstraction
          </span>{" "}
          and{" "}
          <span className="text-white/70">confidential transactions</span> —
          each new primitive that ships makes gasless more pervasive and
          payments more private. SoSui upgrades to consume them as they land.
        </p>
      </footer>
    </div>
  );
}
