import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-primary-700 sm:text-5xl">
        AI-Powered Product Ad Generator
      </h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Upload a product, describe the vibe, generate variants, then refine in chat and on the canvas.
      </p>
      <div className="mt-8 flex flex-col items-center gap-4 rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Open the editor to try the full Phase 4 UI.</p>
        <Link
          href="/editor"
          className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
        >
          Go to editor
        </Link>
      </div>
    </main>
  );
}
