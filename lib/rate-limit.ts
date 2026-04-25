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

function parseWindowMs(window: string): number {
  const trimmed = window.trim();
  const match = /^(\d+)\s*(s|m|h|d)$/i.exec(trimmed);
  if (!match || !match[1] || !match[2]) {
    return 60_000;
  }
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * (multipliers[unit] ?? 60_000);
}

// In-memory sliding-window fallback used when Redis is unavailable.
const inMemoryStore = new Map<string, number[]>();

function inMemoryRateLimit(
  identifier: string,
  limit: number,
  windowMs: number,
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const windowStart = now - windowMs;
  const timestamps = (inMemoryStore.get(identifier) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= limit) {
    const oldestInWindow = Math.min(...timestamps);
    return { success: false, remaining: 0, reset: oldestInWindow + windowMs };
  }

  timestamps.push(now);
  inMemoryStore.set(identifier, timestamps);

  // Evict stale entries when the store grows large to prevent unbounded memory growth.
  if (inMemoryStore.size > 10_000) {
    for (const [key, ts] of inMemoryStore) {
      if (ts.every((t) => t <= windowStart)) {
        inMemoryStore.delete(key);
      }
    }
  }

  return { success: true, remaining: limit - timestamps.length, reset: now + windowMs };
}

/**
 * Applies a sliding-window rate limit.
 * Uses Redis when available; falls back to a process-local in-memory counter.
 * Never fail-open: rate limiting is always enforced.
 */
export async function checkRateLimit(
  identifier: string,
  limit: number,
  window: string,
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const redis = getRedis();

  if (!redis) {
    const windowMs = parseWindowMs(window);
    const result = inMemoryRateLimit(identifier, limit, windowMs);
    if (!result.success) {
      throw new ApiError("Too many requests. Please try again later.", 429, "RATE_LIMIT_EXCEEDED");
    }
    return result;
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
