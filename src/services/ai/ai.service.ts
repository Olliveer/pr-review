import { generateText, Output } from "ai";
import type { ReviewContext, ReviewResult } from "../../types/review.js";
import { buildReviewPrompt } from "./prompts/prompt-builder.js";
import { createModel, type ProviderConfig } from "./provider.factory.js";
import { reviewResultSchema } from "./schemas/review.schema.js";

const MAX_ATTEMPTS = 3; // initial + 2 retries

export class AIService {
  constructor(private readonly config: ProviderConfig) {}

  async review(context: ReviewContext): Promise<ReviewResult> {
    const model = createModel(this.config);
    const { system, user } = buildReviewPrompt(context);
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const { output } = await generateText({
          model,
          system,
          prompt: user,
          output: Output.object({ schema: reviewResultSchema }),
        });

        if (!output) {
          throw new Error("Model returned empty structured output");
        }

        return reviewResultSchema.parse(output);
      } catch (error) {
        lastError = error;
        if (attempt === MAX_ATTEMPTS) break;
      }
    }

    throw new Error(
      `AI review failed after ${MAX_ATTEMPTS} attempts: ${String(lastError)}`,
    );
  }
}
