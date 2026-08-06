import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const post = vi.fn();

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => ({ get, post })),
  },
}));

import { GitHubService } from "../../../src/services/github/github.service.ts";

describe("GitHubService", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  it("fetches PR context and truncates large diffs", async () => {
    get
      .mockResolvedValueOnce({
        data: {
          title: "Fix bug",
          body: "details",
          user: { login: "jose" },
          head: { ref: "fix", sha: "abc123" },
          base: { ref: "main" },
        },
      })
      .mockResolvedValueOnce({
        data: "x".repeat(100),
      });

    const service = new GitHubService({
      token: "ghp_test",
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
    expect(ctx.author).toBe("jose");
    expect(ctx.truncated).toBe(true);
    expect(ctx.diff.length).toBe(50);
  });

  it("posts the general summary before inline comments; continues if inline fails", async () => {
    get.mockResolvedValueOnce({
      data: {
        title: "t",
        body: "",
        user: { login: "u" },
        head: { ref: "feat", sha: "deadbeef" },
        base: { ref: "main" },
      },
    });
    get.mockResolvedValueOnce({ data: "diff" });

    post
      .mockResolvedValueOnce({ data: { id: 1 } })
      .mockRejectedValueOnce(new Error("bad line"))
      .mockResolvedValueOnce({ data: { id: 2, state: "APPROVED" } });

    const service = new GitHubService({
      token: "ghp_test",
      maxDiffChars: 80_000,
    });

    await service.fetchReviewContext({
      owner: "acme",
      repo: "api",
      pullRequestId: 7,
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
    expect(post.mock.calls[0]?.[0]).toContain("/issues/7/comments");
    expect(post.mock.calls[0]?.[1].body).toContain("## Resumo");
    expect(post.mock.calls[1]?.[0]).toContain("/pulls/7/comments");
    expect(post.mock.calls[1]?.[1]).toMatchObject({
      path: "a.ts",
      line: 3,
      side: "RIGHT",
      commit_id: "deadbeef",
    });
    expect(post.mock.calls[2]?.[0]).toContain("/pulls/7/reviews");
    expect(post.mock.calls[2]?.[1]).toEqual({
      commit_id: "deadbeef",
      event: "APPROVE",
    });
  });

  it("marks approved false when GitHub rejects the approval", async () => {
    get.mockResolvedValueOnce({
      data: {
        title: "t",
        body: "",
        user: { login: "u" },
        head: { ref: "feat", sha: "deadbeef" },
        base: { ref: "main" },
      },
    });
    get.mockResolvedValueOnce({ data: "diff" });

    post
      .mockResolvedValueOnce({ data: { id: 1 } })
      .mockRejectedValueOnce(new Error("cannot approve own pull request"));

    const service = new GitHubService({
      token: "ghp_test",
      maxDiffChars: 80_000,
    });

    await service.fetchReviewContext({
      owner: "acme",
      repo: "api",
      pullRequestId: 7,
    });

    const result = await service.postReview(
      { owner: "acme", repo: "api", pullRequestId: 7 },
      {
        summary: "ok",
        risks: [],
        suggestions: [],
        inlineComments: [],
      },
    );

    expect(result.generalPosted).toBe(true);
    expect(result.approved).toBe(false);
  });

  it("skips approval when approve is false", async () => {
    get.mockResolvedValueOnce({
      data: {
        title: "t",
        body: "",
        user: { login: "u" },
        head: { ref: "feat", sha: "deadbeef" },
        base: { ref: "main" },
      },
    });
    get.mockResolvedValueOnce({ data: "diff" });
    post.mockResolvedValueOnce({ data: { id: 1 } });

    const service = new GitHubService({
      token: "ghp_test",
      maxDiffChars: 80_000,
      approve: false,
    });

    await service.fetchReviewContext({
      owner: "acme",
      repo: "api",
      pullRequestId: 7,
    });

    const result = await service.postReview(
      { owner: "acme", repo: "api", pullRequestId: 7 },
      {
        summary: "ok",
        risks: [],
        suggestions: [],
        inlineComments: [],
      },
    );

    expect(result.approved).toBe(false);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]?.[0]).toContain("/issues/7/comments");
  });
});
