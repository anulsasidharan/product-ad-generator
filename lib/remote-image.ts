import { ApiError } from "@/lib/api-response";

const TEN_MB = 10 * 1024 * 1024;

/**
 * Validates a remote image URL and rejects oversized payloads.
 * Enforces https-only and verifies Content-Type is an image.
 */
export async function assertRemoteImageWithinMaxBytes(
  url: string,
  maxBytes: number = TEN_MB,
): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ApiError("Invalid image URL", 400, "INVALID_URL");
  }

  if (parsed.protocol !== "https:") {
    throw new ApiError("Image URL must use https://", 400, "INVALID_URL_PROTOCOL");
  }

  const res = await fetch(url, { method: "HEAD", redirect: "follow" });
  if (!res.ok) {
    throw new ApiError("Could not verify image URL", 400, "IMAGE_HEAD_FAILED");
  }

  const contentType = res.headers.get("content-type");
  if (contentType && !contentType.startsWith("image/")) {
    throw new ApiError("URL must point to an image file", 400, "INVALID_CONTENT_TYPE");
  }

  const len = res.headers.get("content-length");
  if (!len) {
    return;
  }
  const bytes = Number(len);
  if (Number.isFinite(bytes) && bytes > maxBytes) {
    throw new ApiError("Image too large (max 10MB)", 413, "PAYLOAD_TOO_LARGE");
  }
}
