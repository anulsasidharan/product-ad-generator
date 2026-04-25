import Replicate from "replicate";

import { ApiError } from "@/lib/api-response";
import type { ImageModelKey } from "@/lib/types";

const FLUX_SCHNELL = "black-forest-labs/flux-schnell";
const FLUX_PRO = "black-forest-labs/flux-pro";
/** Default Replicate model for background removal; override with REPLICATE_BG_MODEL if needed. */
const DEFAULT_BG_MODEL = "cjwbw/rembg";

const GENERATION_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function normalizeImageUrls(output: unknown): string[] {
  if (typeof output === "string") {
    return [output];
  }
  if (Array.isArray(output)) {
    return output.flatMap((item) => {
      if (typeof item === "string") {
        return [item];
      }
      if (typeof item === "object" && item !== null && "url" in item) {
        const url = (item as { url?: unknown }).url;
        return typeof url === "string" ? [url] : [];
      }
      return [];
    });
  }
  if (typeof output === "object" && output !== null && "output" in output) {
    return normalizeImageUrls((output as { output?: unknown }).output);
  }
  return [];
}

export class ImageGenerator {
  private readonly replicate: Replicate;
  private readonly bgModel: string;

  constructor(token?: string) {
    const auth = token ?? process.env.REPLICATE_API_TOKEN;
    if (!auth) {
      throw new Error("REPLICATE_API_TOKEN is not set");
    }
    this.replicate = new Replicate({ auth });
    this.bgModel = process.env.REPLICATE_BG_MODEL ?? DEFAULT_BG_MODEL;
  }

  /**
   * Runs FLUX Schnell (or mapped model key) and returns public image URLs.
   */
  async generate(
    prompt: string,
    model: ImageModelKey,
    options?: {
      aspectRatio?: string;
      numOutputs?: number;
      seed?: number;
    },
  ): Promise<string[]> {
    const replicateModel = model === "flux-pro" ? FLUX_PRO : FLUX_SCHNELL;
    const aspectRatio = options?.aspectRatio ?? "1:1";
    const numOutputs = options?.numOutputs ?? 1;

    const runOnce = async () => {
      const output = await withTimeout(
        this.replicate.run(replicateModel as `${string}/${string}`, {
          input: {
            prompt,
            aspect_ratio: aspectRatio,
            num_outputs: numOutputs,
            output_format: "png",
            output_quality: 90,
            ...(options?.seed !== undefined ? { seed: options.seed } : {}),
          },
        }),
        GENERATION_TIMEOUT_MS,
        "Image generation",
      );
      const urls = normalizeImageUrls(output);
      if (urls.length === 0) {
        throw new Error("Replicate returned no image URLs");
      }
      return urls;
    };

    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await runOnce();
      } catch (error) {
        lastError = error;
        if (attempt === MAX_ATTEMPTS) {
          break;
        }
        await sleep(500 * 2 ** (attempt - 1) + Math.random() * 200);
      }
    }

    console.error("ImageGenerator.generate failed:", lastError);
    throw new ApiError("Image generation failed", 500, "GENERATION_FAILED");
  }

  /**
   * Removes background from an image URL via Replicate.
   */
  async removeBackground(imageUrl: string): Promise<string> {
    const runOnce = async () => {
      const output = await withTimeout(
        this.replicate.run(this.bgModel as `${string}/${string}`, {
          input: { image: imageUrl },
        }),
        GENERATION_TIMEOUT_MS,
        "Background removal",
      );

      const urls = normalizeImageUrls(output);
      if (urls[0]) {
        return urls[0];
      }
      if (typeof output === "string") {
        return output;
      }
      throw new Error("Replicate returned no isolated image URL");
    };

    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await runOnce();
      } catch (error) {
        lastError = error;
        if (attempt === MAX_ATTEMPTS) {
          break;
        }
        await sleep(500 * 2 ** (attempt - 1) + Math.random() * 200);
      }
    }

    console.error("ImageGenerator.removeBackground failed:", lastError);
    throw new ApiError("Background removal failed", 500, "BACKGROUND_REMOVAL_FAILED");
  }
}
