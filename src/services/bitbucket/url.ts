import type { PrRef } from "../vcs/types.ts";

/** @deprecated Use PrRef — kept as alias for clarity in Bitbucket contexts */
export type BitbucketPrRef = PrRef;

const PR_PATH =
  /^\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/pull-requests\/(?<id>\d+)\/?$/;

export function parseBitbucketPrUrl(raw: string): PrRef {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }

  const host = url.hostname.toLowerCase();
  if (host !== "bitbucket.org") {
    throw new Error(`Not a Bitbucket Cloud URL: ${raw}`);
  }

  const match = PR_PATH.exec(url.pathname);
  if (!match?.groups) {
    throw new Error(
      `Expected path /{workspace}/{repo}/pull-requests/{id}, got: ${url.pathname}`,
    );
  }

  return {
    owner: match.groups.owner,
    repo: match.groups.repo,
    pullRequestId: Number(match.groups.id),
  };
}
