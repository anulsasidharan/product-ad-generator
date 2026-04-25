"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CanvasEditor } from "@/components/canvas/CanvasEditor";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { PromptInput } from "@/components/generation/PromptInput";
import { ResultsGallery } from "@/components/generation/ResultsGallery";
import { ProductUploader } from "@/components/upload/ProductUploader";
import { Button } from "@/components/ui/button";
import type {
  ConversationTurn,
  Generation,
  GenerationOptions,
  ProductAnalysis,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export default function EditorPage() {
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lastRequest, setLastRequest] = useState<{
    prompt: string;
    options: GenerationOptions;
  } | null>(null);
  const [chatByGenId, setChatByGenId] = useState<Record<string, ConversationTurn[]>>({});
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

  const handleGenerate = useCallback(
    async (prompt: string, options: GenerationOptions) => {
      if (!analysis || !remoteUrl) {
        toast.error("Upload and analyze a product first");
        return;
      }
      setLastRequest({ prompt, options });
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
            variants: options.variants,
            aspectRatio: options.aspectRatio,
            ...(options.model !== "auto" ? { model: options.model } : {}),
          }),
        });
        const json = (await res.json()) as {
          success?: boolean;
          data?: { generations?: Generation[] };
          error?: string;
        };
        if (!res.ok || !json.success || !json.data?.generations) {
          throw new Error(json.error ?? "Generation failed");
        }
        setGenerations(json.data.generations);
        toast.success("Generations ready");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Generation failed");
      } finally {
        setGenerating(false);
      }
    },
    [analysis, remoteUrl],
  );

  const handleRegenerate = useCallback(
    async (generationId: string) => {
      if (!lastRequest || !analysis || !remoteUrl) {
        toast.error("Generate once before regenerating");
        return;
      }
      void generationId;
      await handleGenerate(lastRequest.prompt, lastRequest.options);
    },
    [analysis, handleGenerate, lastRequest, remoteUrl],
  );

  const syncChatHistory = useCallback(
    (genId: string, turns: ConversationTurn[]) => {
      setChatByGenId((m) => ({ ...m, [genId]: turns }));
    },
    [],
  );

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Editor</h1>
          <p className="text-sm text-slate-600">Upload, generate, refine, and export in one workspace.</p>
        </div>
        <Link href="/" className="text-sm font-medium text-primary-700 hover:underline">
          Back to home
        </Link>
      </div>

      <section className="grid gap-8 lg:grid-cols-2">
        <ProductUploader
          onUpload={async () => {}}
          onImageReady={(url) => setRemoteUrl(url)}
          onAnalysisComplete={(a) => setAnalysis(a)}
        />
        {analysis ? (
          <PromptInput
            productContext={productContext}
            suggestions={suggestionStrings}
            onGenerate={(p, o) => void handleGenerate(p, o)}
            isGenerating={generating}
          />
        ) : (
          <div className="flex items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            Analyze a product image to unlock prompt controls.
          </div>
        )}
      </section>

      {generations.length > 0 && remoteUrl && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Active variant</span>
            {generations.map((g, i) => (
              <Button
                key={g.id}
                type="button"
                size="sm"
                variant={i === selectedIndex ? "default" : "outline"}
                className={cn("h-8", i === selectedIndex && "pointer-events-none")}
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

      {selectedGeneration && remoteUrl && (
        <section className="grid gap-8 lg:grid-cols-2">
          <CanvasEditor
            generation={selectedGeneration}
            productImageUrl={remoteUrl}
            onUpdate={() => {}}
            onExport={() => toast.success("Export started")}
          />
          <ChatInterface
            key={selectedGeneration.id}
            generation={selectedGeneration}
            productImageUrl={remoteUrl}
            conversationHistory={chatTurnsForSelected}
            isProcessing={false}
            onHistoryChange={(turns) => syncChatHistory(selectedGeneration.id, turns)}
          />
        </section>
      )}
    </main>
  );
}
