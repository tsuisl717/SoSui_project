import { ArrowRight, Hourglass, Lock, MessageSquare } from "lucide-react";

export function HowItWorks() {
  return (
    <section className="pb-28 pt-44">
      <div className="grid grid-cols-1 items-start gap-12 md:grid-cols-2 md:gap-20">
        <div>
          <h2 className="font-display text-5xl font-black italic leading-none tracking-tighter md:text-6xl lg:text-7xl">
            How It Works
          </h2>

          <div className="mt-10 flex items-end gap-3">
            <Step icon={Lock} label="Encrypt" />
            <Arrow />
            <Step icon={MessageSquare} label="Transact" />
            <Arrow />
            <Step icon={Hourglass} label="Expire" accent />
          </div>
        </div>

        <div className="pt-2 md:pt-12">
          <p className="max-w-md text-[16px] leading-[1.7] text-white/65">
            Stripe meets Signal, on Sui. Tip, subscribe, negotiate, or invoice
            inside an encrypted room — every Sui transfer is PTB-atomic with
            its encrypted message. Close the room and the key is gone forever.
            Even if the ciphertext survives on IPFS, no one can decrypt it.{" "}
            <span className="font-display font-black italic text-white/95">
              No decrypt.
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}

function Step({
  icon: Icon,
  label,
  accent,
}: {
  icon: typeof Lock;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`flex h-[58px] w-[58px] items-center justify-center rounded-2xl border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${
          accent ? "bg-amber-300/10" : "bg-white/[0.03]"
        }`}
      >
        <Icon
          size={22}
          strokeWidth={1.4}
          className={accent ? "text-amber-300" : "text-sui-aqua"}
        />
      </div>
      <span className="text-[13px] tracking-wide text-white/75">{label}</span>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex flex-col items-center pb-7">
      <ArrowRight size={20} strokeWidth={1.3} className="text-white/30" />
    </div>
  );
}
