import { describe, expect, it } from "vitest";
import { formatGeneralComment } from "../../../src/services/bitbucket/format-comment.js";

describe("formatGeneralComment", () => {
  it("renders summary, risks, and suggestions", () => {
    const md = formatGeneralComment({
      summary: "Solid change",
      risks: ["No tests"],
      suggestions: ["Add coverage"],
      inlineComments: [],
    });
    expect(md).toContain("## Summary");
    expect(md).toContain("Solid change");
    expect(md).toContain("## Risks");
    expect(md).toContain("No tests");
    expect(md).toContain("## Suggestions");
    expect(md).toContain("Add coverage");
  });
});
