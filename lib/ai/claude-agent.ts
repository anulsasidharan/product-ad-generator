import Anthropic from "@anthropic-ai/sdk";

import { ApiError } from "@/lib/api-response";
import type {
  ConversationTurn,
  GenerationParameters,
  GenerationState,
  ImageModelKey,
  IterationAction,
  ProductAnalysis,
  ProductContext,
} from "@/lib/types";

const ANALYSIS_SYSTEM = `You are a product marketing expert. Analyze this product image and provide:
1. Product category/type (be specific, e.g. 'minimalist wristwatch' not just 'watch')
2. Visual attributes: style, colors, materials, notable features
3. 3-4 creative scene suggestions for marketing photos
Format as JSON following this exact shape (no markdown fences, no extra keys):
{
  "productType": string,
  "attributes": { "category": string, "style": string, "colors": string[], "material"?: string },
  "suggestions": [{ "prompt": string, "reasoning": string, "style": string }]
}`;

const OPTIMIZE_SYSTEM = `You are an expert at writing prompts for image generation models like FLUX and Stable Diffusion.

Transform the user's casual description into a detailed, technical prompt for a BACKGROUND SCENE only.
CRITICAL: Do NOT include the product in the prompt. The product image will be composited on top of the generated background in a separate step — describing the product in the prompt causes it to appear twice.

The prompt must:
1. Describe only the environment, surfaces, props, and lighting that complement the product type
2. Add appropriate photography terms (lighting style, camera angle, depth of field)
3. Set a mood that suits the product category
4. Create a professional marketing aesthetic
5. Explicitly leave the foreground empty for product placement

Return ONLY the background scene prompt as plain text, no explanations.`;

const VARIANTS_SYSTEM = `You create diverse variant background scene prompts for product marketing image generation.
CRITICAL: Each prompt must describe ONLY the environment, setting, surfaces, props, and lighting — NOT the product itself. The product will be composited on top of the generated background in a separate step.
Return ONLY valid JSON: an array of objects, each with:
{ "prompt": string, "reasoning": string, "parameters": { "style": string, "lighting": string, "composition": string } }
No markdown fences.`;

const ITERATION_SYSTEM = `You are an AI assistant helping users refine marketing images through conversation.

Determine what they want to change. Respond with JSON only (no markdown):
{
  "action": "adjust_color_temperature" | "add_text" | "reposition_product" | "regenerate" | "clarify",
  "parameters": { },
  "confidence": number,
  "explanation": string
}

Rules:
- If confidence < 0.7, use action "clarify" with parameters { "question": string, "options": string[] }.
- adjust_color_temperature: parameters { "warmth": number, "layer": "background" | "all" }
- add_text: parameters { "text": string, "position": { "x": number, "y": number }, "font": string, "color": string }
- reposition_product: parameters { "position": { "x": number, "y": number }, "scale": number }
- regenerate: parameters { "modifiedPrompt": string, "reason": string }
- clarify: parameters { "question": string, "options": string[] }`;

export const DEFAULT_MODEL = "claude-sonnet-4-6";
const CACHE_MAX = 50;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/u, "");
  }
  return trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractTextBlock(response: Anthropic.Message): string {
  const block = response.content[0];
  if (!block || block.type !== "text") {
    throw new ApiError("Unexpected Claude response", 502, "AI_SERVICE_ERROR");
  }
  return block.text;
}

function parseProductAnalysis(raw: string): ProductAnalysis {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(raw)) as unknown;
  } catch {
    throw new ApiError("Failed to parse analysis JSON from model", 502, "PARSE_ERROR");
  }

  if (!isRecord(parsed)) {
    throw new ApiError("Invalid analysis response shape", 502, "INVALID_ANALYSIS");
  }

  const productType = parsed["productType"];
  const attributes = parsed["attributes"];
  const suggestions = parsed["suggestions"];

  if (typeof productType !== "string" || !isRecord(attributes) || !Array.isArray(suggestions)) {
    throw new ApiError("Invalid analysis response shape", 502, "INVALID_ANALYSIS");
  }

  const category = attributes["category"];
  const style = attributes["style"];
  const colors = attributes["colors"];
  const material = attributes["material"];

  if (typeof category !== "string" || typeof style !== "string" || !Array.isArray(colors)) {
    throw new ApiError("Invalid attributes in analysis response", 502, "INVALID_ANALYSIS");
  }

  const normalizedColors = colors.filter((c): c is string => typeof c === "string");
  const normalizedSuggestions = suggestions.map((s) => {
    if (!isRecord(s)) {
      throw new ApiError("Invalid suggestion entry", 502, "INVALID_ANALYSIS");
    }
    const prompt = s["prompt"];
    const reasoning = s["reasoning"];
    const st = s["style"];
    if (typeof prompt !== "string" || typeof reasoning !== "string" || typeof st !== "string") {
      throw new ApiError("Invalid suggestion entry", 502, "INVALID_ANALYSIS");
    }
    return { prompt, reasoning, style: st };
  });

  return {
    productType,
    attributes: {
      category,
      style,
      colors: normalizedColors,
      ...(typeof material === "string" ? { material } : {}),
    },
    suggestions: normalizedSuggestions,
  };
}

