import { describe, expect, it } from "vitest";

import { buildDynamicUsageDirective } from "./product-usage-intent";

describe("buildDynamicUsageDirective", () => {
  it("maps footwear to movement/worn guidance", () => {
    const out = buildDynamicUsageDirective({
      productType: "Men's running shoe",
      attributes: { category: "footwear", style: "sport", colors: ["red"] },
    });
    expect(out.toLowerCase()).toContain("worn");
    expect(out.toLowerCase()).toContain("terrain");
  });

  it("returns generic fallback for unknown products", () => {
    const out = buildDynamicUsageDirective({
      productType: "Industrial clamp",
      attributes: { category: "tools", style: "utility", colors: ["gray"] },
    });
    expect(out.toLowerCase()).toContain("person");
    expect(out.toLowerCase()).toContain("interacting");
  });
});

