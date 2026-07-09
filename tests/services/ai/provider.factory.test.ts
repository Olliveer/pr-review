import { describe, expect, it, vi } from "vitest";

vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: vi.fn(() => {
    const fn = vi.fn((model: string) => ({ provider: "openrouter", model }));
    return Object.assign(fn, { chat: fn });
  }),
}));

vi.mock("ollama-ai-provider-v2", () => ({
  createOllama: vi.fn(() => {
    const fn = vi.fn((model: string) => ({ provider: "ollama", model }));
    return Object.assign(fn, { chat: fn });
  }),
}));

import { createModel } from "../../../src/services/ai/provider.factory.js";

describe("createModel", () => {
  it("creates an openrouter model", () => {
    const model = createModel({
      AI_PROVIDER: "openrouter",
      AI_MODEL: "anthropic/claude-sonnet-4",
      OPENROUTER_API_KEY: "sk-test",
      OLLAMA_BASE_URL: "http://localhost:11434",
    });
    expect(model).toMatchObject({
      provider: "openrouter",
      model: "anthropic/claude-sonnet-4",
    });
  });

  it("creates an ollama model", () => {
    const model = createModel({
      AI_PROVIDER: "ollama",
      AI_MODEL: "qwen3:32b",
      OLLAMA_BASE_URL: "http://localhost:11434",
    });
    expect(model).toMatchObject({ provider: "ollama", model: "qwen3:32b" });
  });
});
