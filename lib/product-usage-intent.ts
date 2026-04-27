import type { ProductContext } from "@/lib/types";

function hasAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

/**
 * Derives a "how this product is used by people" hint from analyzed product context.
 * Always returns a generic fallback so unknown categories remain dynamic.
 */
export function buildDynamicUsageDirective(productContext: ProductContext): string {
  const blob = `${productContext.productType} ${productContext.attributes.category} ${productContext.attributes.style}`
    .toLowerCase();

  if (hasAny(blob, ["shoe", "sneaker", "boot", "footwear", "running"])) {
    return "Show lower-body athletic action with the product being worn naturally (stride, stance, movement), with clear leg/foot anatomy and realistic contact with terrain.";
  }
  if (hasAny(blob, ["dress", "gown", "jacket", "shirt", "fashion", "apparel", "clothing"])) {
    return "Show a model wearing the product as a natural fashion shot (standing, walking, seated, or in motion) with realistic drape and fabric behavior.";
  }
  if (hasAny(blob, ["watch", "bracelet", "ring", "necklace", "jewelry", "accessory"])) {
    return "Show the product worn on body in a believable close or medium lifestyle framing with natural skin, pose, and reflections.";
  }
  if (hasAny(blob, ["bottle", "drink", "mug", "cup", "food", "snack", "coffee"])) {
    return "Show a person naturally holding or consuming/using the product in context (table, cafe, kitchen, outdoors), avoiding static catalog staging.";
  }
  if (hasAny(blob, ["phone", "laptop", "tablet", "headphone", "earbud", "device", "electronics"])) {
    return "Show a person actively using the product in realistic day-to-day context with natural hand placement and posture.";
  }
  if (hasAny(blob, ["cream", "serum", "skincare", "cosmetic", "beauty", "makeup"])) {
    return "Show a person applying or holding the product naturally in a beauty/lifestyle setting with authentic skin texture and pose.";
  }

  return "Show at least one person naturally interacting with the product in realistic use context (wearing, holding, operating, or applying as appropriate). Avoid isolated packshot composition.";
}

