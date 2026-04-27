import type {
  AspectRatio,
  GenerationStrategy,
  OrchestratorModelChoice,
  OrchestrationSummary,
} from "@/lib/types";

const STRATEGIES: GenerationStrategy[] = ["new", "modify", "reuse_background"];
const MODELS: OrchestratorModelChoice[] = ["flux-pro", "flux-schnell", "ideogram"];
const ASPECTS: AspectRatio[] = ["1:1", "16:9", "9:16", "4:5"];

function asStrategy(v: unknown): GenerationStrategy | null {
  return typeof v === "string" && (STRATEGIES as readonly string[]).includes(v)
    ? (v as GenerationStrategy)
    : null;
}

function asModel(v: unknown): OrchestratorModelChoice | undefined {
  return typeof v === "string" && (MODELS as readonly string[]).includes(v) ? (v as OrchestratorModelChoice) : undefined;
}

function asAspect(v: unknown): AspectRatio | undefined {
  return typeof v === "string" && (ASPECTS as readonly string[]).includes(v) ? (v as AspectRatio) : undefined;
}

function asNumber01(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.max(0, Math.min(1, v));
  }
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) {
      return Math.max(0, Math.min(1, n));
    }
  }
  return undefined;
}

/**
 * Maps `/api/generate` metadata.orchestration (JSON) into UI state.
 * Tolerant of minor type drift so the panel still renders after API/schema tweaks.
 */
export function parseOrchestrationSummary(
  raw: unknown,
  traceId?: string,
): OrchestrationSummary | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const generationStrategy = asStrategy(o["generationStrategy"]);
  if (!generationStrategy) {
    return null;
  }
  const adType = typeof o["adType"] === "string" ? o["adType"] : "Ad";
  const targetPlatform = typeof o["targetPlatform"] === "string" ? o["targetPlatform"] : "unknown";
  const tone = typeof o["tone"] === "string" ? o["tone"] : "";

  return {
    traceId,
    adType,
    generationStrategy,
    targetPlatform,
    tone,
    modelChoice: asModel(o["modelChoice"]),
    resolvedModel: asModel(o["resolvedModel"]),
    aspectRatio: asAspect(o["aspectRatio"]),
    topEditOperation: typeof o["topEditOperation"] === "string" ? o["topEditOperation"] : undefined,
    intentConfidence: asNumber01(o["intentConfidence"]),
    productTypeConfidence: asNumber01(o["productTypeConfidence"]),
    fallbackApplied: typeof o["fallbackApplied"] === "boolean" ? o["fallbackApplied"] : undefined,
    fallbackReason: typeof o["fallbackReason"] === "string" ? o["fallbackReason"] : undefined,
  };
}
