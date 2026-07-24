import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { PrRef } from "../../services/vcs/types.ts";

export interface WebhookDeps {
  webhookSecret: string;
  reviewPullRequest: (ref: PrRef) => Promise<unknown>;
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

    const ref: PrRef = {
      owner: workspace,
      repo: repoSlug,
      pullRequestId,
    };

    // Fire-and-forget after accepting the webhook
    void deps.reviewPullRequest(ref).catch((error) => {
      console.error("Webhook review failed", error);
    });

    return reply.code(202).send({ accepted: true, ref });
  });
}
