import { ApiError } from "@/lib/api-response";

const TEN_MB = 10 * 1024 * 1024;

/**
 * Rejects remote images larger than maxBytes when Content-Length is available.
 */
export async function assertRemoteImageWithinMaxBytes(
  url: string,
  maxBytes: number = TEN_MB,
): Promise<void> {
  const res = await fetch(url, { method: "HEAD", redirect: "follow" });
  if (!res.ok) {
    throw new ApiError("Could not verify image URL", 400, "IMAGE_HEAD_FAILED");
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
