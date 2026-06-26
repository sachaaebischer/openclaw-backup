import "./globals.css";
import type { Metadata, Viewport } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Coach",
  description: "Training dashboard & gym logger",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0b0f14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-[#e6edf3]">
        <header className="sticky top-0 z-10 border-b border-cardborder bg-bg/80 backdrop-blur">
          <nav className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
            <Link href="/" className="text-lg font-bold tracking-tight">
              🏋️ Coach
            </Link>
            <div className="ml-auto flex gap-2 text-sm">
              <Link href="/" className="btn-ghost">
                Dashboard
              </Link>
              <Link href="/plan" className="btn-ghost">
                Plan
              </Link>
              <Link href="/gym" className="btn-ghost">
                Gym
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
      </body>
    </html>
  );
}
