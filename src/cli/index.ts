#!/usr/bin/env node
import { createReviewServiceFromEnv } from "../app/create-review-service.js";
import { parseBitbucketPrUrl } from "../services/bitbucket/url.js";

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: pr-review <bitbucket-pr-url>");
    process.exit(1);
  }

  const ref = parseBitbucketPrUrl(url);
  console.log(
    `Reviewing ${ref.workspace}/${ref.repoSlug}#${ref.pullRequestId}...`,
  );

  const { reviewService } = createReviewServiceFromEnv();
  const result = await reviewService.reviewPullRequest(ref);

  console.log("\n--- Summary ---");
  console.log(result.review.summary);
  console.log(
    `\nPosted: general=${result.posting.generalPosted} inline=${result.posting.inlinePosted} failedInline=${result.posting.inlineFailed}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
