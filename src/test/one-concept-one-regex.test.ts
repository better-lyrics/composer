import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createSourceFile, forEachChild, isRegularExpressionLiteral, type Node, ScriptTarget } from "typescript";
import { describe, expect, it } from "vitest";
import { isTestFile, walkSourceFiles } from "@/test/source-files";

// CI guard for regex ownership: one pattern in two files is one concept with
// two homes, and the copies drift.
//
// Two gaps, neither closed here. It compares literal text, so a re-declaration
// merely equivalent to an owned pattern (`/\[\d+,\d+\]/` against the owner's
// `/\[(\d+),(\d+)\]/`) reads as a first occurrence and passes. And it visits
// regex literals only, so a pattern built through `new RegExp(...)` is invisible.

// -- Constants ----------------------------------------------------------------

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Generic tokenization primitives with no domain meaning. Permanent: a pattern
// belongs here only when every copy of it means nothing beyond "split on
// whitespace" or "trim a line break".
const PRIMITIVES = new Set<string>(["\\r?\\n", "\\s+", " +$", "[a-zA-Z0-9]"]);

// A ratchet, not a policy. Each entry is a concept that wants the owner named
// beside it and does not route through one yet. It may only SHRINK: never add
// an entry, and the stale-entry test below forces deletion once one is migrated.
const BASELINE_DEBT = new Map<string, string>([
  ["^v(\\d+)$", "agent voice numbering, wants an owner under domain/agent/"],
  ["\\/$", "base URL normalisation, already owned by utils/url.ts"],
]);

// -- Helpers ------------------------------------------------------------------

function extractRegexSources(file: string, code: string): string[] {
  const sources: string[] = [];
  const collect = (node: Node): void => {
    if (isRegularExpressionLiteral(node)) sources.push(node.text.slice(1, node.text.lastIndexOf("/")));
    forEachChild(node, collect);
  };
  forEachChild(createSourceFile(file, code, ScriptTarget.Latest), collect);
  return sources;
}

function collectDuplicates(): Map<string, string[]> {
  const filesBySource = new Map<string, Set<string>>();

  for (const file of walkSourceFiles(SRC_ROOT)) {
    const rel = relative(SRC_ROOT, file).split("\\").join("/");
    if (isTestFile(rel)) continue;

    for (const source of extractRegexSources(file, readFileSync(file, "utf8"))) {
      const files = filesBySource.get(source) ?? new Set<string>();
      files.add(rel);
      filesBySource.set(source, files);
    }
  }

  return new Map(
    [...filesBySource.entries()]
      .filter(([, files]) => files.size > 1)
      .map(([source, files]) => [source, [...files].toSorted()]),
  );
}

function describeOffender(source: string, files: string[]): string {
  return [
    `/${source}/ is declared in ${files.length} files:`,
    ...files.map((file) => `  src/${file}`),
    "A pattern in two files is one concept with two homes, and the copies drift.",
    "  It spells out a grammar or a domain concept -> give it an owner module and import it",
    "  It is a generic tokenization primitive      -> add it to PRIMITIVES",
  ].join("\n");
}

// -- Tests --------------------------------------------------------------------

describe("one concept, one regex", () => {
  it("no regex literal is declared in more than one file under src", () => {
    const offenders = [...collectDuplicates().entries()]
      .filter(([source]) => !PRIMITIVES.has(source) && !BASELINE_DEBT.has(source))
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(([source, files]) => describeOffender(source, files));

    expect(offenders).toEqual([]);
  });

  it("every BASELINE_DEBT entry is still duplicated", () => {
    const duplicates = collectDuplicates();
    const staleEntries = [...BASELINE_DEBT.keys()].filter((source) => !duplicates.has(source));

    expect(staleEntries).toEqual([]);
  });
});
