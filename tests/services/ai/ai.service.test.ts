import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateText } = vi.hoisted(() => ({
  generateText: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText,
  Output: {
    object: (args: unknown) => args,
  },
}));

vi.mock("../../../src/services/ai/provider.factory.js", () => ({
  createModel: vi.fn(() => ({ mocked: true })),
}));

import { AIService } from "../../../src/services/ai/ai.service.js";
import type { ReviewContext } from "../../../src/types/review.js";

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
});
