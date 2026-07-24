import { generateText, NoObjectGeneratedError, Output } from "ai";
import type { ReviewContext, ReviewResult } from "../../types/review.ts";
import {
  extractDiffAnchors,
  filterInlineComments,
} from "./diff-anchors.ts";
import {
  formatAiFailure,
  parseReviewResponse,
} from "./parse-review-output.ts";
import { buildReviewPrompt } from "./prompts/prompt-builder.ts";
import { createModel, type ProviderConfig } from "./provider.factory.ts";
import { reviewResponseSchema } from "./schemas/review.schema.ts";

const MAX_ATTEMPTS = 3; // initial + 2 retries

export class AIService {
  constructor(private readonly config: ProviderConfig) {}

  async review(context: ReviewContext): Promise<ReviewResult> {
    const model = createModel(this.config);
    const { system, user } = buildReviewPrompt(context);
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const { output, text } = await generateText({
          model,
          system,
          prompt: user,
          output: Output.object({ schema: reviewResponseSchema }),
        });

        if (output) {
          return this.sanitize(context, reviewResponseSchema.parse(output));
        }

        if (text) {
          const fromText = this.parseOrFail(text);
          if (fromText) return this.sanitize(context, fromText);
          lastError = new Error("Resposta de review inválida (output vazio)");
        } else {
          lastError = new Error("Model returned empty structured output");
        }
      } catch (error) {
        if (NoObjectGeneratedError.isInstance(error) && error.text) {
          const fromText = this.parseOrFail(error.text);
          if (fromText) return this.sanitize(context, fromText);
          lastError = new Error(
            `Resposta de review inválida: ${formatAiFailure(error)}`,
          );
        } else {
          lastError = error;
        }
      }

      if (attempt < MAX_ATTEMPTS) {
        console.error(
          `Structured output failed (attempt ${attempt}/${MAX_ATTEMPTS}):`,
          formatAiFailure(lastError),
        );
      }
    }

    throw new Error(
      `AI review failed after ${MAX_ATTEMPTS} attempts: ${formatAiFailure(lastError)}. ` +
        `Hint: use a chat/coding model that can return JSON (e.g. anthropic/claude-sonnet-4 or openai/gpt-4o-mini). ` +
        `Content-safety or classifier models will not work.`,
    );
  }

  private parseOrFail(raw: string): ReviewResult | null {
    const parsed = parseReviewResponse(raw);
    if (!parsed.ok) {
      console.error("Falha ao validar resposta de review", {
        error: parsed.error,
        raw: parsed.raw,
      });
      return null;
    }
    return parsed.data;
  }

  private sanitize(
    context: ReviewContext,
    review: ReviewResult,
  ): ReviewResult {
    const anchors = extractDiffAnchors(context.diff);
    const { kept, dropped } = filterInlineComments(
      review.inlineComments,
      anchors,
    );

    if (dropped.length > 0) {
      console.warn(
        `Descartados ${dropped.length} comentário(s) inline fora do diff:`,
        dropped.map((c) => `${c.path}:${c.line}`).join(", "),
      );
    }

    return { ...review, inlineComments: kept };
  }
}
