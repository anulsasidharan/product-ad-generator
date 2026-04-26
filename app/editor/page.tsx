"use client";

import { ImagePlus, LayoutGrid, PenTool, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CanvasEditor } from "@/components/canvas/CanvasEditor";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { PromptInput } from "@/components/generation/PromptInput";
import { ResultsGallery } from "@/components/generation/ResultsGallery";
import { ProductUploader } from "@/components/upload/ProductUploader";
import { Button } from "@/components/ui/button";
import type {
  CanvasState,
  ConversationTurn,
  Generation,
  GenerationOptions,
  ProductAnalysis,
} from "@/lib/types";
import { GenerateResponseSchema } from "@/lib/validation";
import { cn } from "@/lib/utils";

function SectionHeader({
  step,
  icon: Icon,
  title,
  description,
}: {
  step: number;
  icon: React.ElementType;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-xs font-bold text-violet-400 mt-0.5 ring-1 ring-violet-500/20">
        {step}
      </span>
      <div>
        <div className="flex items-center gap-1.5">
          <Icon className="h-4 w-4 text-zinc-500" aria-hidden />
          <h2 className="text-base font-semibold text-white">{title}</h2>
        </div>
        {description && <p className="mt-0.5 text-sm text-zinc-500">{description}</p>}
      </div>
    </div>
  );
}

