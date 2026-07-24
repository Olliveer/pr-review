import type { ReviewContext } from "../../../types/review.ts";
import {
  extractDiffAnchors,
  listAnchorPaths,
} from "../diff-anchors.ts";
import { REVIEW_RESPONSE_SCHEMA_EXAMPLE } from "../schemas/review.schema.ts";

export function buildReviewPrompt(context: ReviewContext): {
  system: string;
  user: string;
} {
  const anchors = extractDiffAnchors(context.diff);
  const paths = listAnchorPaths(anchors);

  const system = [
    "Você é um engenheiro de software sênior fazendo code review de um pull request.",
    "Foque em bugs, segurança, regressões, testes faltando e clareza do código.",
    "TODO o conteúdo textual da resposta (summary, risks, suggestions e body dos inlineComments) DEVE estar em português do Brasil (pt-BR).",
    "Os nomes das chaves JSON permanecem em inglês conforme o schema.",
    "Responda apenas com um único objeto JSON válido, sem crases, sem markdown e sem nenhum texto antes ou depois do JSON.",
    "Formato obrigatório (exemplo de estrutura, não os valores):",
    JSON.stringify(REVIEW_RESPONSE_SCHEMA_EXAMPLE),
    "'severity' deve ser exatamente um de: info, warning, critical.",
    "Comentários inline: o campo path DEVE ser um path exato da lista de arquivos do diff (nunca invente paths como nomes de classe/modelo).",
    "O campo line DEVE ser um número de linha do lado novo (destination) que aparece no diff desse arquivo.",
    "Prefira poucos comentários inline de alto sinal, evitando nitpicks triviais de estilo. Arrays vazios são permitidos quando não houver achados.",
  ].join(" ");

  const pathsSection =
    paths.length > 0
      ? `Arquivos válidos para inlineComments.path (use exatamente estes valores):\n${paths.map((p) => `- ${p}`).join("\n")}`
      : "Nenhum arquivo com linhas ancoráveis no diff — deixe inlineComments como [].";

  const diffSection = context.truncated
    ? `NOTA: O diff abaixo foi truncado por limite de tamanho. Avalie apenas o que está visível e evite conclusões sobre trechos ausentes.\n\nDiff:\n${context.diff}`
    : `Diff:\n${context.diff}`;

  const user = [
    `Workspace: ${context.workspace}`,
    `Repositório: ${context.repoSlug}`,
    `PR #${context.pullRequestId}`,
    `Título: ${context.title || "(sem título)"}`,
    `Autor: ${context.author || "(desconhecido)"}`,
    `Branch de origem: ${context.sourceBranch}`,
    `Branch de destino: ${context.destinationBranch}`,
    `Descrição:\n${context.description || "(nenhuma)"}`,
    pathsSection,
    diffSection,
  ].join("\n\n");

  return { system, user };
}
