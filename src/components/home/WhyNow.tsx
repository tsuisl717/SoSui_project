import { ArrowRight, Coins, Droplets, Sparkles } from "lucide-react";
import Image from "next/image";

export function WhyNow() {
  return (
    <section className="pb-28">
      <div className="relative overflow-hidden rounded-[18px] border border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-8 backdrop-blur-sm md:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(600px 300px at 80% 50%, rgba(80,140,220,0.10), transparent 70%)",
          }}
        />

        <div className="relative mb-5 flex items-center gap-2.5">
          <Sparkles size={13} className="text-sui-aqua" />
          <span className="text-[10px] uppercase tracking-[0.28em] text-white/55">
            Why Now
          </span>
        </div>

        <p className="relative mb-12 max-w-2xl text-[15px] leading-relaxed text-white/75">
          Sui just clicked the missing pieces into place.{" "}
          <span className="font-display font-black italic text-white">Seal</span>{" "}
          shipped to mainnet — native onchain encryption. Paired with{" "}
          <span className="font-display font-black italic text-white">USDsui</span>,
          the consumer surface is finally here.
        </p>

        {/* cards + connector */}
        <div className="relative grid grid-cols-1 items-stretch gap-4 md:grid-cols-[1fr_auto_1fr_auto_auto]">
          {/* Card 1 */}
          <div className="relative z-10 rounded-2xl border border-white/[0.08] bg-[#0b1a32]/80 p-6 backdrop-blur-sm">
            <div className="mb-4 flex items-center gap-2">
              <Droplets size={18} className="text-sui-aqua" strokeWidth={1.6} />
              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-sui-blue/30 bg-sui-blue/10">
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="rgb(125,200,255)"
                  strokeWidth="1.5"
                >
                  <path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" />
                </svg>
              </div>
            </div>
            <h3 className="mb-3 font-display text-2xl font-black italic leading-tight tracking-tighter">
              Seal — encryption native to Sui
            </h3>
            <p className="text-[12px] leading-relaxed text-white/45">
              Identity-based encryption with threshold cryptography. Define a
              policy on-chain; ciphertext only opens when the policy passes.
              SoSui sits at the intersection — Seal upgrades the invite
              envelope into a consumer-facing surface.
            </p>
          </div>

          {/* Arrow: Seal → USDsui */}
          <Connector />

          {/* Card 2 */}
          <div className="relative z-10 rounded-2xl border border-white/[0.08] bg-[#0b1a32]/80 p-6 backdrop-blur-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-sui-blue/30 bg-sui-blue/10">
                <Coins size={14} className="text-sui-aqua" strokeWidth={1.6} />
              </div>
            </div>
            <h3 className="mb-3 font-display text-2xl font-black italic leading-tight tracking-tighter">
              USDsui — gasless stablecoin
            </h3>
            <p className="text-[12px] leading-relaxed text-white/45">
              Stripe-issued stablecoin with protocol-level gas abstraction.
              Tip, subscribe, and settle in dollars without ever holding SUI.
              Phase 3 makes this the default settlement rail in SoSui.
            </p>
          </div>

          {/* Arrow: USDsui → SoSui */}
          <Connector />

          {/* SoSui logo node */}
          <div className="relative z-10 flex flex-col items-center justify-center gap-2 pl-0 md:pl-2">
            <div className="flex h-[88px] w-[88px] items-center justify-center rounded-2xl border border-sui-blue/30 bg-gradient-to-br from-sui-blue/15 to-[#2a5fa8]/5 shadow-[0_0_40px_rgba(80,140,220,0.25)]">
              <Image
                src="/images/SoSui_logo.png"
                alt="SoSui"
                width={64}
                height={64}
                className="h-16 w-16 object-contain"
              />
            </div>
            <span className="mt-1 bg-gradient-to-r from-sui-aqua to-sui-blue bg-clip-text font-display text-2xl font-black italic tracking-tighter text-transparent pr-2">
              SoSui
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Connector() {
  return (
    <div className="relative z-10 flex items-center justify-center py-2 md:py-0">
      {/* Desktop: curves converging into glowing node + arrow */}
      <svg
        viewBox="0 0 65 80"
        width="65"
        height="80"
        className="hidden md:block"
        aria-hidden
      >
        <defs>
          <linearGradient id="conn-line-in" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#7eb8ff" stopOpacity="0" />
            <stop offset="100%" stopColor="#7eb8ff" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="conn-line-out" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#7eb8ff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#7eb8ff" stopOpacity="0.25" />
          </linearGradient>
          <radialGradient id="conn-node-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#bfe0ff" stopOpacity="0.55" />
            <stop offset="60%" stopColor="#7eb8ff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#7eb8ff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* converging curves */}
        <path
          d="M 0 14 C 28 14, 30 40, 52 40"
          stroke="url(#conn-line-in)"
          strokeWidth="1.2"
          fill="none"
        />
        <path
          d="M 0 66 C 28 66, 30 40, 52 40"
          stroke="url(#conn-line-in)"
          strokeWidth="1.2"
          fill="none"
          opacity="0.55"
        />

        {/* node glow halo */}
        <circle cx="52" cy="40" r="16" fill="url(#conn-node-glow)" />
        {/* node outer ring */}
        <circle
          cx="52"
          cy="40"
          r="7"
          fill="none"
          stroke="#7eb8ff"
          strokeOpacity="0.45"
          strokeWidth="1"
        />
        {/* node core */}
        <circle cx="52" cy="40" r="3.6" fill="#bfe0ff" />

      </svg>

      {/* Mobile fallback: simple vertical arrow */}
      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-sui-blue/30 bg-[#0b1a32]/80 shadow-[0_0_18px_rgba(80,140,220,0.35)] backdrop-blur-sm md:hidden">
        <ArrowRight size={14} className="rotate-90 text-sui-aqua" strokeWidth={2} />
      </div>
    </div>
  );
}
