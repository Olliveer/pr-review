import type { ReviewResult } from "../../types/review.ts";

export function formatGeneralComment(result: ReviewResult): string {
  const risks =
    result.risks.length > 0
      ? result.risks.map((r) => `- ${r}`).join("\n")
      : "- Nenhum identificado";
  const suggestions =
    result.suggestions.length > 0
      ? result.suggestions.map((s) => `- ${s}`).join("\n")
      : "- Nenhuma sugerida";

  return [
    "## Resumo",
    result.summary,
    "",
    "## Riscos",
    risks,
    "",
    "## Sugestões",
    suggestions,
    "",
    "_Review automatizado por pr-review_",
  ].join("\n");
}
