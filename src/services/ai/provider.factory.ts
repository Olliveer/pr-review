import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama } from "ollama-ai-provider-v2";
import type { LanguageModel } from "ai";

export interface ProviderConfig {
  AI_PROVIDER: "openrouter" | "ollama";
  AI_MODEL: string;
  OPENROUTER_API_KEY?: string;
  OLLAMA_BASE_URL: string;
}

export function createModel(config: ProviderConfig): LanguageModel {
  if (config.AI_PROVIDER === "openrouter") {
    if (!config.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is required for openrouter");
    }
    const openrouter = createOpenRouter({
      apiKey: config.OPENROUTER_API_KEY,
    });
    return openrouter(config.AI_MODEL);
  }

  // ollama-ai-provider-v2 defaults to http://localhost:11434/api
  const baseURL = config.OLLAMA_BASE_URL.replace(/\/$/, "").endsWith("/api")
    ? config.OLLAMA_BASE_URL.replace(/\/$/, "")
    : `${config.OLLAMA_BASE_URL.replace(/\/$/, "")}/api`;

  const ollama = createOllama({ baseURL });
  return ollama(config.AI_MODEL);
}
