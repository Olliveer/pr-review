import { z } from "zod";

export const reviewResultSchema = z.object({
  summary: z.string().min(1),
  risks: z.array(z.string()),
  suggestions: z.array(z.string()),
  inlineComments: z.array(
    z.object({
      path: z.string().min(1),
      line: z.number().int().positive(),
      severity: z.enum(["info", "warning", "critical"]),
      body: z.string().min(1),
    }),
  ),
});

export type ReviewResultSchema = z.infer<typeof reviewResultSchema>;
