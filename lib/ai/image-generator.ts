import sharp from "sharp";
import Replicate from "replicate";

import { ApiError } from "@/lib/api-response";
import type { ImageModelKey } from "@/lib/types";

const FLUX_SCHNELL = "black-forest-labs/flux-schnell";
const FLUX_PRO = "black-forest-labs/flux-pro";

/** Replicate `Prefer: wait` can block longer than a quick poll; keep under typical serverless ceilings. */
const GENERATION_TIMEOUT_MS = 120_000;
const MAX_ATTEMPTS = 8;

/** Minimum spacing between *prediction creates* when Replicate applies strict low-credit limits (~6/min, burst 1). */
const REPLICATE_LOW_CREDIT_MIN_GAP_MS = (() => {
  const n = Number.parseInt(process.env.REPLICATE_LOW_CREDIT_MIN_GAP_MS ?? "10500", 10);
  return Number.isFinite(n) && n > 0 ? n : 10_500;
})();

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

function urlFromUnknownLeaf(value: unknown): string[] {
  if (typeof value === "string" && (value.startsWith("https://") || value.startsWith("http://"))) {
    return [value];
  }
  if (value instanceof URL) {
    return [value.href];
  }
  if (typeof value === "object" && value !== null) {
    const withUrlFn = value as { url?: unknown };
    if (typeof withUrlFn.url === "function") {
      try {
        const u = (withUrlFn.url as () => URL | string)();
        if (typeof u === "string" && (u.startsWith("https://") || u.startsWith("http://"))) {
          return [u];
        }
        if (u instanceof URL) {
          return [u.href];
        }
      } catch {
        // ignore
      }
    }
    const withStringUrl = value as { url?: unknown };
    if (typeof withStringUrl.url === "string" && (withStringUrl.url.startsWith("https://") || withStringUrl.url.startsWith("http://"))) {
      return [withStringUrl.url];
    }
    const s = String(value);
    if (s.startsWith("https://") || s.startsWith("http://")) {
      return [s];
    }
  }
  return [];
}

/**
 * Replicate `run()` may return plain URL strings, arrays, or (when `useFileOutput` is true)
 * `FileOutput` streams whose string form is the underlying HTTPS URL.
 */
