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
  /** Present when the server performed background removal. */
  isolatedImageUrl?: string;
}

export interface ProductData {
  id: string;
  originalUrl: string;
  isolatedUrl?: string;
  analysis: ProductAnalysis;
}

export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:5";

export type ImageModelKey = "flux-schnell" | "flux-pro" | "ideogram" | "sdxl" | "dall-e-3";

export type OrchestratorModelChoice = "flux-pro" | "flux-schnell" | "ideogram";
export type GenerationStrategy = "new" | "modify" | "reuse_background";
export type CompositionProductPosition = "center" | "left" | "right" | "foreground";
export type CompositionLighting = "soft" | "dramatic" | "warm" | "cool" | "neutral";
export type CompositionDepth = "shallow" | "medium" | "deep";
export type CompositionCameraAngle = "top-down" | "eye-level" | "angled" | "macro";
export type TextOverlayPosition =
  | "top"
  | "bottom"
  | "center-overlay"
  | "left-overlay"
  | "right-overlay";
export type TextOverlayStyle = "modern" | "bold" | "luxury" | "minimal";
export type PostProcessingColorAdjustment =
  | "none"
  | "warm_boost"
  | "cool_boost"
  | "high_contrast"
  | "muted"
  | "vibrant";
export type PostProcessingOverlayEffect =
  | "none"
  | "light_gradient"
  | "film_grain"
  | "bokeh"
  | "vignette";
export type SafeZoneFlag = "off" | "on";

export interface AdOrchestrationPlan {
  schema_version: "1.0";
  ad_type: string;
  tone: string;
  target_platform: string;
  product_type: string;
  generation_strategy: GenerationStrategy;
  model_choice: OrchestratorModelChoice;
  model_fallback_order: Exclude<OrchestratorModelChoice, "ideogram">[] | OrchestratorModelChoice[];
  background_prompt: string;
  negative_prompt: string;
  composition: {
    product_position: CompositionProductPosition;
    background_style: string;
    lighting: CompositionLighting;
    depth: CompositionDepth;
    camera_angle: CompositionCameraAngle;
  };
  text_overlay: {
    enabled: boolean;
    headline: string;
    subtext: string;
    position: TextOverlayPosition;
    style: TextOverlayStyle;
  };
  post_processing: {
    apply_shadow: boolean;
    apply_reflection: boolean;
    color_adjustment: PostProcessingColorAdjustment;
    overlay_effect: PostProcessingOverlayEffect;
  };
  render_specs: {
    aspect_ratio: "1:1" | "4:5" | "9:16" | "16:9" | "3:2";
    width: number;
    height: number;
    safe_zone: SafeZoneFlag;
  };
  edit_operations: Array<Record<string, unknown>>;
  constraints: {
    preserve_product_identity: boolean;
    avoid_extra_objects: boolean;
    text_legibility_priority: boolean;
  };
  confidence: {
    intent_confidence: number;
    product_type_confidence: number;
  };
}

/** UI / API model selector: Auto defers to server suggestion. */
export type GenerationModelChoice = ImageModelKey | "auto";
export type CreativeMode = "in-use-lifestyle" | "studio-product-only";
export type SubjectHint = "auto" | "athlete" | "fashion-model" | "hands-only" | "custom";

export interface GenerationOptions {
  aspectRatio: AspectRatio;
  variants: number;
  model: GenerationModelChoice;
  creativeMode: CreativeMode;
  subjectHint: SubjectHint;
  customSubjectHint?: string;
}

export type ExportFormat = "png" | "jpg" | "webp";

export interface GenerationRequest {
  productImageUrl: string;
  userPrompt: string;
  productContext: ProductContext;
  variants?: number;
  aspectRatio?: AspectRatio;
  model?: ImageModelKey;
  creativeMode?: CreativeMode;
  subjectHint?: SubjectHint;
  customSubjectHint?: string;
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

export interface OrchestrationSummary {
  traceId?: string;
  adType: string;
  generationStrategy: GenerationStrategy;
  targetPlatform: string;
  tone: string;
  modelChoice?: OrchestratorModelChoice;
  resolvedModel?: "flux-pro" | "flux-schnell" | "ideogram";
  aspectRatio?: AspectRatio;
  topEditOperation?: string;
  intentConfidence?: number;
  productTypeConfidence?: number;
  fallbackApplied?: boolean;
  fallbackReason?: string;
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
