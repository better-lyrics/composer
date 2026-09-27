import { describe, expect, it } from "vitest";
import { findProductionMatches } from "@/test/source-files";

// -- Rules --------------------------------------------------------------------

const OWNER = "utils/pluralize.ts";

const HAND_WRITTEN_PLURALS = [
  { name: '=== 1 ? "" : "s"', pattern: /=== 1 \? "" : "s"/, example: 'line${n === 1 ? "" : "s"}' },
  { name: '!== 1 ? "s" : ""', pattern: /!== 1 \? "s" : ""/, example: 'line{n !== 1 ? "s" : ""}' },
  { name: '> 1 ? "s" : ""', pattern: /> 1 \? "s" : ""/, example: 'word${n > 1 ? "s" : ""}' },
  {
    name: 'a whole-word plural ternary (=== 1 ? "line" : "lines")',
    pattern: /=== 1 \? "([a-z]+)" : "\1(?:s|es)"/,
    example: 'count === 1 ? "match" : "matches"',
  },
];

// -- Tests --------------------------------------------------------------------

describe("plurals go through utils/pluralize", () => {
  for (const rule of HAND_WRITTEN_PLURALS) {
    it(`has no ${rule.name} outside the owner`, () => {
      expect(findProductionMatches(rule.pattern, (relPath) => relPath === OWNER)).toEqual([]);
    });

    it(`recognises ${rule.name}`, () => {
      expect(rule.example).toMatch(rule.pattern);
    });
  }
});
