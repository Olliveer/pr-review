import { describe, expect, it } from "vitest";
import {
  extractDiffAnchors,
  filterInlineComments,
} from "../../../src/services/ai/diff-anchors.ts";
import type { InlineComment } from "../../../src/types/review.ts";

const sampleDiff = `diff --git a/prisma/schema.prisma b/prisma/schema.prisma
index 111..222 100644
--- a/prisma/schema.prisma
+++ b/prisma/schema.prisma
@@ -88,6 +88,8 @@ model Customer {
   id Int @id
+  name String
+  @@map("customers")
   email String
 }
diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,4 @@
+import { x } from "./x";
 export const app = {};
`;

describe("extractDiffAnchors", () => {
  it("maps new-side lines for added content per path", () => {
    const anchors = extractDiffAnchors(sampleDiff);

    expect(anchors.get("prisma/schema.prisma")?.has(89)).toBe(true);
    expect(anchors.get("prisma/schema.prisma")?.has(90)).toBe(true);
    expect(anchors.get("src/app.ts")?.has(1)).toBe(true);
    expect(anchors.has("/model Customer")).toBe(false);
  });

  it("ignores deleted-only files pointing at /dev/null", () => {
    const anchors = extractDiffAnchors(`diff --git a/gone.ts b/gone.ts
deleted file mode 100644
--- a/gone.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-old
-line
`);
    expect(anchors.size).toBe(0);
  });
});

describe("filterInlineComments", () => {
  it("keeps only comments whose path+line exist in anchors", () => {
    const anchors = extractDiffAnchors(sampleDiff);
    const comments: InlineComment[] = [
      {
        path: "prisma/schema.prisma",
        line: 90,
        severity: "info",
        body: "ok",
      },
      {
        path: "/model Customer",
        line: 90,
        severity: "info",
        body: "bad path",
      },
      {
        path: "prisma/schema.prisma",
        line: 1,
        severity: "warning",
        body: "wrong line",
      },
    ];

    const { kept, dropped } = filterInlineComments(comments, anchors);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.body).toBe("ok");
    expect(dropped).toHaveLength(2);
  });

  it("normalizes leading slash on otherwise valid paths", () => {
    const anchors = extractDiffAnchors(sampleDiff);
    const { kept, dropped } = filterInlineComments(
      [
        {
          path: "/prisma/schema.prisma",
          line: 90,
          severity: "info",
          body: "slash",
        },
      ],
      anchors,
    );
    expect(kept).toHaveLength(1);
    expect(kept[0]?.path).toBe("prisma/schema.prisma");
    expect(dropped).toHaveLength(0);
  });
});
