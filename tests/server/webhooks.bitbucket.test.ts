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
