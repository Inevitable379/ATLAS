import type { Metadata } from "next";
import Link from "next/link";
import { Lora, Inter } from "next/font/google";
import { Newspaper, Target, Layers, TrendingUp, Library, Settings } from "lucide-react";
import "./globals.css";

const serif = Lora({ subsets: ["latin"], variable: "--atlas-serif" });
const sans = Inter({ subsets: ["latin"], variable: "--atlas-sans" });
export const metadata: Metadata = { title: "ATLAS", description: "Personal CAT preparation workspace" };
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/", label: "Daily feed", Icon: Newspaper },
  { href: "/practice", label: "Practice", Icon: Target },
  { href: "/vocabulary", label: "Vocabulary", Icon: Layers },
  { href: "/progress", label: "Progress", Icon: TrendingUp },
  { href: "/archive", label: "Archive", Icon: Library },
  { href: "/settings", label: "Settings", Icon: Settings },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <header className="border-b border-line bg-surface">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
            <Link href="/" className="font-serif text-lg font-semibold text-accent">ATLAS</Link>
            {NAV.map(({ href, label, Icon }) => (
              <Link key={href} href={href} className="flex items-center gap-1.5 text-sm text-muted hover:text-ink">
                <Icon size={15} aria-hidden /> {label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
