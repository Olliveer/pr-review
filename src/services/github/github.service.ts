import axios, { type AxiosInstance } from "axios";
import type {
  ReviewContext,
  ReviewResult,
  Severity,
} from "../../types/review.ts";
import { formatGeneralComment } from "../vcs/format-comment.ts";
import type { PostReviewResult, PrRef, VcsService } from "../vcs/types.ts";

export interface GitHubConfig {
  token: string;
  maxDiffChars: number;
  approve?: boolean;
}

function severityLabel(severity: Severity): string {
  switch (severity) {
    case "info":
      return "info";
    case "warning":
      return "aviso";
    case "critical":
      return "crítico";
  }
}

export class GitHubService implements VcsService {
  private readonly http: AxiosInstance;
  private headShaByPr = new Map<string, string>();

  constructor(private readonly config: GitHubConfig) {
    this.http = axios.create({
      baseURL: "https://api.github.com",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  }

  private prKey(ref: PrRef): string {
    return `${ref.owner}/${ref.repo}#${ref.pullRequestId}`;
  }

  async fetchReviewContext(ref: PrRef): Promise<ReviewContext> {
    const prPath = `/repos/${ref.owner}/${ref.repo}/pulls/${ref.pullRequestId}`;
    const { data: pr } = await this.http.get(prPath);

    const headSha: string = pr.head?.sha ?? "";
    this.headShaByPr.set(this.prKey(ref), headSha);

    const { data: diff } = await this.http.get(prPath, {
      responseType: "text",
      transformResponse: [(d) => d],
      headers: { Accept: "application/vnd.github.diff" },
    });

    const rawDiff = typeof diff === "string" ? diff : String(diff);
    const truncated = rawDiff.length > this.config.maxDiffChars;
    const clipped = truncated
      ? rawDiff.slice(0, this.config.maxDiffChars)
      : rawDiff;

    return {
      workspace: ref.owner,
      repoSlug: ref.repo,
      pullRequestId: ref.pullRequestId,
      title: pr.title ?? "",
      description: pr.body ?? "",
      author: pr.user?.login ?? "unknown",
      sourceBranch: pr.head?.ref ?? "",
      destinationBranch: pr.base?.ref ?? "",
      diff: clipped,
      truncated,
    };
  }

  async postReview(
    ref: PrRef,
    result: ReviewResult,
  ): Promise<PostReviewResult> {
    const key = this.prKey(ref);
    let headSha = this.headShaByPr.get(key) ?? "";
    if (!headSha) {
      const { data: pr } = await this.http.get(
        `/repos/${ref.owner}/${ref.repo}/pulls/${ref.pullRequestId}`,
      );
      headSha = typeof pr.head?.sha === "string" ? pr.head.sha : "";
      this.headShaByPr.set(key, headSha);
    }

    // GitHub PR conversation is oldest-first: post the summary first so it
    // appears at the top, then inline review comments.
    await this.http.post(
      `/repos/${ref.owner}/${ref.repo}/issues/${ref.pullRequestId}/comments`,
      { body: formatGeneralComment(result) },
    );

    const reviewCommentsPath = `/repos/${ref.owner}/${ref.repo}/pulls/${ref.pullRequestId}/comments`;
    let inlinePosted = 0;
    let inlineFailed = 0;

    for (const comment of result.inlineComments) {
      try {
        await this.http.post(reviewCommentsPath, {
          body: `**${severityLabel(comment.severity)}:** ${comment.body}`,
          path: comment.path,
          line: comment.line,
          side: "RIGHT",
          commit_id: headSha,
        });
        inlinePosted += 1;
      } catch (error) {
        inlineFailed += 1;
        console.error(
          `Falha no comentário inline ${comment.path}:${comment.line}`,
          error,
        );
      }
    }

    let approved = false;
    if (this.config.approve !== false) {
      try {
        await this.http.post(
          `/repos/${ref.owner}/${ref.repo}/pulls/${ref.pullRequestId}/reviews`,
          {
            commit_id: headSha,
            event: "APPROVE",
          },
        );
        approved = true;
      } catch (error) {
        console.error("Falha ao aprovar o pull request", error);
      }
    }

    return { generalPosted: true, inlinePosted, inlineFailed, approved };
  }
}
