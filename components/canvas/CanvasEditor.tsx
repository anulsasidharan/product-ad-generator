"use client";

import { Canvas, FabricImage, Textbox } from "fabric";
import { Eye, EyeOff, FileImage, Redo2, Type, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { CanvasState, ExportFormat, Generation, Layer, LayerType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CanvasEditorProps {
  generation: Generation;
  /** Unused for display: server generations are already composited; a second product layer caused a “picture on picture” bug. */
  productImageUrl?: string;
  onUpdate: (state: CanvasState) => void;
  onExport: (format: ExportFormat) => void;
}

const W = 800;
const H = 600;

export function CanvasEditor({ generation, productImageUrl, onUpdate, onExport }: CanvasEditorProps) {
  void productImageUrl;
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [layers, setLayers] = useState<{ id: string; label: string; visible: boolean }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [historyLength, setHistoryLength] = useState(0);

  const pushHistory = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;
    const json = JSON.stringify(c.toJSON());
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(json);
    historyIndexRef.current = historyRef.current.length - 1;
    setHistoryIndex(historyIndexRef.current);
    setHistoryLength(historyRef.current.length);
  }, []);

  const flushSyncLayers = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;
    const fabricObjects = c.getObjects();
    setLayers(
      fabricObjects.map((o, i) => ({
        id: String(i),
        label: o.type ?? `object-${i}`,
        visible: o.visible !== false,
      })),
    );
    const typedLayers: Layer[] = fabricObjects.map((o, i) => {
      const isText = o.type === "textbox" || o.type === "text";
      const layerType: LayerType = isText ? "text" : "image";
      return {
        id: String(i),
        type: layerType,
        position: { x: Math.round(o.left ?? 0), y: Math.round(o.top ?? 0) },
        scale: o.scaleX ?? 1,
        rotation: o.angle ?? 0,
        content: isText
          ? { kind: "text" as const, text: (o as Textbox).text ?? "" }
          : { kind: "image" as const, url: "" },
      };
    });
    onUpdateRef.current({
      layers: typedLayers,
      dimensions: { width: c.getWidth(), height: c.getHeight() },
      history: [{ layers: typedLayers, dimensions: { width: c.getWidth(), height: c.getHeight() } }],
      historyIndex: historyIndexRef.current,
    });
  }, []);

  const scheduleSyncLayers = useCallback(() => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = setTimeout(() => {
      syncTimerRef.current = null;
      flushSyncLayers();
    }, 120);
  }, [flushSyncLayers]);

  useEffect(() => {
    const el = canvasElRef.current;
    if (!el) return;

    const canvas = new Canvas(el, {
      width: W,
      height: H,
      backgroundColor: "#09090b",
    });
    fabricRef.current = canvas;

    const load = async () => {
      // `generation.imageUrl` is already the server-side composite (product on FLUX background).
      // Do not add `productImageUrl` again — that duplicated the product and looked like a hard overlay.
      const bg = await FabricImage.fromURL(generation.imageUrl, { crossOrigin: "anonymous" });
      const scale = Math.min((W * 0.92) / (bg.width || W), (H * 0.92) / (bg.height || H), 1);
      bg.scale(scale);
      bg.set({ originX: "center", originY: "center", left: W / 2, top: H / 2, selectable: false, evented: false });
      canvas.add(bg);

      canvas.sendObjectToBack(bg);
      canvas.on("object:modified", () => {
        pushHistory();
        scheduleSyncLayers();
      });
      pushHistory();
      flushSyncLayers();
    };

    void load();
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [generation.id, generation.imageUrl, pushHistory, flushSyncLayers, scheduleSyncLayers]);

  const undo = useCallback(() => {
    const c = fabricRef.current;
    if (!c || historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const json = historyRef.current[historyIndexRef.current];
    if (json) void c.loadFromJSON(json).then(() => { c.requestRenderAll(); flushSyncLayers(); setHistoryIndex(historyIndexRef.current); });
  }, [flushSyncLayers]);

  const redo = useCallback(() => {
    const c = fabricRef.current;
    if (!c || historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const json = historyRef.current[historyIndexRef.current];
    if (json) void c.loadFromJSON(json).then(() => { c.requestRenderAll(); flushSyncLayers(); setHistoryIndex(historyIndexRef.current); });
  }, [flushSyncLayers]);

  const addText = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;
    const text = new Textbox("Headline", {
      left: W / 2 - 120,
      top: 80,
      width: 240,
      fontSize: 28,
      fill: "#ffffff",
      editable: true,
    });
    c.add(text);
    c.setActiveObject(text);
    pushHistory();
    flushSyncLayers();
  }, [pushHistory, flushSyncLayers]);

  const zoom = useCallback((factor: number) => {
    const c = fabricRef.current;
    if (!c) return;
    const z = c.getZoom() * factor;
    c.setZoom(Math.min(2, Math.max(0.5, z)));
    c.requestRenderAll();
  }, []);

  const exportCanvas = useCallback(
    (format: ExportFormat) => {
      const c = fabricRef.current;
      if (!c) return;
      const fabricFormat = format === "jpg" ? "jpeg" : format;
      const quality = format === "png" ? 1 : 0.92;
      const dataUrl = c.toDataURL({ format: fabricFormat, multiplier: 1, quality });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `export.${format}`;
      a.click();
      onExport(format);
    },
    [onExport],
  );

  const toggleLayer = useCallback(
    (index: number) => {
      const c = fabricRef.current;
      if (!c) return;
      const obj = c.item(index);
      if (!obj) return;
      obj.visible = !obj.visible;
      c.requestRenderAll();
      flushSyncLayers();
    },
    [flushSyncLayers],
  );

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyLength - 1;

  const toolBtnClass = "h-7 w-7 p-0 border-white/[0.08] bg-white/[0.04] text-zinc-400 hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:opacity-30";

  return (
    <div className="w-full rounded-2xl glass shadow-glass">
      {/* Header */}
      <div className="flex flex-col gap-3 px-4 pt-4 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-white">Canvas</h2>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addText}
            className="gap-1.5 text-xs border-white/[0.08] bg-white/[0.04] text-zinc-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
            aria-label="Add text layer"
          >
            <Type className="h-3.5 w-3.5" aria-hidden />
            Text
          </Button>

          <div className="flex items-center gap-0.5 rounded-md border border-white/[0.08] bg-white/[0.02] p-0.5">
            <Button type="button" size="sm" variant="ghost" onClick={undo} disabled={!canUndo} aria-label="Undo" className={toolBtnClass}>
              <Undo2 className="h-3.5 w-3.5" aria-hidden />
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={redo} disabled={!canRedo} aria-label="Redo" className={toolBtnClass}>
              <Redo2 className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>

          <div className="flex items-center gap-0.5 rounded-md border border-white/[0.08] bg-white/[0.02] p-0.5">
            <Button type="button" size="sm" variant="ghost" onClick={() => zoom(1.1)} aria-label="Zoom in" className={toolBtnClass}>
              <ZoomIn className="h-3.5 w-3.5" aria-hidden />
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => zoom(1 / 1.1)} aria-label="Zoom out" className={toolBtnClass}>
              <ZoomOut className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 pb-4 lg:flex-row">
        {/* Canvas viewport */}
        <div className="overflow-auto rounded-xl border border-white/[0.06] bg-zinc-950 p-1">
          <canvas ref={canvasElRef} className="touch-none" />
        </div>

        {/* Sidebar: layers + export */}
        <div className="w-full shrink-0 space-y-4 lg:w-52">
          {/* Layers */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">Layers</p>
            {layers.length === 0 ? (
              <p className="text-xs text-zinc-600 italic">No layers yet</p>
            ) : (
              <ul className="space-y-1">
                {layers.map((layer, i) => (
                  <li key={layer.id}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-left text-xs transition hover:border-white/[0.12] hover:bg-white/[0.06]",
                        !layer.visible && "opacity-40",
                      )}
                      onClick={() => toggleLayer(i)}
                      aria-label={`Toggle layer ${layer.label} visibility`}
                    >
                      <span className="truncate font-medium text-zinc-300">{layer.label}</span>
                      {layer.visible ? (
                        <Eye className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 shrink-0 text-zinc-700" aria-hidden />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Export */}
          <div className="border-t border-white/[0.06] pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">Export</p>
            <div className="flex flex-col gap-1.5">
              {(["png", "jpg", "webp"] as ExportFormat[]).map((fmt) => (
                <Button
                  key={fmt}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => exportCanvas(fmt)}
                  className="justify-start gap-2 text-xs border-white/[0.08] bg-white/[0.04] text-zinc-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                >
                  <FileImage className="h-3.5 w-3.5 text-zinc-600" aria-hidden />
                  {fmt.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