export interface VariantPlan {
  prompt: string;
  reasoning: string;
  parameters: GenerationParameters;
}

export interface OptimizePromptResult {
  optimizedPrompt: string;
  suggestedModel: ImageModelKey;
}

function suggestModelFromPrompt(userPrompt: string): ImageModelKey {
  const p = userPrompt.toLowerCase();
  if (p.includes("best quality") || p.includes("maximum detail") || p.includes("print")) {
    return "flux-pro";
  }
  return "flux-schnell";
}

function parseVariantPlans(raw: string, count: number): VariantPlan[] {
  const parsed = JSON.parse(stripJsonFence(raw)) as unknown;
  if (!Array.isArray(parsed)) {
    throw new ApiError("Invalid variants JSON", 502, "INVALID_VARIANTS");
  }
  const out: VariantPlan[] = [];
  for (const item of parsed.slice(0, count)) {
    if (!isRecord(item)) {
      continue;
    }
    const prompt = item["prompt"];
    const reasoning = item["reasoning"];
    const parameters = item["parameters"];
    if (typeof prompt !== "string" || typeof reasoning !== "string" || !isRecord(parameters)) {
      continue;
    }
    const style = parameters["style"];
    const lighting = parameters["lighting"];
    const composition = parameters["composition"];
    if (typeof style !== "string" || typeof lighting !== "string" || typeof composition !== "string") {
      continue;
    }
    out.push({
      prompt,
      reasoning,
      parameters: { style, lighting, composition },
    });
  }
  if (out.length === 0) {
    throw new ApiError("No valid variants returned from model", 502, "INVALID_VARIANTS");
  }
  return out;
}

function parseIterationAction(raw: string): IterationAction {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(raw)) as unknown;
  } catch {
    throw new ApiError("Failed to parse iteration JSON", 502, "PARSE_ERROR");
  }
  if (!isRecord(parsed)) {
    throw new ApiError("Invalid iteration response", 502, "INVALID_ITERATION");
  }

  const action = parsed["action"];
  const parameters = parsed["parameters"];
  const confidence = parsed["confidence"];
  const explanation = parsed["explanation"];

  if (typeof action !== "string" || !isRecord(parameters) || typeof explanation !== "string") {
    throw new ApiError("Invalid iteration response", 502, "INVALID_ITERATION");
  }

  const conf = typeof confidence === "number" ? confidence : 0;

  if (conf < 0.7 || action === "clarify") {
    const question = typeof parameters["question"] === "string" ? parameters["question"] : "What would you like to change?";
    const optionsRaw = parameters["options"];
    const options = Array.isArray(optionsRaw)
      ? optionsRaw.filter((o): o is string => typeof o === "string")
      : ["Adjust colors", "Change text", "Regenerate scene"];
    return {
      type: "clarify",
      parameters: { question, options },
      explanation,
    };
  }

  switch (action) {
    case "adjust_color_temperature": {
      const warmth = parameters["warmth"];
      const layer = parameters["layer"];
      if (typeof warmth !== "number" || (layer !== "background" && layer !== "all")) {
        throw new ApiError("Invalid adjust_color_temperature parameters", 502, "INVALID_ITERATION");
      }
      return {
        type: "adjust_color_temperature",
        parameters: { warmth, layer },
        explanation,
      };
    }
    case "add_text": {
      const text = parameters["text"];
      const position = parameters["position"];
      const font = parameters["font"];
      const color = parameters["color"];
      if (
        typeof text !== "string" ||
        !isRecord(position) ||
        typeof position["x"] !== "number" ||
        typeof position["y"] !== "number" ||
        typeof font !== "string" ||
        typeof color !== "string"
      ) {
        throw new ApiError("Invalid add_text parameters", 502, "INVALID_ITERATION");
      }
      return {
        type: "add_text",
        parameters: { text, position: { x: position["x"], y: position["y"] }, font, color },
        explanation,
      };
    }
    case "reposition_product": {
      const position = parameters["position"];
      const scale = parameters["scale"];
      if (
        !isRecord(position) ||
        typeof position["x"] !== "number" ||
        typeof position["y"] !== "number" ||
        typeof scale !== "number"
      ) {
        throw new ApiError("Invalid reposition_product parameters", 502, "INVALID_ITERATION");
      }
      return {
        type: "reposition_product",
        parameters: { position: { x: position["x"], y: position["y"] }, scale },
        explanation,
      };
    }
    case "regenerate": {
      const modifiedPrompt = parameters["modifiedPrompt"];
      const reason = parameters["reason"];
      if (typeof modifiedPrompt !== "string" || typeof reason !== "string") {
        throw new ApiError("Invalid regenerate parameters", 502, "INVALID_ITERATION");
      }
      return {
        type: "regenerate",
        parameters: { modifiedPrompt, reason },
        explanation,
      };
    }
    default:
      return {
        type: "clarify",
        parameters: {
          question: "I am not sure how to apply that change yet. Could you rephrase?",
          options: ["Warmer background", "Add headline text", "Try a new scene"],
        },
        explanation,
      };
  }
}

