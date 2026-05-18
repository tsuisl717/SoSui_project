"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  MotionValue,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  ArrowRight,
  Check,
  Cpu,
  Database,
  Flame,
  Key,
  Lock,
  MessageSquare,
  Sparkles,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────
 *  One continuous scroll-story.
 *
 *  Sticky stage hosts a persistent top header, left timeline rail, right
 *  progress bar, and five choreographed scenes that fade in/out by scroll
 *  position. The "noise sphere" is the master visual that morphs across
 *  scenes; the close stage collapses it into a vertical light beam.
 *
 *  Scene windows (progress: 0 → 1)
 *    0.00–0.20  INTRO   brand title + sphere annotations
 *    0.20–0.40  ROOM    a room is born
 *    0.40–0.60  KEY     mouse-tracked 3D key
 *    0.60–0.80  CIPHER  ciphertext flow + decrypting message
 *    0.80–1.00  CLOSE   card dissolves, sphere becomes a beam
 * ──────────────────────────────────────────────────────────────────────── */

type Range = [number, number];

export function SoSuiProductStory() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 80,
    damping: 25,
    mass: 0.4,
  });

  return (
    <div
      ref={containerRef}
      className="relative mx-auto w-full max-w-[1440px] bg-background-deep text-white"
      style={{ height: "640vh" }}
    >
      <div className="sticky top-0 flex h-screen w-full items-stretch">
        <Backdrop progress={progress} />
        <NoiseSphere progress={progress} />
        <CharRain progress={progress} />

        <PersistentKey progress={progress} />

        <SceneIntro progress={progress} />
        <SceneRoom progress={progress} />
        <SceneKey progress={progress} />
        <SceneCipher progress={progress} />
        <SceneClose progress={progress} />

        <TopHeader progress={progress} />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Top header — persistent journey title                          */
/* ────────────────────────────────────────────────────────────── */

function TopHeader({ progress }: { progress: MotionValue<number> }) {
  const dotY = useTransform(progress, [0, 1], [0, 18]);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between border-b border-white/5 bg-black/30 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <Sparkles size={14} className="text-sui-blue" />
        <h2 className="text-xs font-semibold md:text-sm">
          <span className="text-sui-blue">SOSUI:</span>
          <span className="text-white">
            {" "}
            Zero-Knowledge & Ephemeral Chat Journey.
          </span>
        </h2>
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.3em] text-white/40 md:inline">
          · Explore how noise becomes encrypted, and then vanishes.
        </span>
      </div>
      <div className="relative h-5 w-2 rounded-full border border-white/15 bg-black/30">
        <motion.div
          style={{ y: dotY }}
          className="absolute left-1/2 top-0 h-1 w-1 -translate-x-1/2 rounded-full bg-sui-blue shadow-[0_0_6px_#4DA2FF]"
        />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Backdrop — soft radial that warms toward the dissolve.         */
/* ────────────────────────────────────────────────────────────── */

function Backdrop({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0, 0.5, 0.85, 1], [0.5, 0.85, 1, 0.4]);
  const hue = useTransform(progress, [0, 0.6, 1], [220, 215, 30]);
  const bg = useTransform(
    hue,
    (h) =>
      `radial-gradient(ellipse at center, hsla(${h}, 80%, 55%, 0.10), transparent 60%)`,
  );
  return (
    <motion.div
      style={{ opacity, background: bg }}
      className="pointer-events-none absolute inset-0"
    />
  );
}

/* ────────────────────────────────────────────────────────────── */
/* NoiseSphere — rotating bit-field that morphs through stages.   */
/* ────────────────────────────────────────────────────────────── */

type Bit = {
  x: number;
  y: number;
  z: number;
  c: string;
  delay: number;
  dur: number;
  base: number;
};

type Beam = {
  top: number;
  angle: number;
  len: number;
  duration: number;
  delay: number;
  red: boolean;
};

