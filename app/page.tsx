import Link from "next/link";
import { ArrowRight, Bot, Layers, MessageSquare, ScanSearch, Sparkles, Upload, Wand2 } from "lucide-react";

export default function Home() {
  const features = [
    {
      icon: ScanSearch,
      title: "Smart Product Analysis",
      description: "Upload once and let AI detect category, style, and suggested ad directions automatically.",
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
    },
    {
      icon: Sparkles,
      title: "Natural-Language Generation",
      description: "Describe a vibe in plain English and get multiple polished ad variants in seconds.",
      iconColor: "text-violet-600",
      iconBg: "bg-violet-50",
    },
    {
      icon: MessageSquare,
      title: "Conversational Refinement",
      description: "Iterate with chat prompts like 'make it warmer' or 'add a headline' without starting over.",
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
    },
    {
      icon: Layers,
      title: "Canvas Editing Workspace",
      description: "Adjust layers, text, and composition on a visual canvas before exporting final creatives.",
      iconColor: "text-amber-600",
      iconBg: "bg-amber-50",
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

  const examples = [
    {
      label: "Minimal Studio",
      copy: "Clean white backdrop, soft shadows, and product-first composition.",
      gradient: "from-slate-100 to-slate-200",
      badge: "Variant 1",
    },
    {
      label: "Lifestyle Scene",
      copy: "Context-rich setup that places your product in a relatable moment.",
      gradient: "from-blue-100 to-indigo-200",
      badge: "Variant 2",
    },
    {
      label: "Bold Social Variant",
      copy: "High-contrast, attention-grabbing layout optimised for feed performance.",
      gradient: "from-violet-100 to-purple-200",
      badge: "Variant 3",
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white text-slate-900">
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center px-6 pb-20 pt-16 text-center sm:pt-24">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-700">
          <Bot className="h-3.5 w-3.5" aria-hidden />
          AI-Powered Creative Workflow
        </span>

        <h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
          Turn product images into{" "}
          <span className="bg-gradient-to-r from-primary-600 to-violet-600 bg-clip-text text-transparent">
            professional ad creatives
          </span>{" "}
          with AI
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
          Upload your product, generate three campaign-ready concepts, refine through natural chat, and export polished visuals — all from one editor.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/editor"
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
          >
            Open Editor
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <a
            href="#how-it-works"
            className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            See How It Works
          </a>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section id="how-it-works" className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">How it works</h2>
          <p className="mt-2 text-sm text-slate-500">From photo to polished creative in four steps</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, step, title, description }) => (
            <div
              key={step}
              className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <span className="mb-3 block text-[10px] font-bold tracking-widest text-primary-400 uppercase">
                Step {step}
              </span>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
                <Icon className="h-5 w-5 text-primary-600" aria-hidden />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Features</h2>
          <p className="mt-2 text-sm text-slate-500">Everything you need to produce campaign-ready ads</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, description, iconColor, iconBg }) => (
            <article
              key={title}
              className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
                <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Examples Gallery ───────────────────────────────────────────────── */}
      <section id="examples" className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Examples Gallery</h2>
          <p className="mt-2 text-sm text-slate-500">Styles you can generate with a simple prompt</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {examples.map((example) => (
            <article
              key={example.label}
              className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
            >
              <div className={`relative h-44 bg-gradient-to-br ${example.gradient}`}>
                <span className="absolute left-3 top-3 rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-sm">
                  {example.badge}
                </span>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="h-12 w-12 text-slate-400/30" aria-hidden />
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold text-slate-900">{example.label}</h3>
                <p className="mt-1 text-sm text-slate-500">{example.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="rounded-2xl bg-gradient-to-r from-primary-600 to-violet-600 p-px shadow-lg">
          <div className="rounded-[calc(1rem-1px)] bg-white px-8 py-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Ready to generate your first ad?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
              Start with one product photo and go from idea to export in minutes — analysis, generation, refinement, and canvas editing in a single flow.
            </p>
            <Link
              href="/editor"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-8 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
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
