"use client";

import Link from "next/link";
import { ExternalLink, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";

type MockExample = {
  id: string;
  label: string;
  platform: string;
  format: string;
  headline: string;
  copy: string;
  gradient: string;
  accent: string;
  badge: string;
  cta: string;
  estimatedCtr: string;
};

const MOCK_EXAMPLES: MockExample[] = [
  {
    id: "minimal-studio",
    label: "Minimal Studio",
    platform: "Instagram Feed",
    format: "1:1",
    headline: "Pure Sound. Zero Distractions.",
    copy: "Wireless Earbuds Pro with ANC and 24hr battery in a clean hero setup.",
    gradient: "from-zinc-800 to-zinc-900",
    accent: "border-zinc-700",
    badge: "Variant 1",
    cta: "Shop Now",
    estimatedCtr: "3.8%",
  },
  {
    id: "lifestyle-scene",
    label: "Lifestyle Scene",
    platform: "Facebook Feed",
    format: "4:5",
    headline: "Your commute, upgraded.",
    copy: "Context-rich creative focused on everyday use and comfort benefits.",
    gradient: "from-violet-950 to-indigo-950",
    accent: "border-violet-800/50",
    badge: "Variant 2",
    cta: "Try It Today",
    estimatedCtr: "4.2%",
  },
  {
    id: "bold-social",
    label: "Bold Social Variant",
    platform: "Instagram Story",
    format: "9:16",
    headline: "Turn up the energy.",
    copy: "High-contrast campaign visual optimized for social thumb-stop performance.",
    gradient: "from-indigo-950 to-violet-950",
    accent: "border-indigo-800/50",
    badge: "Variant 3",
    cta: "Swipe Up",
    estimatedCtr: "5.1%",
  },
  {
    id: "display-banner",
    label: "Google Display Banner",
    platform: "Google Display",
    format: "728x90",
    headline: "Premium Audio. Limited Offer.",
    copy: "Compact display ad with clear headline hierarchy and conversion-focused CTA.",
    gradient: "from-cyan-950 to-sky-950",
    accent: "border-cyan-800/50",
    badge: "Variant 4",
    cta: "Buy Now",
    estimatedCtr: "2.6%",
  },
  {
    id: "linkedin-b2b",
    label: "LinkedIn B2B",
    platform: "LinkedIn Sponsored",
    format: "1:1",
    headline: "Focus at Work, Everywhere.",
    copy: "Professional creative emphasizing productivity and call quality for teams.",
    gradient: "from-slate-900 to-indigo-950",
    accent: "border-slate-700",
    badge: "Variant 5",
    cta: "Learn More",
    estimatedCtr: "2.9%",
  },
  {
    id: "retargeting-offer",
    label: "Retargeting Offer",
    platform: "Meta Retargeting",
    format: "1:1",
    headline: "Still thinking about it?",
    copy: "Offer-led format for warm audiences with urgency and social proof elements.",
    gradient: "from-fuchsia-950 to-violet-950",
    accent: "border-fuchsia-800/50",
    badge: "Variant 6",
    cta: "Claim Offer",
    estimatedCtr: "6.0%",
  },
];

export function ExamplesGallery() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => MOCK_EXAMPLES.find((example) => example.id === selectedId) ?? null,
    [selectedId],
  );

  return (
    <section id="examples" className="relative mx-auto w-full max-w-6xl px-6 pb-16">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Examples Gallery</h2>
        <p className="mt-2 text-sm text-zinc-500">Click any mock example to preview full details</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {MOCK_EXAMPLES.map((example) => (
          <article
            key={example.id}
            className={`group cursor-pointer overflow-hidden rounded-2xl border ${example.accent} shadow-glass transition duration-200 hover:-translate-y-0.5 hover:border-white/20`}
            onClick={() => setSelectedId(example.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                setSelectedId(example.id);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Preview ${example.label} example`}
          >
            <div className={`relative h-48 bg-gradient-to-br ${example.gradient}`}>
              <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-semibold text-white/80 backdrop-blur-sm">
                {example.badge}
              </span>
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="h-12 w-12 text-white/10" aria-hidden />
              </div>
            </div>
            <div className="glass-elevated p-4">
              <h3 className="text-sm font-semibold text-white">{example.label}</h3>
              <p className="mt-1 text-sm text-zinc-400">{example.copy}</p>
            </div>
          </article>
        ))}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-zinc-900 shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-violet-300">{selected.platform}</p>
                <h3 className="mt-1 text-lg font-semibold text-white">{selected.label}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-md p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Close example preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className={`h-44 rounded-xl border ${selected.accent} bg-gradient-to-br ${selected.gradient}`} />
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-zinc-500">Format</p>
                  <p className="font-medium text-zinc-100">{selected.format}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-zinc-500">Estimated CTR</p>
                  <p className="font-medium text-zinc-100">{selected.estimatedCtr}</p>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-zinc-500">Headline</p>
                <p className="font-medium text-zinc-100">{selected.headline}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-zinc-500">Primary Copy</p>
                <p className="text-zinc-100">{selected.copy}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-zinc-500">CTA</p>
                <p className="font-medium text-zinc-100">{selected.cta}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-4">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
              >
                Close
              </button>
              <Link
                href={`/editor?template=${selected.id}`}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
              >
                Use This Template
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
