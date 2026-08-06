import { describe, expect, it } from "vitest";
import { applyReviewPolicy } from "../../../src/services/ai/review-policy.ts";
import type { ReviewResult } from "../../../src/types/review.ts";

const base: ReviewResult = {
  summary: "ok",
  risks: ["r"],
  suggestions: ["s"],
  inlineComments: [
    { path: "a.ts", line: 1, severity: "info", body: "nit" },
    { path: "a.ts", line: 2, severity: "warning", body: "warn" },
    { path: "a.ts", line: 3, severity: "critical", body: "crit" },
  ],
};

describe("applyReviewPolicy", () => {
  it("keeps all inlines when severityMin is info and inline enabled", () => {
    const result = applyReviewPolicy(base, {
      severityMin: "info",
      inline: true,
    });
    expect(result.inlineComments).toHaveLength(3);
  });

  it("drops info when severityMin is warning", () => {
    const result = applyReviewPolicy(base, {
      severityMin: "warning",
      inline: true,
    });
    expect(result.inlineComments.map((c) => c.severity)).toEqual([
      "warning",
      "critical",
    ]);
  });

  it("keeps only critical when severityMin is critical", () => {
    const result = applyReviewPolicy(base, {
      severityMin: "critical",
      inline: true,
    });
    expect(result.inlineComments).toEqual([
      { path: "a.ts", line: 3, severity: "critical", body: "crit" },
    ]);
  });

  it("clears all inlines when inline is false", () => {
    const result = applyReviewPolicy(base, {
      severityMin: "info",
      inline: false,
    });
    expect(result.inlineComments).toEqual([]);
    expect(result.summary).toBe("ok");
  });
});
