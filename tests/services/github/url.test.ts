import { describe, expect, it } from "vitest";
import { parseGitHubPrUrl } from "../../../src/services/github/url.ts";

describe("parseGitHubPrUrl", () => {
  it("parses a standard GitHub.com PR URL", () => {
    const result = parseGitHubPrUrl("https://github.com/acme/api/pull/42");
    expect(result).toEqual({
      owner: "acme",
      repo: "api",
      pullRequestId: 42,
    });
  });

  it("throws on non-GitHub host", () => {
    expect(() =>
      parseGitHubPrUrl("https://bitbucket.org/acme/api/pull-requests/1"),
    ).toThrow(/github\.com/i);
  });

  it("rejects lookalike hosts", () => {
    expect(() =>
      parseGitHubPrUrl("https://evilgithub.com/acme/api/pull/1"),
    ).toThrow(/github\.com/i);
  });
});
