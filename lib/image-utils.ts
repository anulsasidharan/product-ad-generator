import sharp from "sharp";

import { ApiError } from "@/lib/api-response";

const IMAGE_DEFAULTS = {
  MAX_COVER: 0.72,
  TEXT_FONT_SIZE: 48,
  TEXT_MIN_FONT_SIZE: 8,
  TEXT_MAX_FONT_SIZE: 200,
  PLACEHOLDER_DIM: 16,
  PLACEHOLDER_BLUR_SIGMA: 6,
  JPEG_QUALITY: 85,
  PLACEHOLDER_QUALITY: 60,
} as const;

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new ApiError(`Failed to fetch image (${res.status})`, 400, "IMAGE_FETCH_FAILED");
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Opaque product photos (JPEG / studio PNG) must be cut out before compositing; otherwise Sharp
 * pastes a solid rectangle (white backdrop) on top of the generated scene.
 *
 * Checking `hasAlpha` alone is insufficient — a PNG can carry an alpha channel while every pixel
 * is fully opaque (alpha = 255). We inspect the channel statistics: only skip background removal
 * when there are actual transparent pixels (alpha min < 255).
 */
export async function resolveProductUrlForComposite(
  productUrl: string,
  removeBackground: (url: string) => Promise<string>,
): Promise<string> {
  const buf = await fetchBuffer(productUrl);
  const meta = await sharp(buf).metadata();
  if (meta.hasAlpha) {
    const stats = await sharp(buf).stats();
    const alphaStats = stats.channels[3]; // RGBA: channel 3 is alpha
    if (alphaStats && alphaStats.min < 255) {
      return productUrl; // genuine transparency present — no removal needed
    }
  }
  return removeBackground(productUrl);
}

export interface CompositeOptions {
  /** 0–1 relative position; default centers product. */
  position?: { x: number; y: number };
  /** Max fraction of background width/height the product may occupy. */
  maxCover?: number;
}

/**
 * Composites a transparent product image onto a background, scaled to fit.
 */
