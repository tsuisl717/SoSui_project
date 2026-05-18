import "./globals.css";
import type { Metadata } from "next";
import { AppProviders } from "@/components/AppProviders";
import { Footer } from "@/components/Footer";
import { Topbar } from "@/components/Topbar";

export const metadata: Metadata = {
  title: "SoSui — encrypted payment rooms on Sui",
  description:
    "Stripe meets Signal, on Sui. PTB-atomic payments inside encrypted, self-destructing rooms.",
  icons: {
    icon: [{ url: "/images/favicon.png", type: "image/png" }],
    shortcut: "/images/favicon.png",
    apple: "/images/favicon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="overflow-x-hidden font-sans antialiased bg-background-deep text-[#e0e0e0] selection:bg-sui-blue selection:text-black">
        <AppProviders>
          <div className="relative flex min-h-screen flex-col border-0">
            <Topbar />
            <main className="relative mx-auto w-full max-w-[1440px] flex-1 px-4 sm:px-8 py-10">
              {children}
            </main>
            <Footer />
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
