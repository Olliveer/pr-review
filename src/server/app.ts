import Fastify from "fastify";
import { createReviewServiceFromEnv } from "../app/create-review-service.ts";
import { registerBitbucketWebhook } from "./routes/webhooks.bitbucket.ts";

export async function buildApp() {
  const { env, reviewService } = createReviewServiceFromEnv();

  if (env.VCS_PROVIDER !== "bitbucket") {
    throw new Error(
      `Webhook server supports only VCS_PROVIDER=bitbucket (got ${env.VCS_PROVIDER}). Use the CLI for GitHub reviews.`,
    );
  }

  if (!env.BITBUCKET_WEBHOOK_SECRET) {
    throw new Error(
      "BITBUCKET_WEBHOOK_SECRET is required for the webhook server",
    );
  }

  const app = Fastify({ logger: true });

  await registerBitbucketWebhook(app, {
    webhookSecret: env.BITBUCKET_WEBHOOK_SECRET,
    reviewPullRequest: (ref) => reviewService.reviewPullRequest(ref),
  });

  app.get("/health", async () => ({ ok: true }));

  return { app, env };
}
