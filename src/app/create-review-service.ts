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
