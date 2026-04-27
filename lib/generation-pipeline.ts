/**
 * Product ad generation style.
 * - `lifestyle` (default): one text-to-image hero per variant — models/hands/feet using or wearing the product in-scene (creative editorial). No cutout composite.
 * - `composite`: legacy flow — generate background only, then composite the isolated product on top.
 */
export type ProductAdPipelineMode = "lifestyle" | "composite";

export function getProductAdPipeline(): ProductAdPipelineMode {
  const v = (process.env.PRODUCT_AD_PIPELINE ?? "lifestyle").toLowerCase().trim();
  if (v === "composite" || v === "studio" || v === "cutout") {
    return "composite";
  }
  return "lifestyle";
}

export function isProductCompositePipeline(): boolean {
  return getProductAdPipeline() === "composite";
}
