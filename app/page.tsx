import Link from "next/link";

export default function Home() {
  const features = [
    {
      title: "Smart Product Analysis",
      description:
        "Upload once and let AI detect category, style, and suggested ad directions automatically.",
    },
    {
      title: "Natural-Language Generation",
      description:
        "Describe a vibe in plain English and get multiple polished ad variants in seconds.",
    },
    {
      title: "Conversational Refinement",
      description:
        "Iterate with chat prompts like 'make it warmer' or 'add a headline' without starting over.",
    },
    {
      title: "Canvas Editing Workspace",
      description:
        "Adjust layers, text, and composition on a visual canvas before exporting final creatives.",
    },
  ];

  const examples = [
    {
      label: "Minimal Studio",
      copy: "Clean white backdrop, soft shadows, and product-first composition.",
    },
    {
      label: "Lifestyle Scene",
      copy: "Context-rich setup that places your product in a relatable moment.",
    },
    {
      label: "Bold Social Variant",
      copy: "High-contrast, attention-grabbing layout optimized for feed performance.",
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white text-slate-900">
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center px-6 pb-16 pt-20 text-center sm:pt-24">
        <span className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-700">
          AI-Powered Creative Workflow
        </span>
        <h1 className="mt-5 max-w-4xl text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
          Turn product images into professional ad creatives with AI
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
          Upload your product, generate three campaign-ready concepts, refine through natural chat, and
          export polished visuals from one editor.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/editor"
            className="rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
          >
            Open Editor
          </Link>
          <a
            href="#examples"
            className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            View Examples
          </a>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Features</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="examples" className="mx-auto w-full max-w-6xl px-6 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Examples Gallery</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {examples.map((example, i) => (
            <article key={example.label} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="relative h-40 bg-gradient-to-br from-primary-100 via-white to-slate-200">
                <div className="absolute left-3 top-3 rounded-md bg-white/80 px-2 py-1 text-xs font-medium text-slate-700">
                  Variant {i + 1}
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold text-slate-900">{example.label}</h3>
                <p className="mt-1 text-sm text-slate-600">{example.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="rounded-2xl border border-primary-100 bg-primary-50 p-8 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Ready to generate your first ad?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-700">
            Start with one product photo and go from idea to export in minutes with analysis, generation,
            refinement, and canvas editing in a single flow.
          </p>
          <Link
            href="/editor"
            className="mt-6 inline-flex rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
          >
            Launch Editor
          </Link>
        </div>
      </section>
    </main>
  );
}
