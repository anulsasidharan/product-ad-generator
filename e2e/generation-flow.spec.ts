import { expect, test } from "@playwright/test";

test("complete generation flow with mocked APIs", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("olivia-product-tour-seen-v1", "true");
  });

  await page.route("**/api/analyze", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          productType: "Minimal steel bottle",
          attributes: {
            category: "fitness",
            style: "minimal",
            colors: ["silver", "black"],
            material: "steel",
          },
          suggestions: [
            { prompt: "Studio shelf scene", reasoning: "Clean and premium", style: "minimal" },
            { prompt: "Gym setup", reasoning: "Lifestyle context", style: "lifestyle" },
            { prompt: "Outdoor trail", reasoning: "Adventure angle", style: "bold" },
          ],
        },
      }),
    });
  });

  await page.route("**/api/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          generations: [
            {
              id: "gen-1",
              imageUrl: "https://picsum.photos/seed/gen1/1024/1024",
              optimizedPrompt: "Studio product shot",
              model: "flux-schnell",
              reasoning: "Product-forward composition",
              parameters: { style: "minimal", lighting: "soft", composition: "centered" },
              metadata: { generationTime: 1200, cost: 0.003 },
            },
          ],
          suggestions: {
            improvements: ["Try warmer tones"],
            relatedStyles: ["minimal studio"],
          },
          metadata: {
            traceId: "e2e-trace-1",
            totalGenerationTime: 1200,
            modelUsed: "flux-schnell",
            orchestration: {
              adType: "instagram_ad",
              generationStrategy: "modify",
              targetPlatform: "instagram",
              tone: "bold, warm",
              modelChoice: "flux-schnell",
              resolvedModel: "flux-schnell",
              aspectRatio: "1:1",
              topEditOperation: "adjust_color_temperature",
              intentConfidence: 0.94,
              productTypeConfidence: 0.88,
              fallbackApplied: false,
            },
          },
        },
      }),
    });
  });

  await page.route("**/api/iterate", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream" },
      body: [
        'data: {"type":"thinking","content":"Adjusting background warmth..."}',
        "",
        'data: {"type":"result","imageUrl":"https://picsum.photos/seed/gen1b/1024/1024","explanation":"Done. I warmed the scene while preserving product color."}',
        "",
      ].join("\n"),
    });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /turn product images into professional ad creatives/i })).toBeVisible();

  await page.goto("/editor");
  await expect(page.getByRole("heading", { name: "Editor" })).toBeVisible();

  const urlInput = page.getByLabel("Or paste image URL");
  await urlInput.fill("https://picsum.photos/seed/product/640/640");
  await page.getByRole("button", { name: /analyse|analyze/i }).click();

  await expect(page.getByText("Minimal steel bottle")).toBeVisible();

  const promptBox = page.getByPlaceholder(/describe.*vibe/i);
  await promptBox.fill("Clean premium bottle ad");
  await page.getByRole("button", { name: /^generate$/i }).click();

  await expect(page.getByRole("heading", { name: "Generated variants" })).toBeVisible();
  await expect(page.getByText("Active variant", { exact: true })).toBeVisible();
  await expect(page.getByText("Creative director plan", { exact: true })).toBeVisible();
  await expect(page.getByText("Strategy: Modify")).toBeVisible();
  await expect(page.getByText("Action: adjust_color_temperature", { exact: true })).toBeVisible();
  await expect(page.getByText("Refine with chat")).toBeVisible();
});
