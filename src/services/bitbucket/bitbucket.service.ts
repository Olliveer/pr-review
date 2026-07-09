import axios, { type AxiosInstance } from "axios";
import type { ReviewContext, ReviewResult } from "../../types/review.js";
import { formatGeneralComment } from "./format-comment.js";
import type { BitbucketPrRef } from "./url.js";

export interface BitbucketConfig {
  username: string;
  appPassword: string;
  maxDiffChars: number;
}

export interface PostReviewResult {
  generalPosted: boolean;
  inlinePosted: number;
  inlineFailed: number;
}

export class BitbucketService {
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

  async fetchReviewContext(ref: BitbucketPrRef): Promise<ReviewContext> {
    const prPath = `/repositories/${ref.workspace}/${ref.repoSlug}/pullrequests/${ref.pullRequestId}`;
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
      workspace: ref.workspace,
      repoSlug: ref.repoSlug,
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
    ref: BitbucketPrRef,
    result: ReviewResult,
  ): Promise<PostReviewResult> {
    const commentsPath = `/repositories/${ref.workspace}/${ref.repoSlug}/pullrequests/${ref.pullRequestId}/comments`;

    await this.http.post(commentsPath, {
      content: { raw: formatGeneralComment(result) },
    });

    let inlinePosted = 0;
    let inlineFailed = 0;

    for (const comment of result.inlineComments) {
      try {
        await this.http.post(commentsPath, {
          content: {
            raw: `**${comment.severity}:** ${comment.body}`,
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
          `Failed inline comment ${comment.path}:${comment.line}`,
          error,
        );
      }
    }

    return { generalPosted: true, inlinePosted, inlineFailed };
  }
}
