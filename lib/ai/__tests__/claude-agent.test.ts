import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    public messages = { create: createMock };
  }
  return { default: MockAnthropic };
});

describe("ClaudeAgent", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    createMock.mockReset();
  });

  it("interprets 'make it warmer' as adjust_color_temperature", async () => {
    createMock.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            action: "adjust_color_temperature",
            parameters: { warmth: 15, layer: "background" },
            confidence: 0.93,
            explanation: "I will warm the background tones.",
          }),
        },
      ],
    });

    const { ClaudeAgent } = await import("@/lib/ai/claude-agent");
    const agent = new ClaudeAgent("test-key");

    const action = await agent.interpretIteration(
      "make it warmer",
      { imageUrl: "https://example.com/current.png", parameters: {} },
      [],
    );

    expect(action.type).toBe("adjust_color_temperature");
    if (action.type === "adjust_color_temperature") {
      expect(action.parameters.warmth).toBeGreaterThan(0);
      expect(action.parameters.layer).toBe("background");
    }
  });

  it("caches optimizePrompt for identical prompt+context", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "Studio product shot, high detail, soft shadows" }],
    });

    const { ClaudeAgent } = await import("@/lib/ai/claude-agent");
    const agent = new ClaudeAgent("test-key");
    const context = {
      productType: "ceramic mug",
      attributes: {
        category: "home",
        style: "minimal",
        colors: ["white"],
      },
    };

    const first = await agent.optimizePrompt("minimal coffee ad", context);
    const second = await agent.optimizePrompt("minimal coffee ad", context);

    expect(first.optimizedPrompt).toContain("Studio product shot");
    expect(second.optimizedPrompt).toBe(first.optimizedPrompt);
    expect(createMock).toHaveBeenCalledTimes(1);
  });
});
