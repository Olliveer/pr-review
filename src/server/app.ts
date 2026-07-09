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
