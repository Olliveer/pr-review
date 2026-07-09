import { describe, expect, it } from "vitest";
import { reviewResultSchema } from "../../../src/services/ai/schemas/review.schema.js";

describe("reviewResultSchema", () => {
  it("accepts a valid review payload", () => {
    const parsed = reviewResultSchema.parse({
      summary: "Looks good overall",
      risks: ["Missing tests"],
      suggestions: ["Add unit tests"],
      inlineComments: [
        {
          path: "src/app.ts",
          line: 12,
          severity: "warning",
          body: "Handle null",
        },
      ],
    });
    expect(parsed.inlineComments).toHaveLength(1);
  });

  it("rejects invalid severity", () => {
    expect(() =>
      reviewResultSchema.parse({
        summary: "x",
        risks: [],
        suggestions: [],
        inlineComments: [
          { path: "a.ts", line: 1, severity: "low", body: "x" },
        ],
      }),
    ).toThrow();
  });
});
