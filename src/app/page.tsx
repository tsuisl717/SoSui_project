import { Hero } from "@/components/home/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { SoSuiProductStory } from "@/components/home/SoSuiProductStory";
import { WhyNow } from "@/components/home/WhyNow";
import { NetworkScene } from "@/components/NetworkScene";

export default function HomePage() {
  return (
    <>
    {/* three.js network — full-bleed; CSS mask fades the canvas itself on the
          left so the atmospheric backdrop shows through cleanly (no overlay seam). */}
      <div
        className="pointer-events-none absolute top-0 left-[calc(50%-35vw)] z-0 h-[740px] w-screen opacity-90"
        style={{
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, transparent 32%, rgba(0,0,0,0.55) 52%, black 72%)",
          maskImage:
            "linear-gradient(to right, transparent 0%, transparent 32%, rgba(0,0,0,0.55) 52%, black 72%)",
        }}
      >
        <NetworkScene />
      </div>
      <Hero />
      <HowItWorks />
      <WhyNow />
      <SoSuiProductStory />
    </>
  );
}
