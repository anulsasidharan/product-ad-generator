/** Product context passed into generation (from analysis). */
export interface ProductContext {
  productType: string;
  attributes: ProductAttributes;
}

export interface ProductAttributes {
  category: string;
  style: string;
  colors: string[];
  material?: string;
}

export interface Suggestion {
  prompt: string;
  reasoning: string;
  style: string;
}

export interface ProductAnalysis {
  productType: string;
  attributes: ProductAttributes;
  suggestions: Suggestion[];
}

export interface ProductData {
  id: string;
  originalUrl: string;
  isolatedUrl?: string;
  analysis: ProductAnalysis;
}

export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:5";

export type ImageModelKey = "flux-schnell" | "flux-pro" | "sdxl" | "dall-e-3";

/** UI / API model selector: Auto defers to server suggestion. */
export type GenerationModelChoice = ImageModelKey | "auto";

export interface GenerationOptions {
  aspectRatio: AspectRatio;
  variants: number;
  model: GenerationModelChoice;
}

export type ExportFormat = "png" | "jpg" | "webp";

export interface GenerationRequest {
  productImageUrl: string;
  userPrompt: string;
  productContext: ProductContext;
  variants?: number;
  aspectRatio?: AspectRatio;
  model?: ImageModelKey;
}

export interface GenerationParameters {
  style: string;
  lighting: string;
  composition: string;
}

export interface GenerationMetadata {
  generationTime: number;
  cost: number;
}

export interface Generation {
  id: string;
  imageUrl: string;
  optimizedPrompt: string;
  model: string;
  reasoning: string;
  parameters: GenerationParameters;
  metadata: GenerationMetadata;
}

export interface CanvasDimensions {
  width: number;
  height: number;
}

export type LayerType = "image" | "text" | "filter";

export interface LayerPosition {
  x: number;
  y: number;
}

export type LayerContent =
  | { kind: "image"; url: string }
  | { kind: "text"; text: string; font?: string; color?: string }
  | { kind: "filter"; filters: Array<{ type: string; params: Record<string, unknown> }> };

export interface Layer {
  id: string;
  type: LayerType;
  position: LayerPosition;
  scale: number;
  rotation: number;
  content: LayerContent;
}

/** Snapshot for undo/redo without recursive CanvasState typing. */
export interface CanvasHistoryEntry {
  layers: Layer[];
  dimensions: CanvasDimensions;
}

export interface CanvasState {
  layers: Layer[];
  dimensions: CanvasDimensions;
  history: CanvasHistoryEntry[];
  historyIndex: number;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface GenerationState {
  imageUrl: string;
  parameters: Record<string, unknown>;
}

export type IterationAction =
  | {
      type: "adjust_color_temperature";
      parameters: { warmth: number; layer: "background" | "all" };
      explanation: string;
    }
  | {
      type: "add_text";
      parameters: {
        text: string;
        position: LayerPosition;
        font: string;
        color: string;
      };
      explanation: string;
    }
  | {
      type: "reposition_product";
      parameters: { position: LayerPosition; scale: number };
      explanation: string;
    }
  | {
      type: "regenerate";
      parameters: { modifiedPrompt: string; reason: string };
      explanation: string;
    }
  | {
      type: "clarify";
      parameters: { question: string; options: string[] };
      explanation: string;
    };