export class ClaudeAgent {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly promptCache = new Map<string, OptimizePromptResult>();

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    this.client = new Anthropic({ apiKey: key });
    this.model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  }

  private cacheKey(userPrompt: string, productContext: ProductContext): string {
    return `${userPrompt}::${JSON.stringify(productContext)}`;
  }

  private touchCache(key: string, value: OptimizePromptResult): void {
    if (this.promptCache.has(key)) {
      this.promptCache.delete(key);
    }
    this.promptCache.set(key, value);
    for (let i = 0; i < CACHE_MAX && this.promptCache.size > CACHE_MAX; i++) {
      const first = this.promptCache.keys().next().value;
      if (first !== undefined) {
        this.promptCache.delete(first);
      } else {
        break;
      }
    }
  }

  /**
   * Analyzes a remote product image URL using Claude vision and returns structured analysis.
   */
  async analyzeProduct(imageUrl: string): Promise<ProductAnalysis> {
    const maxAttempts = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: 2048,
          temperature: 0.4,
          system: ANALYSIS_SYSTEM,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "url", url: imageUrl },
                },
                {
                  type: "text",
                  text: "Return JSON only matching the schema described in the system message.",
                },
              ],
            },
          ],
        });

        return parseProductAnalysis(extractTextBlock(response));
      } catch (error) {
        lastError = error;
        if (error instanceof ApiError) {
          throw error;
        }
        if (attempt === maxAttempts) {
          break;
        }
        await sleep(400 * 2 ** (attempt - 1));
      }
    }

    console.error("Claude analyzeProduct failed:", lastError);
    throw new ApiError("AI service unavailable", 503, "AI_SERVICE_ERROR");
  }

  /**
   * Expands a casual user prompt into a detailed image-generation prompt (cached).
   */
  async optimizePrompt(userPrompt: string, productContext: ProductContext): Promise<OptimizePromptResult> {
    const key = this.cacheKey(userPrompt, productContext);
    const hit = this.promptCache.get(key);
    if (hit) {
      return hit;
    }

    const userContent = `User's product context:
- Type: ${productContext.productType}
- Category: ${productContext.attributes.category}
- Style: ${productContext.attributes.style}
- Colors: ${productContext.attributes.colors.join(", ")}
${productContext.attributes.material ? `- Material: ${productContext.attributes.material}` : ""}

User's request: ${userPrompt}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1200,
      temperature: 0.6,
      system: OPTIMIZE_SYSTEM,
      messages: [{ role: "user", content: userContent }],
    });

    const optimizedPrompt = extractTextBlock(response).trim();
    const suggestedModel = suggestModelFromPrompt(userPrompt);
    const result: OptimizePromptResult = { optimizedPrompt, suggestedModel };
    this.touchCache(key, result);
    return result;
  }

  /**
   * Produces N distinct creative directions (prompts) from an optimized base prompt.
   */
  async generateVariants(
    optimizedPrompt: string,
    productContext: ProductContext,
    count: number,
  ): Promise<VariantPlan[]> {
    const userContent = `Base optimized background prompt:
${optimizedPrompt}

Product type: ${productContext.productType}
Category: ${productContext.attributes.category}

Produce exactly ${count} background scene variants with different composition/lighting/mood. Do NOT include the product in any prompt — only describe the environment and setting. The product will be composited on top separately.`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      temperature: 0.85,
      system: VARIANTS_SYSTEM,
      messages: [{ role: "user", content: userContent }],
    });

    return parseVariantPlans(extractTextBlock(response), count);
  }

  /**
   * Parses a conversational refinement request into a structured iteration action.
   */
  async interpretIteration(
    userMessage: string,
    currentState: GenerationState,
    conversationHistory: ConversationTurn[],
  ): Promise<IterationAction> {
    const historyText = conversationHistory
      .map((t) => `${t.role}: ${t.content}`)
      .join("\n");

    const paramsText = JSON.stringify(currentState.parameters ?? {});
    const userContent = `User's current image context:
- imageUrl: ${currentState.imageUrl}
- parameters (JSON): ${paramsText}

Conversation history:
${historyText || "(none)"}

User just said: '${userMessage}'`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      temperature: 0.3,
      system: ITERATION_SYSTEM,
      messages: [{ role: "user", content: userContent }],
    });

    return parseIterationAction(extractTextBlock(response));
  }
}
