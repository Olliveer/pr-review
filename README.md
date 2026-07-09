# pr-review

Bitbucket Cloud PR reviewer powered by the Vercel AI SDK. Review a pull request from the CLI or automatically via webhook — the service fetches the diff, generates a structured review with an LLM, and posts a general PR comment plus inline comments on changed lines.

Design spec: [docs/superpowers/specs/2026-07-09-pr-review-mvp-design.md](docs/superpowers/specs/2026-07-09-pr-review-mvp-design.md)

## Setup

1. Copy `.env.example` to `.env` and fill in the values (see [Environment variables](#environment-variables)).
2. Install dependencies:

   ```bash
   npm install
   ```

3. Build (required for production CLI/server):

   ```bash
   npm run build
   ```

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BITBUCKET_USERNAME` | Yes | — | Bitbucket Cloud username for API auth |
| `BITBUCKET_APP_PASSWORD` | Yes | — | App password with `repository` and `pullrequest` scopes (see below) |
| `BITBUCKET_WEBHOOK_SECRET` | Yes | — | Shared secret for validating incoming webhook payloads |
| `AI_PROVIDER` | Yes | `openrouter` | LLM provider: `openrouter` or `ollama` |
| `AI_MODEL` | Yes | `anthropic/claude-sonnet-4` | Model identifier for the chosen provider |
| `OPENROUTER_API_KEY` | When `AI_PROVIDER=openrouter` | — | OpenRouter API key |
| `OLLAMA_BASE_URL` | No | `http://localhost:11434` | Ollama server URL when using `ollama` |
| `PORT` | No | `3000` | HTTP port for the webhook server |
| `MAX_DIFF_CHARS` | No | `80000` | Max diff size sent to the LLM; larger diffs are truncated |

## Bitbucket App Password

Create an [App Password](https://support.atlassian.com/bitbucket-cloud/docs/app-passwords/) with these scopes:

- **Repository** — Read
- **Pull requests** — Read, Write (needed to post general and inline comments)

Set `BITBUCKET_USERNAME` and `BITBUCKET_APP_PASSWORD` in `.env`.

## Webhook setup

1. Start the server (see [Commands](#commands)).
2. In Bitbucket: **Repository settings → Webhooks → Add webhook**.
3. **URL:** `https://<your-host>/webhooks/bitbucket`
4. **Secret:** same value as `BITBUCKET_WEBHOOK_SECRET` in `.env`
5. **Triggers** — enable:
   - Pull request: Created
   - Pull request: Updated

The server responds `202 Accepted` immediately and processes the review asynchronously. Invalid signatures return `401`.

Health check: `GET /health` → `{ "ok": true }`.

## Commands

### Development (no build)

```bash
# Review a PR from the CLI
npm run dev:cli -- https://bitbucket.org/{workspace}/{repo}/pull-requests/{id}

# Run the webhook server
npm run dev:server
```

### Production (after `npm run build`)

```bash
# CLI — use node explicitly (tsc does not preserve the shebang)
node dist/cli/index.js https://bitbucket.org/{workspace}/{repo}/pull-requests/{id}

# Webhook server
npm start
```

### Tests

```bash
npm test
```

## Success criteria

- **CLI:** `pr-review <bitbucket-pr-url>` (or `node dist/cli/index.js <url>`) fetches the PR, generates a review, and posts a general comment plus inline comments on changed lines.
- **Webhook:** On pull request created or updated, the server returns `202` and runs the same review flow in the background.
- **Providers:** Switching `AI_PROVIDER` between `openrouter` and `ollama` requires no changes to application code — only env vars.

## Stack

Node.js 22+, TypeScript, Fastify, Axios, Zod, Vercel AI SDK (OpenRouter or Ollama via `AI_PROVIDER`).
