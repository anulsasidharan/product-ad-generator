import { describe, expect, it } from "vitest";

describe("GET /api/health", () => {
  it("returns status, timestamp, and capability diagnostics", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const body = (await response.json()) as {
      status: string;
      timestamp: string;
      capabilities?: {
        ideogramEnabled?: boolean;
        replicateConfigured?: boolean;
        ideogramModel?: string;
        warnings?: string[];
      };
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
    expect(body.capabilities).toBeDefined();
    expect(typeof body.capabilities?.ideogramEnabled).toBe("boolean");
    expect(typeof body.capabilities?.replicateConfigured).toBe("boolean");
    expect(typeof body.capabilities?.ideogramModel).toBe("string");
    expect(Array.isArray(body.capabilities?.warnings)).toBe(true);
  });
});

