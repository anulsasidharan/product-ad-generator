"use client";

import { Loader2, RotateCcw, Upload } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ProductAnalysis } from "@/lib/types";
import { cn } from "@/lib/utils";

type UiPhase = "idle" | "dragging" | "uploading" | "analyzing" | "success" | "error";

const ACCEPT = "image/png,image/jpeg,image/webp";

interface ProductUploaderProps {
  onUpload: (file: File) => Promise<void>;
  onAnalysisComplete: (analysis: ProductAnalysis) => void;
  /** Called with the public image URL after upload (before analysis). */
  onImageReady?: (url: string) => void;
  maxSizeMB?: number;
}

function validateFile(file: File, maxSizeMB: number): string | null {
  const max = maxSizeMB * 1024 * 1024;
  if (file.size > max) {
    return `File must be ${maxSizeMB}MB or smaller`;
  }
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    return "Use PNG, JPG, or WebP";
  }
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
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, []);

  const runAnalyze = useCallback(
    async (imageUrl: string) => {
      setPhase("analyzing");
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const payload = (await res.json()) as { success?: boolean; data?: ProductAnalysis; error?: string };
      if (!res.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Analysis failed");
      }
      setAnalysis(payload.data);
      onAnalysisComplete(payload.data);
      setPhase("success");
    },
    [onAnalysisComplete],
  );

  const processFile = useCallback(
    async (file: File) => {
      const err = validateFile(file, maxSizeMB);
      if (err) {
        setErrorMessage(err);
        setPhase("error");
        toast.error(err);
        return;
      }

      setErrorMessage(null);
      setPhase("uploading");
      const localPreview = URL.createObjectURL(file);
      setPreviewUrl(localPreview);

      try {
        const fd = new FormData();
        fd.set("file", file);
        const up = await fetch("/api/upload", { method: "POST", body: fd });
        const upJson = (await up.json()) as { success?: boolean; data?: { url: string }; error?: string };
        if (!up.ok || !upJson.success || !upJson.data?.url) {
          throw new Error(upJson.error ?? "Upload failed");
        }

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
      if (file) {
        void processFile(file);
      }
    },
    [processFile],
  );

  const onBrowse = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        void processFile(file);
      }
    },
    [processFile],
  );

  const analyzeFromUrl = useCallback(async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      toast.error("Enter an image URL");
      return;
    }
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
      if (!zone || !active || !zone.contains(active)) {
        return;
      }
      const items = e.clipboardData?.files;
      const file = items?.[0];
      if (file && file.type.startsWith("image/")) {
        e.preventDefault();
        void processFile(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [processFile]);

  const busy = phase === "uploading" || phase === "analyzing";

  return (
    <Card className="w-full max-w-xl border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Product image</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          ref={zoneRef}
          role="button"
          tabIndex={0}
          aria-label="Upload product image. Drop a file or press Enter to browse."
          aria-busy={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setPhase("dragging");
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setPhase("idle")}
          onDrop={onDrop}
          onClick={() => !busy && inputRef.current?.click()}
          className={cn(
            "flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
            phase === "dragging" ? "border-primary-500 bg-primary-50" : "border-slate-300 bg-slate-50 hover:bg-slate-100",
            busy && "pointer-events-none opacity-70",
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
            <div className="flex flex-col items-center gap-2 text-slate-600">
              <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
              <span>{phase === "uploading" ? "Uploading…" : "Analyzing product…"}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center text-slate-600">
              <Upload className="h-8 w-8 text-primary-600" aria-hidden />
              <span className="font-medium text-slate-800">Drop image or click to upload</span>
              <span className="text-sm">PNG, JPG, or WebP · max {maxSizeMB}MB</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="product-url" className="text-sm font-medium text-slate-700">
            Or paste image URL
          </label>
          <div className="flex gap-2">
            <Input
              id="product-url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://…"
              disabled={busy}
              className="flex-1"
            />
            <Button type="button" variant="outline" disabled={busy} onClick={() => void analyzeFromUrl()}>
              Analyze URL
            </Button>
          </div>
        </div>

        {phase === "error" && errorMessage && (
          <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <span>{errorMessage}</span>
            <Button type="button" size="sm" variant="ghost" onClick={reset} className="shrink-0 gap-1">
              <RotateCcw className="h-4 w-4" aria-hidden />
              Retry
            </Button>
          </div>
        )}

        {phase === "success" && analysis && previewUrl && (
          <div className="space-y-3 rounded-lg border bg-white p-3">
            <div className="flex gap-3">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-slate-100">
                <Image src={previewUrl} alt="" fill className="object-cover" sizes="80px" unoptimized />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{analysis.productType}</p>
                <p className="text-xs text-slate-600">
                  {analysis.attributes.style} · {analysis.attributes.category}
                </p>
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Suggestions</p>
              <ul className="list-inside list-disc text-sm text-slate-700">
                {analysis.suggestions.slice(0, 4).map((s) => (
                  <li key={s.prompt}>{s.prompt}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
