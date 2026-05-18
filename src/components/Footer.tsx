import Image from "next/image";
import Link from "next/link";

const FOOTER_NAV = [
  { href: "/", label: "Home" },
  { href: "/rooms", label: "Rooms" },
  { href: "/rooms/create", label: "Create" },
  { href: "/roadmap", label: "Roadmap" },
];

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
    <path d="M12 .5C5.73.5.99 5.24.99 11.51c0 4.86 3.15 8.98 7.52 10.43.55.1.75-.24.75-.53 0-.26-.01-.95-.02-1.86-3.06.66-3.71-1.48-3.71-1.48-.5-1.27-1.22-1.61-1.22-1.61-1-.68.08-.67.08-.67 1.1.08 1.69 1.13 1.69 1.13.98 1.69 2.58 1.2 3.21.92.1-.71.39-1.2.7-1.47-2.44-.28-5.01-1.22-5.01-5.42 0-1.2.43-2.18 1.13-2.95-.11-.28-.49-1.4.11-2.92 0 0 .92-.3 3.02 1.13.88-.24 1.83-.36 2.77-.37.94.01 1.89.13 2.77.37 2.1-1.43 3.02-1.13 3.02-1.13.6 1.52.22 2.64.11 2.92.7.77 1.13 1.75 1.13 2.95 0 4.21-2.57 5.14-5.02 5.41.4.34.76 1.02.76 2.06 0 1.49-.01 2.69-.01 3.05 0 .29.2.64.76.53 4.37-1.45 7.52-5.57 7.52-10.43C23.01 5.24 18.27.5 12 .5Z" />
  </svg>
);

const XIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
    <path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.8l-5.32-6.93L4.8 22H1.54l8.02-9.17L1 2h6.96l4.81 6.36L18.24 2Zm-1.19 18h1.88L7.04 4H5.06L17.05 20Z" />
  </svg>
);

const DiscordIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
    <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3.2a.07.07 0 0 0-.075.034c-.32.57-.677 1.314-.926 1.897a18.27 18.27 0 0 0-5.115 0 12.6 12.6 0 0 0-.94-1.897.073.073 0 0 0-.074-.034c-1.314.222-2.572.616-3.76 1.169a.066.066 0 0 0-.03.027C2.09 8.04 1.39 11.6 1.73 15.118a.08.08 0 0 0 .031.055 19.9 19.9 0 0 0 5.992 3.03.073.073 0 0 0 .08-.026c.462-.63.873-1.295 1.226-1.994a.071.071 0 0 0-.04-.099 13.1 13.1 0 0 1-1.872-.892.071.071 0 0 1-.007-.119c.126-.094.252-.192.372-.291a.07.07 0 0 1 .073-.01c3.927 1.793 8.18 1.793 12.062 0a.07.07 0 0 1 .074.009c.12.099.245.198.372.292a.071.071 0 0 1-.006.119c-.598.349-1.22.643-1.873.891a.071.071 0 0 0-.039.1c.36.699.772 1.364 1.225 1.994a.072.072 0 0 0 .08.026 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .031-.054c.407-4.07-.682-7.602-2.886-10.722a.06.06 0 0 0-.029-.027ZM8.02 13.0c-1.182 0-2.156-1.085-2.156-2.419 0-1.333.955-2.418 2.156-2.418 1.21 0 2.175 1.094 2.156 2.418 0 1.334-.955 2.419-2.156 2.419Zm7.974 0c-1.182 0-2.156-1.085-2.156-2.419 0-1.333.955-2.418 2.156-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.946 2.419-2.157 2.419Z" />
  </svg>
);

const SOCIALS = [
  { href: "https://github.com/tsuisl717/SoSui_Media", label: "GitHub", icon: GithubIcon },
  { href: "https://x.com/sosui_media", label: "Twitter / X", icon: XIcon },
  //{ href: "https://discord.com", label: "Discord", icon: DiscordIcon },
];

export function Footer() {
  return (
    <footer className="relative mt-16 border-t border-border-mid bg-surface-dark/60 backdrop-blur-md">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-12 sm:px-8 md:grid-cols-3">
        <div className="space-y-4">
          <Link href="/" className="flex items-end gap-0 group w-fit">
            <Image
              src="/images/SoSui_logo.png"
              alt="SoSui"
              width={48}
              height={48}
              className="h-10 w-10 rounded-xl object-contain"
            />
            <span className="text-2xl font-bold tracking-tighter italic bg-clip-text text-transparent bg-gradient-to-r from-sui-aqua to-sui-blue pr-2">
              SoSui
            </span>
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-1">
              media
            </span>
          </Link>
          <p className="max-w-xs text-sm leading-relaxed text-white/40">
            Encrypted, self-destructing chat rooms on Sui. Pay SUI. Burn keys.
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
            Navigate
          </h3>
          <ul className="space-y-2">
            {FOOTER_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-white/60 transition-colors hover:text-sui-blue"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
            Community
          </h3>
          <div className="flex items-center gap-3">
            {SOCIALS.map(({ href, label, icon: Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={label}
                className="group flex h-10 w-10 items-center justify-center rounded-xl border border-border-bright bg-border-dim/50 text-white/50 transition-all hover:border-sui-blue hover:text-sui-blue"
              >
                <Icon width={16} height={16} />
              </a>
            ))}
          </div>
          <p className="text-xs text-white/30">
            Built on{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-sui-aqua to-sui-blue font-semibold">
              Sui
            </span>
            .
          </p>
        </div>
      </div>

      <div className="border-t border-border-mid">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-2 px-4 py-5 text-[10px] uppercase tracking-[0.3em] text-white/30 sm:flex-row sm:px-8">
          <span>© {new Date().getFullYear()} SoSui Media</span>
          <span>Ephemeral · Encrypted · On-chain</span>
        </div>
      </div>
    </footer>
  );
}
