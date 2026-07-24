import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateText, MockNoObjectGeneratedError } = vi.hoisted(() => {
  class MockNoObjectGeneratedError extends Error {
    readonly text?: string;
    constructor(message: string, text?: string) {
      super(message);
      this.name = "AI_NoObjectGeneratedError";
      this.text = text;
    }
    static isInstance(error: unknown): error is MockNoObjectGeneratedError {
      return (
        !!error &&
        typeof error === "object" &&
        "name" in error &&
        (error as { name: string }).name === "AI_NoObjectGeneratedError"
      );
    }
  }
  return { generateText: vi.fn(), MockNoObjectGeneratedError };
});

vi.mock("ai", () => ({
  generateText,
  Output: {
    object: (args: unknown) => args,
  },
  NoObjectGeneratedError: MockNoObjectGeneratedError,
}));

vi.mock("../../../src/services/ai/provider.factory.ts", () => ({
  createModel: vi.fn(() => ({ mocked: true })),
}));

import { AIService } from "../../../src/services/ai/ai.service.ts";
import type { ReviewContext } from "../../../src/types/review.ts";

const ctx: ReviewContext = {
  workspace: "acme",
  repoSlug: "api",
  pullRequestId: 1,
  title: "t",
  description: "d",
  author: "a",
  sourceBranch: "s",
  destinationBranch: "main",
  diff: "+x",
  truncated: false,
};

describe("AIService", () => {
  beforeEach(() => {
    generateText.mockReset();
  });

  it("returns structured review output", async () => {
    generateText.mockResolvedValue({
      output: {
        summary: "ok",
        risks: [],
        suggestions: ["nits"],
        inlineComments: [],
      },
    });

    const service = new AIService({
      AI_PROVIDER: "ollama",
      AI_MODEL: "qwen3:32b",
      OLLAMA_BASE_URL: "http://localhost:11434",
    });

    const result = await service.review(ctx);
    expect(result.summary).toBe("ok");
    expect(generateText).toHaveBeenCalledOnce();
  });

  it("retries when output is null then succeeds", async () => {
    generateText
      .mockResolvedValueOnce({ output: null })
      .mockResolvedValueOnce({
        output: {
          summary: "retry-ok",
          risks: [],
          suggestions: [],
          inlineComments: [],
        },
      });

    const service = new AIService({
      AI_PROVIDER: "ollama",
      AI_MODEL: "qwen3:32b",
      OLLAMA_BASE_URL: "http://localhost:11434",
    });

    const result = await service.review(ctx);
    expect(result.summary).toBe("retry-ok");
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("falls back to parsing JSON text from NoObjectGeneratedError", async () => {
    const json = JSON.stringify({
      summary: "from-text",
      risks: [],
      suggestions: [],
      inlineComments: [],
    });
    generateText.mockRejectedValueOnce(
      new MockNoObjectGeneratedError("could not parse", json),
    );

    const service = new AIService({
      AI_PROVIDER: "ollama",
      AI_MODEL: "qwen3:32b",
      OLLAMA_BASE_URL: "http://localhost:11434",
    });

    const result = await service.review(ctx);
    expect(result.summary).toBe("from-text");
  });

  it("drops inline comments that do not match diff anchors", async () => {
    generateText.mockResolvedValue({
      output: {
        summary: "ok",
        risks: [],
        suggestions: [],
        inlineComments: [
          {
            path: "/model Customer",
            line: 90,
            severity: "info",
            body: "invented",
          },
          {
            path: "a.ts",
            line: 1,
            severity: "warning",
            body: "valid",
          },
        ],
      },
    });

    const service = new AIService({
      AI_PROVIDER: "ollama",
      AI_MODEL: "qwen3:32b",
      OLLAMA_BASE_URL: "http://localhost:11434",
    });

    const result = await service.review({
      ...ctx,
      diff: `diff --git a/a.ts b/a.ts
--- a/a.ts
+++ b/a.ts
@@ -1,1 +1,2 @@
+export const ok = true;
 const x = 1;
`,
    });

    expect(result.inlineComments).toEqual([
      {
        path: "a.ts",
        line: 1,
        severity: "warning",
        body: "valid",
      },
    ]);
  });
});
