import { describe, expect, it } from "vitest";
import { formatGeneralComment } from "../../../src/services/vcs/format-comment.ts";

describe("formatGeneralComment", () => {
  it("renders summary, risks, and suggestions in pt-BR", () => {
    const md = formatGeneralComment({
      summary: "Mudança sólida",
      risks: ["Sem testes"],
      suggestions: ["Adicionar cobertura"],
      inlineComments: [],
    });
    expect(md).toContain("## Resumo");
    expect(md).toContain("Mudança sólida");
    expect(md).toContain("## Riscos");
    expect(md).toContain("Sem testes");
    expect(md).toContain("## Sugestões");
    expect(md).toContain("Adicionar cobertura");
    expect(md).toContain("Review automatizado por pr-review");
  });
});
