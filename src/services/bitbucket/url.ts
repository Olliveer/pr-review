export interface BitbucketPrRef {
  workspace: string;
  repoSlug: string;
  pullRequestId: number;
}

const PR_PATH =
  /^\/(?<workspace>[^/]+)\/(?<repoSlug>[^/]+)\/pull-requests\/(?<id>\d+)\/?$/;

export function parseBitbucketPrUrl(raw: string): BitbucketPrRef {
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
    workspace: match.groups.workspace,
    repoSlug: match.groups.repoSlug,
    pullRequestId: Number(match.groups.id),
  };
}
