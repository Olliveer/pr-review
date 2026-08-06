import { loadEnv, type Env } from "../config/env.ts";
import { AIService } from "../services/ai/ai.service.ts";
import { BitbucketService } from "../services/bitbucket/bitbucket.service.ts";
import { GitHubService } from "../services/github/github.service.ts";
import { ReviewService } from "../services/review/review.service.ts";
import type { VcsService } from "../services/vcs/types.ts";

function createVcsService(env: Env): VcsService {
  if (env.VCS_PROVIDER === "github") {
    return new GitHubService({
      token: env.GITHUB_TOKEN!,
      maxDiffChars: env.MAX_DIFF_CHARS,
      approve: env.REVIEW_APPROVE,
    });
  }

  return new BitbucketService({
    username: env.BITBUCKET_USERNAME!,
    appPassword: env.BITBUCKET_APP_PASSWORD!,
    maxDiffChars: env.MAX_DIFF_CHARS,
    approve: env.REVIEW_APPROVE,
  });
}

export function createReviewServiceFromEnv() {
  const env = loadEnv();
  const vcs = createVcsService(env);
  const ai = new AIService(
    {
      AI_PROVIDER: env.AI_PROVIDER,
      AI_MODEL: env.AI_MODEL,
      OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
      OLLAMA_BASE_URL: env.OLLAMA_BASE_URL,
    },
    {
      severityMin: env.REVIEW_SEVERITY_MIN,
      focus: env.REVIEW_FOCUS,
      inline: env.REVIEW_INLINE,
    },
  );
  return { env, reviewService: new ReviewService(vcs, ai) };
}
