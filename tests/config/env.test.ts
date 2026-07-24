import { afterEach, describe, expect, it } from "vitest";
import { loadEnv } from "../../src/config/env.ts";

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("loadEnv", () => {
  it("loads openrouter + bitbucket config by default", () => {
    process.env = {
      ...ORIGINAL,
      BITBUCKET_USERNAME: "user",
      BITBUCKET_APP_PASSWORD: "pass",
      BITBUCKET_WEBHOOK_SECRET: "secret",
      AI_PROVIDER: "openrouter",
      AI_MODEL: "anthropic/claude-sonnet-4",
      OPENROUTER_API_KEY: "sk-test",
    };
    delete process.env.VCS_PROVIDER;

    const env = loadEnv();
    expect(env.VCS_PROVIDER).toBe("bitbucket");
    expect(env.AI_PROVIDER).toBe("openrouter");
    expect(env.OPENROUTER_API_KEY).toBe("sk-test");
    expect(env.MAX_DIFF_CHARS).toBe(80000);
  });

  it("requires OPENROUTER_API_KEY when provider is openrouter", () => {
    process.env = {
      ...ORIGINAL,
      BITBUCKET_USERNAME: "user",
      BITBUCKET_APP_PASSWORD: "pass",
      BITBUCKET_WEBHOOK_SECRET: "secret",
      AI_PROVIDER: "openrouter",
      AI_MODEL: "anthropic/claude-sonnet-4",
    };
    delete process.env.OPENROUTER_API_KEY;

    expect(() => loadEnv()).toThrow();
  });

  it("loads github config with GITHUB_TOKEN", () => {
    process.env = {
      ...ORIGINAL,
      VCS_PROVIDER: "github",
      GITHUB_TOKEN: "ghp_test",
      AI_PROVIDER: "ollama",
      AI_MODEL: "gemma4:e4b",
      OLLAMA_BASE_URL: "http://localhost:11434",
    };
    delete process.env.BITBUCKET_USERNAME;
    delete process.env.BITBUCKET_APP_PASSWORD;
    delete process.env.BITBUCKET_WEBHOOK_SECRET;

    const env = loadEnv();
    expect(env.VCS_PROVIDER).toBe("github");
    expect(env.GITHUB_TOKEN).toBe("ghp_test");
  });

  it("requires GITHUB_TOKEN when VCS_PROVIDER is github", () => {
    process.env = {
      ...ORIGINAL,
      VCS_PROVIDER: "github",
      AI_PROVIDER: "ollama",
      AI_MODEL: "gemma4:e4b",
      OLLAMA_BASE_URL: "http://localhost:11434",
    };
    delete process.env.GITHUB_TOKEN;

    expect(() => loadEnv()).toThrow(/GITHUB_TOKEN/);
  });

  it("requires Bitbucket vars when VCS_PROVIDER is bitbucket", () => {
    process.env = {
      ...ORIGINAL,
      VCS_PROVIDER: "bitbucket",
      AI_PROVIDER: "ollama",
      AI_MODEL: "gemma4:e4b",
      OLLAMA_BASE_URL: "http://localhost:11434",
    };
    delete process.env.BITBUCKET_USERNAME;
    delete process.env.BITBUCKET_APP_PASSWORD;
    delete process.env.BITBUCKET_WEBHOOK_SECRET;

    expect(() => loadEnv()).toThrow(/BITBUCKET_USERNAME/);
  });
});
