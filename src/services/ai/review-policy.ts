import type { InlineComment, ReviewResult, Severity } from "../../types/review.ts";

export type ReviewSeverityMin = Severity;
export type ReviewFocus = "all" | "bugs" | "security" | "performance";

export interface ReviewPolicy {
  severityMin: ReviewSeverityMin;
  inline: boolean;
}

const SEVERITY_RANK: Record<Severity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

export function meetsSeverityMin(
  severity: Severity,
  min: ReviewSeverityMin,
): boolean {
  return SEVERITY_RANK[severity] >= SEVERITY_RANK[min];
}

export function filterInlineBySeverity(
  comments: InlineComment[],
  min: ReviewSeverityMin,
): InlineComment[] {
  return comments.filter((c) => meetsSeverityMin(c.severity, min));
}

export function applyReviewPolicy(
  review: ReviewResult,
  policy: ReviewPolicy,
): ReviewResult {
  if (!policy.inline) {
    return { ...review, inlineComments: [] };
  }

  return {
    ...review,
    inlineComments: filterInlineBySeverity(
      review.inlineComments,
      policy.severityMin,
    ),
  };
}

export function focusInstruction(focus: ReviewFocus): string {
  switch (focus) {
    case "bugs":
      return "Foque principalmente em bugs e regressões de comportamento. Evite nitpicks de estilo e micro-otimizações, salvo se forem graves.";
    case "security":
      return "Foque principalmente em segurança: autenticação, autorização, injection, secrets, validação de input e exposição de dados.";
    case "performance":
      return "Foque principalmente em performance: N+1, hot paths, alocações desnecessárias, caching inadequado e complexidade evitável.";
    case "all":
      return "Foque em bugs, segurança, regressões, testes faltando e clareza do código.";
  }
}
