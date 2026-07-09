import { describe, expect, it } from "vitest";
import { buildReviewPrompt } from "../../../src/services/ai/prompts/prompt-builder.js";
import type { ReviewContext } from "../../../src/types/review.js";

const ctx: ReviewContext = {
  workspace: "acme",
  repoSlug: "api",
  pullRequestId: 1,
  title: "Add auth",
  description: "JWT login",
  author: "jose",
  sourceBranch: "feat/auth",
  destinationBranch: "main",
  diff: "diff --git a/a.ts b/a.ts\n+console.log(1)",
  truncated: false,
};

describe("buildReviewPrompt", () => {
  it("includes PR metadata and diff", () => {
    const { system, user } = buildReviewPrompt(ctx);
    expect(system).toMatch(/code review/i);
    expect(user).toContain("Add auth");
    expect(user).toContain("feat/auth");
    expect(user).toContain("console.log(1)");
  });

  it("mentions truncation when truncated", () => {
    const { user } = buildReviewPrompt({ ...ctx, truncated: true });
    expect(user).toMatch(/truncated/i);
  });
});
