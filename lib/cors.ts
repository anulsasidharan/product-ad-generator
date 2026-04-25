export function corsHeaders(): Record<string, string> {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
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
