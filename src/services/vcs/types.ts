import type { ReviewContext, ReviewResult } from "../../types/review.ts";

export interface PrRef {
  owner: string;
  repo: string;
  pullRequestId: number;
}

export interface PostReviewResult {
  generalPosted: boolean;
  inlinePosted: number;
  inlineFailed: number;
  approved: boolean;
}

export interface VcsService {
  fetchReviewContext(ref: PrRef): Promise<ReviewContext>;
  postReview(ref: PrRef, result: ReviewResult): Promise<PostReviewResult>;
}
