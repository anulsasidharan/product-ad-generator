import { z } from "zod";

export const AnalyzeInputSchema = z.object({
  imageUrl: z.string().url(),
  removeBackground: z.boolean().optional(),
});

const ProductAttributesSchema = z.object({
  category: z.string(),
  style: z.string(),
  colors: z.array(z.string()),
  material: z.string().optional(),
});

export const ProductContextSchema = z.object({
  productType: z.string(),
  attributes: ProductAttributesSchema,
});

export const GenerateInputSchema = z.object({
  productImageUrl: z.string().url(),
  userPrompt: z.string().min(1).max(500),
  productContext: ProductContextSchema,
  variants: z.number().int().min(1).max(3).optional().default(3),
  aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:5"]).optional(),
  model: z.enum(["flux-schnell", "flux-pro", "ideogram", "sdxl", "dall-e-3"]).optional(),
  creativeMode: z.enum(["in-use-lifestyle", "studio-product-only"]).optional(),
  subjectHint: z.enum(["auto", "athlete", "fashion-model", "hands-only", "custom"]).optional(),
  customSubjectHint: z.string().min(1).max(120).optional(),
  productDescription: z.string().min(1).max(1000).optional(),
  previousGenerationContext: z.record(z.string(), z.unknown()).optional(),
  userIterationRequest: z.string().min(1).max(500).optional(),
});

export const ConversationTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.string().optional(),
});

export const IterateInputSchema = z.object({
  generationId: z.string().min(1),
  userMessage: z.string().min(1).max(500),
  conversationHistory: z.array(ConversationTurnSchema),
  productDescription: z.string().min(1).max(1000).optional(),
  previousGenerationContext: z.record(z.string(), z.unknown()).optional(),
  userIterationRequest: z.string().min(1).max(500).optional(),
  currentState: z.object({
    imageUrl: z.string().url(),
    parameters: z.record(z.string(), z.unknown()).optional().default({}),
  }),
});

export type AnalyzeInput = z.infer<typeof AnalyzeInputSchema>;
export type GenerateInput = z.infer<typeof GenerateInputSchema>;
export type IterateInput = z.infer<typeof IterateInputSchema>;

// ── Consistent API error response shape (M9) ──────────────────────────────────

export const ApiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

// ── Response schemas for runtime validation (M7) ──────────────────────────────

const GenerationSchema = z.object({
  id: z.string(),
  imageUrl: z.string(),
  optimizedPrompt: z.string(),
  model: z.string(),
  reasoning: z.string(),
  parameters: z.object({
    style: z.string(),
    lighting: z.string(),
    composition: z.string(),
  }),
  metadata: z.object({
    generationTime: z.number(),
    cost: z.number(),
  }),
});

export const OrchestrationPlanSchema = z.object({
  schema_version: z.literal("1.0"),
  ad_type: z.string(),
  tone: z.string(),
  target_platform: z.string(),
  product_type: z.string(),
  generation_strategy: z.enum(["new", "modify", "reuse_background"]),
  model_choice: z.enum(["flux-pro", "flux-schnell", "ideogram"]),
  model_fallback_order: z.array(z.enum(["flux-pro", "flux-schnell", "ideogram"])),
  background_prompt: z.string(),
  negative_prompt: z.string(),
  composition: z.object({
    product_position: z.enum(["center", "left", "right", "foreground"]),
    background_style: z.string(),
    lighting: z.enum(["soft", "dramatic", "warm", "cool", "neutral"]),
    depth: z.enum(["shallow", "medium", "deep"]),
    camera_angle: z.enum(["top-down", "eye-level", "angled", "macro"]),
  }),
  text_overlay: z.object({
    enabled: z.boolean(),
    headline: z.string(),
    subtext: z.string(),
    position: z.enum(["top", "bottom", "center-overlay", "left-overlay", "right-overlay"]),
    style: z.enum(["modern", "bold", "luxury", "minimal"]),
  }),
  post_processing: z.object({
    apply_shadow: z.boolean(),
    apply_reflection: z.boolean(),
    color_adjustment: z.enum([
      "none",
      "warm_boost",
      "cool_boost",
      "high_contrast",
      "muted",
      "vibrant",
    ]),
    overlay_effect: z.enum(["none", "light_gradient", "film_grain", "bokeh", "vignette"]),
  }),
  render_specs: z.object({
    aspect_ratio: z.enum(["1:1", "4:5", "9:16", "16:9", "3:2"]),
    width: z.number().int().min(256),
    height: z.number().int().min(256),
    safe_zone: z.enum(["off", "on"]),
  }),
  edit_operations: z.array(z.record(z.string(), z.unknown())),
  constraints: z.object({
    preserve_product_identity: z.boolean(),
    avoid_extra_objects: z.boolean(),
    text_legibility_priority: z.boolean(),
  }),
  confidence: z.object({
    intent_confidence: z.number().min(0).max(1),
    product_type_confidence: z.number().min(0).max(1),
  }),
});

export const GenerateResponseSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      generations: z.array(GenerationSchema),
      suggestions: z
        .object({
          improvements: z.array(z.string()),
          relatedStyles: z.array(z.string()),
        })
        .optional(),
      metadata: z
        .object({
          traceId: z.string().optional(),
          totalGenerationTime: z.number(),
          modelUsed: z.string(),
          pipeline: z.enum(["lifestyle", "composite"]).optional(),
          /** Loose shape: normalized in the editor via parseOrchestrationSummary */
          orchestration: z.record(z.string(), z.unknown()).optional(),
        })
        .optional(),
    })
    .optional(),
  error: z.string().optional(),
  code: z.string().optional(),
});

export const AnalyzeResponseSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      productType: z.string(),
      attributes: z.object({
        category: z.string(),
        style: z.string(),
        colors: z.array(z.string()),
        material: z.string().optional(),
      }),
      suggestions: z.array(
        z.object({
          prompt: z.string(),
          reasoning: z.string(),
          style: z.string(),
        }),
      ),
      isolatedImageUrl: z.string().optional(),
    })
    .optional(),
  error: z.string().optional(),
});
