import type { PrRef } from "../vcs/types.ts";

const PR_PATH = /^\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/pull\/(?<id>\d+)\/?$/;

export function parseGitHubPrUrl(raw: string): PrRef {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }

  const host = url.hostname.toLowerCase();
  if (host !== "github.com") {
    throw new Error(`Not a GitHub.com URL: ${raw}`);
  }

  const match = PR_PATH.exec(url.pathname);
  if (!match?.groups) {
    throw new Error(
      `Expected path /{owner}/{repo}/pull/{id}, got: ${url.pathname}`,
    );
  }

  return {
    owner: match.groups.owner,
    repo: match.groups.repo,
    pullRequestId: Number(match.groups.id),
  };
}
