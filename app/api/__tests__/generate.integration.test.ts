import { beforeEach, describe, expect, it, vi } from "vitest";

const optimizePromptMock = vi.fn();
const generateVariantsMock = vi.fn();
const orchestrateAdPlanMock = vi.fn();
const buildLifestyleHeroPromptFromImageMock = vi.fn();
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
    orchestrateAdPlan = orchestrateAdPlanMock;
    buildLifestyleHeroPromptFromImage = buildLifestyleHeroPromptFromImageMock;
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
    process.env.PRODUCT_AD_PIPELINE = "composite";
    optimizePromptMock.mockReset();
    generateVariantsMock.mockReset();
    orchestrateAdPlanMock.mockReset();
    buildLifestyleHeroPromptFromImageMock.mockReset();
    generateImageMock.mockReset();
    uploadImageMock.mockReset();
    compositeMock.mockReset();
    resolveProductMock.mockReset();
    rateLimitMock.mockReset();
    assertRemoteMock.mockReset();
    delete process.env.IDEOGRAM_ENABLED;
    buildLifestyleHeroPromptFromImageMock.mockResolvedValue("hero prompt from image");
  });

  it("returns generated variants with success payload", async () => {
    orchestrateAdPlanMock.mockResolvedValue({
      schema_version: "1.0",
      background_prompt: "high-end studio shot",
      model_choice: "flux-schnell",
      model_fallback_order: ["flux-pro"],
      negative_prompt: "",
      ad_type: "studio",
      product_type: "water bottle",
      generation_strategy: "new",
      target_platform: "instagram",
      tone: "premium",
      composition: {
        product_position: "center",
        background_style: "studio",
        lighting: "soft",
        depth: "medium",
        camera_angle: "eye-level",
      },
      text_overlay: {
        enabled: false,
        headline: "",
        subtext: "",
        position: "top",
        style: "minimal",
      },
      post_processing: {
        apply_shadow: false,
        apply_reflection: false,
        color_adjustment: "none",
        overlay_effect: "none",
      },
      render_specs: { aspect_ratio: "1:1", width: 1024, height: 1024, safe_zone: "off" },
      edit_operations: [],
      constraints: {
        preserve_product_identity: true,
        avoid_extra_objects: true,
        text_legibility_priority: true,
      },
      confidence: { intent_confidence: 0.9, product_type_confidence: 0.95 },
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

  it("falls back when orchestration plan fails and reports fallback metadata", async () => {
    orchestrateAdPlanMock.mockRejectedValue(new Error("bad orchestration output"));
    generateVariantsMock.mockResolvedValue([
      {
        prompt: "fallback variant",
        reasoning: "fallback reasoning",
        parameters: { style: "minimal", lighting: "softbox", composition: "centered" },
      },
    ]);
    generateImageMock.mockResolvedValueOnce(["https://replicate.example/fallback.png"]);
    compositeMock.mockResolvedValue(new Uint8Array([9, 9, 9]));
    uploadImageMock.mockResolvedValueOnce("https://blob.example/fallback.png");

    const { POST } = await import("@/app/api/generate/route");

    const request = new Request("http://localhost/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productImageUrl: "https://example.com/product.png",
        userPrompt: "summer ad with bold headline text",
        productContext: {
          productType: "water bottle",
          attributes: {
            category: "fitness",
            style: "modern",
            colors: ["black"],
          },
        },
        variants: 1,
        aspectRatio: "1:1",
      }),
    });

    const response = await POST(request);
    const body = (await response.json()) as {
      success: boolean;
      data?: {
        metadata?: {
          orchestration?: {
            fallbackApplied?: boolean;
            fallbackReason?: string;
            modelChoice?: string;
            resolvedModel?: string;
          };
        };
      };
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(generateImageMock).toHaveBeenCalledWith(
      "fallback variant",
      "flux-pro",
      expect.any(Object),
    );
    expect(body.data?.metadata?.orchestration?.fallbackApplied).toBe(true);
    expect(body.data?.metadata?.orchestration?.fallbackReason).toBe(
      "ideogram_capability_disabled_using_flux_fallback",
    );
    expect(body.data?.metadata?.orchestration?.modelChoice).toBe("ideogram");
    expect(body.data?.metadata?.orchestration?.resolvedModel).toBe("flux-pro");
  });

  it("uses ideogram runtime when capability is enabled", async () => {
    process.env.IDEOGRAM_ENABLED = "true";
    orchestrateAdPlanMock.mockResolvedValue({
      schema_version: "1.0",
      background_prompt: "summer ad with large text",
      model_choice: "ideogram",
      model_fallback_order: ["flux-pro", "flux-schnell"],
      negative_prompt: "",
      ad_type: "instagram_ad",
      product_type: "bottle",
      generation_strategy: "new",
      target_platform: "instagram",
      tone: "bold",
      composition: {
        product_position: "center",
        background_style: "beach",
        lighting: "warm",
        depth: "shallow",
        camera_angle: "eye-level",
      },
      text_overlay: {
        enabled: true,
        headline: "SUMMER",
        subtext: "",
        position: "top",
        style: "bold",
      },
      post_processing: {
        apply_shadow: false,
        apply_reflection: false,
        color_adjustment: "vibrant",
        overlay_effect: "light_gradient",
      },
      render_specs: { aspect_ratio: "4:5", width: 1080, height: 1350, safe_zone: "on" },
      edit_operations: [{ op: "add_text_layer", value: "SUMMER" }],
      constraints: {
        preserve_product_identity: true,
        avoid_extra_objects: true,
        text_legibility_priority: true,
      },
      confidence: { intent_confidence: 0.95, product_type_confidence: 0.9 },
    });
    generateVariantsMock.mockResolvedValue([
      {
        prompt: "text-first summer variant",
        reasoning: "ideogram path",
        parameters: { style: "bold", lighting: "warm", composition: "centered" },
      },
    ]);
    generateImageMock.mockResolvedValueOnce(["https://replicate.example/ideogram.png"]);
    compositeMock.mockResolvedValue(new Uint8Array([7, 7, 7]));
    uploadImageMock.mockResolvedValueOnce("https://blob.example/ideogram.png");

    const { POST } = await import("@/app/api/generate/route");

    const request = new Request("http://localhost/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productImageUrl: "https://example.com/product.png",
        userPrompt: "summer ad with bold text",
        productContext: {
          productType: "water bottle",
          attributes: {
            category: "fitness",
            style: "modern",
            colors: ["black"],
          },
        },
        variants: 1,
      }),
    });

    const response = await POST(request);
    const body = (await response.json()) as {
      success: boolean;
      data?: {
        metadata?: {
          orchestration?: {
            fallbackApplied?: boolean;
            resolvedModel?: string;
          };
        };
      };
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(generateImageMock).toHaveBeenCalledWith(
      "text-first summer variant",
      "ideogram",
      expect.any(Object),
    );
    expect(body.data?.metadata?.orchestration?.fallbackApplied).toBe(false);
    expect(body.data?.metadata?.orchestration?.resolvedModel).toBe("ideogram");
  });

  it("lifestyle pipeline fetches generated image and skips compositing", async () => {
    process.env.PRODUCT_AD_PIPELINE = "lifestyle";
    orchestrateAdPlanMock.mockResolvedValue({
      schema_version: "1.0",
      background_prompt: "model wearing running shoes on city path",
      model_choice: "flux-schnell",
      model_fallback_order: ["flux-pro"],
      negative_prompt: "",
      ad_type: "lifestyle",
      product_type: "sneaker",
      generation_strategy: "new",
      target_platform: "instagram",
      tone: "energetic",
      composition: {
        product_position: "center",
        background_style: "urban",
        lighting: "dramatic",
        depth: "medium",
        camera_angle: "eye-level",
      },
      text_overlay: {
        enabled: false,
        headline: "",
        subtext: "",
        position: "top",
        style: "minimal",
      },
      post_processing: {
        apply_shadow: false,
        apply_reflection: false,
        color_adjustment: "none",
        overlay_effect: "none",
      },
      render_specs: { aspect_ratio: "1:1", width: 1024, height: 1024, safe_zone: "off" },
      edit_operations: [],
      constraints: {
        preserve_product_identity: true,
        avoid_extra_objects: true,
        text_legibility_priority: true,
      },
      confidence: { intent_confidence: 0.9, product_type_confidence: 0.85 },
    });
    buildLifestyleHeroPromptFromImageMock.mockResolvedValue("runner wearing the same red-black shoes");
    generateVariantsMock.mockResolvedValue([
      {
        prompt: "full scene lifestyle variant",
        reasoning: "runner",
        parameters: { style: "sport", lighting: "natural", composition: "dynamic" },
      },
    ]);
    generateImageMock.mockResolvedValueOnce(["https://replicate.example/lifestyle.png"]);
    uploadImageMock.mockResolvedValueOnce("https://blob.example/lifestyle.png");

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("replicate.example")) {
        return new Response(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    const { POST } = await import("@/app/api/generate/route");

    const request = new Request("http://localhost/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productImageUrl: "https://example.com/product.png",
        userPrompt: "morning run through the city",
        productContext: {
          productType: "running shoe",
          attributes: {
            category: "footwear",
            style: "athletic",
            colors: ["red", "black"],
          },
        },
        variants: 1,
      }),
    });

    const response = await POST(request);
    const body = (await response.json()) as {
      success: boolean;
      data?: { metadata?: { pipeline?: string }; generations: Array<{ imageUrl: string }> };
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data?.metadata?.pipeline).toBe("lifestyle");
    expect(buildLifestyleHeroPromptFromImageMock).toHaveBeenCalled();
    expect(buildLifestyleHeroPromptFromImageMock.mock.calls[0]?.[0]).toMatchObject({
      usageDirective: expect.any(String),
    });
    expect(compositeMock).not.toHaveBeenCalled();
    expect(resolveProductMock).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalled();
    expect(uploadImageMock).toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
