// tests/config/env.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { loadEnv } from "../../src/config/env.js";

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("loadEnv", () => {
  it("loads openrouter config", () => {
    process.env = {
      ...ORIGINAL,
      BITBUCKET_USERNAME: "user",
      BITBUCKET_APP_PASSWORD: "pass",
      BITBUCKET_WEBHOOK_SECRET: "secret",
      AI_PROVIDER: "openrouter",
      AI_MODEL: "anthropic/claude-sonnet-4",
      OPENROUTER_API_KEY: "sk-test",
    };

    const env = loadEnv();
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
});
