import type { AIService } from "../ai/ai.service.js";
import type {
  BitbucketService,
  PostReviewResult,
} from "../bitbucket/bitbucket.service.js";
import type { BitbucketPrRef } from "../bitbucket/url.js";
import type { ReviewResult } from "../../types/review.js";

export interface ReviewRunResult {
  review: ReviewResult;
  posting: PostReviewResult;
}

export class ReviewService {
  constructor(
    private readonly bitbucket: BitbucketService,
    private readonly ai: AIService,
  ) {}

  async reviewPullRequest(ref: BitbucketPrRef): Promise<ReviewRunResult> {
    const context = await this.bitbucket.fetchReviewContext(ref);
    const review = await this.ai.review(context);
    const posting = await this.bitbucket.postReview(ref, review);
    return { review, posting };
  }
}
