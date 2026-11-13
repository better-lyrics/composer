import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SRC_ROOT } from "@/test/source-files";

// The context menu and the keyboard decide what a structural word command acts on only through
// `views/timeline/word-commands.ts`, so the two can never act on different words.

const OWNER = "views/timeline/word-commands.ts";

const CALLERS = [
  "views/timeline/timeline-context-menu.tsx",
  "views/timeline/use-context-menu-targets.ts",
  "views/timeline/use-word-menu-actions.ts",
  "views/timeline/use-timeline-keyboard.ts",
];

const OWNED_CALLS = [
  "contiguousSelectionRun(",
  "mergeSelectedWords(",
  "mergeSyllableGroupIntoWord(",
  "mergeSyllableGroup(",
  "markWordsExplicit(",
  "toggleWordExplicit(",
  "resolveExplicitSelectionToggle(",
  "isPartialSyllableSelection(",
];

describe("word command ownership", () => {
  it(`menu and keyboard resolve structural word commands through ${OWNER}`, () => {
    const offenders = CALLERS.flatMap((relPath) => {
      const code = readFileSync(join(SRC_ROOT, relPath), "utf8");
      return OWNED_CALLS.filter((call) => code.includes(call)).map((call) => `${relPath}: ${call}`);
    });
    expect(offenders).toEqual([]);
  });
});
