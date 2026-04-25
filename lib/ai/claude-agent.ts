import Anthropic from "@anthropic-ai/sdk";

import { ApiError } from "@/lib/api-response";
import type { ProductAnalysis } from "@/lib/types";

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

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

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

export class ClaudeAgent {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    this.client = new Anthropic({ apiKey: key });
    this.model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
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

        const block = response.content[0];
        if (!block || block.type !== "text") {
          throw new ApiError("Unexpected response from Claude", 502, "AI_SERVICE_ERROR");
        }

        return parseProductAnalysis(block.text);
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
}
