import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

const baseSchema = z.object({
  VCS_PROVIDER: z.enum(["bitbucket", "github"]).default("bitbucket"),
  BITBUCKET_USERNAME: z.string().optional(),
  BITBUCKET_APP_PASSWORD: z.string().optional(),
  BITBUCKET_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  AI_PROVIDER: z.enum(["openrouter", "ollama"]),
  AI_MODEL: z.string().min(1),
  OPENROUTER_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434"),
  PORT: z.coerce.number().int().positive().default(3000),
  MAX_DIFF_CHARS: z.coerce.number().int().positive().default(80_000),
});

export type Env = z.infer<typeof baseSchema>;

export function loadEnv(env: NodeJS.ProcessEnv = process.env): Env {
  const parsed = baseSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }

  const value = parsed.data;

  if (value.AI_PROVIDER === "openrouter" && !value.OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY is required when AI_PROVIDER=openrouter",
    );
  }

  if (value.VCS_PROVIDER === "bitbucket") {
    if (!value.BITBUCKET_USERNAME?.trim()) {
      throw new Error(
        "BITBUCKET_USERNAME is required when VCS_PROVIDER=bitbucket",
      );
    }
    if (!value.BITBUCKET_APP_PASSWORD?.trim()) {
      throw new Error(
        "BITBUCKET_APP_PASSWORD is required when VCS_PROVIDER=bitbucket",
      );
    }
    if (!value.BITBUCKET_WEBHOOK_SECRET?.trim()) {
      throw new Error(
        "BITBUCKET_WEBHOOK_SECRET is required when VCS_PROVIDER=bitbucket",
      );
    }
  }

  if (value.VCS_PROVIDER === "github" && !value.GITHUB_TOKEN?.trim()) {
    throw new Error("GITHUB_TOKEN is required when VCS_PROVIDER=github");
  }

  return value;
}
