"use client";

import { PlayCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const TOUR_SEEN_KEY = "olivia-product-tour-seen-v1";

export function ProductTourLauncher() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeVideo, setActiveVideo] = useState<"full" | "sample">("full");

  useEffect(() => {
    setMounted(true);
    const hasSeenTour = window.localStorage.getItem(TOUR_SEEN_KEY);
    if (!hasSeenTour) {
      setIsOpen(true);
      window.localStorage.setItem(TOUR_SEEN_KEY, "true");
    }
  }, []);

  if (!mounted) {
    return null;
  }

  const modal = isOpen ? (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/70 p-2 sm:p-4">
      <div className="flex min-h-[100dvh] items-start justify-center py-2 sm:items-center sm:py-4">
        <div className="flex max-h-[96dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-zinc-900 shadow-2xl">
          <div className="sticky top-0 z-10 mb-0 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-zinc-900/95 px-3 py-3 backdrop-blur sm:px-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Product Ad Generator Tour</h2>
              <p className="text-sm text-zinc-400">Quick walkthrough of the full ad creation workflow.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md p-2 text-zinc-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Close product tour"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-black p-2 sm:p-3">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveVideo("full")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  activeVideo === "full"
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                Full Platform Tour (2 min)
              </button>
              <button
                type="button"
                onClick={() => setActiveVideo("sample")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  activeVideo === "sample"
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                Sample Product Journey (1 min)
              </button>
            </div>
            <div className="mx-auto w-full max-w-[1600px] overflow-hidden rounded-lg border border-white/10 bg-black">
              <video
                className="h-auto max-h-[78dvh] w-full object-contain"
                controls
                autoPlay
                preload="metadata"
                key={activeVideo}
              >
                <source
                  src={
                    activeVideo === "full"
                      ? "/tour/product-tour-full.mp4"
                      : "/tour/sample-product-journey.mp4"
                  }
                  type="video/mp4"
                />
                <track kind="captions" srcLang="en" src="/tour/product-tour.vtt" label="English" default />
                Your browser does not support embedded videos.
              </video>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
      >
        <PlayCircle className="h-4 w-4 text-sky-400" aria-hidden />
        Take a Tour
      </button>
      {createPortal(modal, document.body)}
    </>
  );
}
