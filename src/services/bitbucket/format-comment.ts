import type { ReviewResult } from "../../types/review.js";

export function formatGeneralComment(result: ReviewResult): string {
  const risks =
    result.risks.length > 0
      ? result.risks.map((r) => `- ${r}`).join("\n")
      : "- None noted";
  const suggestions =
    result.suggestions.length > 0
      ? result.suggestions.map((s) => `- ${s}`).join("\n")
      : "- None noted";

  return [
    "## Summary",
    result.summary,
    "",
    "## Risks",
    risks,
    "",
    "## Suggestions",
    suggestions,
    "",
    "_Automated review by pr-review_",
  ].join("\n");
}
