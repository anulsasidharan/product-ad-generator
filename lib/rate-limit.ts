import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { ApiError } from "@/lib/api-response";

export const ANALYZE_LIMIT = 10;
export const GENERATE_LIMIT = 5;
export const ITERATE_LIMIT = 20;

type WindowDuration = `${number} ${"s" | "m" | "h" | "d"}`;

let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) {
    return redisClient;
  }
  const url = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;
  if (!url || !token) {
    redisClient = null;
    return null;
  }
  try {
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch (error) {
    console.warn("[rate-limit] Failed to init Redis:", error);
    redisClient = null;
    return null;
  }
}

function parseWindow(window: string): WindowDuration {
  const trimmed = window.trim();
  const match = /^(\d+)\s*(s|m|h|d)$/i.exec(trimmed);
  if (!match || !match[1] || !match[2]) {
    return "60 s";
  }
  const n = Number(match[1]);
  const unit = match[2].toLowerCase() as "s" | "m" | "h" | "d";
  return `${n} ${unit}` as WindowDuration;
}

/**
 * Applies a sliding-window rate limit. If Redis is unavailable, allows the request and logs a warning.
 */
export async function checkRateLimit(
  identifier: string,
  limit: number,
  window: string,
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const redis = getRedis();
  if (!redis) {
    console.warn("[rate-limit] Redis unavailable; allowing request");
    return { success: true, remaining: limit, reset: Date.now() + 60_000 };
  }

  const duration = parseWindow(window);
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, duration),
    prefix: "product-ad-generator",
  });

  const result = await ratelimit.limit(identifier);
  if (!result.success) {
    throw new ApiError("Too many requests. Please try again later.", 429, "RATE_LIMIT_EXCEEDED");
  }

  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}

export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return "unknown";
}
