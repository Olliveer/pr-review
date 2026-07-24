#!/usr/bin/env node
import { createReviewServiceFromEnv } from "../app/create-review-service.ts";
import { parseBitbucketPrUrl } from "../services/bitbucket/url.ts";
import { parseGitHubPrUrl } from "../services/github/url.ts";
import type { PrRef } from "../services/vcs/types.ts";

function parsePrUrlForProvider(
  provider: "bitbucket" | "github",
  url: string,
): PrRef {
  if (provider === "github") {
    return parseGitHubPrUrl(url);
  }
  return parseBitbucketPrUrl(url);
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error(
      "Uso: pr-review <bitbucket-pr-url|github-pr-url>\n" +
        "Defina VCS_PROVIDER=bitbucket|github no .env",
    );
    process.exit(1);
  }

  const { env, reviewService } = createReviewServiceFromEnv();
  const ref = parsePrUrlForProvider(env.VCS_PROVIDER, url);

  console.log(
    `Revisando ${ref.owner}/${ref.repo}#${ref.pullRequestId} (${env.VCS_PROVIDER})...`,
  );

  const result = await reviewService.reviewPullRequest(ref);

  console.log("\n--- Resumo ---");
  console.log(result.review.summary);
  console.log(
    `\nPublicado: geral=${result.posting.generalPosted} inline=${result.posting.inlinePosted} inlineFalhou=${result.posting.inlineFailed} aprovado=${result.posting.approved}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
