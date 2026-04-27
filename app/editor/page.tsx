"use client";

import { ImagePlus, LayoutGrid, PenTool, Sparkles } from "lucide-react";
import Image from "next/image";
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
  OrchestrationSummary,
  ProductAnalysis,
} from "@/lib/types";
import { parseOrchestrationSummary } from "@/lib/orchestration-from-response";
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
  const [refineHistoryByGenId, setRefineHistoryByGenId] = useState<Record<string, string[]>>({});
  const [, setCanvasStateByGenId] = useState<Record<string, CanvasState>>({});
  const [generating, setGenerating] = useState(false);
  const [orchestrationSummary, setOrchestrationSummary] = useState<OrchestrationSummary | null>(null);

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
    } else {
      setIsolatedUrl(null);
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
            productImageUrl: isolatedUrl ?? remoteUrl,
            userPrompt: prompt,
            productContext: {
              productType: analysis.productType,
              attributes: analysis.attributes,
            },
            variants: targetIndex !== undefined ? 1 : options.variants,
            aspectRatio: options.aspectRatio,
            creativeMode: options.creativeMode,
            subjectHint: options.subjectHint,
            customSubjectHint: options.customSubjectHint,
            ...(options.model !== "auto" ? { model: options.model } : {}),
          }),
        });

        const raw: unknown = await res.json();
        const parsed = GenerateResponseSchema.safeParse(raw);
        if (!res.ok || !parsed.success || !parsed.data.success || !parsed.data.data?.generations?.length) {
          const body = parsed.success ? parsed.data : null;
          const code = body?.code;
          const traceId = body?.data?.metadata?.traceId;
          let errorMsg =
            body?.error ?? "Generation failed";
          if (code === "PROVIDER_QUOTA_EXCEEDED") {
            errorMsg =
              `${errorMsg} Add credits at replicate.com/account#billing or set a valid REPLICATE_API_TOKEN.`;
          }
          if (traceId) {
            errorMsg = `${errorMsg} (trace ${traceId})`;
          }
          throw new Error(errorMsg);
        }

        const newGenerations = parsed.data.data.generations;
        const traceId = parsed.data.data.metadata?.traceId;
        const orchestration = parseOrchestrationSummary(
          parsed.data.data.metadata?.orchestration,
          traceId,
        );
        setOrchestrationSummary(orchestration);
        if (targetIndex !== undefined && newGenerations[0]) {
          const replacement = newGenerations[0];
          setGenerations((prev) =>
            prev.map((g, i) => (i === targetIndex ? replacement! : g)),
          );
          if (replacement) {
            const replacedId = generations[targetIndex]?.id;
            if (replacedId) {
              setRefineHistoryByGenId((prev) => ({
                ...prev,
                [replacedId]: [replacement.imageUrl],
              }));
            }
          }
        } else {
          setGenerations(newGenerations);
          setRefineHistoryByGenId(
            Object.fromEntries(newGenerations.map((g) => [g.id, [g.imageUrl]])),
          );
        }
        toast.success(traceId ? `Generations ready (trace ${traceId})` : "Generations ready");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Generation failed");
      } finally {
        setGenerating(false);
      }
    },
    [analysis, generations, isolatedUrl, remoteUrl],
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

  const handleGenerationImageUpdate = useCallback((generationId: string, nextImageUrl: string) => {
    setGenerations((prev) => {
      const target = prev.find((g) => g.id === generationId);
      if (!target || target.imageUrl === nextImageUrl) {
        return prev;
      }
      setRefineHistoryByGenId((history) => {
        const existing = history[generationId] ?? [target.imageUrl];
        if (existing[existing.length - 1] === nextImageUrl) {
          return history;
        }
        return {
          ...history,
          [generationId]: [...existing, nextImageUrl],
        };
      });
      return prev.map((g) => (g.id === generationId ? { ...g, imageUrl: nextImageUrl } : g));
    });
  }, []);

  const selectedRefineHistory = selectedGeneration
    ? (refineHistoryByGenId[selectedGeneration.id] ?? [selectedGeneration.imageUrl])
    : [];

  const handleRestoreRefineVersion = useCallback(
    (generationId: string, imageUrl: string) => {
      setGenerations((prev) =>
        prev.map((g) => (g.id === generationId ? { ...g, imageUrl } : g)),
      );
      toast.success("Restored refine version");
    },
    [],
  );

  const syncChatHistory = useCallback(
    (genId: string, turns: ConversationTurn[]) => {
      setChatByGenId((m) => ({ ...m, [genId]: turns }));
    },
    [],
  );

  const syncCanvasState = useCallback((genId: string, state: CanvasState) => {
    setCanvasStateByGenId((m) => ({ ...m, [genId]: state }));
  }, []);

  const activeGenId = selectedGeneration?.id;
  const onCanvasStateUpdate = useCallback(
    (state: CanvasState) => {
      if (!activeGenId) return;
      syncCanvasState(activeGenId, state);
    },
    [activeGenId, syncCanvasState],
  );

  const effectiveProductUrl = isolatedUrl ?? remoteUrl;
  const recommendedOptions = useMemo<Partial<GenerationOptions> | undefined>(() => {
    if (!orchestrationSummary) {
      return undefined;
    }
    return {
      aspectRatio: orchestrationSummary.aspectRatio,
      model:
        orchestrationSummary.resolvedModel === "flux-schnell"
          ? "flux-schnell"
          : orchestrationSummary.resolvedModel === "flux-pro"
            ? "flux-pro"
            : undefined,
    };
  }, [orchestrationSummary]);

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
                recommendedOptions={recommendedOptions}
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
            orchestration={orchestrationSummary}
          />
          {selectedGeneration && selectedRefineHistory.length > 1 && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Refine history</p>
                <p className="text-[11px] text-zinc-600">
                  {selectedRefineHistory.length} versions
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedRefineHistory.map((url, idx) => {
                  const isActive = selectedGeneration.imageUrl === url;
                  return (
                    <button
                      key={`${selectedGeneration.id}-${idx}`}
                      type="button"
                      className={cn(
                        "group relative w-[84px] overflow-hidden rounded-lg border text-left transition-all",
                        isActive
                          ? "border-violet-500/70 ring-2 ring-violet-500/30"
                          : "border-white/[0.08] hover:border-white/[0.2]",
                      )}
                      onClick={() => handleRestoreRefineVersion(selectedGeneration.id, url)}
                      aria-label={`Restore ${idx === 0 ? "original" : `refine ${idx}`}`}
                    >
                      <div className="relative aspect-square bg-zinc-900">
                        <Image
                          src={url}
                          alt=""
                          fill
                          className="object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                          sizes="84px"
                          unoptimized
                        />
                      </div>
                      <div
                        className={cn(
                          "border-t px-2 py-1 text-[10px]",
                          isActive
                            ? "border-violet-500/40 bg-violet-500/15 text-violet-200"
                            : "border-white/[0.08] bg-white/[0.03] text-zinc-400",
                        )}
                      >
                        {idx === 0 ? "Original" : `Refine ${idx}`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
              onUpdate={onCanvasStateUpdate}
              onExport={(format) => toast.success(`Exported as ${format.toUpperCase()}`)}
            />
            <ChatInterface
              key={selectedGeneration.id}
              generation={selectedGeneration}
              productImageUrl={effectiveProductUrl}
              orchestration={orchestrationSummary}
              conversationHistory={chatTurnsForSelected}
              isProcessing={generating}
              onImageUpdate={(imageUrl) => handleGenerationImageUpdate(selectedGeneration.id, imageUrl)}
              onHistoryChange={(turns) => syncChatHistory(selectedGeneration.id, turns)}
            />
          </div>
        </section>
      )}
    </main>
  );
}
