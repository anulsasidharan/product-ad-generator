import { beforeEach, describe, expect, it, vi } from "vitest";

const interpretIterationMock = vi.fn();
const orchestrateAdPlanMock = vi.fn();
const generateImageMock = vi.fn();
const rateLimitMock = vi.fn();

vi.mock("@/lib/ai/claude-agent", () => {
  class MockClaudeAgent {
    interpretIteration = interpretIterationMock;
    orchestrateAdPlan = orchestrateAdPlanMock;
  }
  return { ClaudeAgent: MockClaudeAgent, DEFAULT_MODEL: "claude-sonnet-4-6" };
});

vi.mock("@/lib/ai/image-generator", () => {
  class MockImageGenerator {
    generate = generateImageMock;
  }
  return { ImageGenerator: MockImageGenerator };
});

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: rateLimitMock,
  ITERATE_LIMIT: 20,
  getClientIdentifier: () => "127.0.0.1",
}));

describe("POST /api/iterate", () => {
  beforeEach(() => {
    vi.resetModules();
    interpretIterationMock.mockReset();
    orchestrateAdPlanMock.mockReset();
    generateImageMock.mockReset();
    rateLimitMock.mockReset();
    delete process.env.ANTHROPIC_API_KEY;
    process.env.PRODUCT_AD_PIPELINE = "composite";
  });

  it("allows regeneration even when orchestration strategy is modify", async () => {
    interpretIterationMock.mockResolvedValue({
      type: "regenerate",
      parameters: { modifiedPrompt: "new background", reason: "user asked" },
      explanation: "I will regenerate the scene.",
    });
    orchestrateAdPlanMock.mockResolvedValue({
      generation_strategy: "modify",
      model_choice: "flux-pro",
      render_specs: { aspect_ratio: "1:1" },
      background_prompt: "new background",
    });
    generateImageMock.mockResolvedValueOnce(["https://replicate.example/new-bg-modify.png"]);

    const { POST } = await import("@/app/api/iterate/route");

    const request = new Request("http://localhost/api/iterate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationId: "gen_123",
        userMessage: "regenerate everything",
        conversationHistory: [],
        currentState: {
          imageUrl: "https://example.com/current.png",
          parameters: {},
        },
      }),
    });

    const response = await POST(request);
    const payload = await response.text();

    expect(response.status).toBe(200);
    expect(generateImageMock).toHaveBeenCalled();
    expect(payload).toContain("\"type\":\"result\"");
    expect(payload).toContain("https://replicate.example/new-bg-modify.png");
  });

  it("uses deterministic orchestration fallback when orchestrator fails", async () => {
    interpretIterationMock.mockResolvedValue({
      type: "regenerate",
      parameters: { modifiedPrompt: "new background", reason: "user asked" },
      explanation: "I will regenerate the scene.",
    });
    orchestrateAdPlanMock.mockRejectedValue(new Error("invalid orchestrator json"));
    generateImageMock.mockResolvedValueOnce(["https://replicate.example/new-bg.png"]);

    const { POST } = await import("@/app/api/iterate/route");

    const request = new Request("http://localhost/api/iterate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationId: "gen_456",
        userMessage: "regenerate with a new scene",
        conversationHistory: [],
        currentState: {
          imageUrl: "https://example.com/current.png",
          parameters: {},
        },
      }),
    });

    const response = await POST(request);
    const payload = await response.text();

    expect(response.status).toBe(200);
    expect(generateImageMock).toHaveBeenCalled();
    expect(payload).toContain("https://replicate.example/new-bg.png");
  });
});

