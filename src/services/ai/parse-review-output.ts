import {
  reviewResponseSchema,
  type ReviewResponse,
} from "./schemas/review.schema.ts";

export type ParseReviewResponseResult =
  | { ok: true; data: ReviewResponse }
  | { ok: false; error: string; raw: string };

/**
 * Extrai o candidato JSON da resposta bruta:
 * - cercas markdown (` ```json ... ``` `) em qualquer posição
 * - ou o primeiro objeto `{ ... }` encontrado
 */
function extractJsonCandidate(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return stripped.slice(start, end + 1);
  }

  return stripped;
}

/**
 * Faz o parse defensivo da resposta bruta do modelo:
 * 1. Remove possíveis cercas de markdown / texto extra.
 * 2. Faz JSON.parse.
 * 3. Valida contra o schema Zod (tipos, severity enum, campos obrigatórios).
 */
export function parseReviewResponse(raw: string): ParseReviewResponseResult {
  const cleaned = extractJsonCandidate(raw);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch {
    return {
      ok: false,
      error: "Resposta do modelo não é um JSON válido.",
      raw,
    };
  }

  const result = reviewResponseSchema.safeParse(parsedJson);
  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; "),
      raw,
    };
  }

  return { ok: true, data: result.data };
}

export function formatAiFailure(error: unknown): string {
  if (!error || typeof error !== "object") {
    return String(error);
  }

  const err = error as {
    name?: string;
    message?: string;
    text?: string;
    finishReason?: string;
  };

  const parts = [
    err.name ?? "Error",
    err.message ?? "",
    err.finishReason ? `finishReason=${err.finishReason}` : "",
    typeof err.text === "string" && err.text.length > 0
      ? `text=${err.text.slice(0, 200)}`
      : "",
  ].filter(Boolean);

  return parts.join(" | ");
}
