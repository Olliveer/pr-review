import { describe, expect, it } from "vitest";
import {
  formatAiFailure,
  parseReviewResponse,
} from "../../../src/services/ai/parse-review-output.ts";

describe("parseReviewResponse", () => {
  it("parses raw JSON", () => {
    const parsed = parseReviewResponse(
      JSON.stringify({
        summary: "ok",
        risks: ["r"],
        suggestions: [],
        inlineComments: [],
      }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.summary).toBe("ok");
      expect(parsed.data.risks).toEqual(["r"]);
    }
  });

  it("parses JSON inside markdown fences", () => {
    const parsed = parseReviewResponse(`Here you go:
\`\`\`json
{"summary":"fenced","risks":[],"suggestions":[],"inlineComments":[]}
\`\`\`
`);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.summary).toBe("fenced");
    }
  });

  it("returns ok:false when text is not review JSON", () => {
    const parsed = parseReviewResponse("safe / unsafe");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toMatch(/JSON válido/);
      expect(parsed.raw).toBe("safe / unsafe");
    }
  });

  it("returns ok:false when schema validation fails", () => {
    const parsed = parseReviewResponse(
      JSON.stringify({
        summary: "x",
        risks: [],
        suggestions: [],
        inlineComments: [
          { path: "a.ts", line: 1, severity: "low", body: "x" },
        ],
      }),
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toMatch(/severity/);
    }
  });
});

describe("formatAiFailure", () => {
  it("includes text preview for NoObjectGeneratedError-shaped errors", () => {
    const message = formatAiFailure({
      name: "AI_NoObjectGeneratedError",
      message: "could not parse the response",
      text: "hello world",
      finishReason: "stop",
    });
    expect(message).toContain("could not parse the response");
    expect(message).toContain("finishReason=stop");
    expect(message).toContain("hello world");
  });
});
