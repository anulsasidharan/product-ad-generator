"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { AspectRatio, GenerationModelChoice, GenerationOptions, ProductContext } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PromptInputProps {
  productContext: ProductContext;
  onGenerate: (prompt: string, options: GenerationOptions) => void;
  suggestions: string[];
  isGenerating: boolean;
}

function contextualChips(productContext: ProductContext): string[] {
  const blob = `${productContext.productType} ${productContext.attributes.category}`.toLowerCase();
  if (blob.includes("watch") || blob.includes("timepiece")) {
    return ["Executive desk", "Minimalist concrete", "Wrist shot cafe"];
  }
  if (blob.includes("skin") || blob.includes("care") || blob.includes("beauty")) {
    return ["Spa bathroom", "Botanical flat lay", "Morning routine"];
  }
  if (blob.includes("food") || blob.includes("coffee") || blob.includes("snack")) {
    return ["Rustic wood table", "Bright kitchen", "Outdoor picnic"];
  }
  return ["Clean studio", "Lifestyle scene", "Bold graphic background"];
}

function previewLine(prompt: string, productType: string): string {
  const p = prompt.trim();
  if (!p) {
    return "Describe a vibe to see a preview of the shot we will create.";
  }
  return `I'll create a ${p}-inspired product shot for your ${productType} with cohesive lighting, realistic materials, and a polished marketing look.`;
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function PromptInput({ productContext, onGenerate, suggestions, isGenerating }: PromptInputProps) {
  const [prompt, setPrompt] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [variants, setVariants] = useState(3);
  const [model, setModel] = useState<GenerationModelChoice>("auto");

  const debouncedPrompt = useDebounced(prompt, 280);

  const chips = useMemo(() => {
    const base = contextualChips(productContext);
    const merged = [...new Set([...suggestions, ...base])];
    return merged.slice(0, 6);
  }, [productContext, suggestions]);

  const handleGenerate = useCallback(() => {
    const trimmed = prompt.trim();
    if (!trimmed || isGenerating) {
      return;
    }
    onGenerate(trimmed, { aspectRatio, variants, model });
  }, [aspectRatio, isGenerating, model, onGenerate, prompt, variants]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleGenerate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleGenerate]);

  return (
    <Card className="w-full max-w-xl border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <Sparkles className="h-5 w-5 text-primary-600" aria-hidden />
        <CardTitle className="text-lg">Describe your ad</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label htmlFor="ad-prompt" className="sr-only">
            Ad prompt
          </label>
          <textarea
            id="ad-prompt"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isGenerating}
            placeholder="Describe the vibe you want (e.g., 'luxury hotel lobby')"
            className={cn(
              "w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none",
              "focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/30",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          />
        </div>

        <div
          className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          aria-live="polite"
        >
          {previewLine(debouncedPrompt, productContext.productType)}
        </div>

        <div className="flex flex-wrap gap-2" role="list">
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              role="listitem"
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-primary-400 hover:text-primary-800"
              onClick={() => setPrompt((p) => (p ? `${p}, ${chip}` : chip))}
              disabled={isGenerating}
            >
              {chip}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="text-sm font-medium text-primary-700 underline-offset-2 hover:underline"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
        >
          {showAdvanced ? "Hide advanced options" : "Advanced options"}
        </button>

        {showAdvanced && (
          <div className="grid gap-3 rounded-lg border bg-slate-50 p-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600" htmlFor="aspect-ratio">
                Aspect ratio
              </label>
              <select
                id="aspect-ratio"
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                disabled={isGenerating}
              >
                <option value="1:1">1:1</option>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="4:5">4:5</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600" htmlFor="variants-count">
                Variants
              </label>
              <select
                id="variants-count"
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                value={variants}
                onChange={(e) => setVariants(Number(e.target.value))}
                disabled={isGenerating}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600" htmlFor="model-select">
                Model
              </label>
              <select
                id="model-select"
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                value={model}
                onChange={(e) => setModel(e.target.value as GenerationModelChoice)}
                disabled={isGenerating}
              >
                <option value="auto">Auto</option>
                <option value="flux-schnell">Flux Schnell</option>
                <option value="flux-pro">Flux Pro</option>
              </select>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end border-t bg-slate-50/50 px-6 py-3">
        <Button type="button" onClick={handleGenerate} disabled={!prompt.trim() || isGenerating} className="min-w-[140px]">
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Generating…
            </>
          ) : (
            "Generate"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
