import { beforeEach, describe, expect, it, vi } from "vitest";

const optimizePromptMock = vi.fn();
const generateVariantsMock = vi.fn();
const generateImageMock = vi.fn();
const uploadImageMock = vi.fn();
const rateLimitMock = vi.fn();
const assertRemoteMock = vi.fn();

const { compositeMock, resolveProductMock } = vi.hoisted(() => ({
  compositeMock: vi.fn(),
  resolveProductMock: vi.fn(async (productUrl: string) => productUrl),
}));

vi.mock("@/lib/ai/claude-agent", () => {
  class MockClaudeAgent {
    optimizePrompt = optimizePromptMock;
    generateVariants = generateVariantsMock;
  }
  return { ClaudeAgent: MockClaudeAgent };
});

vi.mock("@/lib/ai/image-generator", () => {
  class MockImageGenerator {
    generate = generateImageMock;
  }
  return { ImageGenerator: MockImageGenerator };
});

vi.mock("@/lib/blob-storage", () => ({
  uploadImage: uploadImageMock,
}));

vi.mock("@/lib/image-utils", () => ({
  compositeProductOnBackground: compositeMock,
  resolveProductUrlForComposite: resolveProductMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: rateLimitMock,
  GENERATE_LIMIT: 5,
  getClientIdentifier: () => "127.0.0.1",
}));

vi.mock("@/lib/remote-image", () => ({
  assertRemoteImageWithinMaxBytes: assertRemoteMock,
}));

describe("POST /api/generate", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.REPLICATE_VARIANT_SPACING_MS = "0";
    optimizePromptMock.mockReset();
    generateVariantsMock.mockReset();
    generateImageMock.mockReset();
    uploadImageMock.mockReset();
    compositeMock.mockReset();
    resolveProductMock.mockReset();
    rateLimitMock.mockReset();
    assertRemoteMock.mockReset();
  });

  it("returns generated variants with success payload", async () => {
    optimizePromptMock.mockResolvedValue({
      optimizedPrompt: "high-end studio shot",
      suggestedModel: "flux-schnell",
    });
    generateVariantsMock.mockResolvedValue([
      {
        prompt: "variant one",
        reasoning: "minimal",
        parameters: { style: "minimal", lighting: "softbox", composition: "centered" },
      },
      {
        prompt: "variant two",
        reasoning: "lifestyle",
        parameters: { style: "lifestyle", lighting: "sunlight", composition: "desk scene" },
      },
    ]);
    generateImageMock
      .mockResolvedValueOnce(["https://replicate.example/one.png"])
      .mockResolvedValueOnce(["https://replicate.example/two.png"]);
    compositeMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    uploadImageMock
      .mockResolvedValueOnce("https://blob.example/generated-1.png")
      .mockResolvedValueOnce("https://blob.example/generated-2.png");

    const { POST } = await import("@/app/api/generate/route");

    const request = new Request("http://localhost/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productImageUrl: "https://example.com/product.png",
        userPrompt: "clean premium ad",
        productContext: {
          productType: "water bottle",
          attributes: {
            category: "fitness",
            style: "modern",
            colors: ["black"],
          },
        },
        variants: 2,
        aspectRatio: "1:1",
      }),
    });

    const response = await POST(request);
    const body = (await response.json()) as {
      success: boolean;
      data: { generations: Array<{ imageUrl: string }> };
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.generations).toHaveLength(2);
    expect(body.data.generations[0]?.imageUrl).toContain("blob.example");
    expect(rateLimitMock).toHaveBeenCalled();
    expect(assertRemoteMock).toHaveBeenCalledWith("https://example.com/product.png");
    expect(resolveProductMock).toHaveBeenCalledWith(
      "https://example.com/product.png",
      expect.any(Function),
    );
    expect(compositeMock).toHaveBeenCalledWith(
      "https://example.com/product.png",
      "https://replicate.example/one.png",
    );
  });
});
