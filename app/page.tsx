export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-primary-700 sm:text-5xl">
        AI-Powered Product Ad Generator
      </h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Next.js 14 + TypeScript setup complete. Ready for Phase 1 implementation.
      </p>
      <div className="mt-8 rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">
          Next step: build upload, analysis, and generation workflows.
        </p>
      </div>
    </main>
  );
}
