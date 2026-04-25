import { randomUUID } from "crypto";

import { ClaudeAgent } from "@/lib/ai/claude-agent";
import { ImageGenerator } from "@/lib/ai/image-generator";
import { ApiError, errorResponse } from "@/lib/api-response";
import { uploadImage } from "@/lib/blob-storage";
import { corsHeaders, jsonResponse, withCors } from "@/lib/cors";
import { compositeProductOnBackground } from "@/lib/image-utils";
import { assertRemoteImageWithinMaxBytes } from "@/lib/remote-image";
import { checkRateLimit, GENERATE_LIMIT, getClientIdentifier } from "@/lib/rate-limit";
import type { Generation, ProductContext } from "@/lib/types";
import { GenerateInputSchema } from "@/lib/validation";

const FLUX_COST = 0.003;

function buildGenerationSuggestions(productContext: ProductContext) {
  return {
    improvements: [
      `Emphasize the ${productContext.attributes.style} aesthetic`,
      "Try a tighter hero crop and softer rim light",
      "Swap background mood while keeping product colors accurate",
    ],
    relatedStyles: ["minimal studio", "editorial lifestyle", "bold gradient backdrop"],
  };
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request): Promise<Response> {
  const wallStart = Date.now();

  try {
    const json: unknown = await request.json();
    const parsed = GenerateInputSchema.safeParse(json);
    if (!parsed.success) {
      return jsonResponse(
        { success: false, error: "Invalid request", details: parsed.error.issues },
        400,
      );
    }

    const ip = getClientIdentifier(request);
    await checkRateLimit(ip, GENERATE_LIMIT, "1 m");

    const {
      productImageUrl,
      userPrompt,
      productContext,
      variants: variantCount,
      aspectRatio,
      model,
    } = parsed.data;

    await assertRemoteImageWithinMaxBytes(productImageUrl);

    const agent = new ClaudeAgent();
    const generator = new ImageGenerator();

    const { optimizedPrompt, suggestedModel } = await agent.optimizePrompt(userPrompt, productContext);
    const modelKey = model ?? suggestedModel;
    const effectiveModel = modelKey === "flux-pro" ? "flux-pro" : "flux-schnell";

    const plans = await agent.generateVariants(optimizedPrompt, productContext, variantCount);

    const settled = await Promise.allSettled(
      plans.map(async (plan, index) => {
        const t0 = Date.now();
        const urls = await generator.generate(plan.prompt, effectiveModel, {
          aspectRatio: aspectRatio ?? "1:1",
          numOutputs: 1,
          seed: index + 1,
        });
        const backgroundUrl = urls[0];
        if (!backgroundUrl) {
          throw new Error("No image URL returned");
        }
        const composite = await compositeProductOnBackground(productImageUrl, backgroundUrl);
        const publicUrl = await uploadImage(composite, `variant-${index + 1}.png`, "generated");
        const generation: Generation = {
          id: randomUUID(),
          imageUrl: publicUrl,
          optimizedPrompt: plan.prompt,
          model: effectiveModel,
          reasoning: plan.reasoning,
          parameters: plan.parameters,
          metadata: {
            generationTime: Date.now() - t0,
            cost: FLUX_COST,
          },
        };
        return generation;
      }),
    );

    const generations: Generation[] = [];
    for (const result of settled) {
      if (result.status === "fulfilled") {
        generations.push(result.value);
      } else {
        console.error("Variant generation failed:", result.reason);
      }
    }

    if (generations.length === 0) {
      throw new ApiError("All variant generations failed", 500, "GENERATION_FAILED");
    }

    const totalGenerationTime = Date.now() - wallStart;

    return jsonResponse({
      success: true,
      data: {
        generations,
        suggestions: buildGenerationSuggestions(productContext),
        metadata: {
          totalGenerationTime,
          modelUsed: effectiveModel,
        },
      },
    });
  } catch (error) {
    return withCors(errorResponse(error));
  }
}
