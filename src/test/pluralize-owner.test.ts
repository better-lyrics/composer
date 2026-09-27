import { describe, expect, it } from "vitest";
import { findProductionMatches } from "@/test/source-files";

// -- Rules --------------------------------------------------------------------

const OWNER = "utils/pluralize.ts";

const COUNT_IS_ONE = String.raw`(?:[!=]==|[<>]=?) 1 \? `;

const HAND_WRITTEN_PLURALS = [
  {
    name: 'a suffix ternary (=== 1 ? "" : "s")',
    pattern: new RegExp(String.raw`${COUNT_IS_ONE}"(?:e?s)?" : "(?:e?s)?"`),
    examples: [
      'line${n === 1 ? "" : "s"}',
      'line{n !== 1 ? "s" : ""}',
      'word${n > 1 ? "s" : ""}',
      'match${n === 1 ? "" : "es"}',
      'match${n !== 1 ? "es" : ""}',
    ],
  },
  {
    name: 'a whole-word plural ternary (=== 1 ? "line" : "lines")',
    pattern: new RegExp(String.raw`${COUNT_IS_ONE}"([a-z]+)\b[^"]*" : "\1(?:s|es)\b`),
    examples: [
      'count === 1 ? "line" : "lines"',
      'count === 1 ? "match" : "matches"',
      `count === 1 ? "line doesn't" : "lines don't"`,
    ],
  },
  {
    name: 'a reversed whole-word plural ternary (!== 1 ? "lines" : "line")',
    pattern: new RegExp(String.raw`${COUNT_IS_ONE}"([a-z]+)(?:s|es)\b[^"]*" : "\1\b`),
    examples: [
      'count !== 1 ? "lines" : "line"',
      'count > 1 ? "matches" : "match"',
      'count !== 1 ? "lines need" : "line needs"',
    ],
  },
  {
    name: 'a literal count of one against a counted plural (=== 1 ? "1 line" : `${n} lines`)',
    pattern: new RegExp(String.raw`${COUNT_IS_ONE}"1 ([a-z]+)\b[^"]*" : ${"`"}\$\{[^}]+\} \1(?:s|es)\b`),
    examples: ['n === 1 ? "1 line has a timing mismatch" : `${n} lines have a timing mismatch`'],
  },
];

// -- Tests --------------------------------------------------------------------

describe("plurals go through utils/pluralize", () => {
  for (const rule of HAND_WRITTEN_PLURALS) {
    it(`has no ${rule.name} outside the owner`, () => {
      expect(findProductionMatches(rule.pattern, (relPath) => relPath === OWNER)).toEqual([]);
    });

    it(`recognises ${rule.name}`, () => {
      for (const example of rule.examples) expect(example).toMatch(rule.pattern);
    });
  }
});
