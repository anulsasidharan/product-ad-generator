import Link from "next/link";
import { ArrowRight, Bot, Layers, MessageSquare, ScanSearch, Sparkles, Upload, Wand2 } from "lucide-react";
import { ExamplesGallery } from "@/components/home/ExamplesGallery";

export default function Home() {
  const features = [
    {
      icon: ScanSearch,
      title: "Smart Product Analysis",
      description: "Upload once and let AI detect category, style, and suggested ad directions automatically.",
      iconColor: "text-violet-400",
      iconBg: "bg-violet-500/10",
      glow: "group-hover:shadow-[0_0_20px_rgba(124,58,237,0.15)]",
    },
    {
      icon: Sparkles,
      title: "Natural-Language Generation",
      description: "Describe a vibe in plain English and get multiple polished ad variants in seconds.",
      iconColor: "text-indigo-400",
      iconBg: "bg-indigo-500/10",
      glow: "group-hover:shadow-[0_0_20px_rgba(99,102,241,0.15)]",
    },
    {
      icon: MessageSquare,
      title: "Conversational Refinement",
      description: "Iterate with chat prompts like 'make it warmer' or 'add a headline' without starting over.",
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-500/10",
      glow: "group-hover:shadow-[0_0_20px_rgba(16,185,129,0.12)]",
    },
    {
      icon: Layers,
      title: "Canvas Editing Workspace",
      description: "Adjust layers, text, and composition on a visual canvas before exporting final creatives.",
      iconColor: "text-amber-400",
      iconBg: "bg-amber-500/10",
      glow: "group-hover:shadow-[0_0_20px_rgba(245,158,11,0.12)]",
    },
  ];

  const steps = [
    {
      icon: Upload,
      step: "01",
      title: "Upload Product",
      description: "Drop any product image — PNG, JPG, or WebP. Paste a URL or drag right in.",
    },
    {
      icon: ScanSearch,
      step: "02",
      title: "AI Analysis",
      description: "Claude identifies your product and suggests creative directions automatically.",
    },
    {
      icon: Wand2,
      step: "03",
      title: "Generate Variants",
      description: "Get up to 3 campaign-ready concepts from a single plain-English prompt.",
    },
    {
      icon: MessageSquare,
      step: "04",
      title: "Refine & Export",
      description: "Chat to iterate, edit on canvas, and download polished creatives.",
    },
  ];

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Background grid */}
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-100" aria-hidden />
      {/* Radial glow behind hero */}
      <div
        className="pointer-events-none fixed left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full opacity-20"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.5) 0%, transparent 70%)" }}
        aria-hidden
      />

      {/* ── Hero ── */}
      <section className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-6 pb-20 pt-16 text-center sm:pt-28">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-300">
          <Bot className="h-3.5 w-3.5" aria-hidden />
          AI-Powered Creative Workflow
        </span>

        <h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight text-white sm:text-6xl">
          Turn product images into{" "}
          <span className="text-gradient-violet">
            professional ad creatives
          </span>{" "}
          with AI
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          Upload your product, generate three campaign-ready concepts, refine through natural chat, and export polished visuals — all from one editor.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/editor"
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-glow-violet transition hover:bg-violet-500"
          >
            Open Editor
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <a
            href="#how-it-works"
            className="rounded-lg border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-zinc-300 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
          >
            See How It Works
          </a>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="relative mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">How it works</h2>
          <p className="mt-2 text-sm text-zinc-500">From photo to polished creative in four steps</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, step, title, description }) => (
            <div
              key={step}
              className="group relative rounded-2xl glass p-5 shadow-glass transition duration-200 hover:shadow-glass hover:border-white/[0.14]"
            >
              <span className="mb-3 block text-[10px] font-bold tracking-widest text-violet-400 uppercase">
                Step {step}
              </span>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
                <Icon className="h-5 w-5 text-violet-400" aria-hidden />
              </div>
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="relative mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Features</h2>
          <p className="mt-2 text-sm text-zinc-500">Everything you need to produce campaign-ready ads</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, description, iconColor, iconBg, glow }) => (
            <article
              key={title}
              className={`group flex gap-4 rounded-2xl glass p-5 shadow-glass transition duration-200 hover:border-white/[0.14] ${glow}`}
            >
              <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
                <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <ExamplesGallery />

      {/* ── CTA ── */}
      <section className="relative mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/60 to-indigo-950/60 p-px shadow-glow-violet">
          <div className="rounded-[calc(1rem-1px)] px-8 py-14 text-center backdrop-blur-xl">
            {/* Inner radial glow */}
            <div
              className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-30"
              style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.4) 0%, transparent 60%)" }}
              aria-hidden
            />
            <h2 className="relative text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Ready to generate your first ad?
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
              Start with one product photo and go from idea to export in minutes — analysis, generation, refinement, and canvas editing in a single flow.
            </p>
            <Link
              href="/editor"
              className="relative mt-6 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-8 py-3 text-sm font-semibold text-white shadow-glow-violet transition hover:bg-violet-500"
            >
              Launch Editor
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
