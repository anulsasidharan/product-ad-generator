import Anthropic from "@anthropic-ai/sdk";

import { ApiError } from "@/lib/api-response";
import { OrchestrationPlanSchema } from "@/lib/validation";
import type {
  AdOrchestrationPlan,
  CompositionCameraAngle,
  CompositionDepth,
  CompositionLighting,
  CompositionProductPosition,
  ConversationTurn,
  GenerationParameters,
  GenerationStrategy,
  GenerationState,
  ImageModelKey,
  IterationAction,
  ProductAnalysis,
  ProductContext,
  TextOverlayPosition,
  TextOverlayStyle,
} from "@/lib/types";

const ANALYSIS_SYSTEM = `You are a product marketing expert. Analyze this product image and provide:
1. Product category/type (be specific, e.g. 'minimalist wristwatch' not just 'watch')
2. Visual attributes: style, colors, materials, notable features
3. 3-4 creative scene suggestions for marketing photos — prefer **in-use lifestyle** ideas (someone wearing, running in, holding, or using the product in a believable setting), not only flat lays or empty-stage packshots
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

const LIFESTYLE_HERO_PROMPT_SYSTEM = `You are an expert creative director for lifestyle product ads.
Given a product reference image + user request, write ONE production-ready photoreal hero prompt.

Hard requirements:
- The product must be shown as in-use on a person (worn/held/used naturally), not as a floating object or catalog cutout.
- Keep visual identity close to the reference image: colorways, material feel, silhouette/class.
- Include camera framing, lens feel, lighting, motion/body pose where relevant, and environment from the user's request.
- Avoid malformed anatomy, duplicate limbs, duplicate shoes, logo gibberish, and cheap composite look.
- Do not output JSON.

Return ONLY the final hero prompt string.`;

const VARIANTS_SYSTEM_COMPOSITE = `You create diverse variant background scene prompts for product marketing image generation.
CRITICAL: Each prompt must describe ONLY the environment, setting, surfaces, props, and lighting — NOT the product itself. The product will be composited on top of the generated background in a separate step.
Return ONLY valid JSON: an array of objects, each with:
{ "prompt": string, "reasoning": string, "parameters": { "style": string, "lighting": string, "composition": string } }
No markdown fences.`;

const VARIANTS_SYSTEM_LIFESTYLE = `You create diverse prompts for **single-shot photoreal lifestyle product advertisements**.
Each prompt must describe the **entire finished photograph**: subjects (models, athletes, hands, feet as appropriate), the product naturally **worn, held, or in use**, environment, wardrobe that matches the product category, lighting, camera angle, and mood. Variants should differ meaningfully (e.g. urban run vs trail vs studio motion blur) while matching product_context category and colors where relevant.
CRITICAL: Do NOT describe empty stages, "room for product", packshot-only white voids, or floating cutout objects. No duplicate products on the same person.
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

const ORCHESTRATION_SYSTEM_COMPOSITE = `You are an AI Creative Director + Generation Orchestrator for **composite** product ads (packshot pasted onto a generated background).
Return STRICT JSON only. No markdown, no explanations, no extra keys.
Follow this schema exactly:
{
  "schema_version": "1.0",
  "ad_type": string,
  "tone": string,
  "target_platform": string,
  "product_type": string,
  "generation_strategy": "new" | "modify" | "reuse_background",
  "model_choice": "flux-pro" | "flux-schnell" | "ideogram",
  "model_fallback_order": string[],
  "background_prompt": string,
  "negative_prompt": string,
  "composition": {
    "product_position": "center" | "left" | "right" | "foreground",
    "background_style": string,
    "lighting": "soft" | "dramatic" | "warm" | "cool" | "neutral",
    "depth": "shallow" | "medium" | "deep",
    "camera_angle": "top-down" | "eye-level" | "angled" | "macro"
  },
  "text_overlay": {
    "enabled": boolean,
    "headline": string,
    "subtext": string,
    "position": "top" | "bottom" | "center-overlay" | "left-overlay" | "right-overlay",
    "style": "modern" | "bold" | "luxury" | "minimal"
  },
  "post_processing": {
    "apply_shadow": boolean,
    "apply_reflection": boolean,
    "color_adjustment": "none" | "warm_boost" | "cool_boost" | "high_contrast" | "muted" | "vibrant",
    "overlay_effect": "none" | "light_gradient" | "film_grain" | "bokeh" | "vignette"
  },
  "render_specs": {
    "aspect_ratio": "1:1" | "4:5" | "9:16" | "16:9" | "3:2",
    "width": number,
    "height": number,
    "safe_zone": "off" | "on"
  },
  "edit_operations": object[],
  "constraints": {
    "preserve_product_identity": boolean,
    "avoid_extra_objects": boolean,
    "text_legibility_priority": boolean
  },
  "confidence": {
    "intent_confidence": number,
    "product_type_confidence": number
  }
}
Priority order: user_iteration_request > user_prompt > previous_generation_context > product_description.
Use model_choice=ideogram when visible generated text is required.
Use flux-pro for high-quality photoreal output.
Use flux-schnell for speed/preview.
Use generation_strategy=modify for local edits, reuse_background when scene should stay, new for full scene changes.
For background_prompt: describe ONLY the environment — no product, no model wearing the product; leave clear space for a composited packshot.`;

