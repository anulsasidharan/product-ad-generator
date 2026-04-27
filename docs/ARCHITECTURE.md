# Olivia — Full Architecture Design (Vercel Stack)

This document describes the **target production architecture** for the Olivia AI Product Ad Generator: hosting on **Vercel**, object storage on **Vercel Blob**, serverless API routes in **Next.js 14 (App Router)**, and **external AI / supporting services** where Vercel does not provide equivalents.

It is aligned with the current codebase layout (`app/`, `lib/`, `components/`), `vercel.json`, and project documentation. Use the Mermaid blocks directly in [Eraser.io](https://eraser.io) (Mermaid import or embedded diagram).

---

## 1. Executive summary

Olivia is a **browser-first** web application. The **Next.js** app serves the marketing home page, the **editor** workspace, and **Route Handlers** under `/api/*`. Heavy work (vision analysis, orchestration, image generation, image processing) runs in **Vercel Serverless Functions** with bounded timeouts. **Binary assets** (uploads, generated ads, intermediate PNGs) live on **Vercel Blob** with HTTPS URLs passed between client and APIs. **Anthropic Claude** provides multimodal reasoning and agent-style decisions; **Replicate** runs diffusion and optional background-removal models. **Upstash Redis** (optional but recommended in production) backs **sliding-window rate limiting** shared across serverless instances.

---

## 2. Design principles

| Principle | Implementation |
|-----------|----------------|
| Stateless API tier | No mandatory app database; generation and session state primarily client-held |
| Durable media | Vercel Blob for uploads and generated images referenced by URL |
| Long-running generation | `vercel.json` extends `maxDuration` for `/api/generate` (see repo config) |
| Streaming UX | `/api/iterate` returns **SSE** for incremental thinking and results |
| Defense in depth | Rate limits, CORS tied to `NEXT_PUBLIC_APP_URL`, CSP headers in `vercel.json`, Zod validation on inputs |
| Observability hooks | `GET /api/health` for capability flags; optional Vercel Analytics / Speed Insights (not required by code) |

---

## 3. Logical architecture layers

```mermaid
flowchart TB
  subgraph Client["Client tier (browser)"]
    UI["Next.js pages\n/ /editor /gallery"]
    RSC["React 18 + App Router"]
    Canvas["Fabric.js canvas"]
    Chat["Chat UI + SSE client"]
  end

  subgraph Vercel["Vercel platform"]
    CDN["Vercel Edge Network\n(static + SSR)"]
    Fn["Serverless functions\nRoute Handlers /api/*"]
    Blob["Vercel Blob\nobject storage"]
    MW["Middleware\n(next/server)"]
  end

  subgraph Data["Optional / supporting data plane"]
    Redis["Upstash Redis\nREST API"]
  end

  subgraph External["External AI & APIs (non-Vercel)"]
    Anthropic["Anthropic API\nClaude Vision + text"]
    Replicate["Replicate API\nFLUX / SDXL / rembg / optional Ideogram"]
    OpenAI["OpenAI API\noptional DALL-E / GPT"]
  end

  UI --> CDN
  CDN --> Fn
  Chat --> Fn
  Fn --> Blob
  Fn --> Anthropic
  Fn --> Replicate
  Fn --> OpenAI
  Fn --> Redis
  MW --> CDN
```

---

## 4. Vercel platform components (what runs where)

| Vercel capability | Role in Olivia |
|-------------------|----------------|
| **Vercel Hosting** | Git-connected deployments; preview + production URLs |
| **Next.js Runtime** | SSR/SSG pages, Server Components, client bundles |
| **Serverless Functions** | Each `app/api/**/route.ts` becomes a function; cold starts bounded by region (`vercel.json` → `iad1`) |
| **Vercel Blob** | `POST /api/upload`, `lib/blob-storage.ts` — product images, generated creatives, iterate outputs |
| **Edge CDN** | Static `_next/static` caching headers in `vercel.json` |
| **Middleware** | `middleware.ts` — lightweight request shaping (e.g. favicon redirect) |
| **Environment variables** | Secrets for Anthropic, Replicate, Blob token, optional Redis, `NEXT_PUBLIC_*` |
| **GitHub integration** | Push → build → deploy; CI/CD workflows in `.github/workflows/` |

**Optional Vercel add-ons** (not wired in code but common for submissions / production hardening):

- **Vercel Analytics** — traffic and Web Vitals  
- **Speed Insights** — real user performance  
- **Vercel KV** — alternative to Upstash for small key-value (not used in this repo today)

---

## 5. External services (AI & non-Vercel)

| Service | Responsibility |
|---------|----------------|
| **Anthropic** | Product image analysis, prompt orchestration, iteration interpretation, optional short streaming copy via AI SDK |
| **Replicate** | Image generation (FLUX Schnell / FLUX Pro, etc.), optional Ideogram routing, background removal models |
| **OpenAI** | Optional fallback image or text capabilities per `lib/ai/image-generator.ts` / env |
| **Upstash** | Redis-compatible HTTP API for **rate limiting** (`@upstash/ratelimit` + `@upstash/redis`); in-memory fallback when unset |

---

## 6. Application modules (code map)

```mermaid
flowchart LR
  subgraph Pages["app/"]
    P1["page.tsx"]
    P2["editor/page.tsx"]
    P3["gallery/page.tsx"]
  end

  subgraph APIs["app/api/"]
    A1["analyze"]
    A2["generate"]
    A3["iterate"]
    A4["upload"]
    A5["health"]
  end

  subgraph Lib["lib/"]
    L1["claude-agent.ts"]
    L2["image-generator.ts"]
    L3["blob-storage.ts"]
    L4["rate-limit.ts"]
    L5["image-utils.ts\nSharp"]
    L6["validation.ts\nZod"]
    L7["cors.ts"]
  end

  subgraph UI["components/"]
    U1["ProductUploader"]
    U2["PromptInput / ResultsGallery"]
    U3["ChatInterface"]
    U4["CanvasEditor"]
  end

  P2 --> U1 & U2 & U3 & U4
  P2 --> A2 & A3
  U1 --> A1 & A4
  U2 --> A2
  U3 --> A3
  A1 & A2 & A3 --> L1 & L2
  A2 & A3 & A4 --> L3
  A1 & A2 & A3 --> L4 & L6
  A3 --> L5
```

---

## 7. Deployment & CI/CD (repository automation)

```mermaid
flowchart LR
  Dev["Developer"]
  GH["GitHub\nrepository"]
  GHCI["GitHub Actions\nCI: lint, test, build"]
  GHCD["GitHub Actions\nCD: vercel build/deploy"]
  VC["Vercel\nproduction + previews"]

  Dev -->|push / PR| GH
  GH --> GHCI
  GH --> GHCD
  GHCD --> VC
  VC -->|env + Blob store| Fn2["Serverless + Blob"]
```

CI (`.github/workflows/ci.yml`): Node 20, `npm ci`, type-check, lint, unit tests, `npm run build` with secrets for build-time env.

CD (`.github/workflows/cd.yml`): build, `vercel pull` / `vercel build --prod` / `vercel deploy --prebuilt --prod` using `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

---

## 8. Runtime deployment view (Vercel-centric)

```mermaid
flowchart TB
  User((User browser))

  subgraph Edge["Vercel Edge Network"]
    Static["Static assets\n_next/static"]
    Pages["SSR / RSC pages"]
  end

  subgraph IAD["Serverless region iad1"]
    API_A["POST /api/analyze"]
    API_G["POST /api/generate\nmaxDuration: 180"]
    API_I["POST /api/iterate\nSSE stream"]
    API_U["POST /api/upload"]
    API_H["GET /api/health"]
  end

  Blob[(Vercel Blob)]

  User --> Edge
  Edge --> API_A & API_G & API_I & API_U & API_H
  API_A & API_G & API_I & API_U --> Blob
```

---

## 9. Data & asset flow

```mermaid
flowchart LR
  subgraph Inputs
    IMG["Product image\nbinary"]
  end

  subgraph Storage["Vercel Blob"]
    B1["uploads/*"]
    B2["generated/*"]
  end

  subgraph URLs["HTTPS URLs"]
    U1["imageUrl in JSON"]
  end

  IMG -->|POST /api/upload| B1
  B1 --> U1
  U1 -->|POST /api/analyze| Claude["Anthropic"]
  U1 -->|POST /api/generate| Rep["Replicate"]
  Rep -->|model output URL or buffer| B2
  B2 --> U1
  U1 -->|POST /api/iterate| Sharp["Sharp / image-utils"]
  Sharp --> B2
```

---

## 10. Sequence — Upload and analyse

```mermaid
sequenceDiagram
  actor User
  participant Browser
  participant Upload as POST /api/upload
  participant Blob as Vercel Blob
  participant Analyze as POST /api/analyze
  participant Claude as Anthropic API
  participant RL as Rate limiter

  User->>Browser: Select product image
  Browser->>Upload: multipart file
  Upload->>RL: check IP limit
  Upload->>Blob: put object
  Blob-->>Upload: public URL
  Upload-->>Browser: { url }

  Browser->>Analyze: JSON { imageUrl }
  Analyze->>RL: check IP limit
  Analyze->>Claude: vision + instructions
  Claude-->>Analyze: productType, attributes, suggestions
  Analyze-->>Browser: analysis + optional isolatedImageUrl
```

---

## 11. Sequence — Generate variants

```mermaid
sequenceDiagram
  actor User
  participant Browser
  participant Gen as POST /api/generate
  participant Agent as ClaudeAgent
  participant Img as ImageGenerator
  participant Rep as Replicate
  participant Blob as Vercel Blob
  participant RL as Rate limiter

  User->>Browser: Prompt + options
  Browser->>Gen: productImageUrl, userPrompt, context, variants...
  Gen->>RL: check IP limit
  Gen->>Agent: orchestrate / optimize (as implemented)
  Gen->>Img: generate per variant / model
  Img->>Rep: run model(s)
  Rep-->>Img: image URL(s) or output
  Img->>Blob: optional persist / pipeline steps
  Gen-->>Browser: JSON generations + metadata traceId
```

---

## 12. Sequence — Conversational refine (SSE)

```mermaid
sequenceDiagram
  actor User
  participant Browser
  participant It as POST /api/iterate
  participant Agent as ClaudeAgent
  participant Anth as Anthropic stream
  participant Img as Sharp / Replicate / Blob
  participant RL as Rate limiter

  User->>Browser: Refinement message
  Browser->>It: JSON + Accept stream
  It->>RL: check IP limit
  It->>Agent: interpretIteration + orchestrateAdPlan
  It->>Anth: optional short streamText
  Anth-->>Browser: SSE thinking chunks
  It-->>Browser: SSE action / status
  It->>Img: adjust / overlay / regenerate path
  Img-->>It: new image URL (Blob)
  It-->>Browser: SSE result imageUrl + explanation
```

---

## 13. Security & cross-cutting concerns

```mermaid
mindmap
  root((Olivia security))
    Transport
      HTTPS only to providers
      CSP in vercel.json
    Access control
      CORS via NEXT_PUBLIC_APP_URL
      No wildcard in production config goal
    Abuse prevention
      Upstash sliding window per IP
      In-memory fallback if Redis unset
    Validation
      Zod schemas per route
    Secrets
      Vercel env not in repo
      BLOB_READ_WRITE_TOKEN scoped to store
```

---

## 14. Component inventory (submission checklist)

| Component | Technology | Hosted by |
|-----------|------------|-----------|
| Web app | Next.js 14, TypeScript, React 18 | Vercel |
| Styling / UI | Tailwind, shadcn/ui, Framer Motion | Vercel (static) |
| Canvas | Fabric.js 7 | Browser |
| Product analysis API | Route Handler + Claude | Vercel Function → Anthropic |
| Generation API | Route Handler + Replicate + Claude | Vercel Function → Replicate / Anthropic |
| Iterate API | Route Handler, SSE | Vercel Function |
| Upload API | Route Handler + `@vercel/blob` | Vercel Function → Blob |
| Object storage | Vercel Blob | Vercel |
| Rate limiting | `@upstash/ratelimit` | Upstash (HTTP) |
| Image processing | `sharp`, custom utils | Vercel Function (memory/CPU limits apply) |
| Validation | `zod` | Bundled in function |
| Unit tests | Vitest | CI runner |
| E2E tests | Playwright | CI runner |
| Build / deploy | GitHub Actions + Vercel CLI | GitHub + Vercel |

---

## 15. Future architecture options (not in scope of current code)

These are **logical extensions** for coursework or v2:

- **Vercel Postgres / Neon** — user accounts, saved projects, billing  
- **Vercel KV** — server-side session or feature flags  
- **Queue / workflow** — Vercel does not provide a first-class job queue; **Inngest**, **Trigger.dev**, or **Cloudflare Queues** could offload long pipelines  
- **CDN caching** of third-party model URLs — careful TTL; prefer Blob as canonical store  

---

## 16. System context — portable flowchart (recommended for Eraser.io)

```mermaid
flowchart LR
  User((End user))

  subgraph Olivia["Olivia — Next.js on Vercel"]
    Web["Pages + API routes"]
    Store["Vercel Blob"]
  end

  Anthropic["Anthropic\nClaude"]
  Replicate["Replicate\nimage models"]
  Upstash["Upstash\nRedis"]
  OpenAI["OpenAI\noptional"]

  User <-->|HTTPS| Web
  Web <-->|read/write URLs| Store
  Web --> Anthropic
  Web --> Replicate
  Web --> Upstash
  Web -.-> OpenAI
```

### 16b. C4-style context (optional — requires C4 support in your renderer)

```mermaid
C4Context
  title System context — Olivia on Vercel

  Person(user, "End user", "Creates product ads in the browser")
  System(olivia, "Olivia web app", "Next.js on Vercel — editor, APIs, Blob integration")
  System_Ext(anthropic, "Anthropic", "Claude vision & reasoning APIs")
  System_Ext(replicate, "Replicate", "Hosted diffusion & image models")
  System_Ext(upstash, "Upstash Redis", "HTTP Redis for rate limits")
  System_Ext(openai, "OpenAI", "Optional APIs")

  Rel(user, olivia, "HTTPS")
  Rel(olivia, anthropic, "HTTPS API")
  Rel(olivia, replicate, "HTTPS API")
  Rel(olivia, upstash, "HTTPS REST")
  Rel(olivia, openai, "Optional HTTPS")
```

> If Eraser does not render **16b**, use **Section 16** or **Section 3** only.

---

## 17. Document control

| Field | Value |
|-------|--------|
| Product | Olivia — AI Product Ad Generator |
| Primary host | Vercel |
| Storage | Vercel Blob |
| Source of truth | Repository `README.md`, `vercel.json`, `app/`, `lib/` |
| Last updated | 2026-04-27 |

---

*End of architecture document.*
