import { errorResponse } from "@/lib/api-response";
import { uploadImage } from "@/lib/blob-storage";
import { corsHeaders, jsonResponse, withCors } from "@/lib/cors";
import { ANALYZE_LIMIT, checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024;

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const ip = getClientIdentifier(request);
    await checkRateLimit(ip, ANALYZE_LIMIT, "1 m");

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return jsonResponse({ success: false, error: "Invalid form data", code: "INVALID_FORM_DATA" }, 400);
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonResponse({ success: false, error: "Missing file field", code: "MISSING_FILE" }, 400);
    }
    if (!ALLOWED.has(file.type)) {
      return jsonResponse({ success: false, error: "Only PNG, JPG, or WebP allowed", code: "INVALID_TYPE" }, 400);
    }
    if (file.size > MAX_BYTES) {
      return jsonResponse({ success: false, error: "Image too large (max 10MB)", code: "PAYLOAD_TOO_LARGE" }, 413);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadImage(buffer, file.name || "upload.png", "uploads");

    return jsonResponse({ success: true, data: { url } });
  } catch (error) {
    return withCors(errorResponse(error));
  }
}
