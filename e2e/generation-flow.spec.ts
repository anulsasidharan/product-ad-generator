import { expect, test } from "@playwright/test";

test("complete generation flow with mocked APIs", async ({ page }) => {
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
            totalGenerationTime: 1200,
            modelUsed: "flux-schnell",
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

  await page.getByRole("link", { name: /open editor|launch editor/i }).first().click();
  await expect(page.getByRole("heading", { name: "Editor" })).toBeVisible();

  const urlInput = page.getByLabel("Or paste image URL");
  await urlInput.fill("https://picsum.photos/seed/product/640/640");
  await page.getByRole("button", { name: "Analyze URL" }).click();

  await expect(page.getByText("Minimal steel bottle")).toBeVisible();

  const promptBox = page.getByPlaceholder(/describe.*vibe/i);
  await promptBox.fill("Clean premium bottle ad");
  await page.getByRole("button", { name: /^generate$/i }).click();

  await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
  await expect(page.getByText("Active variant")).toBeVisible();
  await expect(page.getByText("Refine with chat")).toBeVisible();
});
