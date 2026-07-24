import { z } from "zod";

export const severitySchema = z.enum(["info", "warning", "critical"]);
export type Severity = z.infer<typeof severitySchema>;

export const inlineCommentSchema = z.object({
  path: z.string().min(1),
  line: z.number().int().positive(),
  severity: severitySchema,
  body: z.string().min(1),
});

export const reviewResponseSchema = z.object({
  summary: z.string().min(1),
  risks: z.array(z.string()),
  suggestions: z.array(z.string()),
  inlineComments: z.array(inlineCommentSchema),
});

export type ReviewResponse = z.infer<typeof reviewResponseSchema>;

// Exemplo de estrutura usado no prompt — construído a partir do próprio
// schema Zod (via .parse em dados de exemplo), garantindo que nunca
// diverge do que de fato é validado.
export const REVIEW_RESPONSE_SCHEMA_EXAMPLE: ReviewResponse =
  reviewResponseSchema.parse({
    summary: "string",
    risks: ["string"],
    suggestions: ["string"],
    inlineComments: [
      { path: "string", line: 1, severity: "info", body: "string" },
    ],
  });
