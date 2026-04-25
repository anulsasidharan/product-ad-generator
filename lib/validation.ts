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
  model: z.enum(["flux-schnell", "flux-pro", "sdxl", "dall-e-3"]).optional(),
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
          totalGenerationTime: z.number(),
          modelUsed: z.string(),
        })
        .optional(),
    })
    .optional(),
  error: z.string().optional(),
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
