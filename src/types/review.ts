export type Severity = "info" | "warning" | "critical";

export interface InlineComment {
  path: string;
  line: number;
  severity: Severity;
  body: string;
}

export interface ReviewResult {
  summary: string;
  risks: string[];
  suggestions: string[];
  inlineComments: InlineComment[];
}

export interface ReviewContext {
  workspace: string;
  repoSlug: string;
  pullRequestId: number;
  title: string;
  description: string;
  author: string;
  sourceBranch: string;
  destinationBranch: string;
  diff: string;
  truncated: boolean;
}
