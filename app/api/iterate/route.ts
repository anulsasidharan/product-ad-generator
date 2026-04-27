import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";

import { ClaudeAgent, DEFAULT_MODEL } from "@/lib/ai/claude-agent";
import { ImageGenerator } from "@/lib/ai/image-generator";
import { errorResponse } from "@/lib/api-response";
import { uploadImage } from "@/lib/blob-storage";
import { corsHeaders, jsonResponse, withCors } from "@/lib/cors";
import {
  addTextOverlay,
  adjustColorTemperature,
  compositeProductOnBackground,
  resolveProductUrlForComposite,
} from "@/lib/image-utils";
import { ITERATE_LIMIT, checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import type { ConversationTurn, GenerationState, IterationAction } from "@/lib/types";
import { isProductCompositePipeline } from "@/lib/generation-pipeline";
import { IterateInputSchema } from "@/lib/validation";

function mapActionForClient(action: IterationAction): string {
  if (action.type === "adjust_color_temperature") {
    return "adjust_color";
  }
  return action.type;
}

function getStringParam(params: Record<string, unknown>, key: string): string | undefined {
  const v = params[key];
  return typeof v === "string" ? v : undefined;
}

function fallbackOrchestrationForIterate(userMessage: string) {
  const p = userMessage.toLowerCase();
  const wantsFullRegeneration = /\b(new scene|completely different|regenerate|start over)\b/u.test(p);
  return {
    generation_strategy: wantsFullRegeneration ? ("new" as const) : ("modify" as const),
    model_choice: "flux-pro" as const,
    render_specs: { aspect_ratio: "1:1" as const },
    background_prompt: userMessage,
    edit_operations: [],
    text_overlay: { headline: "", position: "top", style: "minimal" },
  };
}

function getPrimaryEditOperation(orchestration: unknown): string | null {
  const ops = (orchestration as { edit_operations?: unknown }).edit_operations;
  if (!Array.isArray(ops) || ops.length === 0) {
    return null;
  }
  const first = ops[0];
  if (!first || typeof first !== "object") {
    return null;
  }
  const op = (first as Record<string, unknown>)["op"];
  return typeof op === "string" ? op : null;
}

function inferWarmthFromOperation(orchestration: unknown): number {
  const ops = (orchestration as { edit_operations?: unknown }).edit_operations;
  if (!Array.isArray(ops) || ops.length === 0) {
    return 10;
  }
  const first = ops[0];
  if (!first || typeof first !== "object") {
    return 10;
  }
  const raw = (first as Record<string, unknown>)["value"];
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    const n = Number.parseFloat(raw);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return 10;
}

function inferTextFromOrchestration(orchestration: unknown): string {
  const textOverlay = (orchestration as { text_overlay?: unknown }).text_overlay;
  if (!textOverlay || typeof textOverlay !== "object") {
    return "New headline";
  }
  const headline = (textOverlay as Record<string, unknown>)["headline"];
  return typeof headline === "string" && headline.trim().length > 0 ? headline : "New headline";
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const traceId = crypto.randomUUID();
    const json: unknown = await request.json();
    const parsed = IterateInputSchema.safeParse(json);
    if (!parsed.success) {
      return jsonResponse(
        { success: false, error: "Invalid request", details: parsed.error.issues },
        400,
      );
    }

    const ip = getClientIdentifier(request);
    await checkRateLimit(ip, ITERATE_LIMIT, "1 m");

    const {
      userMessage,
      conversationHistory,
      currentState,
      productDescription,
      previousGenerationContext,
      userIterationRequest,
    } = parsed.data;
    const history: ConversationTurn[] = conversationHistory.map((t) => ({
      role: t.role,
      content: t.content,
      timestamp: t.timestamp ?? new Date().toISOString(),
    }));

    const state: GenerationState = {
      imageUrl: currentState.imageUrl,
      parameters: (currentState.parameters ?? {}) as Record<string, unknown>,
    };

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const agent = new ClaudeAgent();
          const iteration = await agent.interpretIteration(userMessage, state, history);
          const productContextParam =
            (state.parameters["productContext"] as Record<string, unknown> | undefined) ?? undefined;
          const maybeProductContext =
            productContextParam &&
            typeof productContextParam["productType"] === "string" &&
            typeof productContextParam["attributes"] === "object" &&
            productContextParam["attributes"] !== null
              ? (productContextParam as {
                  productType: string;
                  attributes: { category: string; style: string; colors: string[]; material?: string };
                })
              : undefined;
          let orchestration;
          try {
            orchestration = await agent.orchestrateAdPlan({
              userPrompt: userMessage,
              userIterationRequest: userIterationRequest ?? userMessage,
              previousGenerationContext: previousGenerationContext ?? state.parameters,
              productDescription: productDescription ?? null,
              productContext: maybeProductContext ?? null,
              pipeline: isProductCompositePipeline() ? "composite" : "lifestyle",
            });
          } catch (error) {
            console.warn("orchestrateAdPlan failed in iterate route, using fallback:", error);
            orchestration = fallbackOrchestrationForIterate(userMessage);
          }
          const primaryEditOperation = getPrimaryEditOperation(orchestration);

          const apiKey = process.env.ANTHROPIC_API_KEY;
          const streamModelId = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;

          if (apiKey) {
            try {
              const anthropicProvider = createAnthropic({ apiKey });
              const thinking = streamText({
                model: anthropicProvider(streamModelId),
                maxOutputTokens: 200,
                prompt: `User said: "${userMessage}"
Planned change: ${iteration.type}
Assistant plan: ${iteration.explanation}
Write one short friendly sentence (max 35 words) acknowledging what you will do next.`,
              });
              for await (const chunk of thinking.textStream) {
                send({ type: "thinking", content: chunk });
              }
            } catch (streamErr) {
              console.warn("streamText thinking fallback:", streamErr);
              send({ type: "thinking", content: iteration.explanation });
            }
          } else {
            send({ type: "thinking", content: iteration.explanation });
          }

          send({
            type: "action",
            traceId,
            action:
              primaryEditOperation === "adjust_color_temperature" ||
              primaryEditOperation === "background_tone_shift" ||
              primaryEditOperation === "adjust_lighting"
                ? "adjust_color"
                : primaryEditOperation === "add_text_layer" || primaryEditOperation === "update_text_layer"
                  ? "add_text"
                  : primaryEditOperation === "reposition_product"
                    ? "reposition_product"
                    : mapActionForClient(iteration),
            params:
              iteration.type === "clarify"
                ? iteration.parameters
                : "parameters" in iteration
                  ? iteration.parameters
                  : {},
          });

          send({ type: "status", progress: 0.35, message: "Applying change..." });

          if (iteration.type === "clarify") {
            send({
              type: "result",
              traceId,
              imageUrl: state.imageUrl,
              explanation: iteration.explanation,
              clarify: true,
              question: iteration.parameters.question,
              options: iteration.parameters.options,
            });
            return;
          }

          let resultUrl = state.imageUrl;
          const explanation = iteration.explanation;
          const params = state.parameters;
          const productImageUrl = getStringParam(params, "productImageUrl");
          const backgroundUrl = getStringParam(params, "backgroundUrl");
          const forceColorAdjust =
            primaryEditOperation === "adjust_color_temperature" ||
            primaryEditOperation === "background_tone_shift" ||
            primaryEditOperation === "adjust_lighting";
          const forceTextAdjust =
            primaryEditOperation === "add_text_layer" || primaryEditOperation === "update_text_layer";
          const forceReposition = primaryEditOperation === "reposition_product";
          const effectiveAction =
            forceColorAdjust
              ? "adjust_color_temperature"
              : forceTextAdjust
                ? "add_text"
                : forceReposition
                  ? "reposition_product"
                  : iteration.type;

          switch (effectiveAction) {
            case "adjust_color_temperature": {
              const warmth =
                iteration.type === "adjust_color_temperature"
                  ? iteration.parameters.warmth
                  : inferWarmthFromOperation(orchestration);
              const buf = await adjustColorTemperature(resultUrl, warmth);
              resultUrl = await uploadImage(buf, "iterate-warmth.png", "generated");
              break;
            }
            case "add_text": {
              const text =
                iteration.type === "add_text" ? iteration.parameters.text : inferTextFromOrchestration(orchestration);
              const buf = await addTextOverlay(resultUrl, text, {
                position: iteration.type === "add_text" ? iteration.parameters.position : { x: 0.5, y: 0.15 },
                font: iteration.type === "add_text" ? iteration.parameters.font : "Inter",
                color: iteration.type === "add_text" ? iteration.parameters.color : "#FFFFFF",
              });
              resultUrl = await uploadImage(buf, "iterate-text.png", "generated");
              break;
            }
            case "reposition_product": {
              if (!isProductCompositePipeline()) {
                send({
                  type: "result",
                  traceId,
                  imageUrl: resultUrl,
                  explanation:
                    "This image was generated as a full lifestyle scene (no separate packshot layer). Ask for a new scene or a small framing change and I will regenerate instead.",
                });
                return;
              }
              if (productImageUrl && backgroundUrl) {
                const gen = new ImageGenerator();
                const cutout = await resolveProductUrlForComposite(productImageUrl, (u) => gen.removeBackground(u));
                const buf = await compositeProductOnBackground(cutout, backgroundUrl, {
                  position: {
                    x:
                      iteration.type === "reposition_product"
                        ? Math.max(0, Math.min(1, iteration.parameters.position.x))
                        : 0.5,
                    y:
                      iteration.type === "reposition_product"
                        ? Math.max(0, Math.min(1, iteration.parameters.position.y))
                        : 0.5,
                  },
                });
                resultUrl = await uploadImage(buf, "iterate-reposition.png", "generated");
              } else {
                send({
                  type: "result",
                  traceId,
                  imageUrl: resultUrl,
                  explanation:
                    "Provide productImageUrl and backgroundUrl in currentState.parameters for server-side repositioning.",
                });
                return;
              }
              break;
            }
            case "regenerate": {
              const gen = new ImageGenerator();
              const regenModel = orchestration.model_choice === "flux-schnell" ? "flux-schnell" : "flux-pro";
              const modifiedPrompt =
                iteration.type === "regenerate" &&
                "modifiedPrompt" in iteration.parameters &&
                typeof iteration.parameters.modifiedPrompt === "string"
                  ? iteration.parameters.modifiedPrompt
                  : undefined;
              const regenPrompt = orchestration.background_prompt || modifiedPrompt || userMessage;
              const urls = await gen.generate(regenPrompt, regenModel, {
                aspectRatio: orchestration.render_specs.aspect_ratio,
              });
              const bg = urls[0];
              if (!bg) {
                throw new Error("Regeneration produced no image");
              }
              if (isProductCompositePipeline() && productImageUrl) {
                const cutout = await resolveProductUrlForComposite(productImageUrl, (u) => gen.removeBackground(u));
                const buf = await compositeProductOnBackground(cutout, bg);
                resultUrl = await uploadImage(buf, "iterate-regenerate.png", "generated");
              } else if (isProductCompositePipeline()) {
                resultUrl = bg;
              } else {
                const imgRes = await fetch(bg);
                if (!imgRes.ok) {
                  throw new Error(`Regeneration fetch failed (${imgRes.status})`);
                }
                const buf = Buffer.from(await imgRes.arrayBuffer());
                resultUrl = await uploadImage(buf, "iterate-regenerate.png", "generated");
              }
              break;
            }
            default:
              break;
          }

          send({ type: "status", progress: 1, message: "Done" });
          send({ type: "result", traceId, imageUrl: resultUrl, explanation });
        } catch (err) {
          send({
            type: "error",
            traceId,
            message: err instanceof Error ? err.message : "Unknown error",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders(),
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return withCors(errorResponse(error));
  }
}
