import { describe, expect, it } from "vitest";
import { parseBitbucketPrUrl } from "../../../src/services/bitbucket/url.ts";

describe("parseBitbucketPrUrl", () => {
  it("parses a standard Cloud PR URL", () => {
    const result = parseBitbucketPrUrl(
      "https://bitbucket.org/acme/api/pull-requests/42",
    );
    expect(result).toEqual({
      owner: "acme",
      repo: "api",
      pullRequestId: 42,
    });
  });

  it("throws on invalid URL", () => {
    expect(() =>
      parseBitbucketPrUrl("https://github.com/acme/api/pull/1"),
    ).toThrow(/bitbucket/i);
  });

  it("rejects lookalike hosts", () => {
    expect(() =>
      parseBitbucketPrUrl("https://evilbitbucket.org/acme/api/pull-requests/1"),
    ).toThrow(/bitbucket/i);
  });
});
