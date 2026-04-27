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

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request): Promise<Response> {
  try {
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

    const { userMessage, conversationHistory, currentState } = parsed.data;
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
            action: mapActionForClient(iteration),
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

          switch (iteration.type) {
            case "adjust_color_temperature": {
              const buf = await adjustColorTemperature(resultUrl, iteration.parameters.warmth);
              resultUrl = await uploadImage(buf, "iterate-warmth.png", "generated");
              break;
            }
            case "add_text": {
              const buf = await addTextOverlay(resultUrl, iteration.parameters.text, {
                position: iteration.parameters.position,
                font: iteration.parameters.font,
                color: iteration.parameters.color,
              });
              resultUrl = await uploadImage(buf, "iterate-text.png", "generated");
              break;
            }
            case "reposition_product": {
              if (productImageUrl && backgroundUrl) {
                const gen = new ImageGenerator();
                const cutout = await resolveProductUrlForComposite(productImageUrl, (u) => gen.removeBackground(u));
                const buf = await compositeProductOnBackground(cutout, backgroundUrl, {
                  position: {
                    x: Math.max(0, Math.min(1, iteration.parameters.position.x)),
                    y: Math.max(0, Math.min(1, iteration.parameters.position.y)),
                  },
                });
                resultUrl = await uploadImage(buf, "iterate-reposition.png", "generated");
              } else {
                send({
                  type: "result",
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
              const urls = await gen.generate(iteration.parameters.modifiedPrompt, "flux-schnell", {
                aspectRatio: "1:1",
              });
              const bg = urls[0];
              if (!bg) {
                throw new Error("Regeneration produced no image");
              }
              if (productImageUrl) {
                const cutout = await resolveProductUrlForComposite(productImageUrl, (u) => gen.removeBackground(u));
                const buf = await compositeProductOnBackground(cutout, bg);
                resultUrl = await uploadImage(buf, "iterate-regenerate.png", "generated");
              } else {
                resultUrl = bg;
              }
              break;
            }
            default:
              break;
          }

          send({ type: "status", progress: 1, message: "Done" });
          send({ type: "result", imageUrl: resultUrl, explanation });
        } catch (err) {
          send({
            type: "error",
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