const ORCHESTRATION_SYSTEM_LIFESTYLE = `You are an AI Creative Director for **in-scene lifestyle and editorial product ads** (one text-to-image shot per creative — no separate packshot paste).
Return STRICT JSON only. No markdown, no explanations, no extra keys.
Follow this schema exactly:
{
  "schema_version": "1.0",
  "ad_type": string,
  "tone": string,
  "target_platform": string,
  "product_type": string,
  "generation_strategy": "new" | "modify" | "reuse_background",
  "model_choice": "flux-pro" | "flux-schnell" | "ideogram",
  "model_fallback_order": string[],
  "background_prompt": string,
  "negative_prompt": string,
  "composition": {
    "product_position": "center" | "left" | "right" | "foreground",
    "background_style": string,
    "lighting": "soft" | "dramatic" | "warm" | "cool" | "neutral",
    "depth": "shallow" | "medium" | "deep",
    "camera_angle": "top-down" | "eye-level" | "angled" | "macro"
  },
  "text_overlay": {
    "enabled": boolean,
    "headline": string,
    "subtext": string,
    "position": "top" | "bottom" | "center-overlay" | "left-overlay" | "right-overlay",
    "style": "modern" | "bold" | "luxury" | "minimal"
  },
  "post_processing": {
    "apply_shadow": boolean,
    "apply_reflection": boolean,
    "color_adjustment": "none" | "warm_boost" | "cool_boost" | "high_contrast" | "muted" | "vibrant",
    "overlay_effect": "none" | "light_gradient" | "film_grain" | "bokeh" | "vignette"
  },
  "render_specs": {
    "aspect_ratio": "1:1" | "4:5" | "9:16" | "16:9" | "3:2",
    "width": number,
    "height": number,
    "safe_zone": "off" | "on"
  },
  "edit_operations": object[],
  "constraints": {
    "preserve_product_identity": boolean,
    "avoid_extra_objects": boolean,
    "text_legibility_priority": boolean
  },
  "confidence": {
    "intent_confidence": number,
    "product_type_confidence": number
  }
}
The JSON field is still named background_prompt for API compatibility, but here it means the **full hero image prompt**: photoreal scene including people using or wearing the product type from product_context (e.g. runner mid-stride in the shoes, model seated in the gown), environment from user_prompt, lighting, lens, and wardrobe that fits the category. Match colors/materials/silhouette from product_context so the ad reads as the same product class.
negative_prompt must discourage: floating isolated product, cut-and-paste look, duplicate footwear, two watches on one wrist, deformed limbs, mangled logos, watermarks, low resolution.
Priority order: user_iteration_request > user_prompt > previous_generation_context > product_description.
Use model_choice=ideogram when visible generated text is required.
Use flux-pro for high-quality photoreal output.
Use flux-schnell for speed/preview.
Use generation_strategy=modify for local edits, reuse_background when scene should stay, new for full scene changes.`;

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

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseOrchestrationPlan(raw: string): AdOrchestrationPlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(raw)) as unknown;
  } catch {
    throw new ApiError("Failed to parse orchestration JSON", 502, "PARSE_ERROR");
  }
  if (!isRecord(parsed)) {
    throw new ApiError("Invalid orchestration response", 502, "INVALID_ORCHESTRATION");
  }

  const composition = isRecord(parsed["composition"]) ? parsed["composition"] : {};
  const textOverlay = isRecord(parsed["text_overlay"]) ? parsed["text_overlay"] : {};
  const postProcessing = isRecord(parsed["post_processing"]) ? parsed["post_processing"] : {};
  const renderSpecs = isRecord(parsed["render_specs"]) ? parsed["render_specs"] : {};
  const constraints = isRecord(parsed["constraints"]) ? parsed["constraints"] : {};
  const confidence = isRecord(parsed["confidence"]) ? parsed["confidence"] : {};
  const modelChoice = asEnum(parsed["model_choice"], ["flux-pro", "flux-schnell", "ideogram"] as const, "flux-pro");
  const generationStrategy = asEnum(parsed["generation_strategy"], ["new", "modify", "reuse_background"] as const, "new");

  const fallbackOrderRaw = Array.isArray(parsed["model_fallback_order"]) ? parsed["model_fallback_order"] : [];
  const fallbackOrder = fallbackOrderRaw.filter(
    (m): m is "flux-pro" | "flux-schnell" | "ideogram" =>
      m === "flux-pro" || m === "flux-schnell" || m === "ideogram",
  );

  const normalized: AdOrchestrationPlan = {
    schema_version: "1.0",
    ad_type: asString(parsed["ad_type"], "studio"),
    tone: asString(parsed["tone"], "clean, modern"),
    target_platform: asString(parsed["target_platform"], "unknown"),
    product_type: asString(parsed["product_type"], "unknown"),
    generation_strategy: generationStrategy as GenerationStrategy,
    model_choice: modelChoice,
    model_fallback_order: fallbackOrder.length > 0 ? fallbackOrder : modelChoice === "ideogram" ? ["flux-pro", "flux-schnell"] : modelChoice === "flux-pro" ? ["flux-schnell"] : ["flux-pro"],
    background_prompt: asString(parsed["background_prompt"], ""),
    negative_prompt: asString(parsed["negative_prompt"], ""),
    composition: {
      product_position: asEnum(
        composition["product_position"],
        ["center", "left", "right", "foreground"] as const,
        "center",
      ) as CompositionProductPosition,
      background_style: asString(composition["background_style"], "clean studio"),
      lighting: asEnum(
        composition["lighting"],
        ["soft", "dramatic", "warm", "cool", "neutral"] as const,
        "soft",
      ) as CompositionLighting,
      depth: asEnum(composition["depth"], ["shallow", "medium", "deep"] as const, "medium") as CompositionDepth,
      camera_angle: asEnum(
        composition["camera_angle"],
        ["top-down", "eye-level", "angled", "macro"] as const,
        "eye-level",
      ) as CompositionCameraAngle,
    },
    text_overlay: {
      enabled: asBoolean(textOverlay["enabled"], false),
      headline: asString(textOverlay["headline"], ""),
      subtext: asString(textOverlay["subtext"], ""),
      position: asEnum(
        textOverlay["position"],
        ["top", "bottom", "center-overlay", "left-overlay", "right-overlay"] as const,
        "top",
      ) as TextOverlayPosition,
      style: asEnum(textOverlay["style"], ["modern", "bold", "luxury", "minimal"] as const, "minimal") as TextOverlayStyle,
    },
    post_processing: {
      apply_shadow: asBoolean(postProcessing["apply_shadow"], false),
      apply_reflection: asBoolean(postProcessing["apply_reflection"], false),
      color_adjustment: asEnum(
        postProcessing["color_adjustment"],
        ["none", "warm_boost", "cool_boost", "high_contrast", "muted", "vibrant"] as const,
        "none",
      ),
      overlay_effect: asEnum(
        postProcessing["overlay_effect"],
        ["none", "light_gradient", "film_grain", "bokeh", "vignette"] as const,
        "none",
      ),
    },
    render_specs: {
      aspect_ratio: asEnum(renderSpecs["aspect_ratio"], ["1:1", "4:5", "9:16", "16:9", "3:2"] as const, "1:1"),
      width: Math.max(256, asNumber(renderSpecs["width"], 1024)),
      height: Math.max(256, asNumber(renderSpecs["height"], 1024)),
      safe_zone: asEnum(renderSpecs["safe_zone"], ["off", "on"] as const, "off"),
    },
    edit_operations: Array.isArray(parsed["edit_operations"])
      ? parsed["edit_operations"].filter((op): op is Record<string, unknown> => isRecord(op))
      : [],
    constraints: {
      preserve_product_identity: asBoolean(constraints["preserve_product_identity"], true),
      avoid_extra_objects: asBoolean(constraints["avoid_extra_objects"], true),
      text_legibility_priority: asBoolean(constraints["text_legibility_priority"], true),
    },
    confidence: {
      intent_confidence: Math.max(0, Math.min(1, asNumber(confidence["intent_confidence"], 0.8))),
      product_type_confidence: Math.max(0, Math.min(1, asNumber(confidence["product_type_confidence"], 0.7))),
    },
  };
  const checked = OrchestrationPlanSchema.safeParse(normalized);
  if (!checked.success) {
    throw new ApiError("Invalid normalized orchestration plan", 502, "INVALID_ORCHESTRATION");
  }
  return checked.data as AdOrchestrationPlan;
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
   * Builds a single full-scene lifestyle hero prompt grounded in the uploaded product image.
   */
  async buildLifestyleHeroPromptFromImage(input: {
    productImageUrl: string;
    userPrompt: string;
    productContext: ProductContext;
    orchestratedDirection?: string;
    negativePrompt?: string;
    usageDirective?: string;
  }): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1200,
      temperature: 0.4,
      system: LIFESTYLE_HERO_PROMPT_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: input.productImageUrl } },
            {
              type: "text",
              text: `User request: ${input.userPrompt}
Product context:
- type: ${input.productContext.productType}
- category: ${input.productContext.attributes.category}
- style: ${input.productContext.attributes.style}
- colors: ${input.productContext.attributes.colors.join(", ")}
${input.productContext.attributes.material ? `- material: ${input.productContext.attributes.material}` : ""}
${input.usageDirective ? `Dynamic usage directive: ${input.usageDirective}` : ""}
${input.orchestratedDirection ? `Creative direction to preserve: ${input.orchestratedDirection}` : ""}
${input.negativePrompt ? `Avoid: ${input.negativePrompt}` : ""}

Return only one final photoreal lifestyle ad prompt.`,
            },
          ],
        },
      ],
    });
    return extractTextBlock(response).trim();
  }

  /**
   * Produces N distinct creative directions (prompts) from an optimized base prompt.
   */
  async generateVariants(
    optimizedPrompt: string,
    productContext: ProductContext,
    count: number,
    creativeBrief?: Pick<
      AdOrchestrationPlan,
      | "tone"
      | "ad_type"
      | "generation_strategy"
      | "composition"
      | "text_overlay"
      | "target_platform"
      | "negative_prompt"
    > | null,
    pipeline: "lifestyle" | "composite" = "lifestyle",
  ): Promise<VariantPlan[]> {
    const variantsSystem =
      pipeline === "lifestyle" ? VARIANTS_SYSTEM_LIFESTYLE : VARIANTS_SYSTEM_COMPOSITE;

    const briefBlockLifestyle =
      creativeBrief && typeof creativeBrief === "object"
        ? `Creative director brief — every variant must be a **full hero shot** honoring this:
- Ad type: ${creativeBrief.ad_type}
- Tone: ${creativeBrief.tone}
- Platform: ${creativeBrief.target_platform}
- Strategy: ${creativeBrief.generation_strategy}
- Composition hints: ${JSON.stringify(creativeBrief.composition)}
- Text / overlay intent: ${JSON.stringify(creativeBrief.text_overlay)}
- Avoid: ${creativeBrief.negative_prompt || "(none)"}

`
        : "";

    const briefBlockComposite =
      creativeBrief && typeof creativeBrief === "object"
        ? `Creative director brief (mood and diversity; backgrounds still exclude the physical product — it is composited later):
- Ad type: ${creativeBrief.ad_type}
- Tone: ${creativeBrief.tone}
- Platform: ${creativeBrief.target_platform}
- Strategy: ${creativeBrief.generation_strategy}
- Composition hints: ${JSON.stringify(creativeBrief.composition)}
- Text overlay intent: ${JSON.stringify(creativeBrief.text_overlay)}
- Avoid in backgrounds: ${creativeBrief.negative_prompt || "(none)"}

`
        : "";

    const colorLine =
      productContext.attributes.colors.length > 0
        ? `Key colors to mirror on the product in-scene: ${productContext.attributes.colors.join(", ")}.`
        : "";

    const userContent =
      pipeline === "lifestyle"
        ? `${briefBlockLifestyle}Orchestrated scene direction:
${optimizedPrompt}

Product type: ${productContext.productType}
Category: ${productContext.attributes.category}
Style: ${productContext.attributes.style}
${colorLine}

Produce exactly ${count} distinct full-scene prompts as required by the system message.`
        : `${briefBlockComposite}Base optimized background prompt:
${optimizedPrompt}

Product type: ${productContext.productType}
Category: ${productContext.attributes.category}

Produce exactly ${count} background scene variants with different composition/lighting/mood. Do NOT include the product in any prompt — only describe the environment and setting. The product will be composited on top separately.`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      temperature: 0.85,
      system: variantsSystem,
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

  async orchestrateAdPlan(input: {
    productDescription?: string | null;
    userPrompt: string;
    productContext?: ProductContext | null;
    previousGenerationContext?: Record<string, unknown> | null;
    userIterationRequest?: string | null;
    /** `lifestyle` = full-scene in-use ads; `composite` = packshot on generated background */
    pipeline?: "lifestyle" | "composite";
  }): Promise<AdOrchestrationPlan> {
    const pipeline = input.pipeline ?? "lifestyle";
    const orchestrationSystem =
      pipeline === "lifestyle" ? ORCHESTRATION_SYSTEM_LIFESTYLE : ORCHESTRATION_SYSTEM_COMPOSITE;

    const userContent = JSON.stringify(
      {
        product_description: input.productDescription ?? null,
        user_prompt: input.userPrompt,
        previous_generation_context: input.previousGenerationContext ?? null,
        user_iteration_request: input.userIterationRequest ?? null,
        product_context: input.productContext ?? null,
        pipeline,
      },
      null,
      2,
    );

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2200,
      temperature: 0.25,
      system: orchestrationSystem,
      messages: [{ role: "user", content: userContent }],
    });

    return parseOrchestrationPlan(extractTextBlock(response));
  }
}
