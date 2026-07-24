import { describe, expect, it, vi } from "vitest";
import { ReviewService } from "../../../src/services/review/review.service.ts";
import type { ReviewContext, ReviewResult } from "../../../src/types/review.ts";

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

    const vcs = {
      fetchReviewContext: vi.fn().mockResolvedValue(context),
      postReview: vi.fn().mockResolvedValue({
        generalPosted: true,
        inlinePosted: 0,
        inlineFailed: 0,
        approved: true,
      }),
    };
    const ai = {
      review: vi.fn().mockResolvedValue(review),
    };

    const service = new ReviewService(vcs as never, ai as never);
    const ref = { owner: "acme", repo: "api", pullRequestId: 9 };
    const result = await service.reviewPullRequest(ref);

    expect(vcs.fetchReviewContext).toHaveBeenCalledOnce();
    expect(ai.review).toHaveBeenCalledWith(context);
    expect(vcs.postReview).toHaveBeenCalledWith(ref, review);
    expect(result.review.summary).toBe("ok");
  });
});
