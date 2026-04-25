"use client";

import { Canvas, FabricImage, Textbox } from "fabric";
import { Redo2, Type, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CanvasState, ExportFormat, Generation } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CanvasEditorProps {
  generation: Generation;
  /** Isolated product image (transparent) for compositing on the generated scene. */
  productImageUrl?: string;
  onUpdate: (state: CanvasState) => void;
  onExport: (format: ExportFormat) => void;
}

const W = 800;
const H = 600;

export function CanvasEditor({ generation, productImageUrl, onUpdate, onExport }: CanvasEditorProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const [layers, setLayers] = useState<{ id: string; label: string; visible: boolean }[]>([]);

  const pushHistory = useCallback(() => {
    const c = fabricRef.current;
    if (!c) {
      return;
    }
    const json = JSON.stringify(c.toJSON());
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(json);
    historyIndexRef.current = historyRef.current.length - 1;
  }, []);

  const syncLayers = useCallback(() => {
    const c = fabricRef.current;
    if (!c) {
      return;
    }
    setLayers(
      c.getObjects().map((o, i) => ({
        id: String(i),
        label: o.type ?? `object-${i}`,
        visible: o.visible !== false,
      })),
    );
    onUpdate({
      layers: [],
      dimensions: { width: c.getWidth(), height: c.getHeight() },
      history: [{ layers: [], dimensions: { width: c.getWidth(), height: c.getHeight() } }],
      historyIndex: historyIndexRef.current,
    });
  }, [onUpdate]);

  useEffect(() => {
    const el = canvasElRef.current;
    if (!el) {
      return;
    }

    const canvas = new Canvas(el, {
      width: W,
      height: H,
      backgroundColor: "#f8fafc",
    });
    fabricRef.current = canvas;

    const load = async () => {
      const bg = await FabricImage.fromURL(generation.imageUrl, { crossOrigin: "anonymous" });
      const scale = Math.min((W * 0.92) / (bg.width || W), (H * 0.92) / (bg.height || H), 1);
      bg.scale(scale);
      bg.set({ originX: "center", originY: "center", left: W / 2, top: H / 2, selectable: false, evented: false });
      canvas.add(bg);

      if (productImageUrl) {
        const prod = await FabricImage.fromURL(productImageUrl, { crossOrigin: "anonymous" });
        const ps = Math.min(220 / (prod.width || 220), 220 / (prod.height || 220), 1);
        prod.scale(ps);
        prod.set({
          originX: "center",
          originY: "center",
          left: W / 2,
          top: H / 2 + 40,
          name: "product",
        });
        canvas.add(prod);
      }
      canvas.sendObjectToBack(bg);

      canvas.on("object:modified", () => {
        pushHistory();
        syncLayers();
      });
      pushHistory();
      syncLayers();
    };

    void load();

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [generation.imageUrl, productImageUrl, pushHistory, syncLayers]);

  const undo = useCallback(() => {
    const c = fabricRef.current;
    if (!c || historyIndexRef.current <= 0) {
      return;
    }
    historyIndexRef.current -= 1;
    const json = historyRef.current[historyIndexRef.current];
    if (json) {
      void c.loadFromJSON(json).then(() => {
        c.requestRenderAll();
        syncLayers();
      });
    }
  }, [syncLayers]);

  const redo = useCallback(() => {
    const c = fabricRef.current;
    if (!c || historyIndexRef.current >= historyRef.current.length - 1) {
      return;
    }
    historyIndexRef.current += 1;
    const json = historyRef.current[historyIndexRef.current];
    if (json) {
      void c.loadFromJSON(json).then(() => {
        c.requestRenderAll();
        syncLayers();
      });
    }
  }, [syncLayers]);

  const addText = useCallback(() => {
    const c = fabricRef.current;
    if (!c) {
      return;
    }
    const text = new Textbox("Headline", {
      left: W / 2 - 120,
      top: 80,
      width: 240,
      fontSize: 28,
      fill: "#0f172a",
      editable: true,
    });
    c.add(text);
    c.setActiveObject(text);
    pushHistory();
    syncLayers();
  }, [pushHistory, syncLayers]);

  const zoom = useCallback((factor: number) => {
    const c = fabricRef.current;
    if (!c) {
      return;
    }
    const z = c.getZoom() * factor;
    c.setZoom(Math.min(2, Math.max(0.5, z)));
    c.requestRenderAll();
  }, []);

  const exportCanvas = useCallback(
    (format: ExportFormat) => {
      const c = fabricRef.current;
      if (!c) {
        return;
      }
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
      if (!c) {
        return;
      }
      const obj = c.item(index);
      if (!obj) {
        return;
      }
      obj.visible = !obj.visible;
      c.requestRenderAll();
      syncLayers();
    },
    [syncLayers],
  );

  return (
    <Card className="w-full border-slate-200 shadow-sm">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-lg">Canvas</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={addText}>
            <Type className="mr-1 h-4 w-4" />
            Add Text
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={undo}>
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={redo}>
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => zoom(1.1)}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => zoom(1 / 1.1)}>
            <ZoomOut className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 lg:flex-row">
        <div className="overflow-auto rounded-md border bg-white p-2">
          <canvas ref={canvasElRef} className="touch-none" />
        </div>
        <div className="w-full shrink-0 space-y-3 lg:w-56">
          <p className="text-sm font-medium text-slate-800">Layers</p>
          <ul className="space-y-1 text-sm">
            {layers.map((layer, i) => (
              <li key={layer.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between rounded border px-2 py-1 text-left hover:bg-slate-50",
                    !layer.visible && "opacity-50",
                  )}
                  onClick={() => toggleLayer(i)}
                >
                  <span className="truncate">{layer.label}</span>
                  <span className="text-xs text-slate-500">{layer.visible ? "on" : "off"}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium text-slate-600">Export</p>
            <div className="flex flex-col gap-1">
              <Button type="button" size="sm" variant="outline" onClick={() => exportCanvas("png")}>
                PNG
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => exportCanvas("jpg")}>
                JPG
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => exportCanvas("webp")}>
                WebP
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
