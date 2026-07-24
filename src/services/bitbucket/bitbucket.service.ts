import axios, { type AxiosInstance } from "axios";
import type {
  ReviewContext,
  ReviewResult,
  Severity,
} from "../../types/review.ts";
import { formatGeneralComment } from "../vcs/format-comment.ts";
import type { PostReviewResult, PrRef, VcsService } from "../vcs/types.ts";

export interface BitbucketConfig {
  username: string;
  appPassword: string;
  maxDiffChars: number;
}

export type { PostReviewResult };

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

export class BitbucketService implements VcsService {
  private readonly http: AxiosInstance;

  constructor(private readonly config: BitbucketConfig) {
    this.http = axios.create({
      baseURL: "https://api.bitbucket.org/2.0",
      auth: {
        username: config.username,
        password: config.appPassword,
      },
      headers: { Accept: "application/json" },
    });
  }

  async fetchReviewContext(ref: PrRef): Promise<ReviewContext> {
    const prPath = `/repositories/${ref.owner}/${ref.repo}/pullrequests/${ref.pullRequestId}`;
    const { data: pr } = await this.http.get(prPath);
    const { data: diff } = await this.http.get(`${prPath}/diff`, {
      responseType: "text",
      transformResponse: [(d) => d],
      headers: { Accept: "text/plain" },
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
      description: pr.description ?? "",
      author: pr.author?.display_name ?? pr.author?.nickname ?? "unknown",
      sourceBranch: pr.source?.branch?.name ?? "",
      destinationBranch: pr.destination?.branch?.name ?? "",
      diff: clipped,
      truncated,
    };
  }

  async postReview(
    ref: PrRef,
    result: ReviewResult,
  ): Promise<PostReviewResult> {
    const commentsPath = `/repositories/${ref.owner}/${ref.repo}/pullrequests/${ref.pullRequestId}/comments`;

    // Post inlines first, then the general summary last so Bitbucket's
    // newest-first activity feed shows the overview at the top.
    let inlinePosted = 0;
    let inlineFailed = 0;

    for (const comment of result.inlineComments) {
      try {
        await this.http.post(commentsPath, {
          content: {
            raw: `**${severityLabel(comment.severity)}:** ${comment.body}`,
          },
          inline: {
            path: comment.path,
            to: comment.line,
          },
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

    await this.http.post(commentsPath, {
      content: { raw: formatGeneralComment(result) },
    });

    let approved = false;
    try {
      await this.http.post(
        `/repositories/${ref.owner}/${ref.repo}/pullrequests/${ref.pullRequestId}/approve`,
      );
      approved = true;
    } catch (error) {
      console.error("Falha ao aprovar o pull request", error);
    }

    return { generalPosted: true, inlinePosted, inlineFailed, approved };
  }
}
