import { del, head, put } from "@vercel/blob";
import sharp from "sharp";

import { ApiError } from "@/lib/api-response";

const scheduledCleanup = new Map<string, number>();

function logBlob(operation: string, details: Record<string, unknown>): void {
  console.info(`[blob] ${operation}`, details);
}

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      await new Promise((r) => setTimeout(r, 300 * 2 ** i));
    }
  }
  logBlob(label, { error: String(last) });
  throw last instanceof Error ? last : new Error(String(last));
}

function assertToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new ApiError("Blob storage is not configured", 500, "BLOB_NOT_CONFIGURED");
  }
  return token;
}

/**
 * Uploads a buffer to Vercel Blob with a unique path.
 */
export async function uploadImage(
  buffer: Buffer,
  filename: string,
  folder: "uploads" | "generated",
  userId = "anonymous",
): Promise<string> {
  const token = assertToken();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${folder}/${userId}/${Date.now()}-${safeName}`;

  const blob = await withRetry("uploadImage", async () => {
    try {
      return await put(path, buffer, {
        access: "public",
        token,
      });
    } catch (error) {
      const message = String(error);
      if (!message.includes("Cannot use public access on a private store")) {
        throw error;
      }

      // Private blob stores reject explicit `access: "public"`.
      // Retry with default store access so local/dev uploads still work.
      return put(path, buffer, { token });
    }
  });

  const clientUrl =
    "downloadUrl" in blob && typeof blob.downloadUrl === "string" ? blob.downloadUrl : blob.url;

  logBlob("uploadImage", { path, url: blob.url, clientUrl });
  return clientUrl;
}

/**
 * Deletes a blob by public URL.
 */
export async function deleteImage(url: string): Promise<void> {
  const token = assertToken();
  try {
    await withRetry("deleteImage", () => del(url, { token }));
    scheduledCleanup.delete(url);
    logBlob("deleteImage", { url });
  } catch (error) {
    logBlob("deleteImage_failed", { url, error: String(error) });
  }
}

export interface ImageMetadata {
  size: number;
  dimensions: { width: number; height: number };
  format: string;
}

/**
 * Returns basic metadata for a blob URL using the Blob API when possible.
 */
export async function getImageMetadata(url: string): Promise<ImageMetadata> {
  let size = 0;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    try {
      const blobMeta = await withRetry("head", () => head(url, { token }));
      size = blobMeta.size;
    } catch {
      // continue with fetch-based metadata
    }
  }

  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new ApiError("Failed to read image metadata", 400, "METADATA_FAILED");
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const m = await sharp(buf).metadata();
  return {
    size: size || buf.byteLength,
    dimensions: { width: m.width ?? 0, height: m.height ?? 0 },
    format: m.format ?? "unknown",
  };
}

/**
 * Records a URL for optional cleanup after `afterHours` (in-process only; use cron in production).
 */
export function scheduleCleanup(url: string, afterHours = 24): void {
  const deleteAt = Date.now() + afterHours * 3_600_000;
  scheduledCleanup.set(url, deleteAt);
  logBlob("scheduleCleanup", { url, deleteAt });
}
