import type { ReviewContext } from "../../../types/review.js";

export function buildReviewPrompt(context: ReviewContext): {
  system: string;
  user: string;
} {
  const system = [
    "You are a senior software engineer performing a pull request code review.",
    "Focus on bugs, security, regressions, missing tests, and clarity.",
    "Return only structured fields matching the schema.",
    "Inline comments must reference paths and line numbers present in the new (destination) side of the diff.",
    "Prefer fewer high-signal inline comments over noise.",
  ].join(" ");

  const user = [
    `Workspace: ${context.workspace}`,
    `Repository: ${context.repoSlug}`,
    `PR #${context.pullRequestId}`,
    `Title: ${context.title}`,
    `Author: ${context.author}`,
    `Source branch: ${context.sourceBranch}`,
    `Destination branch: ${context.destinationBranch}`,
    `Description:\n${context.description || "(none)"}`,
    context.truncated
      ? "NOTE: The diff below was truncated due to size limits."
      : null,
    "Diff:",
    context.diff,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user };
}
