import { describe, expect, it } from "vitest";

import { parseOrchestrationSummary } from "./orchestration-from-response";

describe("parseOrchestrationSummary", () => {
  it("returns null for invalid input", () => {
    expect(parseOrchestrationSummary(undefined)).toBeNull();
    expect(parseOrchestrationSummary([])).toBeNull();
    expect(parseOrchestrationSummary({ adType: "x" })).toBeNull();
  });

  it("maps API metadata orchestration with trace", () => {
    const o = parseOrchestrationSummary(
      {
        adType: "lifestyle",
        generationStrategy: "new",
        targetPlatform: "instagram",
        tone: "warm",
        modelChoice: "ideogram",
        resolvedModel: "flux-pro",
        fallbackApplied: true,
        fallbackReason: "ideogram_capability_disabled_using_flux_fallback",
        intentConfidence: "0.85",
        topEditOperation: "adjust_warmth",
      },
      "trace-abc",
    );
    expect(o).not.toBeNull();
    expect(o?.traceId).toBe("trace-abc");
    expect(o?.generationStrategy).toBe("new");
    expect(o?.intentConfidence).toBeCloseTo(0.85);
    expect(o?.fallbackApplied).toBe(true);
  });
});
