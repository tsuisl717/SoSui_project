import Link from "next/link";
import {
  ChevronRight,
  Compass,
  Layers,
  Lock,
  Trash2,
  Zap,
} from "lucide-react";

export function Hero() {
  return (
    <div className="relative">
      {/* full-bleed atmospheric backdrop — blurred brand orbs + scanlines */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-6rem] bottom-[-3rem] left-[calc(50%-50vw)] z-0 w-screen overflow-hidden"
      >
        <div className="hero-grid absolute inset-0" />
        <div className="hero-orb-aqua absolute -top-32 left-[6%] h-[44rem] w-[44rem] rounded-full" />
        <div className="hero-orb-blue absolute top-24 right-[4%] h-[36rem] w-[36rem] rounded-full" />
        <div className="hero-scanlines absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-background-deep" />
      </div>

      

      <section className="relative z-10 pt-16">
        {/* tag pill */}
        <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 backdrop-blur-sm">
          <Zap size={11} className="fill-sui-aqua text-sui-aqua" />
          <span className="text-[10px] uppercase tracking-[0.28em] text-white/60">
            Sui Overflow 2026
          </span>
          <span className="h-1 w-1 rounded-full bg-white/25" />
          <span className="text-[10px] uppercase tracking-[0.28em] text-white/60">
            PTB Atomic Payments
          </span>
          <span className="h-1 w-1 rounded-full bg-white/25" />
          <span className="text-[10px] uppercase tracking-[0.28em] text-white/60">
            AES 256
          </span>
        </div>

        {/* headline */}
        <h1 className="mt-7 font-display text-5xl font-black italic leading-[0.95] tracking-tighter md:text-7xl lg:text-8xl">
          <span className="text-white/95">Pay, chat, and settle</span>
          <br />
          <span className="text-white/95">in rooms that </span>
          <span className="bg-gradient-to-r from-sui-aqua to-sui-blue bg-clip-text pr-4 text-transparent">
            self-destruct
          </span>
        </h1>

        {/* 3 features */}
        <div className="mt-16 grid max-w-[920px] grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
          {FEATURES.map((f) => (
            <Feature key={f.title} {...f} />
          ))}
        </div>

        {/* CTAs */}
        <div className="mt-14 flex flex-wrap items-center gap-4">
          <Link
            href="/rooms/create"
            className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[12px] font-medium uppercase tracking-[0.2em] text-slate-900 shadow-[0_8px_30px_rgba(160,200,255,0.18)] transition hover:bg-sky-50"
          >
            Create a Room
            <ChevronRight
              size={14}
              strokeWidth={2}
              className="transition group-hover:translate-x-0.5"
            />
          </Link>
          <Link
            href="/rooms"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.02] px-7 py-3.5 text-[12px] uppercase tracking-[0.2em] text-white/85 transition hover:bg-white/[0.05]"
          >
            <Compass size={13} strokeWidth={1.5} />
            Browse Rooms
          </Link>
        </div>
      </section>
    </div>
  );
}

function Feature({
  icon: Icon,
  kicker,
  title,
  body,
}: {
  icon: typeof Lock;
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex max-w-xs items-start gap-4">
      <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <Icon size={20} strokeWidth={1.4} className="text-sui-aqua" />
      </div>
      <div>
        <div className="mb-1.5 text-[10px] uppercase tracking-[0.22em] text-sui-aqua/80">
          {kicker}
        </div>
        <div className="mb-2 text-[19px] font-medium leading-snug text-white/95">
          {title}
        </div>
        <p className="text-[12.5px] leading-relaxed text-white/45">{body}</p>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: Lock,
    kicker: "Encrypted",
    title: "Client-side only",
    body: "AES-GCM 256. The key is forged in your browser, never uploaded, and dies with the room.",
  },
  {
    icon: Layers,
    kicker: "Programmable",
    title: "PTB-atomic payments",
    body: "Tip, paid DM, subscription, or invoice — every Sui transfer is bundled atomically with its encrypted message.",
  },
  {
    icon: Trash2,
    kicker: "Ephemeral",
    title: "Self-destruct",
    body: "Closing the room emits an on-chain event. Every client wipes its key. Only undecryptable bytes remain.",
  },
];