function NoiseSphere({ progress }: { progress: MotionValue<number> }) {
  const [bits, setBits] = useState<Bit[]>([]);
  const [beams, setBeams] = useState<Beam[]>([]);

  useEffect(() => {
    const N = 380;
    const palette = "01ABCDEF*$";
    const out: Bit[] = [];
    for (let i = 0; i < N; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / N);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const z = Math.cos(phi);
      out.push({
        x: Math.cos(theta) * Math.sin(phi),
        y: Math.sin(theta) * Math.sin(phi),
        z,
        c: palette[Math.floor(Math.random() * palette.length)],
        delay: Math.random() * 4,
        dur: 1.6 + Math.random() * 2.4,
        base: 0.3 + (z + 1) * 0.32,
      });
    }
    setBits(out);

    const bs: Beam[] = [];
    for (let i = 0; i < 9; i++) {
      bs.push({
        top: 8 + Math.random() * 84,
        angle: -22 + Math.random() * 44,
        len: 70 + Math.random() * 110,
        duration: 2.6 + Math.random() * 2.6,
        delay: Math.random() * 6,
        red: i % 4 === 0,
      });
    }
    setBeams(bs);
  }, []);

  // Step 01 (0.18-0.32): sphere descends + blooms outward + fades — the
  // "unfolding" gesture before the card materializes.
  const scale = useTransform(
    progress,
    [0, 0.18, 0.32, 0.4, 0.6, 0.8, 0.92, 1],
    [1, 0.85, 1.35, 0.5, 0.4, 0.65, 1.4, 0.05],
  );
  // Sphere is only visible for intro + step 1 hand-off. Stays hidden from
  // step 2 onward — including step 4, which uses the LightBeam alone.
  const opacity = useTransform(
    progress,
    [0, 0.18, 0.32, 0.55, 1],
    [0.95, 0.9, 0.08, 0, 0],
  );
  const x = useTransform(progress, [0, 0.2, 0.4, 1], ["0vw", "0vw", "0vw", "0vw"]);
  const y = useTransform(
    progress,
    [0, 0.18, 0.32, 0.6, 0.8, 1],
    ["0vh", "0vh", "22vh", "0vh", "-12vh", "-30vh"],
  );
  const blurPx = useTransform(progress, [0.85, 1], [0, 22]);
  const filter = useTransform(blurPx, (v) => `blur(${v}px)`);

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <motion.div
        style={{ scale, opacity, x, y, filter }}
        className="relative h-[440px] w-[440px]"
      >
        {/* Ambient glow */}
        <div className="absolute inset-0 rounded-full bg-sui-blue/15 blur-[80px]" />
        <div className="absolute inset-8 rounded-full border border-sui-blue/10" />

        {/* Light beams — diagonal red/blue trails streaking across the sphere */}
        <div className="pointer-events-none absolute -inset-12 overflow-hidden">
          {beams.map((b, i) => {
            const color = b.red
              ? "rgba(255, 90, 90, 0.85)"
              : "rgba(111, 188, 240, 0.95)";
            return (
              <motion.div
                key={i}
                initial={{ x: "-220%", opacity: 0 }}
                animate={{ x: "320%", opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: b.duration,
                  delay: b.delay,
                  repeat: Infinity,
                  ease: "linear",
                  times: [0, 0.15, 0.85, 1],
                }}
                className="absolute h-px"
                style={{
                  top: `${b.top}%`,
                  width: `${b.len}px`,
                  background: `linear-gradient(to right, transparent, ${color}, transparent)`,
                  transform: `rotate(${b.angle}deg)`,
                  boxShadow: `0 0 6px ${color}`,
                }}
              />
            );
          })}
        </div>

        {/* Spinning sphere of bits — slight X-tilt for 3D feel */}
        <div
          style={{ transform: "rotateX(14deg)", transformStyle: "preserve-3d" }}
          className="absolute inset-0"
        >
          <motion.div
            animate={{ rotateY: 360 }}
            transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
            style={{ transformStyle: "preserve-3d", perspective: 1500 }}
            className="absolute inset-0"
          >
            {bits.map((b, i) => (
              <span
                key={i}
                className="noise-bit absolute font-mono text-[9px] leading-none text-sui-aqua"
                style={{
                  // Container is 440px square. X/Y use 45% of that → ±198px
                  // radius. Z must match to keep the dot field a true sphere
                  // (otherwise it squashes to ~110px wide when rotated 90°).
                  left: `${50 + b.x * 45}%`,
                  top: `${50 + b.y * 45}%`,
                  transform: `translate(-50%, -50%) translateZ(${b.z * 198}px)`,
                  animationDuration: `${b.dur}s`,
                  animationDelay: `${b.delay}s`,
                  ["--bit-base" as string]: b.base.toString(),
                }}
              >
                {b.c}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Highlighted "data packet" cell — pulses to catch the eye */}
        <motion.div
          animate={{ opacity: [0.55, 1, 0.55], scale: [1, 1.18, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-[36%] top-[34%] h-3 w-3 rounded-sm border-2 border-sui-blue bg-sui-blue/30 shadow-[0_0_16px_rgba(77,162,255,1)]"
        />
      </motion.div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* CharRain — cascading characters during the intro→step-01       */
/* hand-off. The sphere "rains" into the materializing card.      */
/* ────────────────────────────────────────────────────────────── */

function CharRain({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(
    progress,
    [0.18, 0.24, 0.36, 0.42],
    [0, 0.6, 0.6, 0],
  );

  // Seeded LCG → deterministic positions/timings (SSR-safe).
  const drops = useMemo(() => {
    let s = 0xc4f3a91d;
    const next = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return (s >>> 16) / 0xffff;
    };
    const palette = "01ABCDEF*$";
    return Array.from({ length: 44 }, () => ({
      left: 25 + next() * 65,
      delay: next() * 3,
      dur: 2 + next() * 2.2,
      c: palette[Math.floor(next() * palette.length)],
    }));
  }, []);

  return (
    <motion.div
      style={{ opacity }}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {drops.map((d, i) => (
        <span
          key={i}
          className="char-rain absolute font-mono text-[11px] text-sui-aqua"
          style={{
            left: `${d.left}%`,
            top: 0,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.dur}s`,
            textShadow: "0 0 4px rgba(111,188,240,0.8)",
          }}
        >
          {d.c}
        </span>
      ))}
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Scene 0 — Intro                                                */
/* ────────────────────────────────────────────────────────────── */

function SceneIntro({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0, 0.18, 0.22], [1, 1, 0]);
  const y = useTransform(progress, [0, 0.22], ["0px", "-60px"]);

  return (
    <motion.div
      style={{ opacity, y }}
      className="pointer-events-none absolute inset-0 grid grid-cols-1 items-center gap-6 px-8 pt-16 md:grid-cols-3 md:px-16"
    >
      {/* LEFT — title block */}
      <div>
        <h1 className="font-display text-3xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
          <span className="block text-sui-blue">SOSUI:</span>
          <span className="block text-white">ENCRYPTED.</span>
          <span className="block text-white">EPHEMERAL.</span>
          <span className="block text-white">IMMUTABLE.</span>
        </h1>
        <p className="mt-5 max-w-xs text-sm text-white/40">
          Scroll to follow a payment room from creation to self-destruct.
        </p>
      </div>

      {/* CENTER — frame for sphere annotations (sphere itself lives in
          the NoiseSphere layer, viewport-centered). */}
      <div className="relative hidden h-[480px] md:block">
        <span className="absolute left-1/2 top-0 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.4em] text-white/30">
          The Raw, Noisy Network
        </span>
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.4em] text-white/30">
          The Network
        </span>

        <div className="absolute right-[-30px] top-20 flex items-center gap-2">
          <div className="h-px w-14 bg-gradient-to-r from-transparent to-white/40" />
          <div className="rounded-md border border-white/15 bg-white/5 px-3 py-2 font-mono text-[10px] text-white/80 backdrop-blur">
            Data packet
            <br />
            accepted as sui.
          </div>
        </div>

        <div className="absolute bottom-24 right-[-10px] flex items-center gap-2">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-sui-blue/60" />
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-sui-blue">
            <Key size={12} />
            Key generated
          </div>
        </div>
      </div>

      {/* RIGHT — detail cards */}
      <div className="flex flex-col items-end gap-4">
        <KeyGenerationCard />
        <ImmutableAuditCard />
      </div>
    </motion.div>
  );
}

function KeyGenerationCard() {
  return (
    <div className="w-64 rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-4 backdrop-blur-md">
      <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-sui-blue">
        Key Generation
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-white/70">
        Zoom into the browser&apos;s cryptographic library. Forges a 256-bit AES
        key.
      </p>
      <div className="mt-3 flex items-center gap-1.5">
        <span className="rounded-md border border-white/15 bg-white/5 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-white/70">
          WebCrypto API
        </span>
        <ArrowRight size={11} className="shrink-0 text-white/30" />
        <span className="inline-flex items-center gap-1 rounded-md border border-sui-blue/40 bg-sui-blue/10 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-sui-blue">
          <Key size={9} />
          256-bit AES
        </span>
      </div>
    </div>
  );
}

function ImmutableAuditCard() {
  return (
    <div className="w-64 rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-4 backdrop-blur-md">
      <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-sui-blue">
        Immutable Audit
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-white/70">
        Sui transaction hash is immutable.
      </p>
      <div className="mt-3 space-y-1.5">
        <div className="rounded-md border border-white/10 bg-black/30 px-2 py-1 font-mono text-[10px] text-white/60">
          Sui transaction hash
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-md border border-sui-blue/40 bg-sui-blue/10 px-2 py-1 font-mono text-[10px] text-sui-blue">
          <Check size={10} />
          Sui transaction hash is immutable
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Scene 1 — Room is born                                         */
/* ────────────────────────────────────────────────────────────── */

function SceneRoom({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0.18, 0.22, 0.38, 0.42], [0, 1, 1, 0]);
  // Enters from above, settles, then drifts downward into the background
  // as Step 02 takes over.
  const y = useTransform(
    progress,
    [0.18, 0.22, 0.38, 0.42],
    ["-40px", "0px", "0px", "120px"],
  );

  return (
    <motion.div
      style={{ opacity, y }}
      className="pointer-events-none absolute inset-0 grid grid-cols-12 items-center gap-6 px-12 pt-16 md:px-24"
    >
      <StepLabel n="01" />
      <Headline
        pill="Encrypted from byte one"
        white="A room is born on Sui."
        grey="Encrypted from the first byte."
      />
      <div className="col-span-12 md:col-span-4">
        <RoomCreatedCard progress={progress} />
      </div>
      <BodyText>
        Pay the SUI fee. A shared object materializes on-chain — a room ready to
        hold secrets it can never read.
      </BodyText>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Scene 2 — Key forged                                           */
/* ────────────────────────────────────────────────────────────── */

function SceneKey({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0.38, 0.42, 0.58, 0.62], [0, 1, 1, 0]);

  return (
    <motion.div
      style={{ opacity }}
      className="pointer-events-none absolute inset-0 grid grid-cols-1 items-center gap-10 px-8 pt-16 md:grid-cols-2 md:px-16"
    >
      {/* LEFT — text content stack */}
      <div className="space-y-5">
        <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/30">
          Step 02
        </span>
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.3em] text-white/70 backdrop-blur">
            <span className="h-1 w-1 rounded-full bg-sui-blue shadow-[0_0_4px_#4DA2FF]" />
            Key Generated
          </div>
          <h2 className="font-display text-4xl italic leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
            <span className="text-white">Your browser forges a key</span>{" "}
            <span className="text-white/30">no one else holds.</span>
          </h2>
        </div>
        <KeyDetailChips />
        <p className="max-w-md text-sm leading-relaxed text-white/50">
          A 256-bit AES key is generated inside your tab. Never uploaded, never
          logged, never persisted to disk. Sovereignty you control — and only you.
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
          Tip — drag across the key
        </p>
      </div>

      {/* RIGHT — reserved space for the floating PersistentKey */}
      <div className="hidden md:block" />
    </motion.div>
  );
}

/* PersistentKey — the 3D pixel key lives outside SceneKey's opacity so it can
   slide to the corner and persist as a small "background" presence during
   Step 03, then fade for Step 04. Mouse-tracking is gated to Step 02 only. */
function PersistentKey({ progress }: { progress: MotionValue<number> }) {
  const scale = useTransform(
    progress,
    [0.4, 0.42, 0.55, 0.62],
    [0.6, 1, 1, 0.6],
  );
  // Key fully dissolves by 0.62 — it stays gone for step 3 and beyond.
  const opacity = useTransform(
    progress,
    [0.4, 0.42, 0.55, 0.62],
    [0, 1, 1, 0],
  );
  // Stage 2: sits in the right half of the layout (next to the text on left).
  // Stage 3+: shifts further right and up to live as a corner background.
  const x = useTransform(
    progress,
    [0.42, 0.55, 0.62, 0.92],
    ["20vw", "20vw", "32vw", "32vw"],
  );
  const y = useTransform(
    progress,
    [0.42, 0.55, 0.62, 0.92],
    ["0vh", "0vh", "-26vh", "-26vh"],
  );
  // Pointer events only enabled while Step 02 is the active scene.
  const pe = useTransform(progress, (p) =>
    p > 0.42 && p < 0.55 ? ("auto" as const) : ("none" as const),
  );

  return (
    <motion.div
      style={{ scale, opacity, x, y, pointerEvents: pe }}
      className="absolute inset-0 flex items-center justify-center"
    >
      <Mouse3DKey />
    </motion.div>
  );
}

/* Mouse-tracked key built from a pixel-grid of data points. The key shape
   is mathematically defined (bow ring + shaft + two teeth) so every dot is
   precisely placed — visual contrast to the chaotic noise sphere. The whole
   grid auto-spins on Y and tilts to follow the cursor. */
function Mouse3DKey() {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [25, -25]), {
    stiffness: 100,
    damping: 14,
  });
  const tiltY = useSpring(useTransform(mx, [-0.5, 0.5], [-20, 20]), {
    stiffness: 100,
    damping: 14,
  });

  const dots = useMemo(buildKeyDots, []);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <div
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ perspective: 1400 }}
      className="relative cursor-grab active:cursor-grabbing"
    >
      <div className="absolute -inset-16 rounded-full bg-sui-blue/20 blur-3xl" />
      <motion.div
        animate={{ rotateY: 360 }}
        transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
        style={{ transformStyle: "preserve-3d" }}
        className="relative"
      >
        <motion.div
          style={{
            rotateX: rx,
            rotateY: tiltY,
            transformStyle: "preserve-3d",
          }}
          className="relative"
        >
          <KeyDotGrid dots={dots} />
        </motion.div>
      </motion.div>
    </div>
  );
}

type KeyDot = {
  x: number;
  y: number;
  intensity: number;
  r: number;
  bright: boolean;
};

function buildKeyDots(): KeyDot[] {
  const W = 65;
  const H = 18;
  const bowCx = 11;
  const bowCy = 8.5;
  const bowR = 7;
  const bowRing = 1.9;
  const innerR = 3;
  const innerRing = 1.4;
  const shaftEnd = 58;

  const dots: KeyDot[] = [];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - bowCx;
      const dy = y - bowCy;
      const dist = Math.hypot(dx, dy);

      let intensity = 0;
      // outer bow ring
      if (dist <= bowR && dist >= bowR - bowRing) intensity = 1;
      // inner bow hole
      if (dist <= innerR && dist >= innerR - innerRing) {
        intensity = Math.max(intensity, 0.85);
      }
      // shaft (horizontal bar)
      if (
        x > bowCx + bowR - 1 &&
        x <= shaftEnd &&
        Math.abs(dy) <= 0.85
      ) {
        intensity = 1;
      }
      // tooth 1 — at the very end
      if (x >= shaftEnd - 1 && x <= shaftEnd && y >= bowCy && y <= bowCy + 4) {
        intensity = 1;
      }
      // tooth 2 — slightly back
      if (x >= shaftEnd - 5 && x <= shaftEnd - 4 && y >= bowCy && y <= bowCy + 3) {
        intensity = 1;
      }

      if (intensity > 0) {
        dots.push({
          x,
          y,
          intensity,
          r: 0.32 + intensity * 0.1,
          bright: false,
        });
      }
    }
  }

  // Mark ~12% of dots as "bright" (deterministic seeded LCG → SSR-safe).
  let s = 0xb0a7c0de;
  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s >>> 16) / 0xffff;
  };
  for (const d of dots) {
    if (next() > 0.88) {
      d.bright = true;
      d.r += 0.18;
    }
  }

  return dots;
}

function KeyDotGrid({ dots }: { dots: KeyDot[] }) {
  return (
    <svg
      viewBox="0 0 65 18"
      className="w-[clamp(280px,38vw,540px)]"
      style={{ overflow: "visible" }}
    >
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.x + 0.5}
          cy={d.y + 0.5}
          r={d.r}
          fill={d.bright ? "#9CC8FF" : "#4DA2FF"}
          opacity={0.6 + d.intensity * 0.35}
        />
      ))}
    </svg>
  );
}

function KeyDetailChips() {
  return (
    <div className="flex flex-col items-start gap-3">
      <div className="inline-block rounded-md border border-sui-blue/50 bg-sui-blue/15 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.4em] text-sui-blue shadow-[0_0_12px_rgba(77,162,255,0.35)]">
        AES-256 Key
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip icon={<Database size={10} />}>Client-Side Local Storage</Chip>
        <Chip icon={<Cpu size={10} />}>Browser Web Crypto API</Chip>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Scene 3 — Ciphertext flow                                      */
/* ────────────────────────────────────────────────────────────── */

function SceneCipher({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0.58, 0.62, 0.78, 0.82], [0, 1, 1, 0]);
  const y = useTransform(progress, [0.58, 0.82], ["50px", "-50px"]);

  return (
    <motion.div
      style={{ opacity, y }}
      className="pointer-events-none absolute inset-0 grid grid-cols-12 items-center gap-6 px-12 pt-16 md:px-24"
    >
      <StepLabel n="03" />
      <Headline
        pill="AES-GCM-256 Encryption"
        white="Messages travel as ciphertext."
        grey="The network sees noise."
      />
      <div className="col-span-12 grid grid-cols-2 gap-3 md:col-span-4">
        <UserViewCard progress={progress} />
        <NetworkViewCard />
      </div>
      <BodyText>
        Every line is sealed with AES-GCM in the browser, pushed to PTB, and
        anchored on Sui by content hash. Servers carry bytes they can&apos;t
        decode.
      </BodyText>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Scene 4 — Close                                                */
/* ────────────────────────────────────────────────────────────── */

function SceneClose({ progress }: { progress: MotionValue<number> }) {
  // Scene fades in for step 4 and stays — no end-of-scroll dissolve.
  const opacity = useTransform(progress, [0.78, 0.82, 1], [0, 1, 1]);

  return (
    <motion.div
      style={{ opacity }}
      className="pointer-events-none absolute inset-0 grid grid-cols-12 items-center gap-6 px-12 pt-16 md:px-24"
    >
      <StepLabel n="04" />
      <Headline
        pill="Key Destroyed"
        white="Close the room. The key dies."
        grey="The bytes stay locked."
      />
      <div className="col-span-12 md:col-span-4">
        <RoomClosedCard />
      </div>
      <BodyText>
        A close-event broadcasts. Every client wipes its copy of the key. The
        ciphertext lingers forever as PFS — and forever undecryptable.
      </BodyText>
    </motion.div>
  );
}

/* ResetButton lives outside SceneClose so it can appear AFTER the scene fades
   — the journey closes on a single actionable element on near-empty space. */
function ResetButton({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0.92, 0.97, 1], [0, 1, 1]);
  const pe = useTransform(opacity, (o) =>
    o > 0.5 ? ("auto" as const) : ("none" as const),
  );
  return (
    <motion.div
      style={{ opacity, pointerEvents: pe }}
      className="absolute bottom-12 left-1/2 z-10 -translate-x-1/2"
    >
      <button className="rounded-full border border-white/30 bg-black/60 px-8 py-3 font-mono text-[11px] uppercase tracking-[0.3em] text-white/90 backdrop-blur transition-all hover:border-white/50 hover:bg-white/10 hover:text-white">
        Reset Session
      </button>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Layout primitives                                              */
/* ────────────────────────────────────────────────────────────── */

function StepLabel({ n }: { n: string }) {
  return (
    <div className="col-span-12 md:col-span-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/30">
        Step {n}
      </span>
    </div>
  );
}

function Headline({
  white,
  grey,
  pill,
  sub,
}: {
  white: string;
  grey: string;
  pill?: string;
  sub?: string;
}) {
  return (
    <div className="col-span-12 md:col-span-5">
      {pill && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.3em] text-white/70 backdrop-blur">
          <span className="h-1 w-1 rounded-full bg-sui-blue shadow-[0_0_4px_#4DA2FF]" />
          {pill}
        </div>
      )}
      <h2 className="font-display text-4xl italic leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
        <span className="text-white">{white}</span>{" "}
        <span className="text-white/30">{grey}</span>
      </h2>
      {sub && (
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
          {sub}
        </p>
      )}
    </div>
  );
}

function BodyText({ children }: { children: ReactNode }) {
  return (
    <div className="col-span-12 md:col-span-2">
      <p className="text-sm leading-relaxed text-white/50">{children}</p>
    </div>
  );
}

function Chip({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-white/60">
      {icon}
      {children}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Cards                                                          */
/* ────────────────────────────────────────────────────────────── */

function CardShell({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-md">
      {label && (
        <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-white/60">
          <span className="h-1.5 w-1.5 rounded-full bg-sui-blue shadow-[0_0_6px_#4DA2FF]" />
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

function RoomCreatedCard({ progress }: { progress: MotionValue<number> }) {
  return (
    <CardShell>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/70">
          <DecryptingText progress={progress} range={[0.22, 0.3]} text="TRANS-01" />
        </span>
        <Lock size={14} className="text-sui-blue" />
      </div>
      <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/40">
        Encrypted Index
      </p>
      <div className="mt-2 space-y-1.5 rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-[10px]">
        <Row
          k="object_id"
          v={
            <DecryptingText
              progress={progress}
              range={[0.24, 0.34]}
              text="0xfb19...43b9"
            />
          }
        />
        <Row k="data" v="ciphered" />
        <Row k="indemnity" v="signed" />
        <Row k="checkpoint" v="1ME-431" />
      </div>
      <div className="mt-4 flex justify-between">
        <span className="rounded-md border border-white/15 bg-white/5 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-white/60">
          Draft
        </span>
        <span className="rounded-md border border-sui-blue/40 bg-sui-blue/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-sui-blue">
          Read
        </span>
      </div>
    </CardShell>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-white/40">{k}</span>
      <span className="text-white/85">{v}</span>
    </div>
  );
}

/* User view (decrypted side) — chat history and input both materialize
   from ciphertext as the user scrolls through Step 03. */
function UserViewCard({ progress }: { progress: MotionValue<number> }) {
  // Caret blink only after the input has finished decrypting.
  const caretOpacity = useTransform(progress, [0.78, 0.8], [0, 1]);
  return (
    <CardShell label="User View">
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        <MessageSquare size={11} className="text-sui-blue" />
        <span className="font-mono text-[9px] uppercase tracking-widest text-white/50">
          @ryulis
        </span>
      </div>
      <div className="mt-3 space-y-2">
        <Bubble side="them">
          <DecryptingText
            progress={progress}
            range={[0.62, 0.7]}
            text="gm, ready?"
          />
        </Bubble>
        <Bubble side="me">
          <DecryptingText
            progress={progress}
            range={[0.66, 0.72]}
            text="let's go"
          />
        </Bubble>
        <Bubble side="them">
          <DecryptingText
            progress={progress}
            range={[0.7, 0.76]}
            text="sending now..."
          />
        </Bubble>
      </div>
      {/* Composer input at the bottom — also materializes from noise */}
      <div className="mt-3 flex items-center gap-2 rounded-md border border-white/15 bg-black/40 px-2 py-1.5">
        <span className="font-mono text-[10px] text-sui-blue">›</span>
        <span className="flex-1 font-mono text-[10px] text-white/80">
          <DecryptingText
            progress={progress}
            range={[0.74, 0.8]}
            text="type a message..."
          />
        </span>
        <motion.span style={{ opacity: caretOpacity }} className="inline-block">
          <motion.span
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
            className="block h-3 w-px bg-sui-blue"
          />
        </motion.span>
      </div>
    </CardShell>
  );
}

function Bubble({
  side,
  children,
}: {
  side: "me" | "them";
  children: ReactNode;
}) {
  const isMe = side === "me";
  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
      <span
        className={`rounded-lg px-3 py-1.5 font-mono text-[10px] ${
          isMe
            ? "border border-sui-blue/40 bg-sui-blue/10 text-sui-blue"
            : "border border-white/10 bg-white/5 text-white/80"
        }`}
      >
        {children}
      </span>
    </div>
  );
}

/* Reveals one character at a time as `progress` moves through `range`.
   Scramble characters are seeded once with useMemo so SSR/CSR match. */
function DecryptingText({
  progress,
  range,
  text,
}: {
  progress: MotionValue<number>;
  range: Range;
  text: string;
}) {
  const scramble = useMemo(() => {
    const chars = "0123456789abcdef!@#$%&*";
    let s = 0xfeedbeef;
    const next = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s;
    };
    return text.split("").map((c) => (c === " " ? " " : chars[next() % chars.length]));
  }, [text]);

  const t = useTransform(progress, range, [0, 1], { clamp: true });
  const display = useTransform(t, (v) => {
    const reveal = Math.floor(v * text.length);
    return text
      .split("")
      .map((c, i) => (i < reveal ? c : scramble[i]))
      .join("");
  });

  return <motion.span>{display}</motion.span>;
}

/* Network view — what the network actually carries: hex noise. */
function NetworkViewCard() {
  const noise = useMemo(() => {
    const chars = "0123456789abcdef";
    let s = 0xa5a5a5a5;
    const next = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s;
    };
    return Array.from({ length: 9 }, () =>
      Array.from({ length: 14 }, () => chars[next() % chars.length]).join(""),
    );
  }, []);

  return (
    <CardShell label="Network View">
      <div className="rounded-md border border-white/10 bg-black/40 p-2 font-mono text-[8px] leading-tight text-sui-aqua/80">
        {noise.map((row, i) => (
          <div key={i}>{row}</div>
        ))}
      </div>
      <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.3em] text-white/30">
        Ciphertext Noise
      </p>
    </CardShell>
  );
}

function RoomClosedCard() {
  return (
    <CardShell>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/70">
          ROOM · CC033D
        </span>
        <span className="rounded-md border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-orange-400">
          Destroyed
        </span>
      </div>
      <div className="flex flex-col items-center gap-3 py-3 text-center">
        {/* Centerpiece flame — flickers via scale + tilt, with a pulsing
            outer halo to read as the burning "ROOM CLOSED" sigil. */}
        <div className="relative">
          <motion.div
            animate={{
              opacity: [0.4, 0.8, 0.5, 0.9, 0.4],
              scale: [1, 1.25, 0.9, 1.2, 1],
            }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -inset-6 rounded-full bg-orange-500/30 blur-2xl"
          />
          <motion.div
            animate={{
              scale: [1, 1.12, 0.96, 1.08, 1],
              rotate: [-2, 2, -1, 1.5, -2],
            }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            className="relative rounded-2xl border border-orange-500/50 bg-gradient-to-b from-orange-500/30 to-orange-500/5 p-5 shadow-[0_0_40px_rgba(251,146,60,0.45)]"
          >
            <Flame
              size={56}
              strokeWidth={1.3}
              className="text-orange-400 drop-shadow-[0_0_18px_rgba(251,146,60,0.95)]"
            />
          </motion.div>
        </div>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-orange-400">
          Room Closed
        </p>
        <p className="font-display text-lg italic text-white">key wiped</p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-orange-400/80">
          local storage cleared
        </p>
      </div>
      <div className="mt-2 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 font-mono text-[9px] tracking-widest text-white/30">
        ciphertext remains · undecryptable
      </div>
    </CardShell>
  );
}
