"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import { Coins, Flame, Key, Lock } from "lucide-react";

type Chapter = {
  feature: string;
  headlineLead: string;
  headlineTail: string;
  description: string;
  Visual: () => JSX.Element;
  glow: CSSProperties;
};

const CHAPTERS: Chapter[] = [
  {
    feature: "Feature 01",
    headlineLead: "A room is born\non Sui.",
    headlineTail: "Encrypted from the first byte.",
    description:
      "Pay the SUI fee. A shared object materialises on-chain — a room ready to hold secrets it can never read.",
    Visual: SpawnVisual,
    glow: {
      background: "rgba(56, 139, 253, 0.22)",
      top: "-10%",
      right: "-10%",
    },
  },
  {
    feature: "Feature 02",
    headlineLead: "Your browser\nforges a key",
    headlineTail: "no one else holds.",
    description:
      "A 256-bit AES key is generated inside your tab. It is never uploaded, never logged, never persisted to disk. Memory you control — and only you.",
    Visual: ForgeVisual,
    glow: {
      background: "rgba(111, 188, 240, 0.20)",
      bottom: "-15%",
      left: "-10%",
    },
  },
  {
    feature: "Feature 03",
    headlineLead: "Messages travel\nas ciphertext.",
    headlineTail: "The network sees noise.",
    description:
      "Every line is sealed with AES-GCM in the browser, pushed to IPFS, and anchored on Sui by content-hash. Servers carry bytes they can't decode.",
    Visual: EncryptVisual,
    glow: {
      background: "rgba(77, 162, 255, 0.14)",
      top: "20%",
      left: "35%",
    },
  },
  {
    feature: "Feature 04",
    headlineLead: "Close the room.\nThe key dies.",
    headlineTail: "The bytes stay locked.",
    description:
      "A close-event broadcasts. Every client wipes its copy of the key. The ciphertext lingers forever on IPFS — and forever undecryptable.",
    Visual: BurnVisual,
    glow: {
      background: "rgba(255, 90, 60, 0.18)",
      bottom: "-10%",
      right: "-5%",
    },
  },
];

export function ScrollNarrative() {
  return (
    <section className="full-bleed">
      {CHAPTERS.map((chapter, i) => (
        <ChapterRow key={chapter.feature} chapter={chapter} index={i} />
      ))}
    </section>
  );
}

function ChapterRow({ chapter, index }: { chapter: Chapter; index: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setVisible(true);
        });
      },
      { rootMargin: "0px 0px -25% 0px", threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { Visual } = chapter;
  const isEven = index % 2 === 0;

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden border-t border-border-dim transition-all duration-1000 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      } ${isEven ? "bg-background-deep" : "bg-surface-dark"}`}
    >
      {/* Ambient glow blob — colour & position vary per chapter */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-[40rem] w-[40rem] rounded-full blur-[140px]"
        style={chapter.glow}
      />

      {/* Dot grid backdrop */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${isEven ? "dot-grid" : "dot-grid-tight"} opacity-40`}
      />

      {/* Top + bottom fade so glow doesn't bleed into neighbour sections */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background-deep/80 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background-deep/80 to-transparent"
      />

      <div className="relative mx-auto grid min-h-[55vh] w-full max-w-7xl grid-cols-12 items-center gap-x-6 px-4 py-16 sm:px-8 lg:py-24">
        <div className="col-span-12 lg:col-span-2">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/35">
            {chapter.feature}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 mt-4 lg:mt-0">
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-black italic tracking-tight leading-[1.05] whitespace-pre-line">
            {chapter.headlineLead}
            <br />
            <span className="text-white/30">{chapter.headlineTail}</span>
          </h2>
        </div>

        <div className="col-span-12 lg:col-span-3 mt-12 lg:mt-0 flex justify-center">
          <div className="aspect-[3/4] w-full max-w-[220px]">
            <Visual />
          </div>
        </div>

        <div className="col-span-12 lg:col-span-2 mt-8 lg:mt-0">
          <p className="text-sm leading-relaxed text-white/55">
            {chapter.description}
          </p>
        </div>
      </div>
    </div>
  );
}

function VisualShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col rounded-2xl border border-border-mid bg-background-deep p-5">
      {children}
    </div>
  );
}

function SpawnVisual() {
  return (
    <VisualShell>
      <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.25em] text-white/40">
        <Coins size={12} className="text-sui-blue" /> SUI · paid
      </div>
      <div className="flex flex-1 flex-col justify-center gap-3 text-center">
        <div className="font-mono text-[10px] text-white/40">object created</div>
        <div className="break-all rounded-lg border border-border-mid px-3 py-2 font-mono text-[10px] text-sui-blue">
          0x7hgk…aR2q
        </div>
        <div className="text-[10px] text-white/30">checkpoint 287,442,901</div>
      </div>
      <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-white/30">
        <span>state</span>
        <span className="text-sui-blue">ready</span>
      </div>
    </VisualShell>
  );
}

function ForgeVisual() {
  return (
    <VisualShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <Key size={36} className="text-sui-aqua" />
        <div className="grid grid-cols-8 gap-1">
          {Array.from({ length: 32 }).map((_, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-sm bg-sui-blue/70"
              style={{ opacity: 0.3 + ((i * 37) % 70) / 100 }}
            />
          ))}
        </div>
        <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-white/40">
          AES-256 · in-browser
        </div>
      </div>
    </VisualShell>
  );
}

function EncryptVisual() {
  return (
    <VisualShell>
      <div className="mb-3 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.25em] text-white/40">
        <Lock size={12} className="text-sui-blue" /> sealed
      </div>
      <div className="flex flex-1 flex-col justify-center gap-2">
        <div className="rounded-md border border-border-mid p-2 text-xs text-white/70">
          gm. ready?
        </div>
        <div className="text-center font-mono text-[10px] text-sui-aqua">
          ↓ AES-GCM
        </div>
        <div className="break-all rounded-md border border-border-mid p-2 font-mono text-[9px] leading-relaxed text-sui-blue/80">
          c1f4 a8b2 e3d7 9f0c 4a6e 2bd1 8c93 f5e0
        </div>
      </div>
      <div className="text-center font-mono text-[9px] uppercase tracking-widest text-white/40">
        → IPFS · on-chain CID
      </div>
    </VisualShell>
  );
}

function BurnVisual() {
  return (
    <VisualShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <Flame size={40} className="text-sui-aqua" />
        <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-white/40">
          room · closed
        </div>
        <div className="font-mono text-[10px] text-white/30 line-through">
          0x4f…a8c2
        </div>
        <div className="text-[10px] text-sui-blue">key wiped</div>
      </div>
      <div className="rounded-md border border-border-mid px-2 py-1.5 text-center font-mono text-[9px] text-white/30">
        ciphertext remains
      </div>
    </VisualShell>
  );
}
