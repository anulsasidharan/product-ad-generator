# Olivia — AI Product Ad Generator

Turn any product photo into polished, campaign-ready ad creatives with a single prompt. Olivia combines Claude's vision and reasoning with Replicate's image-generation models to deliver an end-to-end creative workflow: upload, analyse, generate, refine conversationally, edit on canvas, and export.

---

## Features

- **Smart product analysis** — Claude Vision identifies the product category, style, colours, and materials and suggests creative directions automatically.
- **Natural-language generation** — describe a vibe in plain English ("summer beach", "luxury hotel lobby") and get up to three campaign-ready variants in seconds.
- **Multi-model image generation** — routes to FLUX Schnell (fast) or FLUX Pro (quality) on Replicate, with DALL-E 3 as an optional fallback.
- **Conversational refinement** — iterate via the chat panel ("make it warmer", "add a headline") without regenerating from scratch. Streams reasoning and results in real time via Server-Sent Events.
- **Canvas editor** — Fabric.js canvas with layer management, text overlays, undo/redo, zoom, and one-click export to PNG / JPG / WebP.
- **Variant-specific regeneration** — regenerate a single variant without touching the others.
- **Sliding before/after comparison** — lightbox with a draggable slider comparing the original product and the generated ad.
- **Rate limiting** — sliding-window rate limiter backed by Upstash Redis, with an in-memory fallback so the app never fail-opens.
- **Background removal** — optional product isolation via a Replicate `rembg` model for cleaner compositing.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| UI | React 18, Tailwind CSS, shadcn/ui, Framer Motion |
| Canvas | Fabric.js 7 |
| AI — reasoning | Anthropic Claude Sonnet 4 (`@anthropic-ai/sdk`) |
| AI — image generation | Replicate (FLUX Schnell, FLUX Pro) |
| AI — streaming | Vercel AI SDK |
| Storage | Vercel Blob |
| Rate limiting | Upstash Redis + in-memory sliding window fallback |
| Image processing | Sharp |
| Validation | Zod |
| Testing | Vitest (unit), Playwright (E2E) |
| Deployment | Vercel |

---

## Project structure

```
├── app/
│   ├── layout.tsx             # Root layout with sticky nav header
│   ├── page.tsx               # Home / landing page
│   ├── editor/page.tsx        # Main editor workspace
│   └── api/
│       ├── analyze/route.ts   # POST — product image analysis
│       ├── generate/route.ts  # POST — ad image generation
│       ├── iterate/route.ts   # POST (SSE) — conversational refinement
│       ├── upload/route.ts    # POST — file upload to Vercel Blob
│       └── health/route.ts    # GET  — health check
├── components/
│   ├── canvas/CanvasEditor.tsx
│   ├── chat/ChatInterface.tsx
│   ├── generation/
│   │   ├── PromptInput.tsx
│   │   └── ResultsGallery.tsx
│   ├── upload/ProductUploader.tsx
│   └── ui/                    # shadcn/ui primitives
├── lib/
│   ├── ai/
│   │   ├── claude-agent.ts    # Claude agent — analysis, prompt optimisation, iteration
│   │   └── image-generator.ts # Replicate / OpenAI image generation
│   ├── cors.ts                # CORS headers (enforces NEXT_PUBLIC_APP_URL)
│   ├── image-utils.ts         # Sharp helpers, text overlay, placeholder generation
│   ├── rate-limit.ts          # Sliding-window rate limiter
│   ├── remote-image.ts        # Validated remote image fetch (https + Content-Type check)
│   ├── types.ts               # Shared TypeScript types
│   └── validation.ts          # Zod schemas for all API inputs and responses
├── contexts/                  # React context providers
├── e2e/                       # Playwright end-to-end tests
├── __tests__/                 # Vitest unit tests
├── public/                    # Static assets
├── .env.example               # Environment variable template
└── vercel.json                # Vercel deployment config
```

---

## Getting started

### Prerequisites

