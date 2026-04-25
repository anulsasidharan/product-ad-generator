export function corsHeaders(): Record<string, string> {
  const origin = process.env.NEXT_PUBLIC_APP_URL;
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  // Only set the header when an explicit allowlist origin is configured.
  // No fallback to "*" — omitting the header enforces same-origin policy.
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export function mergeCors(headers?: HeadersInit): Headers {
  const merged = new Headers(headers);
  for (const [key, value] of Object.entries(corsHeaders())) {
    merged.set(key, value);
  }
  return merged;
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: mergeCors({ "Content-Type": "application/json" }),
  });
}

export function withCors(response: Response): Response {
  return new Response(response.body, {
    status: response.status,
    headers: mergeCors(response.headers),
  });
}
