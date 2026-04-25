import { createHash } from "crypto";

import { ClaudeAgent } from "@/lib/ai/claude-agent";
import { ImageGenerator } from "@/lib/ai/image-generator";
import { errorResponse } from "@/lib/api-response";
import { corsHeaders, jsonResponse, withCors } from "@/lib/cors";
import { assertRemoteImageWithinMaxBytes } from "@/lib/remote-image";
import { ANALYZE_LIMIT, checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { AnalyzeInputSchema } from "@/lib/validation";

function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request): Promise<Response> {
  const started = Date.now();
  let imageHash = "";

  try {
    const json: unknown = await request.json();
    const parsed = AnalyzeInputSchema.safeParse(json);
    if (!parsed.success) {
      return jsonResponse(
        { success: false, error: "Invalid request", details: parsed.error.issues },
        400,
      );
    }

    const { imageUrl, removeBackground } = parsed.data;
    imageHash = hashUrl(imageUrl);

    const ip = getClientIdentifier(request);
    await checkRateLimit(ip, ANALYZE_LIMIT, "1 m");

    await assertRemoteImageWithinMaxBytes(imageUrl);

    const agent = new ClaudeAgent();
    const analysis = await agent.analyzeProduct(imageUrl);

    let isolatedImageUrl: string | undefined;
    if (removeBackground) {
      const generator = new ImageGenerator();
      isolatedImageUrl = await generator.removeBackground(imageUrl);
    }

    console.info(
      JSON.stringify({
        event: "analyze_complete",
        timestamp: new Date().toISOString(),
        imageUrlHash: imageHash,
        removeBackground: Boolean(removeBackground),
        durationMs: Date.now() - started,
        productType: analysis.productType,
      }),
    );

    return jsonResponse({
      success: true,
      data: {
        productType: analysis.productType,
        attributes: analysis.attributes,
        suggestions: analysis.suggestions,
        ...(isolatedImageUrl ? { isolatedImageUrl } : {}),
      },
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "analyze_error",
        timestamp: new Date().toISOString(),
        imageUrlHash: imageHash,
        durationMs: Date.now() - started,
        error: String(error),
      }),
    );
    return withCors(errorResponse(error));
  }
}
