import { randomUUID } from "crypto";

import { ClaudeAgent } from "@/lib/ai/claude-agent";
import { ImageGenerator } from "@/lib/ai/image-generator";
import { ApiError, errorResponse } from "@/lib/api-response";
import { uploadImage } from "@/lib/blob-storage";
import { corsHeaders, jsonResponse, withCors } from "@/lib/cors";
import { getProductAdPipeline, type ProductAdPipelineMode } from "@/lib/generation-pipeline";
import { compositeProductOnBackground, resolveProductUrlForComposite } from "@/lib/image-utils";
import { buildDynamicUsageDirective } from "@/lib/product-usage-intent";
import { assertRemoteImageWithinMaxBytes } from "@/lib/remote-image";
import { checkRateLimit, GENERATE_LIMIT, getClientIdentifier } from "@/lib/rate-limit";
import type { Generation, ProductContext } from "@/lib/types";
import { GenerateInputSchema } from "@/lib/validation";

const FLUX_COST = 0.003;
/** Space between variant runs so Replicate low-credit tiers (~6 creates/min, burst 1) do not 429. Override with REPLICATE_VARIANT_SPACING_MS. */
const BETWEEN_VARIANTS_DELAY_MS = (() => {
  const n = Number.parseInt(process.env.REPLICATE_VARIANT_SPACING_MS ?? "11000", 10);
  return Number.isFinite(n) && n >= 0 ? n : 11_000;
})();

function buildGenerationSuggestions(productContext: ProductContext) {
  return {
    improvements: [
      `Lean into ${productContext.attributes.style} with models or athletes actually using the product`,
      "Try a different location or time of day while keeping the same product category cues",
      "Tighter crop on the face and footwear or garment detail for more drama",
    ],
    relatedStyles: ["street motion", "editorial fashion", "golden-hour outdoor", "night city"],
  };
}

function fallbackOrchestrationForGenerate(
  userPrompt: string,
  aspectRatio: "1:1" | "16:9" | "9:16" | "4:5" | undefined,
  productContext: ProductContext,
  pipeline: ProductAdPipelineMode,
) {
  const p = userPrompt.toLowerCase();
  const wantsText = /\b(headline|slogan|text|typography|caption)\b/u.test(p);
  const modelChoice = wantsText ? "ideogram" : "flux-pro";
  const pt = productContext.productType;
  const colors = productContext.attributes.colors.join(", ");
  const mat = productContext.attributes.material
    ? `, ${productContext.attributes.material} material`
    : "";
  const lifestyleHero =
    `Award-style advertising photograph: ${userPrompt.trim()}. ` +
    `Show believable people naturally **wearing or using** the ${pt} (${colors}${mat}; overall style: ${productContext.attributes.style}). ` +
    `Photoreal editorial lighting, correct human anatomy, campaign-quality single image — not a packshot pasted on a backdrop.`;

  return {
    schema_version: "1.0" as const,
    ad_type: "studio",
    tone: "clean, modern",
    target_platform: "unknown",
    product_type: productContext.productType,
    generation_strategy: "new" as const,
    model_choice: modelChoice,
    model_fallback_order:
      modelChoice === "ideogram" ? ["flux-pro", "flux-schnell"] : ["flux-schnell"],
    background_prompt: pipeline === "lifestyle" ? lifestyleHero : userPrompt.trim(),
    negative_prompt:
      pipeline === "lifestyle"
        ? "floating isolated product, cutout composite look, duplicate footwear, extra limbs, deformed hands or feet, mangled logo, watermark, blurry, low resolution"
        : "blurry image, duplicate product, warped logo, low detail",
    composition: {
      product_position: "center" as const,
      background_style: "clean studio",
      lighting: "soft" as const,
      depth: "medium" as const,
      camera_angle: "eye-level" as const,
    },
    text_overlay: {
      enabled: wantsText,
      headline: "",
      subtext: "",
      position: "top" as const,
      style: "minimal" as const,
    },
    post_processing: {
      apply_shadow: true,
      apply_reflection: false,
      color_adjustment: "none" as const,
      overlay_effect: "none" as const,
    },
    render_specs: {
      aspect_ratio: aspectRatio ?? "1:1",
      width: 1024,
      height: 1024,
      safe_zone: wantsText ? ("on" as const) : ("off" as const),
    },
    edit_operations: [],
    constraints: {
      preserve_product_identity: true,
      avoid_extra_objects: true,
      text_legibility_priority: true,
    },
    confidence: {
      intent_confidence: 0.6,
      product_type_confidence: 0.3,
    },
  };
}