- Node.js 18+
- A [Replicate](https://replicate.com) account and API token
- An [Anthropic](https://console.anthropic.com) API key
- A [Vercel](https://vercel.com) account (for Blob storage)
- Optional: [Upstash](https://upstash.com) Redis for production rate limiting

### 1. Clone and install

```bash
git clone https://github.com/anulsasidharan/olivia-product-ad-generator.git
cd olivia-product-ad-generator
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your keys:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-api03-...
REPLICATE_API_TOKEN=r8_...
BLOB_READ_WRITE_TOKEN=vercel_blob_...
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional — production rate limiting
UPSTASH_REDIS_URL=https://...
UPSTASH_REDIS_TOKEN=...

# Optional — override the default Claude model
# ANTHROPIC_MODEL=claude-sonnet-4-20250514

# Optional — override the background-removal model
# REPLICATE_BG_MODEL=cjwbw/rembg
```

> The app falls back to an in-memory rate limiter when Upstash credentials are absent, so Redis is not required for local development.

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## API reference

All routes are under `/api/`. Each route is rate-limited per IP.

### `POST /api/analyze`

Analyses an uploaded product image and returns product metadata and creative suggestions.

**Request**
```json
{
  "imageUrl": "https://...",
  "removeBackground": false
}
```

**Response**
```json
{
  "success": true,
  "data": {
    "productType": "luxury wristwatch",
    "attributes": { "category": "fashion", "style": "minimalist", "colors": ["silver", "black"] },
    "suggestions": [{ "prompt": "Executive desk setup", "reasoning": "...", "style": "lifestyle" }],
    "isolatedImageUrl": "https://..."
  }
}
```

---

### `POST /api/generate`

Generates up to three ad image variants from a natural-language prompt.

**Request**
```json
{
  "productImageUrl": "https://...",
  "userPrompt": "summer beach vibe",
  "productContext": { "productType": "sunglasses", "attributes": {} },
  "variants": 3,
  "aspectRatio": "1:1",
  "model": "flux-schnell"
}
```

**Response**
```json
{
  "success": true,
  "data": {
    "generations": [{
      "id": "gen_...",
      "imageUrl": "https://...",
      "optimizedPrompt": "...",
      "model": "flux-schnell",
      "reasoning": "...",
      "parameters": { "style": "lifestyle", "lighting": "natural", "composition": "wide" },
      "metadata": { "generationTime": 4200, "cost": 0.003 }
    }]
  }
}
```

---

### `POST /api/iterate` (Server-Sent Events)

Processes a conversational refinement request and streams back thinking, actions, and results.

**Request**
```json
{
  "generationId": "gen_...",
  "userMessage": "make the background warmer",
  "conversationHistory": [],
  "currentState": { "imageUrl": "https://...", "parameters": {} }
}
```

**Streamed events**
```
data: {"type":"thinking","content":"I'll adjust the colour temperature..."}
data: {"type":"result","imageUrl":"https://...","explanation":"...","clarify":false}
```

---

### `POST /api/upload`

Uploads an image file (multipart/form-data) to Vercel Blob and returns a public URL.

### `GET /api/health`

Returns `{"status":"ok","timestamp":"..."}`. Used for uptime monitoring.

---

## Development

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run type-check   # TypeScript — tsc --noEmit
npm run lint         # ESLint
npm test             # Vitest unit tests
npm run test:watch   # Vitest in watch mode
npm run test:e2e     # Playwright end-to-end tests
npm run build        # Production build
npm run format       # Prettier
```

---

## Deployment

The project is configured for one-command Vercel deployment.

### Set Vercel secrets

```bash
vercel env add ANTHROPIC_API_KEY
vercel env add REPLICATE_API_TOKEN
vercel env add BLOB_READ_WRITE_TOKEN
vercel env add NEXT_PUBLIC_APP_URL
# optional
vercel env add UPSTASH_REDIS_URL
vercel env add UPSTASH_REDIS_TOKEN
```

### Deploy

```bash
npm run deploy:preview   # Preview deployment
npm run deploy           # Production deployment
```

The `/api/generate` function is configured with a 60-second timeout in `vercel.json` to accommodate multi-variant image generation. Static assets are cached immutably via the CDN. CORS is enforced to `NEXT_PUBLIC_APP_URL` only — no wildcard origins.

---

## Security notes

- **CORS** — enforced to `NEXT_PUBLIC_APP_URL`; wildcard `*` is never used.
- **Remote image validation** — only `https://` URLs are accepted; `Content-Type` is verified to be `image/*` before processing.
- **Rate limiting** — sliding-window limiter (Upstash Redis with in-memory fallback). Exceeding the limit returns HTTP 429.
- **Environment secrets** — `.env.local` and all `.env*` files are excluded from git via `.gitignore`.
- **Content-Security-Policy** — set globally via `vercel.json` headers.

---

## License

Private — all rights reserved.
