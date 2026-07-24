import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const post = vi.fn();

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => ({ get, post })),
  },
}));

import { BitbucketService } from "../../../src/services/bitbucket/bitbucket.service.ts";

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
      owner: "acme",
      repo: "api",
      pullRequestId: 7,
    });

    expect(ctx.title).toBe("Fix bug");
    expect(ctx.workspace).toBe("acme");
    expect(ctx.repoSlug).toBe("api");
    expect(ctx.truncated).toBe(true);
    expect(ctx.diff.length).toBe(50);
  });

  it("posts inline comments before the general summary, then approves", async () => {
    post
      .mockRejectedValueOnce(new Error("bad line"))
      .mockResolvedValueOnce({ data: { id: 1 } })
      .mockResolvedValueOnce({ data: { approved: true } });

    const service = new BitbucketService({
      username: "user",
      appPassword: "pass",
      maxDiffChars: 80_000,
    });

    const result = await service.postReview(
      { owner: "acme", repo: "api", pullRequestId: 7 },
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
    expect(result.approved).toBe(true);
    expect(post).toHaveBeenCalledTimes(3);
    expect(post.mock.calls[0]?.[1]).toMatchObject({
      inline: { path: "a.ts", to: 3 },
    });
    expect(post.mock.calls[1]?.[1].content.raw).toContain("## Resumo");
    expect(post.mock.calls[2]?.[0]).toContain("/pullrequests/7/approve");
  });
});
