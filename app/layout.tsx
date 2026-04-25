import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { Zap } from "lucide-react";

import { Providers } from "@/components/providers";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Olivia · AI Product Ad Generator",
  description: "Generate product ads with AI and natural language prompts.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <Providers>
          <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur-sm">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
              <Link href="/" className="flex items-center gap-2.5 font-semibold text-slate-900 hover:opacity-90 transition-opacity">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-600 shadow-sm">
                  <Zap className="h-4 w-4 text-white" />
                </span>
                <span className="text-base tracking-tight">Olivia</span>
              </Link>
              <nav className="flex items-center gap-3">
                <Link
                  href="/editor"
                  className="rounded-md bg-primary-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-primary-700 transition-colors"
                >
                  Open Editor
                </Link>
              </nav>
            </div>
          </header>
          {children}
        </Providers>
      </body>
    </html>
  );
}
