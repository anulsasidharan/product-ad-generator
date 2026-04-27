"use client";

import { CheckCircle2, ImagePlus, Loader2, RotateCcw, Upload } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProductAnalysis } from "@/lib/types";
import { cn } from "@/lib/utils";

type UiPhase = "idle" | "dragging" | "uploading" | "analyzing" | "success" | "error";

const ACCEPT = "image/png,image/jpeg,image/webp";

interface ProductUploaderProps {
  onUpload: (file: File) => Promise<void>;
  onAnalysisComplete: (analysis: ProductAnalysis) => void;
  onImageReady?: (url: string) => void;
  maxSizeMB?: number;
}

function validateFile(file: File, maxSizeMB: number): string | null {
  const max = maxSizeMB * 1024 * 1024;
  if (file.size > max) return `File must be ${maxSizeMB}MB or smaller`;
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return "Use PNG, JPG, or WebP";
  return null;
}

export function ProductUploader({
  onUpload,
  onAnalysisComplete,
  onImageReady,
  maxSizeMB = 10,
}: ProductUploaderProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<UiPhase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [urlInput, setUrlInput] = useState("");

  const reset = useCallback(() => {
    setPhase("idle");
    setErrorMessage(null);
    setPreviewUrl(null);
    setAnalysis(null);
    setUrlInput("");
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const runAnalyze = useCallback(
    async (imageUrl: string) => {
      setPhase("analyzing");
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, removeBackground: true }),
      });
      const payload = (await res.json()) as { success?: boolean; data?: ProductAnalysis; error?: string };
      if (!res.ok || !payload.success || !payload.data) throw new Error(payload.error ?? "Analysis failed");
      setAnalysis(payload.data);
      onAnalysisComplete(payload.data);
      setPhase("success");
    },
    [onAnalysisComplete],
  );

  const processFile = useCallback(
    async (file: File) => {
      const err = validateFile(file, maxSizeMB);
      if (err) { setErrorMessage(err); setPhase("error"); toast.error(err); return; }

      setErrorMessage(null);
      setPhase("uploading");
      const localPreview = URL.createObjectURL(file);
      setPreviewUrl(localPreview);

      try {
        const fd = new FormData();
        fd.set("file", file);
        const up = await fetch("/api/upload", { method: "POST", body: fd });
        const upJson = (await up.json()) as { success?: boolean; data?: { url: string }; error?: string };
        if (!up.ok || !upJson.success || !upJson.data?.url) throw new Error(upJson.error ?? "Upload failed");

        URL.revokeObjectURL(localPreview);
        setPreviewUrl(upJson.data.url);
        onImageReady?.(upJson.data.url);
        await onUpload(file);
        await runAnalyze(upJson.data.url);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong";
        setErrorMessage(msg);
        setPhase("error");
        toast.error(msg);
        URL.revokeObjectURL(localPreview);
        setPreviewUrl(null);
      }
    },
    [maxSizeMB, onImageReady, onUpload, runAnalyze],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setPhase("idle");
      const file = e.dataTransfer.files[0];
      if (file) void processFile(file);
    },
    [processFile],
  );

  const onBrowse = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void processFile(file);
    },
    [processFile],
  );

  const analyzeFromUrl = useCallback(async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) { toast.error("Enter an image URL"); return; }
    try {
      setPreviewUrl(trimmed);
      onImageReady?.(trimmed);
      setPhase("analyzing");
      await runAnalyze(trimmed);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      setErrorMessage(msg);
      setPhase("error");
      toast.error(msg);
    }
  }, [onImageReady, runAnalyze, urlInput]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const active = document.activeElement;
      const zone = zoneRef.current;
      if (!zone || !active || !zone.contains(active)) return;
      const file = e.clipboardData?.files?.[0];
      if (file && file.type.startsWith("image/")) { e.preventDefault(); void processFile(file); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [processFile]);

  const busy = phase === "uploading" || phase === "analyzing";

  return (
    <div className="w-full max-w-xl rounded-2xl glass shadow-glass">
      {/* Header */}
      <div className="flex flex-row items-center gap-2.5 px-4 pt-4 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
          <ImagePlus className="h-4 w-4 text-violet-400" aria-hidden />
        </div>
        <span className="text-base font-semibold text-white">Product image</span>
        {phase === "success" && (
          <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-400" aria-hidden />
        )}
      </div>

      <div className="space-y-4 px-4 pb-4">
        {/* Drop zone */}
        <div
          ref={zoneRef}
          role="button"
          tabIndex={0}
          aria-label="Upload product image. Drop a file or press Enter to browse."
          aria-busy={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); }
          }}
          onDragEnter={(e) => { e.preventDefault(); setPhase("dragging"); }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setPhase("idle")}
          onDrop={onDrop}
          onClick={() => !busy && inputRef.current?.click()}
          className={cn(
            "flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
            phase === "dragging"
              ? "border-violet-500/60 bg-violet-500/[0.08]"
              : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={onBrowse}
            aria-hidden
          />

          {busy ? (
            <div className="flex flex-col items-center gap-3 text-zinc-400">
              <Loader2 className="h-8 w-8 animate-spin text-violet-400" aria-hidden />
              <span className="text-sm font-medium">
                {phase === "uploading" ? "Uploading…" : "Analysing product…"}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
                <Upload className="h-6 w-6 text-violet-400" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Drop image or click to upload</p>
                <p className="mt-0.5 text-xs text-zinc-500">PNG, JPG, or WebP · max {maxSizeMB} MB</p>
              </div>
            </div>
          )}
        </div>

        {/* URL input */}
        <div className="space-y-1.5">
          <label htmlFor="product-url" className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
            Or paste image URL
          </label>
          <div className="flex gap-2">
            <Input
              id="product-url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://…"
              disabled={busy}
              className="flex-1 border-white/[0.08] bg-white/[0.04] text-sm text-white placeholder:text-zinc-600 focus-visible:border-violet-500/50 focus-visible:ring-violet-500/20"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void analyzeFromUrl()}
              className="border-white/[0.08] bg-white/[0.04] text-zinc-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
            >
              Analyse
            </Button>
          </div>
        </div>

        {/* Error state */}
        {phase === "error" && errorMessage && (
          <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/[0.08] px-3 py-2.5 text-sm text-red-400">
            <span>{errorMessage}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={reset}
              className="shrink-0 gap-1 text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Retry
            </Button>
          </div>
        )}

        {/* Success state */}
        {phase === "success" && analysis && previewUrl && (
          <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.04]">
            <div className="flex gap-3 p-3">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-zinc-900">
                <Image src={previewUrl} alt="" fill className="object-cover" sizes="80px" unoptimized />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{analysis.productType}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {analysis.attributes.style} · {analysis.attributes.category}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {analysis.attributes.colors.slice(0, 3).map((c) => (
                    <span key={c} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                AI suggestions
              </p>
              <ul className="space-y-1">
                {analysis.suggestions.slice(0, 3).map((s) => (
                  <li key={s.prompt} className="flex items-start gap-1.5 text-xs text-zinc-400">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                    {s.prompt}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