export async function compositeProductOnBackground(
  productUrl: string,
  backgroundUrl: string,
  options?: CompositeOptions,
): Promise<Buffer> {
  const [productBuf, bgBuf] = await Promise.all([fetchBuffer(productUrl), fetchBuffer(backgroundUrl)]);

  const bgMeta = await sharp(bgBuf).metadata();
  const bgWidth = bgMeta.width;
  const bgHeight = bgMeta.height;
  if (!bgWidth || !bgHeight) {
    throw new ApiError("Could not read background dimensions", 400, "INVALID_IMAGE");
  }

  const maxCover = options?.maxCover ?? IMAGE_DEFAULTS.MAX_COVER;
  const maxW = Math.floor(bgWidth * maxCover);
  const maxH = Math.floor(bgHeight * maxCover);

  const productMeta = await sharp(productBuf).metadata();
  let productPipeline = sharp(productBuf).ensureAlpha();
  if (productMeta.hasAlpha) {
    try {
      const trimmed = await sharp(productBuf).ensureAlpha().trim().png().toBuffer();
      productPipeline = sharp(trimmed).ensureAlpha();
    } catch {
      productPipeline = sharp(productBuf).ensureAlpha();
    }
  }

  const resizedProduct = await productPipeline
    .resize({
      width: maxW,
      height: maxH,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();

  const prodMeta = await sharp(resizedProduct).metadata();
  const pw = prodMeta.width ?? 0;
  const ph = prodMeta.height ?? 0;
  if (!pw || !ph) {
    throw new ApiError("Could not read product dimensions", 400, "INVALID_IMAGE");
  }

  const posX = options?.position?.x ?? 0.5;
  const posY = options?.position?.y ?? 0.5;
  const left = Math.max(0, Math.round(posX * (bgWidth - pw)));
  const top = Math.max(0, Math.round(posY * (bgHeight - ph)));

  return sharp(bgBuf)
    .composite([{ input: resizedProduct, left, top, blend: "over" }])
    .png()
    .toBuffer();
}

/**
 * Adjusts warmth using a simple RGB recombination (positive = warmer).
 */
export async function adjustColorTemperature(imageUrl: string, warmth: number): Promise<Buffer> {
  if (warmth < -100 || warmth > 100) {
    throw new ApiError("warmth must be between -100 and 100", 400, "INVALID_WARMTH");
  }

  const input = await fetchBuffer(imageUrl);
  const t = warmth / 100;
  const r: [number, number, number] = [1 + t * 0.22, 0, 0];
  const g: [number, number, number] = [0, 1 - Math.abs(t) * 0.04, 0];
  const b: [number, number, number] = [0, 0, 1 - t * 0.22];

  try {
    return await sharp(input)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .recomb([r, g, b])
      .png()
      .toBuffer();
  } catch {
    throw new ApiError("Failed to adjust image colors", 500, "IMAGE_ADJUST_FAILED");
  }
}

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export interface TextOverlayOptions {
  position: { x: number; y: number };
  font: string;
  color: string;
}

/**
 * Renders text onto an image using an SVG overlay.
 * Numeric position values are clamped to image bounds to prevent SVG renderer issues.
 */
export async function addTextOverlay(
  imageUrl: string,
  text: string,
  options: TextOverlayOptions,
): Promise<Buffer> {
  const input = await fetchBuffer(imageUrl);
  const meta = await sharp(input).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) {
    throw new ApiError("Could not read image dimensions", 400, "INVALID_IMAGE");
  }

  // Clamp numeric params to valid bounds before interpolation into SVG
  const safeX = Math.max(0, Math.min(Math.floor(options.position.x), width));
  const safeY = Math.max(0, Math.min(Math.floor(options.position.y), height));
  const safeFontSize = Math.max(
    IMAGE_DEFAULTS.TEXT_MIN_FONT_SIZE,
    Math.min(IMAGE_DEFAULTS.TEXT_MAX_FONT_SIZE, IMAGE_DEFAULTS.TEXT_FONT_SIZE),
  );

  const safeText = escapeXml(text);
  const svg = `<svg width="${width}" height="${height}">
  <text x="${safeX}" y="${safeY}" font-family="${escapeXml(options.font)}" font-size="${safeFontSize}" fill="${escapeXml(options.color)}">${safeText}</text>
</svg>`;

  try {
    return await sharp(input)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .png()
      .toBuffer();
  } catch {
    throw new ApiError("Failed to render text overlay", 500, "TEXT_OVERLAY_FAILED");
  }
}

export interface ThumbnailResult {
  buffer: Buffer;
  /** Tiny blurred JPEG as data URL for blur-up placeholders. */
  placeholderDataUrl: string;
}

/**
 * Resizes to fit within width/height and produces a tiny blur placeholder.
 */
export async function generateThumbnail(
  imageUrl: string,
  width: number,
  height: number,
): Promise<ThumbnailResult> {
  if (width <= 0 || height <= 0) {
    throw new ApiError("Thumbnail dimensions must be positive", 400, "INVALID_THUMBNAIL_SIZE");
  }

  const input = await fetchBuffer(imageUrl);
  try {
    const buffer = await sharp(input)
      .resize({
        width,
        height,
        fit: "inside",
        withoutEnlargement: false,
      })
      .jpeg({ quality: IMAGE_DEFAULTS.JPEG_QUALITY })
      .toBuffer();

    const placeholderBuf = await sharp(buffer)
      .resize(IMAGE_DEFAULTS.PLACEHOLDER_DIM, IMAGE_DEFAULTS.PLACEHOLDER_DIM, { fit: "cover" })
      .blur(IMAGE_DEFAULTS.PLACEHOLDER_BLUR_SIGMA)
      .jpeg({ quality: IMAGE_DEFAULTS.PLACEHOLDER_QUALITY })
      .toBuffer();

    const placeholderDataUrl = `data:image/jpeg;base64,${placeholderBuf.toString("base64")}`;

    return { buffer, placeholderDataUrl };
  } catch {
    throw new ApiError("Failed to generate thumbnail", 500, "THUMBNAIL_FAILED");
  }
}
