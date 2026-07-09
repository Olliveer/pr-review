import { describe, expect, it, vi } from "vitest";
import { ReviewService } from "../../../src/services/review/review.service.js";
import type { ReviewContext, ReviewResult } from "../../../src/types/review.js";

describe("ReviewService", () => {
  it("fetches, reviews, and posts", async () => {
    const context: ReviewContext = {
      workspace: "acme",
      repoSlug: "api",
      pullRequestId: 9,
      title: "t",
      description: "d",
      author: "a",
      sourceBranch: "s",
      destinationBranch: "main",
      diff: "+x",
      truncated: false,
    };
    const review: ReviewResult = {
      summary: "ok",
      risks: [],
      suggestions: [],
      inlineComments: [],
    };

    const bitbucket = {
      fetchReviewContext: vi.fn().mockResolvedValue(context),
      postReview: vi.fn().mockResolvedValue({
        generalPosted: true,
        inlinePosted: 0,
        inlineFailed: 0,
      }),
    };
    const ai = {
      review: vi.fn().mockResolvedValue(review),
    };

    const service = new ReviewService(bitbucket as never, ai as never);
    const result = await service.reviewPullRequest({
      workspace: "acme",
      repoSlug: "api",
      pullRequestId: 9,
    });

    expect(bitbucket.fetchReviewContext).toHaveBeenCalledOnce();
    expect(ai.review).toHaveBeenCalledWith(context);
    expect(bitbucket.postReview).toHaveBeenCalledWith(
      { workspace: "acme", repoSlug: "api", pullRequestId: 9 },
      review,
    );
    expect(result.review.summary).toBe("ok");
  });
});