function normalizeImageUrls(output: unknown): string[] {
  if (typeof output === "string") {
    return [output];
  }
  if (Array.isArray(output)) {
    return output.flatMap((item) => (typeof item === "string" ? [item] : urlFromUnknownLeaf(item)));
  }
  if (typeof output === "object" && output !== null && "output" in output) {
    return normalizeImageUrls((output as { output?: unknown }).output);
  }
  return urlFromUnknownLeaf(output);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isReplicateLowCreditThrottle(error: unknown): boolean {
  return /burst of 1|6 requests per minute|less than \$5/i.test(errorMessage(error));
}

function parseRetryAfterSecondsFromBody(error: unknown): number | null {
  const m = errorMessage(error).match(/"retry_after"\s*:\s*(\d+)/i);
  if (!m) {
    return null;
  }
  const n = Number.parseInt(m[1] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Milliseconds to wait before retrying a Replicate prediction create after HTTP 429.
 * Low-credit tiers need ~10s between creates even when `Retry-After` is only a few seconds.
 */
function get429CreateBackoffMs(error: unknown): number {
  const headers = (error as { response?: { headers?: { get?: (name: string) => string | null } } }).response
    ?.headers;
  const get = headers?.get?.bind(headers) as ((name: string) => string | null) | undefined;

  let seconds =
    parseRetryAfterSecondsFromBody(error) ??
    (get?.("retry-after") ? Number.parseInt(get("retry-after")!, 10) : NaN);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    const reset = get?.("ratelimit-reset");
    if (reset) {
      const n = Number.parseInt(reset, 10);
      if (Number.isFinite(n) && n > 0) {
        seconds = n;
      }
    }
  }
  if (!Number.isFinite(seconds) || seconds <= 0) {
    seconds = isReplicateLowCreditThrottle(error) ? 11 : 5;
  }

  const fromApiMs = seconds * 1000;
  const floorMs = isReplicateLowCreditThrottle(error) ? REPLICATE_LOW_CREDIT_MIN_GAP_MS : 2_500;
  return Math.max(fromApiMs, floorMs);
}

function getHttpStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  const maybeError = error as { response?: { status?: number } };
  return typeof maybeError.response?.status === "number" ? maybeError.response.status : null;
}

function isRetryableStatus(status: number | null): boolean {
  return status !== null && [408, 409, 429, 500, 502, 503, 504].includes(status);
}

/**
 * Flood-fill background removal using Sharp.
 * Samples the four corner pixels to determine the background colour, then
 * BFS-fills from all border pixels making matching pixels transparent.
 * Works well for white, black, grey, or any solid-colour studio backgrounds.
 */
async function removeBackgroundSharp(imageBuffer: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const pixels = new Uint8Array(data);

  const px = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return { r: pixels[i] ?? 0, g: pixels[i + 1] ?? 0, b: pixels[i + 2] ?? 0, i };
  };

  const corners = [px(0, 0), px(width - 1, 0), px(0, height - 1), px(width - 1, height - 1)];
  const bgR = Math.round(corners.reduce((s, c) => s + c.r, 0) / 4);
  const bgG = Math.round(corners.reduce((s, c) => s + c.g, 0) / 4);
  const bgB = Math.round(corners.reduce((s, c) => s + c.b, 0) / 4);
  const TOLERANCE = 40;

  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  for (let x = 0; x < width; x++) {
    queue.push(x, (height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    queue.push(y * width, y * width + width - 1);
  }

  while (queue.length > 0) {
    const idx = queue.pop()!;
    if (visited[idx]) continue;

    const i = idx * 4;
    const dist =
      Math.abs((pixels[i] ?? 0) - bgR) +
      Math.abs((pixels[i + 1] ?? 0) - bgG) +
      Math.abs((pixels[i + 2] ?? 0) - bgB);
    if (dist > TOLERANCE * 3) continue;

    visited[idx] = 1;
    pixels[i + 3] = 0;

    const x = idx % width;
    const y = Math.floor(idx / width);
    if (x > 0) queue.push(idx - 1);
    if (x < width - 1) queue.push(idx + 1);
    if (y > 0) queue.push(idx - width);
    if (y < height - 1) queue.push(idx + width);
  }

  return sharp(Buffer.from(pixels.buffer), { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}

export class ImageGenerator {
  private readonly replicate: Replicate;

  constructor(token?: string) {
    const auth = token ?? process.env.REPLICATE_API_TOKEN;
    if (!auth) {
      throw new Error("REPLICATE_API_TOKEN is not set");
    }
    // Replicate JS ≥1.4 defaults `useFileOutput: true`, which wraps image URLs in
    // ReadableStream `FileOutput` objects instead of strings. We need HTTPS strings for fetch/composite.
    this.replicate = new Replicate({ auth, useFileOutput: false });
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
        const status = getHttpStatus(error);
        if (status !== null && !isRetryableStatus(status)) {
          break;
        }
        if (status === 429) {
          const backoffMs = get429CreateBackoffMs(error);
          await sleep(backoffMs + Math.random() * 400);
          continue;
        }
        await sleep(700 * 2 ** (attempt - 1) + Math.random() * 300);
      }
    }

    console.error("ImageGenerator.generate failed:", lastError);
    const status = getHttpStatus(lastError);
    if (status === 429) {
      throw new ApiError(
        "Replicate rate limit. With under $5 credit, new predictions are limited to about six per minute (burst 1)—wait ~10 seconds between runs or add credit for higher limits.",
        503,
        "PROVIDER_RATE_LIMITED",
      );
    }
    if (status === 402) {
      throw new ApiError("Image provider credits/quota appear exhausted.", 402, "PROVIDER_QUOTA_EXCEEDED");
    }
    if (status === 401 || status === 403) {
      throw new ApiError("Image provider authentication failed. Check REPLICATE_API_TOKEN.", 502, "PROVIDER_AUTH_FAILED");
    }
    throw new ApiError("Image generation failed", 500, "GENERATION_FAILED");
  }

  /**
   * Removes the background from a product image.
   *
   * Strategy (in order):
   *  1. remove.bg API — AI-quality results; requires REMOVE_BG_API_KEY env var.
   *  2. Sharp flood-fill — zero-dependency fallback; works well on white/solid backgrounds.
   *
   * Returns a data:image/png;base64 URL usable directly by sharp's composite pipeline.
   */
  async removeBackground(imageUrl: string): Promise<string> {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      throw new ApiError(`Failed to fetch product image (${res.status})`, 400, "IMAGE_FETCH_FAILED");
    }
    const imageBuffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "image/png";

    // 1 — remove.bg (AI quality, optional)
    const removeBgKey = process.env.REMOVE_BG_API_KEY;
    if (removeBgKey) {
      try {
        const form = new FormData();
        form.append("image_file", new Blob([imageBuffer], { type: contentType }), "product.png");
        form.append("size", "auto");
        const bgRes = await fetch("https://api.remove.bg/v1.0/removebg", {
          method: "POST",
          headers: { "X-Api-Key": removeBgKey },
          body: form,
        });
        if (bgRes.ok) {
          const buf = Buffer.from(await bgRes.arrayBuffer());
          return `data:image/png;base64,${buf.toString("base64")}`;
        }
        console.warn("remove.bg failed:", bgRes.status);
      } catch (err) {
        console.warn("remove.bg request error:", String(err));
      }
    }

    // 2 — Sharp flood-fill fallback
    try {
      const buf = await removeBackgroundSharp(imageBuffer);
      return `data:image/png;base64,${buf.toString("base64")}`;
    } catch (err) {
      console.error("Sharp background removal failed:", String(err));
      throw new ApiError("Background removal failed", 500, "BACKGROUND_REMOVAL_FAILED");
    }
  }
}
