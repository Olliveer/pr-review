# PR Review MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Bitbucket Cloud CLI + webhook that reviews PRs with Vercel AI SDK (OpenRouter/Ollama) and posts a general comment plus inline comments.

**Architecture:** Shared `ReviewService` orchestrates `BitbucketService` (fetch + post) and `AIService` (`generateText` + `Output.object` via AI SDK). Fastify exposes `POST /webhooks/bitbucket`; CLI parses a PR URL and calls the same service.

**Tech Stack:** Node.js 22+, TypeScript, Fastify, Axios, Zod, Vitest, `ai` (Vercel AI SDK), `@openrouter/ai-sdk-provider`, `ollama-ai-provider-v2`, `dotenv`

**Spec:** `docs/superpowers/specs/2026-07-09-pr-review-mvp-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `package.json` | Scripts, deps, `bin` for CLI |
| `tsconfig.json` | Strict TS, NodeNext |
| `vitest.config.ts` | Test runner |
| `.env.example` | Documented env vars |
| `src/config/env.ts` | Zod-validated env |
| `src/types/review.ts` | `ReviewContext`, shared types |
| `src/services/ai/schemas/review.schema.ts` | Zod schema for AI output |
| `src/services/ai/prompts/prompt-builder.ts` | Build system/user prompts |
| `src/services/ai/provider.factory.ts` | OpenRouter / Ollama model |
| `src/services/ai/ai.service.ts` | Call AI SDK + retries |
| `src/services/bitbucket/url.ts` | Parse Bitbucket PR URLs |
| `src/services/bitbucket/bitbucket.service.ts` | REST client |
| `src/services/bitbucket/format-comment.ts` | Markdown for general comment |
| `src/services/review/review.service.ts` | Orchestration |
| `src/cli/index.ts` | CLI entry |
| `src/server/app.ts` | Fastify app factory |
| `src/server/routes/webhooks.bitbucket.ts` | Webhook route |
| `src/server/index.ts` | Server bootstrap |
| `tests/**` | Vitest unit/integration tests |

---

### Task 1: Scaffold project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "pr-review",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "pr-review": "./dist/cli/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev:cli": "tsx src/cli/index.ts",
    "dev:server": "tsx src/server/index.ts",
    "start": "node dist/server/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "engines": {
    "node": ">=22"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Create `.gitignore`**

```gitignore
node_modules/
dist/
.env
coverage/
*.log
.DS_Store
```

- [ ] **Step 5: Create `.env.example`**

```env
BITBUCKET_USERNAME=
BITBUCKET_APP_PASSWORD=
BITBUCKET_WEBHOOK_SECRET=

AI_PROVIDER=openrouter
AI_MODEL=anthropic/claude-sonnet-4

OPENROUTER_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434

PORT=3000
MAX_DIFF_CHARS=80000
```

- [ ] **Step 6: Install dependencies**

```bash
npm install ai zod axios fastify @openrouter/ai-sdk-provider ollama-ai-provider-v2 dotenv
npm install -D typescript tsx vitest @types/node
```

Expected: `package-lock.json` created, no peer dependency errors that block install.

- [ ] **Step 7: Update `README.md` with minimal usage**

```md
# pr-review

Bitbucket Cloud PR reviewer powered by Vercel AI SDK.

## Setup

1. Copy `.env.example` to `.env` and fill values.
2. `npm install`
3. CLI: `npm run dev:cli -- https://bitbucket.org/{workspace}/{repo}/pull-requests/{id}`
4. Webhook server: `npm run dev:server` then point Bitbucket webhook to `POST /webhooks/bitbucket`
```

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore .env.example README.md
git commit -m "chore: scaffold pr-review MVP project"
```

---

### Task 2: Env config + shared types

**Files:**
- Create: `src/config/env.ts`
- Create: `src/types/review.ts`
- Create: `tests/config/env.test.ts`

- [ ] **Step 1: Write failing env test**

```ts
// tests/config/env.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { loadEnv } from "../../src/config/env.js";

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("loadEnv", () => {
  it("loads openrouter config", () => {
    process.env = {
      ...ORIGINAL,
      BITBUCKET_USERNAME: "user",
      BITBUCKET_APP_PASSWORD: "pass",
      BITBUCKET_WEBHOOK_SECRET: "secret",
      AI_PROVIDER: "openrouter",
      AI_MODEL: "anthropic/claude-sonnet-4",
      OPENROUTER_API_KEY: "sk-test",
    };

    const env = loadEnv();
    expect(env.AI_PROVIDER).toBe("openrouter");
    expect(env.OPENROUTER_API_KEY).toBe("sk-test");
    expect(env.MAX_DIFF_CHARS).toBe(80000);
  });

  it("requires OPENROUTER_API_KEY when provider is openrouter", () => {
    process.env = {
      ...ORIGINAL,
      BITBUCKET_USERNAME: "user",
      BITBUCKET_APP_PASSWORD: "pass",
      BITBUCKET_WEBHOOK_SECRET: "secret",
      AI_PROVIDER: "openrouter",
      AI_MODEL: "anthropic/claude-sonnet-4",
    };
    delete process.env.OPENROUTER_API_KEY;

    expect(() => loadEnv()).toThrow();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run tests/config/env.test.ts
```

Expected: FAIL — `loadEnv` not found / cannot resolve module.

- [ ] **Step 3: Implement types + env**

```ts
// src/types/review.ts
export type Severity = "info" | "warning" | "critical";

export interface InlineComment {
  path: string;
  line: number;
  severity: Severity;
  body: string;
}

export interface ReviewResult {
  summary: string;
  risks: string[];
  suggestions: string[];
  inlineComments: InlineComment[];
}

export interface ReviewContext {
  workspace: string;
  repoSlug: string;
  pullRequestId: number;
  title: string;
  description: string;
  author: string;
  sourceBranch: string;
  destinationBranch: string;
  diff: string;
  truncated: boolean;
}
```

```ts
// src/config/env.ts
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

const baseSchema = z.object({
  BITBUCKET_USERNAME: z.string().min(1),
  BITBUCKET_APP_PASSWORD: z.string().min(1),
  BITBUCKET_WEBHOOK_SECRET: z.string().min(1),
  AI_PROVIDER: z.enum(["openrouter", "ollama"]),
  AI_MODEL: z.string().min(1),
  OPENROUTER_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434"),
  PORT: z.coerce.number().int().positive().default(3000),
  MAX_DIFF_CHARS: z.coerce.number().int().positive().default(80_000),
});

export type Env = z.infer<typeof baseSchema>;

export function loadEnv(env: NodeJS.ProcessEnv = process.env): Env {
  const parsed = baseSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }

  const value = parsed.data;
  if (value.AI_PROVIDER === "openrouter" && !value.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is required when AI_PROVIDER=openrouter");
  }
  return value;
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run tests/config/env.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config/env.ts src/types/review.ts tests/config/env.test.ts
git commit -m "feat: add env validation and review types"
```

---

### Task 3: Review Zod schema + Bitbucket URL parser

**Files:**
- Create: `src/services/ai/schemas/review.schema.ts`
- Create: `src/services/bitbucket/url.ts`
- Create: `tests/services/ai/review.schema.test.ts`
- Create: `tests/services/bitbucket/url.test.ts`

- [ ] **Step 1: Write failing schema + URL tests**

```ts
// tests/services/ai/review.schema.test.ts
import { describe, expect, it } from "vitest";
import { reviewResultSchema } from "../../../src/services/ai/schemas/review.schema.js";

describe("reviewResultSchema", () => {
  it("accepts a valid review payload", () => {
    const parsed = reviewResultSchema.parse({
      summary: "Looks good overall",
      risks: ["Missing tests"],
      suggestions: ["Add unit tests"],
      inlineComments: [
        {
          path: "src/app.ts",
          line: 12,
          severity: "warning",
          body: "Handle null",
        },
      ],
    });
    expect(parsed.inlineComments).toHaveLength(1);
  });

  it("rejects invalid severity", () => {
    expect(() =>
      reviewResultSchema.parse({
        summary: "x",
        risks: [],
        suggestions: [],
        inlineComments: [
          { path: "a.ts", line: 1, severity: "low", body: "x" },
        ],
      }),
    ).toThrow();
  });
});
```

```ts
// tests/services/bitbucket/url.test.ts
import { describe, expect, it } from "vitest";
import { parseBitbucketPrUrl } from "../../../src/services/bitbucket/url.js";

describe("parseBitbucketPrUrl", () => {
  it("parses a standard Cloud PR URL", () => {
    const result = parseBitbucketPrUrl(
      "https://bitbucket.org/acme/api/pull-requests/42",
    );
    expect(result).toEqual({
      workspace: "acme",
      repoSlug: "api",
      pullRequestId: 42,
    });
  });

  it("throws on invalid URL", () => {
    expect(() => parseBitbucketPrUrl("https://github.com/acme/api/pull/1")).toThrow(
      /bitbucket/i,
    );
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run tests/services/ai/review.schema.test.ts tests/services/bitbucket/url.test.ts
```

Expected: FAIL — modules missing.

- [ ] **Step 3: Implement schema + URL parser**

```ts
// src/services/ai/schemas/review.schema.ts
import { z } from "zod";

export const reviewResultSchema = z.object({
  summary: z.string().min(1),
  risks: z.array(z.string()),
  suggestions: z.array(z.string()),
  inlineComments: z.array(
    z.object({
      path: z.string().min(1),
      line: z.number().int().positive(),
      severity: z.enum(["info", "warning", "critical"]),
      body: z.string().min(1),
    }),
  ),
});

export type ReviewResultSchema = z.infer<typeof reviewResultSchema>;
```

```ts
// src/services/bitbucket/url.ts
export interface BitbucketPrRef {
  workspace: string;
  repoSlug: string;
  pullRequestId: number;
}

const PR_PATH =
  /^\/(?<workspace>[^/]+)\/(?<repoSlug>[^/]+)\/pull-requests\/(?<id>\d+)\/?$/;

export function parseBitbucketPrUrl(raw: string): BitbucketPrRef {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }

  if (!url.hostname.endsWith("bitbucket.org")) {
    throw new Error(`Not a Bitbucket Cloud URL: ${raw}`);
  }

  const match = PR_PATH.exec(url.pathname);
  if (!match?.groups) {
    throw new Error(
      `Expected path /{workspace}/{repo}/pull-requests/{id}, got: ${url.pathname}`,
    );
  }

  return {
    workspace: match.groups.workspace,
    repoSlug: match.groups.repoSlug,
    pullRequestId: Number(match.groups.id),
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run tests/services/ai/review.schema.test.ts tests/services/bitbucket/url.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/ai/schemas/review.schema.ts src/services/bitbucket/url.ts tests/services/ai/review.schema.test.ts tests/services/bitbucket/url.test.ts
git commit -m "feat: add review schema and Bitbucket URL parser"
```

---

### Task 4: Prompt builder + comment formatter

**Files:**
- Create: `src/services/ai/prompts/prompt-builder.ts`
- Create: `src/services/bitbucket/format-comment.ts`
- Create: `tests/services/ai/prompt-builder.test.ts`
- Create: `tests/services/bitbucket/format-comment.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/services/ai/prompt-builder.test.ts
import { describe, expect, it } from "vitest";
import { buildReviewPrompt } from "../../../src/services/ai/prompts/prompt-builder.js";
import type { ReviewContext } from "../../../src/types/review.js";

const ctx: ReviewContext = {
  workspace: "acme",
  repoSlug: "api",
  pullRequestId: 1,
  title: "Add auth",
  description: "JWT login",
  author: "jose",
  sourceBranch: "feat/auth",
  destinationBranch: "main",
  diff: "diff --git a/a.ts b/a.ts\n+console.log(1)",
  truncated: false,
};

describe("buildReviewPrompt", () => {
  it("includes PR metadata and diff", () => {
    const { system, user } = buildReviewPrompt(ctx);
    expect(system).toMatch(/code review/i);
    expect(user).toContain("Add auth");
    expect(user).toContain("feat/auth");
    expect(user).toContain("console.log(1)");
  });

  it("mentions truncation when truncated", () => {
    const { user } = buildReviewPrompt({ ...ctx, truncated: true });
    expect(user).toMatch(/truncated/i);
  });
});
```

```ts
// tests/services/bitbucket/format-comment.test.ts
import { describe, expect, it } from "vitest";
import { formatGeneralComment } from "../../../src/services/bitbucket/format-comment.js";

describe("formatGeneralComment", () => {
  it("renders summary, risks, and suggestions", () => {
    const md = formatGeneralComment({
      summary: "Solid change",
      risks: ["No tests"],
      suggestions: ["Add coverage"],
      inlineComments: [],
    });
    expect(md).toContain("## Summary");
    expect(md).toContain("Solid change");
    expect(md).toContain("## Risks");
    expect(md).toContain("No tests");
    expect(md).toContain("## Suggestions");
    expect(md).toContain("Add coverage");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run tests/services/ai/prompt-builder.test.ts tests/services/bitbucket/format-comment.test.ts
```

Expected: FAIL — modules missing.

- [ ] **Step 3: Implement**

```ts
// src/services/ai/prompts/prompt-builder.ts
import type { ReviewContext } from "../../../types/review.js";

export function buildReviewPrompt(context: ReviewContext): {
  system: string;
  user: string;
} {
  const system = [
    "You are a senior software engineer performing a pull request code review.",
    "Focus on bugs, security, regressions, missing tests, and clarity.",
    "Return only structured fields matching the schema.",
    "Inline comments must reference paths and line numbers present in the new (destination) side of the diff.",
    "Prefer fewer high-signal inline comments over noise.",
  ].join(" ");

  const user = [
    `Workspace: ${context.workspace}`,
    `Repository: ${context.repoSlug}`,
    `PR #${context.pullRequestId}`,
    `Title: ${context.title}`,
    `Author: ${context.author}`,
    `Source branch: ${context.sourceBranch}`,
    `Destination branch: ${context.destinationBranch}`,
    `Description:\n${context.description || "(none)"}`,
    context.truncated
      ? "NOTE: The diff below was truncated due to size limits."
      : null,
    "Diff:",
    context.diff,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user };
}
```

```ts
// src/services/bitbucket/format-comment.ts
import type { ReviewResult } from "../../types/review.js";

export function formatGeneralComment(result: ReviewResult): string {
  const risks =
    result.risks.length > 0
      ? result.risks.map((r) => `- ${r}`).join("\n")
      : "- None noted";
  const suggestions =
    result.suggestions.length > 0
      ? result.suggestions.map((s) => `- ${s}`).join("\n")
      : "- None noted";

  return [
    "## Summary",
    result.summary,
    "",
    "## Risks",
    risks,
    "",
    "## Suggestions",
    suggestions,
    "",
    "_Automated review by pr-review_",
  ].join("\n");
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run tests/services/ai/prompt-builder.test.ts tests/services/bitbucket/format-comment.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/ai/prompts/prompt-builder.ts src/services/bitbucket/format-comment.ts tests/services/ai/prompt-builder.test.ts tests/services/bitbucket/format-comment.test.ts
git commit -m "feat: add prompt builder and general comment formatter"
```

---

### Task 5: Provider factory

**Files:**
- Create: `src/services/ai/provider.factory.ts`
- Create: `tests/services/ai/provider.factory.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/services/ai/provider.factory.test.ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: vi.fn(() => {
    const fn = vi.fn((model: string) => ({ provider: "openrouter", model }));
    return Object.assign(fn, { chat: fn });
  }),
}));

vi.mock("ollama-ai-provider-v2", () => ({
  createOllama: vi.fn(() => {
    const fn = vi.fn((model: string) => ({ provider: "ollama", model }));
    return Object.assign(fn, { chat: fn });
  }),
}));

import { createModel } from "../../../src/services/ai/provider.factory.js";

describe("createModel", () => {
  it("creates an openrouter model", () => {
    const model = createModel({
      AI_PROVIDER: "openrouter",
      AI_MODEL: "anthropic/claude-sonnet-4",
      OPENROUTER_API_KEY: "sk-test",
      OLLAMA_BASE_URL: "http://localhost:11434",
    });
    expect(model).toMatchObject({
      provider: "openrouter",
      model: "anthropic/claude-sonnet-4",
    });
  });

  it("creates an ollama model", () => {
    const model = createModel({
      AI_PROVIDER: "ollama",
      AI_MODEL: "qwen3:32b",
      OLLAMA_BASE_URL: "http://localhost:11434",
    });
    expect(model).toMatchObject({ provider: "ollama", model: "qwen3:32b" });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run tests/services/ai/provider.factory.test.ts
```

Expected: FAIL — `createModel` missing.

- [ ] **Step 3: Implement factory**

```ts
// src/services/ai/provider.factory.ts
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama } from "ollama-ai-provider-v2";
import type { LanguageModel } from "ai";

export interface ProviderConfig {
  AI_PROVIDER: "openrouter" | "ollama";
  AI_MODEL: string;
  OPENROUTER_API_KEY?: string;
  OLLAMA_BASE_URL: string;
}

export function createModel(config: ProviderConfig): LanguageModel {
  if (config.AI_PROVIDER === "openrouter") {
    if (!config.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is required for openrouter");
    }
    const openrouter = createOpenRouter({
      apiKey: config.OPENROUTER_API_KEY,
    });
    return openrouter(config.AI_MODEL);
  }

  const ollama = createOllama({
    baseURL: config.OLLAMA_BASE_URL,
  });
  return ollama(config.AI_MODEL);
}
```

Note: If `LanguageModel` import path differs in the installed `ai` version, use the return type inferred from the provider call (`ReturnType`) instead — keep the factory returning whatever the AI SDK accepts as `model`.

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run tests/services/ai/provider.factory.test.ts
```

Expected: PASS (adjust mock shape if provider packages export differently).

- [ ] **Step 5: Commit**

```bash
git add src/services/ai/provider.factory.ts tests/services/ai/provider.factory.test.ts
git commit -m "feat: add AI provider factory for OpenRouter and Ollama"
```

---

### Task 6: AIService

**Files:**
- Create: `src/services/ai/ai.service.ts`
- Create: `tests/services/ai/ai.service.test.ts`

- [ ] **Step 1: Write failing test with mocked `ai` module**

```ts
// tests/services/ai/ai.service.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const generateText = vi.fn();

vi.mock("ai", () => ({
  generateText,
  Output: {
    object: (args: unknown) => args,
  },
}));

vi.mock("../../../src/services/ai/provider.factory.js", () => ({
  createModel: vi.fn(() => ({ mocked: true })),
}));

import { AIService } from "../../../src/services/ai/ai.service.js";
import type { ReviewContext } from "../../../src/types/review.js";

const ctx: ReviewContext = {
  workspace: "acme",
  repoSlug: "api",
  pullRequestId: 1,
  title: "t",
  description: "d",
  author: "a",
  sourceBranch: "s",
  destinationBranch: "main",
  diff: "+x",
  truncated: false,
};

describe("AIService", () => {
  beforeEach(() => {
    generateText.mockReset();
  });

  it("returns structured review output", async () => {
    generateText.mockResolvedValue({
      output: {
        summary: "ok",
        risks: [],
        suggestions: ["nits"],
        inlineComments: [],
      },
    });

    const service = new AIService({
      AI_PROVIDER: "ollama",
      AI_MODEL: "qwen3:32b",
      OLLAMA_BASE_URL: "http://localhost:11434",
    });

    const result = await service.review(ctx);
    expect(result.summary).toBe("ok");
    expect(generateText).toHaveBeenCalledOnce();
  });

  it("retries when output is null then succeeds", async () => {
    generateText
      .mockResolvedValueOnce({ output: null })
      .mockResolvedValueOnce({
        output: {
          summary: "retry-ok",
          risks: [],
          suggestions: [],
          inlineComments: [],
        },
      });

    const service = new AIService({
      AI_PROVIDER: "ollama",
      AI_MODEL: "qwen3:32b",
      OLLAMA_BASE_URL: "http://localhost:11434",
    });

    const result = await service.review(ctx);
    expect(result.summary).toBe("retry-ok");
    expect(generateText).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run tests/services/ai/ai.service.test.ts
```

Expected: FAIL — `AIService` missing.

- [ ] **Step 3: Implement AIService**

Use current AI SDK structured output API (`generateText` + `Output.object`), which supersedes older `generateObject` naming in the design spec.

```ts
// src/services/ai/ai.service.ts
import { generateText, Output } from "ai";
import type { ReviewContext, ReviewResult } from "../../types/review.js";
import { buildReviewPrompt } from "./prompts/prompt-builder.js";
import { createModel, type ProviderConfig } from "./provider.factory.js";
import { reviewResultSchema } from "./schemas/review.schema.js";

const MAX_ATTEMPTS = 3; // initial + 2 retries

export class AIService {
  constructor(private readonly config: ProviderConfig) {}

  async review(context: ReviewContext): Promise<ReviewResult> {
    const model = createModel(this.config);
    const { system, user } = buildReviewPrompt(context);
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const { output } = await generateText({
          model,
          system,
          prompt: user,
          output: Output.object({ schema: reviewResultSchema }),
        });

        if (!output) {
          throw new Error("Model returned empty structured output");
        }

        return reviewResultSchema.parse(output);
      } catch (error) {
        lastError = error;
        if (attempt === MAX_ATTEMPTS) break;
      }
    }

    throw new Error(
      `AI review failed after ${MAX_ATTEMPTS} attempts: ${String(lastError)}`,
    );
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run tests/services/ai/ai.service.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/ai/ai.service.ts tests/services/ai/ai.service.test.ts
git commit -m "feat: add AIService with structured output and retries"
```

---

### Task 7: BitbucketService

**Files:**
- Create: `src/services/bitbucket/bitbucket.service.ts`
- Create: `tests/services/bitbucket/bitbucket.service.test.ts`

- [ ] **Step 1: Write failing tests with mocked axios**

```ts
// tests/services/bitbucket/bitbucket.service.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const post = vi.fn();

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => ({ get, post })),
  },
}));

import { BitbucketService } from "../../../src/services/bitbucket/bitbucket.service.js";

describe("BitbucketService", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  it("fetches PR context and truncates large diffs", async () => {
    get
      .mockResolvedValueOnce({
        data: {
          id: 7,
          title: "Fix bug",
          description: "details",
          author: { display_name: "Jose" },
          source: { branch: { name: "fix" } },
          destination: { branch: { name: "main" } },
        },
      })
      .mockResolvedValueOnce({
        data: "x".repeat(100),
      });

    const service = new BitbucketService({
      username: "user",
      appPassword: "pass",
      maxDiffChars: 50,
    });

    const ctx = await service.fetchReviewContext({
      workspace: "acme",
      repoSlug: "api",
      pullRequestId: 7,
    });

    expect(ctx.title).toBe("Fix bug");
    expect(ctx.truncated).toBe(true);
    expect(ctx.diff.length).toBe(50);
  });

  it("posts general and inline comments; continues if inline fails", async () => {
    post
      .mockResolvedValueOnce({ data: { id: 1 } })
      .mockRejectedValueOnce(new Error("bad line"));

    const service = new BitbucketService({
      username: "user",
      appPassword: "pass",
      maxDiffChars: 80_000,
    });

    const result = await service.postReview(
      { workspace: "acme", repoSlug: "api", pullRequestId: 7 },
      {
        summary: "ok",
        risks: [],
        suggestions: [],
        inlineComments: [
          { path: "a.ts", line: 3, severity: "info", body: "nit" },
        ],
      },
    );

    expect(result.generalPosted).toBe(true);
    expect(result.inlinePosted).toBe(0);
    expect(result.inlineFailed).toBe(1);
    expect(post).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run tests/services/bitbucket/bitbucket.service.test.ts
```

Expected: FAIL — service missing.

- [ ] **Step 3: Implement BitbucketService**

```ts
// src/services/bitbucket/bitbucket.service.ts
import axios, { type AxiosInstance } from "axios";
import type { ReviewContext, ReviewResult } from "../../types/review.js";
import { formatGeneralComment } from "./format-comment.js";
import type { BitbucketPrRef } from "./url.js";

export interface BitbucketConfig {
  username: string;
  appPassword: string;
  maxDiffChars: number;
}

export interface PostReviewResult {
  generalPosted: boolean;
  inlinePosted: number;
  inlineFailed: number;
}

export class BitbucketService {
  private readonly http: AxiosInstance;

  constructor(private readonly config: BitbucketConfig) {
    this.http = axios.create({
      baseURL: "https://api.bitbucket.org/2.0",
      auth: {
        username: config.username,
        password: config.appPassword,
      },
      headers: { Accept: "application/json" },
    });
  }

  async fetchReviewContext(ref: BitbucketPrRef): Promise<ReviewContext> {
    const prPath = `/repositories/${ref.workspace}/${ref.repoSlug}/pullrequests/${ref.pullRequestId}`;
    const { data: pr } = await this.http.get(prPath);
    const { data: diff } = await this.http.get(`${prPath}/diff`, {
      responseType: "text",
      transformResponse: [(d) => d],
      headers: { Accept: "text/plain" },
    });

    const rawDiff = typeof diff === "string" ? diff : String(diff);
    const truncated = rawDiff.length > this.config.maxDiffChars;
    const clipped = truncated
      ? rawDiff.slice(0, this.config.maxDiffChars)
      : rawDiff;

    return {
      workspace: ref.workspace,
      repoSlug: ref.repoSlug,
      pullRequestId: ref.pullRequestId,
      title: pr.title ?? "",
      description: pr.description ?? "",
      author: pr.author?.display_name ?? pr.author?.nickname ?? "unknown",
      sourceBranch: pr.source?.branch?.name ?? "",
      destinationBranch: pr.destination?.branch?.name ?? "",
      diff: clipped,
      truncated,
    };
  }

  async postReview(
    ref: BitbucketPrRef,
    result: ReviewResult,
  ): Promise<PostReviewResult> {
    const commentsPath = `/repositories/${ref.workspace}/${ref.repoSlug}/pullrequests/${ref.pullRequestId}/comments`;

    await this.http.post(commentsPath, {
      content: { raw: formatGeneralComment(result) },
    });

    let inlinePosted = 0;
    let inlineFailed = 0;

    for (const comment of result.inlineComments) {
      try {
        await this.http.post(commentsPath, {
          content: {
            raw: `**${comment.severity}:** ${comment.body}`,
          },
          inline: {
            path: comment.path,
            to: comment.line,
          },
        });
        inlinePosted += 1;
      } catch (error) {
        inlineFailed += 1;
        console.error(
          `Failed inline comment ${comment.path}:${comment.line}`,
          error,
        );
      }
    }

    return { generalPosted: true, inlinePosted, inlineFailed };
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run tests/services/bitbucket/bitbucket.service.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/bitbucket/bitbucket.service.ts tests/services/bitbucket/bitbucket.service.test.ts
git commit -m "feat: add BitbucketService for PR fetch and comments"
```

---

### Task 8: ReviewService (orchestration)

**Files:**
- Create: `src/services/review/review.service.ts`
- Create: `tests/services/review/review.service.test.ts`

- [ ] **Step 1: Write failing integration-style unit test**

```ts
// tests/services/review/review.service.test.ts
import { describe, expect, it, vi } from "vitest";
import { ReviewService } from "../../../src/services/review/review.service.js";
import type { ReviewContext, ReviewResult } from "../../../src/types/review.js";

describe("ReviewService", () => {
  it("fetches, reviews, and posts", async () => {
    const context: ReviewContext = {
      workspace: "acme",
      repoSlug: "api",
      pullRequestId: 9,
      title: "t",
      description: "d",
      author: "a",
      sourceBranch: "s",
      destinationBranch: "main",
      diff: "+x",
      truncated: false,
    };
    const review: ReviewResult = {
      summary: "ok",
      risks: [],
      suggestions: [],
      inlineComments: [],
    };

    const bitbucket = {
      fetchReviewContext: vi.fn().mockResolvedValue(context),
      postReview: vi.fn().mockResolvedValue({
        generalPosted: true,
        inlinePosted: 0,
        inlineFailed: 0,
      }),
    };
    const ai = {
      review: vi.fn().mockResolvedValue(review),
    };

    const service = new ReviewService(bitbucket as never, ai as never);
    const result = await service.reviewPullRequest({
      workspace: "acme",
      repoSlug: "api",
      pullRequestId: 9,
    });

    expect(bitbucket.fetchReviewContext).toHaveBeenCalledOnce();
    expect(ai.review).toHaveBeenCalledWith(context);
    expect(bitbucket.postReview).toHaveBeenCalledWith(
      { workspace: "acme", repoSlug: "api", pullRequestId: 9 },
      review,
    );
    expect(result.review.summary).toBe("ok");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run tests/services/review/review.service.test.ts
```

Expected: FAIL — `ReviewService` missing.

- [ ] **Step 3: Implement**

```ts
// src/services/review/review.service.ts
import type { AIService } from "../ai/ai.service.js";
import type {
  BitbucketService,
  PostReviewResult,
} from "../bitbucket/bitbucket.service.js";
import type { BitbucketPrRef } from "../bitbucket/url.js";
import type { ReviewResult } from "../../types/review.js";

export interface ReviewRunResult {
  review: ReviewResult;
  posting: PostReviewResult;
}

export class ReviewService {
  constructor(
    private readonly bitbucket: BitbucketService,
    private readonly ai: AIService,
  ) {}

  async reviewPullRequest(ref: BitbucketPrRef): Promise<ReviewRunResult> {
    const context = await this.bitbucket.fetchReviewContext(ref);
    const review = await this.ai.review(context);
    const posting = await this.bitbucket.postReview(ref, review);
    return { review, posting };
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run tests/services/review/review.service.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/review/review.service.ts tests/services/review/review.service.test.ts
git commit -m "feat: add ReviewService orchestration"
```

---

### Task 9: CLI entrypoint

**Files:**
- Create: `src/cli/index.ts`
- Create: `tests/cli/parse-args.test.ts` (optional thin wrapper if needed)
- Create: `src/app/create-review-service.ts` (shared wiring for CLI + server)

- [ ] **Step 1: Create shared factory**

```ts
// src/app/create-review-service.ts
import { loadEnv } from "../config/env.js";
import { AIService } from "../services/ai/ai.service.js";
import { BitbucketService } from "../services/bitbucket/bitbucket.service.js";
import { ReviewService } from "../services/review/review.service.js";

export function createReviewServiceFromEnv() {
  const env = loadEnv();
  const bitbucket = new BitbucketService({
    username: env.BITBUCKET_USERNAME,
    appPassword: env.BITBUCKET_APP_PASSWORD,
    maxDiffChars: env.MAX_DIFF_CHARS,
  });
  const ai = new AIService({
    AI_PROVIDER: env.AI_PROVIDER,
    AI_MODEL: env.AI_MODEL,
    OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
    OLLAMA_BASE_URL: env.OLLAMA_BASE_URL,
  });
  return { env, reviewService: new ReviewService(bitbucket, ai) };
}
```

- [ ] **Step 2: Implement CLI**

```ts
// src/cli/index.ts
#!/usr/bin/env node
import { createReviewServiceFromEnv } from "../app/create-review-service.js";
import { parseBitbucketPrUrl } from "../services/bitbucket/url.js";

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: pr-review <bitbucket-pr-url>");
    process.exit(1);
  }

  const ref = parseBitbucketPrUrl(url);
  console.log(
    `Reviewing ${ref.workspace}/${ref.repoSlug}#${ref.pullRequestId}...`,
  );

  const { reviewService } = createReviewServiceFromEnv();
  const result = await reviewService.reviewPullRequest(ref);

  console.log("\n--- Summary ---");
  console.log(result.review.summary);
  console.log(
    `\nPosted: general=${result.posting.generalPosted} inline=${result.posting.inlinePosted} failedInline=${result.posting.inlineFailed}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 3: Smoke-check TypeScript compile of CLI wiring**

```bash
npx tsc --noEmit || true
npx vitest run
```

Expected: all existing tests PASS. Fix any type errors before continuing.

- [ ] **Step 4: Commit**

```bash
git add src/app/create-review-service.ts src/cli/index.ts
git commit -m "feat: add CLI entrypoint for Bitbucket PR reviews"
```

---

### Task 10: Fastify webhook server

**Files:**
- Create: `src/server/app.ts`
- Create: `src/server/routes/webhooks.bitbucket.ts`
- Create: `src/server/index.ts`
- Create: `tests/server/webhooks.bitbucket.test.ts`

- [ ] **Step 1: Write failing webhook tests**

```ts
// tests/server/webhooks.bitbucket.test.ts
import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { registerBitbucketWebhook } from "../../src/server/routes/webhooks.bitbucket.js";

function sign(secret: string, rawBody: string): string {
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
  return `sha256=${digest}`;
}

describe("POST /webhooks/bitbucket", () => {
  it("returns 401 on invalid signature", async () => {
    const app = Fastify();
    const review = vi.fn();
    await registerBitbucketWebhook(app, {
      webhookSecret: "secret",
      reviewPullRequest: review,
    });

    const res = await app.inject({
      method: "POST",
      url: "/webhooks/bitbucket",
      headers: {
        "content-type": "application/json",
        "x-event-key": "pullrequest:created",
        "x-hub-signature": "sha256=deadbeef",
      },
      payload: { pullrequest: { id: 1 } },
    });

    expect(res.statusCode).toBe(401);
    expect(review).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 202 and triggers review for PR events", async () => {
    const app = Fastify();
    const review = vi.fn().mockResolvedValue(undefined);
    await registerBitbucketWebhook(app, {
      webhookSecret: "secret",
      reviewPullRequest: review,
    });

    const payload = {
      repository: {
        workspace: { slug: "acme" },
        name: "api",
      },
      pullrequest: { id: 42 },
    };
    const raw = JSON.stringify(payload);

    const res = await app.inject({
      method: "POST",
      url: "/webhooks/bitbucket",
      headers: {
        "content-type": "application/json",
        "x-event-key": "pullrequest:updated",
        "x-hub-signature": sign("secret", raw),
      },
      payload: raw,
    });

    expect(res.statusCode).toBe(202);
    await new Promise((r) => setTimeout(r, 20));
    expect(review).toHaveBeenCalledWith({
      workspace: "acme",
      repoSlug: "api",
      pullRequestId: 42,
    });
    await app.close();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run tests/server/webhooks.bitbucket.test.ts
```

Expected: FAIL — route module missing.

- [ ] **Step 3: Implement webhook route + app**

Bitbucket Cloud sends `X-Hub-Signature: sha256=<hmac>` when a webhook secret is configured. Validate against the raw body.

```ts
// src/server/routes/webhooks.bitbucket.ts
import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { BitbucketPrRef } from "../../services/bitbucket/url.js";

export interface WebhookDeps {
  webhookSecret: string;
  reviewPullRequest: (ref: BitbucketPrRef) => Promise<unknown>;
}

function isValidSignature(
  secret: string,
  rawBody: string,
  header: string | undefined,
): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = header.slice("sha256=".length);
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(provided, "hex"),
    );
  } catch {
    return false;
  }
}

export async function registerBitbucketWebhook(
  app: FastifyInstance,
  deps: WebhookDeps,
): Promise<void> {
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      try {
        const raw = typeof body === "string" ? body : body.toString("utf8");
        (req as { rawBody?: string }).rawBody = raw;
        done(null, JSON.parse(raw));
      } catch (error) {
        done(error as Error, undefined);
      }
    },
  );

  app.post("/webhooks/bitbucket", async (request, reply) => {
    const rawBody = (request as { rawBody?: string }).rawBody ?? "";
    const signature = request.headers["x-hub-signature"];
    if (
      !isValidSignature(
        deps.webhookSecret,
        rawBody,
        Array.isArray(signature) ? signature[0] : signature,
      )
    ) {
      return reply.code(401).send({ error: "invalid signature" });
    }

    const event = request.headers["x-event-key"];
    const eventKey = Array.isArray(event) ? event[0] : event;
    if (
      eventKey !== "pullrequest:created" &&
      eventKey !== "pullrequest:updated"
    ) {
      return reply.code(202).send({ ignored: true, event: eventKey });
    }

    const body = request.body as {
      repository?: {
        workspace?: { slug?: string };
        name?: string;
        full_name?: string;
      };
      pullrequest?: { id?: number };
    };

    const workspace = body.repository?.workspace?.slug;
    const repoSlug =
      body.repository?.name ??
      body.repository?.full_name?.split("/")[1];
    const pullRequestId = body.pullrequest?.id;

    if (!workspace || !repoSlug || !pullRequestId) {
      return reply.code(400).send({ error: "missing pull request fields" });
    }

    const ref: BitbucketPrRef = {
      workspace,
      repoSlug,
      pullRequestId,
    };

    // Fire-and-forget after accepting the webhook
    void deps.reviewPullRequest(ref).catch((error) => {
      console.error("Webhook review failed", error);
    });

    return reply.code(202).send({ accepted: true, ref });
  });
}
```

```ts
// src/server/app.ts
import Fastify from "fastify";
import { createReviewServiceFromEnv } from "../app/create-review-service.js";
import { registerBitbucketWebhook } from "./routes/webhooks.bitbucket.js";

export async function buildApp() {
  const { env, reviewService } = createReviewServiceFromEnv();
  const app = Fastify({ logger: true });

  await registerBitbucketWebhook(app, {
    webhookSecret: env.BITBUCKET_WEBHOOK_SECRET,
    reviewPullRequest: (ref) => reviewService.reviewPullRequest(ref),
  });

  app.get("/health", async () => ({ ok: true }));

  return { app, env };
}
```

```ts
// src/server/index.ts
import { buildApp } from "./app.js";

const { app, env } = await buildApp();
await app.listen({ port: env.PORT, host: "0.0.0.0" });
```

- [ ] **Step 4: Run webhook tests — expect PASS**

```bash
npx vitest run tests/server/webhooks.bitbucket.test.ts
```

Expected: PASS. If Bitbucket payload field names differ in a real event, adjust mapping (`workspace.slug` / `repository.name`) once verified against a sample payload — keep tests updated.

- [ ] **Step 5: Run full suite**

```bash
npx vitest run
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server src/app/create-review-service.ts tests/server/webhooks.bitbucket.test.ts
git commit -m "feat: add Bitbucket webhook server with signature validation"
```

---

### Task 11: Final polish

**Files:**
- Modify: `README.md`
- Modify: `package.json` (ensure `bin` shebang works after build)
- Optionally create: `docs.md` note pointing to the new spec (only if useful; do not rewrite the whole stack doc unless asked)

- [ ] **Step 1: Expand README with env table, webhook setup, and success criteria**

Include:
- Required Bitbucket App Password scopes: `repository`, `pullrequest` (read + write comments)
- Webhook events to enable: Pull Request Created, Pull Request Updated
- Example CLI and server commands
- Link to `docs/superpowers/specs/2026-07-09-pr-review-mvp-design.md`

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: `dist/` emitted without TS errors.

- [ ] **Step 3: Run full tests once more**

```bash
npm test
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document MVP setup for CLI and Bitbucket webhook"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| CLI `pr-review <url>` | Task 9 |
| Webhook `pullrequest:created/updated` + `202` | Task 10 |
| Signature validation / `401` | Task 10 |
| Bitbucket fetch PR + diff | Task 7 |
| Diff truncation | Task 7 |
| AI via Vercel AI SDK + Zod structured output | Task 6 |
| OpenRouter + Ollama factory | Task 5 |
| Unified `AI_MODEL` env | Task 2 |
| General + inline comments; inline failures non-fatal | Task 7 |
| Prompt builder | Task 4 |
| Retries on invalid structure | Task 6 |
| Unit tests for schema/URL/prompt/factory/review | Tasks 2–8, 10 |
| Fastify only for webhook | Task 10 |
| No simple-git / OpenAI / multi-model | Out of scope (not planned) |

## Notes for implementers

1. Prefer AI SDK current API: `generateText` + `Output.object({ schema })` (equivalent intent to spec’s `generateObject`).
2. Inline comments must send only `inline.to` (destination line), not both `from` and `to`.
3. Keep business services free of provider-specific imports except inside `provider.factory.ts`.
4. Do not add Fastify routes beyond `/webhooks/bitbucket` and `/health` in MVP.
