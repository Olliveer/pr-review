# pr-review

PR reviewer powered by the Vercel AI SDK. Supports **Bitbucket Cloud** (CLI + webhook) and **GitHub.com** (CLI). Fetches the diff, generates a structured review with an LLM, posts a general PR comment plus optional inline comments, and can approve the pull request afterward.

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

| Variable                   | Required                      | Default                  | Description                                                       |
| -------------------------- | ----------------------------- | ------------------------ | ----------------------------------------------------------------- |
| `VCS_PROVIDER`             | No                            | `bitbucket`              | `bitbucket` or `github`                                           |
| `BITBUCKET_USERNAME`       | When `VCS_PROVIDER=bitbucket` | —                        | Atlassian account email (API token) or Bitbucket username         |
| `BITBUCKET_APP_PASSWORD`   | When `VCS_PROVIDER=bitbucket` | —                        | Bitbucket API token / app password                                |
| `BITBUCKET_WEBHOOK_SECRET` | When `VCS_PROVIDER=bitbucket` | —                        | Shared secret for validating Bitbucket webhooks                   |
| `GITHUB_TOKEN`             | When `VCS_PROVIDER=github`    | —                        | GitHub PAT with `repo` (or fine-grained PR read/write)            |
| `AI_PROVIDER`              | Yes                           | —                        | LLM provider: `openrouter` or `ollama`                            |
| `AI_MODEL`                 | Yes                           | —                        | Model identifier for the chosen provider                          |
| `OPENROUTER_API_KEY`       | When `AI_PROVIDER=openrouter` | —                        | OpenRouter API key                                                |
| `OLLAMA_BASE_URL`          | No                            | `http://localhost:11434` | Ollama server URL when using `ollama`                             |
| `PORT`                     | No                            | `3000`                   | HTTP port for the webhook server                                  |
| `MAX_DIFF_CHARS`           | No                            | `80000`                  | Max diff size sent to the LLM; larger diffs are truncated         |
| `REVIEW_SEVERITY_MIN`      | No                            | `warning`                | Minimum inline severity to keep: `info`, `warning`, or `critical` |
| `REVIEW_FOCUS`             | No                            | `all`                    | Prompt focus: `all`, `bugs`, `security`, or `performance`         |
| `REVIEW_INLINE`            | No                            | `true`                   | Post inline comments (`true` / `false`)                           |
| `REVIEW_APPROVE`           | No                            | `true`                   | Approve the PR after posting comments (`true` / `false`)          |

## Bitbucket credentials

Prefer a [Bitbucket API token](https://support.atlassian.com/bitbucket-cloud/docs/api-tokens/) with:

- `read:repository:bitbucket`
- `read:pullrequest:bitbucket`
- `write:pullrequest:bitbucket`

Set `BITBUCKET_USERNAME` to your **Atlassian account email** and `BITBUCKET_APP_PASSWORD` to the token.

## GitHub credentials

Create a [personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) with permission to read the PR/diff, write issue + pull request review comments, and submit reviews (approve). Set `VCS_PROVIDER=github` and `GITHUB_TOKEN`.

GitHub does not allow approving your own pull request — if the token user is the PR author, comments still post and `aprovado=false` is reported.

GitHub webhook support is not implemented yet — use the CLI.

## Bitbucket webhook setup

Requires `VCS_PROVIDER=bitbucket`.

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
# Bitbucket
VCS_PROVIDER=bitbucket npm run dev:cli -- https://bitbucket.org/{workspace}/{repo}/pull-requests/{id}

# GitHub
VCS_PROVIDER=github npm run dev:cli -- https://github.com/{owner}/{repo}/pull/{id}

# Bitbucket webhook server
VCS_PROVIDER=bitbucket npm run dev:server
```

### Production (after `npm run build`)

```bash
node dist/cli/index.js https://bitbucket.org/{workspace}/{repo}/pull-requests/{id}
# or
node dist/cli/index.js https://github.com/{owner}/{repo}/pull/{id}

npm start   # Bitbucket webhook only
```

### Tests

```bash
npm test
```

## Success criteria

- **CLI (Bitbucket or GitHub):** fetches the PR, generates a review, posts a general comment plus inline comments.
- **Webhook (Bitbucket only):** On pull request created or updated, the server returns `202` and runs the same review flow in the background.
- **Providers:** Switching `AI_PROVIDER` / `VCS_PROVIDER` requires no business-logic changes — only env vars.

## Stack

Node.js 22+, TypeScript, Fastify, Axios, Zod, Vercel AI SDK (OpenRouter or Ollama via `AI_PROVIDER`).