export default function EditorPage() {
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [isolatedUrl, setIsolatedUrl] = useState<string | null>(null);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lastRequest, setLastRequest] = useState<{
    prompt: string;
    options: GenerationOptions;
  } | null>(null);
  const [chatByGenId, setChatByGenId] = useState<Record<string, ConversationTurn[]>>({});
  const [, setCanvasStateByGenId] = useState<Record<string, CanvasState>>({});
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setSelectedIndex(0);
  }, [generations]);

  useEffect(() => {
    if (selectedIndex >= generations.length) {
      setSelectedIndex(Math.max(0, generations.length - 1));
    }
  }, [generations.length, selectedIndex]);

  const suggestionStrings = useMemo(
    () => analysis?.suggestions.map((s) => s.prompt) ?? [],
    [analysis],
  );

  const productContext = useMemo(() => {
    if (!analysis) {
      return { productType: "", attributes: { category: "", style: "", colors: [] as string[] } };
    }
    return { productType: analysis.productType, attributes: analysis.attributes };
  }, [analysis]);

  const selectedGeneration = generations[selectedIndex] ?? null;
  const chatTurnsForSelected = selectedGeneration
    ? (chatByGenId[selectedGeneration.id] ?? [])
    : [];

  const handleAnalysisComplete = useCallback((a: ProductAnalysis) => {
    setAnalysis(a);
    if (a.isolatedImageUrl) {
      setIsolatedUrl(a.isolatedImageUrl);
    }
  }, []);

  const runGenerate = useCallback(
    async (
      prompt: string,
      options: GenerationOptions,
      targetIndex?: number,
    ) => {
      if (!analysis || !remoteUrl) {
        toast.error("Upload and analyze a product first");
        return;
      }
      setGenerating(true);
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productImageUrl: remoteUrl,
            userPrompt: prompt,
            productContext: {
              productType: analysis.productType,
              attributes: analysis.attributes,
            },
            variants: targetIndex !== undefined ? 1 : options.variants,
            aspectRatio: options.aspectRatio,
            ...(options.model !== "auto" ? { model: options.model } : {}),
          }),
        });

        const raw: unknown = await res.json();
        const parsed = GenerateResponseSchema.safeParse(raw);
        if (!res.ok || !parsed.success || !parsed.data.success || !parsed.data.data?.generations?.length) {
          const errorMsg =
            parsed.success && parsed.data.error
              ? parsed.data.error
              : "Generation failed";
          throw new Error(errorMsg);
        }

        const newGenerations = parsed.data.data.generations;
        if (targetIndex !== undefined && newGenerations[0]) {
          setGenerations((prev) =>
            prev.map((g, i) => (i === targetIndex ? newGenerations[0]! : g)),
          );
        } else {
          setGenerations(newGenerations);
        }
        toast.success("Generations ready");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Generation failed");
      } finally {
        setGenerating(false);
      }
    },
    [analysis, remoteUrl],
  );

  const handleGenerate = useCallback(
    async (prompt: string, options: GenerationOptions) => {
      setLastRequest({ prompt, options });
      await runGenerate(prompt, options);
    },
    [runGenerate],
  );

  const handleRegenerate = useCallback(
    async (generationId: string) => {
      if (!lastRequest || !analysis || !remoteUrl) {
        toast.error("Generate once before regenerating");
        return;
      }
      const targetIndex = generations.findIndex((g) => g.id === generationId);
      await runGenerate(
        lastRequest.prompt,
        { ...lastRequest.options, variants: 1 },
        targetIndex >= 0 ? targetIndex : undefined,
      );
    },
    [analysis, generations, lastRequest, remoteUrl, runGenerate],
  );

  const syncChatHistory = useCallback(
    (genId: string, turns: ConversationTurn[]) => {
      setChatByGenId((m) => ({ ...m, [genId]: turns }));
    },
    [],
  );

  const syncCanvasState = useCallback(
    (genId: string, state: CanvasState) => {
      setCanvasStateByGenId((m) => ({ ...m, [genId]: state }));
    },
    [],
  );

  const effectiveProductUrl = isolatedUrl ?? remoteUrl;

  return (
    <main className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10">
      {/* Subtle top glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-64 w-[600px] -translate-x-1/2 rounded-full opacity-10"
        style={{ background: "radial-gradient(ellipse, rgba(124,58,237,0.6) 0%, transparent 70%)" }}
        aria-hidden
      />

      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Editor</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Upload, generate, refine, and export — all in one workspace.
        </p>
      </div>

      {/* Step 1 + 2: Upload & Prompt */}
      <section className="space-y-4">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-3">
            <SectionHeader step={1} icon={ImagePlus} title="Upload product image" description="Drag and drop or paste a URL to get started." />
            <ProductUploader
              onUpload={async () => {}}
              onImageReady={(url) => setRemoteUrl(url)}
              onAnalysisComplete={handleAnalysisComplete}
            />
          </div>

          <div className="space-y-3">
            <SectionHeader step={2} icon={Sparkles} title="Describe your ad" description="Tell us the vibe and we'll generate the creatives." />
            {analysis ? (
              <PromptInput
                productContext={productContext}
                suggestions={suggestionStrings}
                onGenerate={(p, o) => void handleGenerate(p, o)}
                isGenerating={generating}
              />
            ) : (
              <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] p-6 text-center">
                <p className="text-sm text-zinc-500">
                  Analyse a product image first to unlock prompt controls.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Step 3: Results */}
      {generations.length > 0 && remoteUrl && (
        <section className="space-y-4">
          <SectionHeader step={3} icon={LayoutGrid} title="Generated variants" description="Pick an active variant to edit in the canvas or refine via chat." />

          {/* Variant tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Active variant</span>
            {generations.map((g, i) => (
              <Button
                key={g.id}
                type="button"
                size="sm"
                variant={i === selectedIndex ? "default" : "outline"}
                className={cn(
                  "h-8 min-w-[2.5rem]",
                  i === selectedIndex
                    ? "bg-violet-600 text-white hover:bg-violet-500 border-transparent pointer-events-none"
                    : "border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-white",
                )}
                onClick={() => setSelectedIndex(i)}
              >
                {i + 1}
              </Button>
            ))}
          </div>

          <ResultsGallery
            generations={generations}
            originalProductUrl={remoteUrl}
            onRegenerate={(id) => void handleRegenerate(id)}
          />
        </section>
      )}

      {/* Step 4: Canvas + Chat */}
      {selectedGeneration && effectiveProductUrl && (
        <section className="space-y-4">
          <SectionHeader step={4} icon={PenTool} title="Refine &amp; export" description="Edit on canvas, chat to iterate, then export your final creative." />
          <div className="grid gap-8 lg:grid-cols-2">
            <CanvasEditor
              generation={selectedGeneration}
              productImageUrl={effectiveProductUrl}
              onUpdate={(state) => syncCanvasState(selectedGeneration.id, state)}
              onExport={(format) => toast.success(`Exported as ${format.toUpperCase()}`)}
            />
            <ChatInterface
              key={selectedGeneration.id}
              generation={selectedGeneration}
              productImageUrl={effectiveProductUrl}
              conversationHistory={chatTurnsForSelected}
              isProcessing={generating}
              onHistoryChange={(turns) => syncChatHistory(selectedGeneration.id, turns)}
            />
          </div>
        </section>
      )}
    </main>
  );
}
