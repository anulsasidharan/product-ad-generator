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
