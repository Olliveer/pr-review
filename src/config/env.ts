import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

const baseSchema = z.object({
  BITBUCKET_USERNAME: z.string().min(1),
  BITBUCKET_APP_PASSWORD: z.string().min(1),
  BITBUCKET_WEBHOOK_SECRET: z.string().min(1),
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
    throw new Error("OPENROUTER_API_KEY is required when AI_PROVIDER=openrouter");
  }
  return value;
}
