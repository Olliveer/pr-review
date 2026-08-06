import { describe, expect, it } from "vitest";
import { buildReviewPrompt } from "../../../src/services/ai/prompts/prompt-builder.ts";
import type { ReviewContext } from "../../../src/types/review.ts";

const ctx: ReviewContext = {
  workspace: "acme",
  repoSlug: "api",
  pullRequestId: 1,
  title: "Add auth",
  description: "JWT login",
  author: "jose",
  sourceBranch: "feat/auth",
  destinationBranch: "main",
  diff: "diff --git a/a.ts b/a.ts\n+console.log(1)",
  truncated: false,
};

describe("buildReviewPrompt", () => {
  it("includes PR metadata and diff", () => {
    const { system, user } = buildReviewPrompt(ctx);
    expect(system).toMatch(/code review/i);
    expect(system).toMatch(/português do Brasil|pt-BR/i);
    expect(user).toContain("Add auth");
    expect(user).toContain("feat/auth");
    expect(user).toContain("console.log(1)");
  });

  it("lists valid paths for inline comments from the diff", () => {
    const { system, user } = buildReviewPrompt({
      ...ctx,
      diff: `diff --git a/src/auth.ts b/src/auth.ts
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -1,1 +1,2 @@
+export const token = 1;
 export const x = 1;
`,
    });
    expect(system).toMatch(/path exato da lista/i);
    expect(user).toContain("Arquivos válidos para inlineComments.path");
    expect(user).toContain("- src/auth.ts");
  });

  it("applies focus and severity options in the prompt", () => {
    const { system, user } = buildReviewPrompt(ctx, {
      focus: "performance",
      severityMin: "critical",
      inline: false,
    });
    expect(system).toMatch(/performance/i);
    expect(system).toMatch(/NÃO inclua comentários inline/i);
    expect(user).toContain("Foco do review: performance");
    expect(user).toContain("Severidade mínima (inline): critical");
    expect(user).toContain("Inline desabilitado");
  });

  it("mentions truncation when truncated", () => {
    const { user } = buildReviewPrompt({ ...ctx, truncated: true });
    expect(user).toMatch(/truncado/i);
  });
});
