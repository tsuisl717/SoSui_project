"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Droplets, Home, Map as MapIcon, PlusCircle } from "lucide-react";
import { FAUCET_URL } from "@/lib/constants";

const ConnectButton = dynamic(
  async () => (await import("@mysten/dapp-kit")).ConnectButton,
  { ssr: false },
);

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  match: (path: string) => boolean;
};

const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: Home, match: (p) => p === "/" },
  {
    href: "/rooms",
    label: "Rooms",
    icon: Compass,
    match: (p) => p === "/rooms" || (p.startsWith("/rooms/") && p !== "/rooms/create"),
  },
  {
    href: "/rooms/create",
    label: "Create",
    icon: PlusCircle,
    match: (p) => p === "/rooms/create",
  },
  { href: "/roadmap", label: "Roadmap", icon: MapIcon, match: (p) => p.startsWith("/roadmap") },
];

export function Topbar() {
  const pathname = usePathname() || "/";

  return (
    <header className="sticky top-0 z-50 h-20 border-b border-white/[0.08] bg-background-deep/40 backdrop-blur-2xl backdrop-saturate-150 [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.08),0_8px_32px_-16px_rgba(0,0,0,0.6)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.025] to-transparent"
      />

      <div className="relative mx-auto flex h-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-8">
        <Link href="/" className="flex items-center gap-0 group">
          <Image
            src="/images/SoSui_logo.png"
            alt="SoSui"
            width={48}
            height={48}
            priority
            className="h-12 w-12 rounded-xl object-contain"
          />
          <div className="hidden sm:flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-bold tracking-tighter italic bg-clip-text text-transparent bg-gradient-to-r from-sui-aqua to-sui-blue pr-2">SoSui</span>
            <span className="hidden md:inline text-[10px] uppercase tracking-[0.3em] text-white/30">media</span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-1">
          {NAV.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-2 rounded-xl px-4 py-2 transition-all ${
                  active
                    ? "bg-border-bright text-white shadow-xl"
                    : "text-white/30 hover:text-white"
                }`}
              >
                <Icon
                  size={16}
                  className={
                    active
                      ? "text-sui-blue"
                      : "group-hover:text-sui-blue transition-colors"
                  }
                />
                <span className="text-[10px] font-bold uppercase tracking-widest hidden lg:block">
                  {item.label}
                </span>
              </Link>
            );
          })}
          {FAUCET_URL && (
            <a
              href={FAUCET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 rounded-xl px-4 py-2 text-white/30 transition-all hover:text-white"
            >
              <Droplets size={16} className="group-hover:text-sui-blue transition-colors" />
              <span className="text-[10px] font-bold uppercase tracking-widest hidden lg:block">
                Faucet
              </span>
            </a>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <nav className="md:hidden flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-1">
            {NAV.map((item) => {
              const active = item.match(pathname);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-center rounded-lg p-2 transition-all ${
                    active ? "bg-border-bright text-sui-blue" : "text-white/40"
                  }`}
                  aria-label={item.label}
                >
                  <Icon size={16} />
                </Link>
              );
            })}
            {FAUCET_URL && (
              <a
                href={FAUCET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center rounded-lg p-2 text-white/40 transition-all"
                aria-label="Faucet"
              >
                <Droplets size={16} />
              </a>
            )}
          </nav>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
