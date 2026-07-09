# PR Review MVP — Design Spec

**Date:** 2026-07-09  
**Status:** Approved for implementation planning  
**Source:** `docs.md` + design session

## Goal

CLI and Bitbucket Cloud webhook that review pull requests with an LLM (Vercel AI SDK), then post a general PR comment (summary + risks + suggestions) and inline comments on changed lines.

## Non-goals (post-MVP)

- GitHub / Bitbucket Server
- `simple-git` local-only reviews
- OpenAI as a first-class provider
- Multi-model, fallback, cost balancing, response cache
- Public generic HTTP API beyond the webhook
- Streaming the final review object to Bitbucket

## Architecture

```text
Bitbucket webhook ──┐
                    ├──► ReviewService ──► AIService (Vercel AI SDK)
CLI `pr-review url` ┘         │                    │
                              │                    ▼
                              │            OpenRouter | Ollama
                              ▼
                    BitbucketService (fetch PR + post comments)
```

### Components

| Component | Responsibility |
|-----------|----------------|
| `cli` | Parse Bitbucket PR URL → `ReviewService` |
| `server` (Fastify) | `POST /webhooks/bitbucket` → validate → async `ReviewService` |
| `BitbucketService` | Auth, fetch PR metadata/diff, post general + inline comments |
| `AIService` | Prompt + `generateObject` (Zod) via AI SDK |
| `provider.factory` | `AI_PROVIDER=openrouter\|ollama` → model instance |
| `PromptBuilder` | Build context (title, description, diff, optional rules) |
| `config/env` | Zod-validated environment |

Business code never imports OpenRouter/Ollama SDKs directly — only the Vercel AI SDK via the factory.

## Data flow

1. **Trigger:** CLI URL or webhook (`pullrequest:created` / `pullrequest:updated`).
2. **Fetch:** `BitbucketService` loads PR metadata + diff.
3. **Review:** `AIService` builds prompt, calls `generateObject` with Zod schema (retry up to 2 times on invalid structure).
4. **Post:** General markdown comment, then inline comments; failed inlines are logged and skipped.
5. **Exit:** CLI prints result; webhook already returned `202`.

## Contracts

### ReviewContext (input)

- workspace, repo slug, PR id
- title, description, author, source/destination branches
- files + diff (truncated with notice if oversized)
- optional company/language rules (env or file; optional in MVP)

### ReviewResult (Zod / AI output)

```ts
{
  summary: string
  risks: string[]
  suggestions: string[]
  inlineComments: Array<{
    path: string
    line: number          // line in destination (new) file
    severity: "info" | "warning" | "critical"
    body: string
  }>
}
```

### Bitbucket posting

1. One general PR comment: summary + risks + suggestions (markdown).
2. One inline comment per `inlineComments` item (diff-anchored).
3. Inline failure must not roll back the general comment.

### Webhook

- Events: `pullrequest:created`, `pullrequest:updated`
- Validate `BITBUCKET_WEBHOOK_SECRET`
- Respond `202` immediately; process asynchronously
- Invalid signature → `401`

## Configuration

```env
# Bitbucket Cloud
BITBUCKET_USERNAME=
BITBUCKET_APP_PASSWORD=
BITBUCKET_WEBHOOK_SECRET=

# AI (unified model name — replaces per-provider *_MODEL from docs.md)
AI_PROVIDER=openrouter   # or ollama
AI_MODEL=anthropic/claude-sonnet-4

OPENROUTER_API_KEY=      # when AI_PROVIDER=openrouter
OLLAMA_BASE_URL=http://localhost:11434  # when AI_PROVIDER=ollama
```

## Repository layout

```text
src/
  cli/index.ts
  server/
    app.ts
    routes/webhooks.bitbucket.ts
  services/
    review/review.service.ts
    bitbucket/bitbucket.service.ts
    ai/
      ai.service.ts
      provider.factory.ts
      prompts/
      schemas/review.schema.ts
  config/env.ts
  types/
```

## Error handling

| Case | Behavior |
|------|----------|
| Invalid Zod output | Retry up to 2 times; then fail with log |
| Oversized diff | Truncate + note in summary |
| Inline comment rejected | Skip + log; keep general comment |
| Invalid webhook | `401` |
| Bitbucket/AI outage | CLI exits non-zero; webhook logs, no infinite retry |

## Streaming

- CLI may show progress logs.
- Final structured result uses `generateObject` (not streamed object).
- Webhook does not stream to Bitbucket.

## Testing (MVP)

- Unit: PromptBuilder, review Zod schema, Bitbucket URL parse
- Unit: provider factory (mocked models)
- Light integration: `ReviewService` with mocked AI + Bitbucket

## Stack

- Node.js, TypeScript, Fastify, Axios, Zod, Vercel AI SDK
- `simple-git` deferred (not in MVP)

## Changes vs `docs.md`

1. Product surface defined: Bitbucket Cloud CLI + webhook, not AI-only.
2. Single `AI_MODEL` env (drop conflicting `OPENROUTER_MODEL` / `OLLAMA_MODEL` as primary).
3. Providers are thin AI SDK adapters, not full `review()` reimplementations.
4. Fastify included for webhook only.
5. Future evolutions (multi-model, cache, etc.) explicitly out of MVP.
6. Bitbucket replaces any GitHub assumption.

## Success criteria

- `pr-review <bitbucket-pr-url>` fetches PR, generates review, posts general + inline comments.
- Webhook on PR create/update does the same asynchronously after `202`.
- Switching `AI_PROVIDER` between openrouter and ollama requires no business-logic changes.