function normalizeAspectRatioForUi(value: string): "1:1" | "16:9" | "9:16" | "4:5" | undefined {
  return value === "1:1" || value === "16:9" || value === "9:16" || value === "4:5"
    ? value
    : undefined;
}

function subjectHintText(subjectHint?: string, customSubjectHint?: string): string {
  switch (subjectHint) {
    case "athlete":
      return "Prefer an athlete subject in believable movement/action.";
    case "fashion-model":
      return "Prefer a fashion model subject with editorial styling.";
    case "hands-only":
      return "Prefer hands-only or partial-body framing focused on product usage.";
    case "custom":
      return customSubjectHint?.trim() ? `Subject preference: ${customSubjectHint.trim()}` : "";
    default:
      return "";
  }
}

function isIdeogramRuntimeEnabled(): boolean {
  const enabled = (process.env.IDEOGRAM_ENABLED ?? "").toLowerCase();
  return enabled === "1" || enabled === "true" || enabled === "yes";
}

function resolveRuntimeModel(
  requestedModelChoice: string,
  fallbackOrder: string[],
): {
  runtimeModel: "flux-pro" | "flux-schnell" | "ideogram";
  fallbackApplied: boolean;
  fallbackReason?: string;
} {
  const ideogramEnabled = isIdeogramRuntimeEnabled();
  if (requestedModelChoice === "ideogram") {
    if (ideogramEnabled) {
      return { runtimeModel: "ideogram", fallbackApplied: false };
    }
    const fallbackTo = fallbackOrder.find((m) => m === "flux-pro" || m === "flux-schnell");
    return {
      runtimeModel: fallbackTo === "flux-schnell" ? "flux-schnell" : "flux-pro",
      fallbackApplied: true,
      fallbackReason: "ideogram_capability_disabled_using_flux_fallback",
    };
  }
  return {
    runtimeModel: requestedModelChoice === "flux-schnell" ? "flux-schnell" : "flux-pro",
    fallbackApplied: false,
  };
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request): Promise<Response> {
  const wallStart = Date.now();
  const traceId = randomUUID();

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
      creativeMode,
      subjectHint,
      customSubjectHint,
      productDescription,
      previousGenerationContext,
      userIterationRequest,
    } = parsed.data;

    await assertRemoteImageWithinMaxBytes(productImageUrl);

    const envPipelineMode = getProductAdPipeline();
    const pipelineMode =
      creativeMode === "studio-product-only"
        ? ("composite" as const)
        : creativeMode === "in-use-lifestyle"
          ? ("lifestyle" as const)
          : envPipelineMode;
    const useComposite = pipelineMode === "composite";

    const agent = new ClaudeAgent();
    const generator = new ImageGenerator();

    let productForComposite: string | null = null;
    if (useComposite) {
      try {
        productForComposite = await resolveProductUrlForComposite(productImageUrl, (url) =>
          generator.removeBackground(url),
        );
      } catch (err) {
        console.error("Background removal failed:", String(err));
        throw new ApiError(
          "Background removal is temporarily unavailable. Please try again in a few seconds.",
          503,
          "BACKGROUND_REMOVAL_FAILED",
        );
      }
    }

    let orchestratedPlan;
    let orchestrationFallbackApplied = false;
    try {
      orchestratedPlan = await agent.orchestrateAdPlan({
        productDescription: productDescription ?? null,
        userPrompt,
        productContext,
        userIterationRequest: userIterationRequest ?? null,
        previousGenerationContext: previousGenerationContext ?? null,
        pipeline: pipelineMode,
      });
    } catch (error) {
      console.warn("orchestrateAdPlan failed, using deterministic fallback:", error);
      orchestratedPlan = fallbackOrchestrationForGenerate(userPrompt, aspectRatio, productContext, pipelineMode);
      orchestrationFallbackApplied = true;
    }

    const requestedModelChoice = model ?? orchestratedPlan.model_choice;
    const runtimeModelResolution = resolveRuntimeModel(
      requestedModelChoice,
      Array.isArray(orchestratedPlan.model_fallback_order)
        ? orchestratedPlan.model_fallback_order
        : [],
    );
    const effectiveModel = runtimeModelResolution.runtimeModel;
    let optimizedPrompt = orchestratedPlan.background_prompt;
    if (!useComposite) {
      try {
        const usageDirective = buildDynamicUsageDirective(productContext);
        const subjectDirective = subjectHintText(subjectHint, customSubjectHint);
        optimizedPrompt = await agent.buildLifestyleHeroPromptFromImage({
          productImageUrl,
          userPrompt,
          productContext,
          usageDirective: `${usageDirective}${subjectDirective ? ` ${subjectDirective}` : ""}`,
          orchestratedDirection: orchestratedPlan.background_prompt,
          negativePrompt: orchestratedPlan.negative_prompt,
        });
      } catch (err) {
        console.warn("buildLifestyleHeroPromptFromImage failed, using orchestration prompt:", err);
      }
    }
    const resolvedAspectRatio = aspectRatio ?? orchestratedPlan.render_specs.aspect_ratio;

    const plans = await agent.generateVariants(
      optimizedPrompt,
      productContext,
      variantCount,
      {
        tone: orchestratedPlan.tone,
        ad_type: orchestratedPlan.ad_type,
        generation_strategy: orchestratedPlan.generation_strategy,
        composition: orchestratedPlan.composition,
        text_overlay: orchestratedPlan.text_overlay,
        target_platform: orchestratedPlan.target_platform,
        negative_prompt: orchestratedPlan.negative_prompt,
      },
      pipelineMode,
    );

    const generations: Generation[] = [];
    let firstFailure: unknown = null;
    for (let index = 0; index < plans.length; index++) {
      const variantPlan = plans[index];
      if (!variantPlan) {
        continue;
      }
      try {
        const t0 = Date.now();
        const urls = await generator.generate(variantPlan.prompt, effectiveModel, {
          aspectRatio: resolvedAspectRatio,
          numOutputs: 1,
          seed: index + 1,
        });
        const generatedUrl = urls[0];
        if (!generatedUrl) {
          throw new Error("No image URL returned");
        }
        let outBuffer: Buffer;
        if (useComposite && productForComposite) {
          outBuffer = await compositeProductOnBackground(productForComposite, generatedUrl);
        } else {
          const imgRes = await fetch(generatedUrl);
          if (!imgRes.ok) {
            throw new ApiError(
              `Failed to fetch generated image (${imgRes.status})`,
              502,
              "IMAGE_FETCH_FAILED",
            );
          }
          outBuffer = Buffer.from(await imgRes.arrayBuffer());
        }
        const publicUrl = await uploadImage(outBuffer, `variant-${index + 1}.png`, "generated");
        const generation: Generation = {
          id: randomUUID(),
          imageUrl: publicUrl,
          optimizedPrompt: variantPlan.prompt,
          model: effectiveModel,
          reasoning: `${variantPlan.reasoning}${orchestratedPlan.negative_prompt ? ` | avoid: ${orchestratedPlan.negative_prompt}` : ""}`,
          parameters: variantPlan.parameters,
          metadata: {
            generationTime: Date.now() - t0,
            cost: FLUX_COST,
          },
        };
        generations.push(generation);
      } catch (error) {
        if (firstFailure === null) {
          firstFailure = error;
        }
        console.error("Variant generation failed:", error);
      }

      if (index < plans.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, BETWEEN_VARIANTS_DELAY_MS));
      }
    }

    if (generations.length === 0) {
      if (firstFailure instanceof ApiError) {
        throw firstFailure;
      }
      throw new ApiError("All variant generations failed", 500, "GENERATION_FAILED");
    }

    const totalGenerationTime = Date.now() - wallStart;

    return jsonResponse({
      success: true,
      data: {
        generations,
        suggestions: buildGenerationSuggestions(productContext),
        metadata: {
          traceId,
          totalGenerationTime,
          modelUsed: effectiveModel,
          pipeline: pipelineMode,
          orchestration: {
            adType: orchestratedPlan.ad_type,
            generationStrategy: orchestratedPlan.generation_strategy,
            targetPlatform: orchestratedPlan.target_platform,
            tone: orchestratedPlan.tone,
            modelChoice: orchestratedPlan.model_choice,
            resolvedModel: effectiveModel,
            aspectRatio: normalizeAspectRatioForUi(resolvedAspectRatio),
            topEditOperation:
              orchestratedPlan.edit_operations[0] &&
              typeof orchestratedPlan.edit_operations[0]["op"] === "string"
                ? (orchestratedPlan.edit_operations[0]["op"] as string)
                : undefined,
            intentConfidence: orchestratedPlan.confidence.intent_confidence,
            productTypeConfidence: orchestratedPlan.confidence.product_type_confidence,
            fallbackApplied:
              orchestrationFallbackApplied || runtimeModelResolution.fallbackApplied,
            fallbackReason: runtimeModelResolution.fallbackReason
              ? runtimeModelResolution.fallbackReason
              : orchestrationFallbackApplied
                ? "orchestrator_plan_fallback_used"
                : undefined,
          },
        },
      },
    });
  } catch (error) {
    return withCors(errorResponse(error));
  }
}
