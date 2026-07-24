import type { AIService } from "../ai/ai.service.ts";
import type {
  PostReviewResult,
  PrRef,
  VcsService,
} from "../vcs/types.ts";
import type { ReviewResult } from "../../types/review.ts";

export interface ReviewRunResult {
  review: ReviewResult;
  posting: PostReviewResult;
}

export class ReviewService {
  constructor(
    private readonly vcs: VcsService,
    private readonly ai: AIService,
  ) {}

  async reviewPullRequest(ref: PrRef): Promise<ReviewRunResult> {
    const context = await this.vcs.fetchReviewContext(ref);
    const review = await this.ai.review(context);
    const posting = await this.vcs.postReview(ref, review);
    return { review, posting };
  }
}
