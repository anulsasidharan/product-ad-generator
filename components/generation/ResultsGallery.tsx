"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Copy, Download, RefreshCw, Share2, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Generation } from "@/lib/types";

interface ResultsGalleryProps {
  generations: Generation[];
  originalProductUrl: string;
  onRegenerate: (generationId: string) => void;
}

function modelLabel(model: string): string {
  if (model.includes("flux-pro") || model === "flux-pro") {
    return "Flux Pro";
  }
  return "Flux Schnell";
}

async function downloadImage(imageUrl: string, format: "png" | "jpeg" | "webp", filename: string): Promise<void> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error("Download failed");
  }
  const blob = await res.blob();
  const img = document.createElement("img");
  img.crossOrigin = "anonymous";
  img.src = URL.createObjectURL(blob);
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Image decode failed"));
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas unsupported");
  }
  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(img.src);
  const mime =
    format === "png" ? "image/png" : format === "jpeg" ? "image/jpeg" : "image/webp";
  const quality = format === "png" ? undefined : 0.88;
  const out = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), mime, quality),
  );
  if (!out) {
    throw new Error("Encode failed");
  }
  const url = URL.createObjectURL(out);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ResultsGallery({ generations, originalProductUrl, onRegenerate }: ResultsGalleryProps) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [slider, setSlider] = useState(50);

  const active = useMemo(
    () => (lightbox !== null ? generations[lightbox] ?? null : null),
    [generations, lightbox],
  );

  const close = useCallback(() => setLightbox(null), []);

  useEffect(() => {
    if (lightbox === null) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      }
      if (e.key === "ArrowRight") {
        setLightbox((i) => (i === null ? i : Math.min(generations.length - 1, i + 1)));
      }
      if (e.key === "ArrowLeft") {
        setLightbox((i) => (i === null ? i : Math.max(0, i - 1)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, generations.length, lightbox]);

  const shareUrl = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }, []);

  if (generations.length === 0) {
    return null;
  }

  return (
    <div className="w-full space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Results</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {generations.map((g, index) => (
          <motion.div key={g.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="group overflow-hidden border-slate-200 shadow-sm">
              <button
                type="button"
                className="relative block aspect-square w-full bg-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                onClick={() => {
                  setSlider(50);
                  setLightbox(index);
                }}
                aria-label={`Open preview for variant ${index + 1}`}
              >
                <Image
                  src={g.imageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width:768px) 100vw, 33vw"
                  loading="lazy"
                  unoptimized
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-left text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="line-clamp-2">{g.optimizedPrompt}</span>
                </div>
              </button>
              <CardContent className="space-y-2 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="rounded-full bg-primary-100 px-2 py-0.5 font-medium text-primary-800">
                    {modelLabel(g.model)}
                  </span>
                  <span>{(g.metadata.generationTime / 1000).toFixed(1)}s</span>
                </div>
                <p className="line-clamp-2 text-xs text-slate-500" title={g.optimizedPrompt}>
                  {g.optimizedPrompt}
                </p>
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 px-2 text-xs"
                    onClick={() => onRegenerate(g.id)}
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    Regenerate
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 px-2 text-xs"
                    onClick={() => void shareUrl(g.imageUrl)}
                  >
                    <Share2 className="h-3.5 w-3.5" aria-hidden />
                    Share
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {lightbox !== null && active && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
          >
            <motion.div
              className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-xl"
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.96 }}
            >
              <button
                type="button"
                className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                onClick={close}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="grid max-h-[85vh] gap-4 overflow-auto p-4 md:grid-cols-[1fr_280px]">
                <div className="relative min-h-[280px] w-full overflow-hidden rounded-lg bg-slate-100">
                  <div className="relative aspect-square w-full touch-pan-y">
                    <Image
                      src={active.imageUrl}
                      alt="Generated ad"
                      fill
                      className="object-contain"
                      sizes="(max-width:768px) 100vw, 800px"
                      priority
                      unoptimized
                    />
                    <div
                      className="absolute inset-0 overflow-hidden border-r-2 border-white/90 shadow-md"
                      style={{ clipPath: `inset(0 ${100 - slider}% 0 0)` }}
                      aria-hidden
                    >
                      <Image
                        src={originalProductUrl}
                        alt="Original product"
                        fill
                        className="object-contain"
                        sizes="800px"
                        unoptimized
                      />
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={slider}
                    onChange={(e) => setSlider(Number(e.target.value))}
                    className="absolute bottom-3 left-1/2 w-[min(90%,360px)] -translate-x-1/2 accent-primary-600"
                    aria-label="Before and after comparison"
                  />
                  <p className="pointer-events-none absolute left-3 top-3 rounded bg-black/50 px-2 py-1 text-xs text-white">
                    Drag · original (left) / result (full)
                  </p>
                </div>
                <div className="flex flex-col gap-3 text-sm">
                  <p className="font-medium text-slate-900">Download</p>
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="justify-start gap-2"
                      onClick={() =>
                        void downloadImage(active.imageUrl, "png", `${active.id}.png`).catch(() =>
                          toast.error("PNG download failed"),
                        )
                      }
                    >
                      <Download className="h-4 w-4" />
                      PNG (full)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="justify-start gap-2"
                      onClick={() =>
                        void downloadImage(active.imageUrl, "jpeg", `${active.id}.jpg`).catch(() =>
                          toast.error("JPG download failed"),
                        )
                      }
                    >
                      <Download className="h-4 w-4" />
                      JPG (web)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="justify-start gap-2"
                      onClick={() =>
                        void downloadImage(active.imageUrl, "webp", `${active.id}.webp`).catch(() =>
                          toast.error("WebP download failed"),
                        )
                      }
                    >
                      <Download className="h-4 w-4" />
                      WebP (small)
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="gap-2"
                    onClick={() => void shareUrl(active.imageUrl)}
                  >
                    <Copy className="h-4 w-4" />
                    Copy image URL
                  </Button>
                  <div className="mt-auto flex gap-2 border-t pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Previous variant"
                      disabled={lightbox === 0}
                      onClick={() => setLightbox((i) => (i === null || i === 0 ? i : i - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Next variant"
                      disabled={lightbox === generations.length - 1}
                      onClick={() =>
                        setLightbox((i) =>
                          i === null || i >= generations.length - 1 ? i : i + 1,
                        )
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
