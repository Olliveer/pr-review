import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const post = vi.fn();

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => ({ get, post })),
  },
}));

import { BitbucketService } from "../../../src/services/bitbucket/bitbucket.service.js";

describe("BitbucketService", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  it("fetches PR context and truncates large diffs", async () => {
    get
      .mockResolvedValueOnce({
        data: {
          id: 7,
          title: "Fix bug",
          description: "details",
          author: { display_name: "Jose" },
          source: { branch: { name: "fix" } },
          destination: { branch: { name: "main" } },
        },
      })
      .mockResolvedValueOnce({
        data: "x".repeat(100),
      });

    const service = new BitbucketService({
      username: "user",
      appPassword: "pass",
      maxDiffChars: 50,
    });

    const ctx = await service.fetchReviewContext({
      workspace: "acme",
      repoSlug: "api",
      pullRequestId: 7,
    });

    expect(ctx.title).toBe("Fix bug");
    expect(ctx.truncated).toBe(true);
    expect(ctx.diff.length).toBe(50);
  });

  it("posts general and inline comments; continues if inline fails", async () => {
    post
      .mockResolvedValueOnce({ data: { id: 1 } })
      .mockRejectedValueOnce(new Error("bad line"));

    const service = new BitbucketService({
      username: "user",
      appPassword: "pass",
      maxDiffChars: 80_000,
    });

    const result = await service.postReview(
      { workspace: "acme", repoSlug: "api", pullRequestId: 7 },
      {
        summary: "ok",
        risks: [],
        suggestions: [],
        inlineComments: [
          { path: "a.ts", line: 3, severity: "info", body: "nit" },
        ],
      },
    );

    expect(result.generalPosted).toBe(true);
    expect(result.inlinePosted).toBe(0);
    expect(result.inlineFailed).toBe(1);
    expect(post).toHaveBeenCalledTimes(2);
  });
});
