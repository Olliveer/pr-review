import type { InlineComment } from "../../types/review.ts";

export type DiffAnchors = Map<string, Set<number>>;

/**
 * Parses a unified diff and collects destination-side (new file) line numbers
 * that appear as context or added lines — valid targets for inline comments.
 */
export function extractDiffAnchors(diff: string): DiffAnchors {
  const anchors: DiffAnchors = new Map();
  let currentPath: string | null = null;
  let newLine = 0;
  let inHunk = false;

  for (const rawLine of diff.split(/\r?\n/)) {
    if (rawLine.startsWith("diff --git ")) {
      currentPath = null;
      inHunk = false;
      continue;
    }

    if (rawLine.startsWith("+++ ")) {
      const target = rawLine.slice(4).trim();
      if (target === "/dev/null") {
        currentPath = null;
      } else {
        currentPath = normalizeDiffPath(target);
        if (currentPath && !anchors.has(currentPath)) {
          anchors.set(currentPath, new Set());
        }
      }
      inHunk = false;
      continue;
    }

    const hunk = rawLine.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      newLine = Number(hunk[1]);
      inHunk = Boolean(currentPath);
      continue;
    }

    if (!inHunk || !currentPath) continue;

    const lines = anchors.get(currentPath);
    if (!lines) continue;

    if (rawLine.startsWith("+") || rawLine.startsWith(" ")) {
      lines.add(newLine);
      newLine += 1;
    } else if (rawLine.startsWith("-")) {
      // deleted line — no destination line number
    } else if (rawLine.startsWith("\\")) {
      // "\ No newline at end of file"
    }
  }

  // Drop paths that never got any line anchors (e.g. empty sets)
  for (const [path, lines] of anchors) {
    if (lines.size === 0) anchors.delete(path);
  }

  return anchors;
}

export function normalizeDiffPath(path: string): string {
  let p = path.trim();
  if (p.startsWith("b/")) p = p.slice(2);
  if (p.startsWith("a/")) p = p.slice(2);
  if (p.startsWith("./")) p = p.slice(2);
  while (p.startsWith("/")) p = p.slice(1);
  return p;
}

export function filterInlineComments(
  comments: InlineComment[],
  anchors: DiffAnchors,
): { kept: InlineComment[]; dropped: InlineComment[] } {
  const kept: InlineComment[] = [];
  const dropped: InlineComment[] = [];

  for (const comment of comments) {
    const path = normalizeDiffPath(comment.path);
    const lines = anchors.get(path);
    if (lines?.has(comment.line)) {
      kept.push({ ...comment, path });
    } else {
      dropped.push(comment);
    }
  }

  return { kept, dropped };
}

export function listAnchorPaths(anchors: DiffAnchors): string[] {
  return [...anchors.keys()].sort();
}
