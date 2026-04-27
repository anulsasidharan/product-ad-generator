"use client";

import { Loader2, Settings2, Sparkles, Wand2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type {
  AspectRatio,
  CreativeMode,
  GenerationModelChoice,
  GenerationOptions,
  ProductContext,
  SubjectHint,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface PromptInputProps {
  productContext: ProductContext;
  onGenerate: (prompt: string, options: GenerationOptions) => void;
  suggestions: string[];
  isGenerating: boolean;
  recommendedOptions?: Partial<GenerationOptions>;
}

function contextualChips(productContext: ProductContext): string[] {
  const blob = `${productContext.productType} ${productContext.attributes.category}`.toLowerCase();
  if (blob.includes("watch") || blob.includes("timepiece")) return ["Executive desk", "Minimalist concrete", "Wrist shot cafe"];
  if (blob.includes("skin") || blob.includes("care") || blob.includes("beauty")) return ["Spa bathroom", "Botanical flat lay", "Morning routine"];
  if (blob.includes("food") || blob.includes("coffee") || blob.includes("snack")) return ["Rustic wood table", "Bright kitchen", "Outdoor picnic"];
  return ["Clean studio", "Lifestyle scene", "Bold graphic background"];
}

function previewLine(prompt: string, productType: string): string {
  const p = prompt.trim();
  if (!p) return "Describe a vibe to see a preview of the shot we will create.";
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

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function PromptInput({
  productContext,
  onGenerate,
  suggestions,
  isGenerating,
  recommendedOptions,
}: PromptInputProps) {
  const [prompt, setPrompt] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [variants, setVariants] = useState(3);
  const [model, setModel] = useState<GenerationModelChoice>("auto");
  const [creativeMode, setCreativeMode] = useState<CreativeMode>("in-use-lifestyle");
  const [subjectHint, setSubjectHint] = useState<SubjectHint>("auto");
  const [customSubjectHint, setCustomSubjectHint] = useState("");

  useEffect(() => {
    if (!recommendedOptions) {
      return;
    }
    if (recommendedOptions.aspectRatio) {
      setAspectRatio(recommendedOptions.aspectRatio);
    }
    if (recommendedOptions.model) {
      setModel(recommendedOptions.model);
    }
  }, [recommendedOptions?.aspectRatio, recommendedOptions?.model]);

  const debouncedPrompt = useDebounced(prompt, 280);

  const chips = useMemo(() => {
    const base = contextualChips(productContext);
    const merged = [...new Set([...suggestions, ...base])];
    return merged.slice(0, 6);
  }, [productContext, suggestions]);

  const handleGenerate = useCallback(() => {
    const trimmed = prompt.trim();
    if (!trimmed || isGenerating) return;
    onGenerate(trimmed, {
      aspectRatio,
      variants,
      model,
      creativeMode,
      subjectHint,
      customSubjectHint: subjectHint === "custom" ? customSubjectHint.trim() : undefined,
    });
  }, [aspectRatio, creativeMode, customSubjectHint, isGenerating, model, onGenerate, prompt, subjectHint, variants]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleGenerate(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleGenerate]);

  const selectClass =
    "h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/50 disabled:opacity-50";

  return (
    <div className="w-full max-w-xl rounded-2xl glass shadow-glass">
      {/* Header */}
      <div className="flex flex-row items-center gap-2.5 px-4 pt-4 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
          <Sparkles className="h-4 w-4 text-violet-400" aria-hidden />
        </div>
        <span className="text-base font-semibold text-white">Describe your ad</span>
      </div>

      <div className="space-y-3 px-4 pb-3">
        {/* Prompt textarea */}
        <div>
          <label htmlFor="ad-prompt" className="sr-only">Ad prompt</label>
          <textarea
            id="ad-prompt"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isGenerating}
            placeholder={`Describe the vibe you want (e.g. "luxury hotel lobby")`}
            className={cn(
              "w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white shadow-sm outline-none leading-relaxed",
              "focus-visible:border-violet-500/50 focus-visible:ring-2 focus-visible:ring-violet-500/20",
              "disabled:cursor-not-allowed disabled:opacity-60",
              "placeholder:text-zinc-600",
            )}
          />
        </div>

        {/* Live preview */}
        <div
          className="rounded-xl border border-dashed border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-sm leading-relaxed text-zinc-400"
          aria-live="polite"
        >
          <span className="mr-1 text-[10px] font-bold uppercase tracking-wide text-zinc-600">Preview · </span>
          {previewLine(debouncedPrompt, productContext.productType)}
        </div>

        {/* Suggestion chips */}
        <div className="flex flex-wrap gap-1.5" role="list">
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              role="listitem"
              className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-medium text-zinc-400 transition hover:border-violet-500/40 hover:bg-violet-500/[0.08] hover:text-violet-300 disabled:opacity-50"
              onClick={() => setPrompt((p) => (p ? `${p}, ${chip}` : chip))}
              disabled={isGenerating}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Advanced toggle */}
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-violet-400 transition-colors"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
        >
          <Settings2 className="h-3.5 w-3.5" aria-hidden />
          {showAdvanced ? "Hide advanced options" : "Advanced options"}
        </button>

        {showAdvanced && (
          <div className="grid gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600" htmlFor="aspect-ratio">
                Aspect ratio
              </label>
              <select id="aspect-ratio" className={selectClass} value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)} disabled={isGenerating}>
                <option value="1:1">1:1 (Square)</option>
                <option value="16:9">16:9 (Wide)</option>
                <option value="9:16">9:16 (Story)</option>
                <option value="4:5">4:5 (Portrait)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600" htmlFor="variants-count">
                Variants
              </label>
              <select id="variants-count" className={selectClass} value={variants} onChange={(e) => setVariants(Number(e.target.value))} disabled={isGenerating}>
                <option value={1}>1 variant</option>
                <option value={2}>2 variants</option>
                <option value={3}>3 variants</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600" htmlFor="model-select">
                Model
              </label>
              <select id="model-select" className={selectClass} value={model} onChange={(e) => setModel(e.target.value as GenerationModelChoice)} disabled={isGenerating}>
                <option value="auto">Auto (follow orchestration)</option>
                <option value="flux-schnell">Flux Schnell</option>
                <option value="flux-pro">Flux Pro</option>
                <option value="ideogram">Ideogram</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600" htmlFor="creative-mode">
                Creative mode
              </label>
              <select
                id="creative-mode"
                className={selectClass}
                value={creativeMode}
                onChange={(e) => setCreativeMode(e.target.value as CreativeMode)}
                disabled={isGenerating}
              >
                <option value="in-use-lifestyle">In-use lifestyle (person using/wearing)</option>
                <option value="studio-product-only">Studio product-only</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600" htmlFor="subject-hint">
                Subject hint
              </label>
              <select
                id="subject-hint"
                className={selectClass}
                value={subjectHint}
                onChange={(e) => setSubjectHint(e.target.value as SubjectHint)}
                disabled={isGenerating || creativeMode === "studio-product-only"}
              >
                <option value="auto">Auto by product type</option>
                <option value="athlete">Athlete</option>
                <option value="fashion-model">Fashion model</option>
                <option value="hands-only">Hands-only user</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            {subjectHint === "custom" && creativeMode !== "studio-product-only" && (
              <div className="space-y-1 sm:col-span-3">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600" htmlFor="custom-subject-hint">
                  Custom subject hint
                </label>
                <input
                  id="custom-subject-hint"
                  value={customSubjectHint}
                  onChange={(e) => setCustomSubjectHint(e.target.value)}
                  disabled={isGenerating}
                  placeholder="e.g., male trail runner, close-up on legs"
                  className={selectClass}
                />
              </div>
            )}
          </div>
        )}
        {recommendedOptions && (
          <p className="text-xs text-zinc-500">
            Recommended defaults synced from the latest orchestration plan.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-white/[0.06] bg-white/[0.02] px-4 py-3 rounded-b-2xl">
        <span className="text-xs text-zinc-600">{isMac ? "⌘" : "Ctrl"}+↵ to generate</span>
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={!prompt.trim() || isGenerating}
          className="min-w-[140px] gap-2 bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40 shadow-glow-violet"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Generating…
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4" aria-hidden />
              Generate
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
