import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// CI-layer net for the domain-module refactor. Derived concepts (line-synced
// detection, word/instance bounds, instance membership) must go through
// `src/domain/**`, never be re-derived inline at call sites. Re-derivation is
// what made these concepts impossible to evolve safely.
//
// This is a regex heuristic, not a completeness proof: it catches the common
// inline forms. A derivation routed through an intermediate variable (e.g.
// `const last = words.at(-1); last.end`) escapes it. The compile-time wall for
// the remaining cases is the deferred `LyricLine` discriminated-union change.

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Files allowed to contain the raw patterns.
//   - domain/** : the modules that legitimately own these derivations.
//   - stores/project.ts : constructs and mutates LyricLine objects; the
//     mutator-local "clear stale begin/end when words are written" checks were
//     intentionally deferred (see docs/plans domain-refactor design, phase 5).
const WHITELIST_EXACT = new Set(["stores/project.ts"]);

function isWhitelisted(relPath: string): boolean {
  if (relPath.startsWith("domain/")) return true;
  return WHITELIST_EXACT.has(relPath);
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
      yield* walk(full);
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      yield full;
    }
  }
}

interface ForbiddenPattern {
  name: string;
  regex: RegExp;
  use: string;
}

const FORBIDDEN: ForbiddenPattern[] = [
  {
    name: "inline line-synced check",
    regex: /\.begin !== undefined &&\s*[\w.]+\.end !== undefined/,
    use: "isLineSynced from @/domain/line/predicates",
  },
  {
    name: "inline first-word-begin access",
    regex: /\bwords\[0\]\.begin\b/,
    use: "firstBegin from @/domain/word/bounds",
  },
  {
    name: "inline last-word-end access",
    regex: /words\[words\.length - 1\]\.end\b/,
    use: "lastEnd from @/domain/word/bounds",
  },
  {
    name: "inline standalone check",
    regex: /\.groupId === undefined \|\|\s*[\w.]+\.instanceIdx === undefined/,
    use: "isLinked from @/domain/instance/predicates",
  },
  {
    name: "inline linked-line check",
    regex: /\.groupId !== undefined &&\s*[\w.]+\.instanceIdx !== undefined/,
    use: "isLinked from @/domain/instance/predicates",
  },
  {
    name: "inline word-selection identity check",
    regex: /\.wordIndex === [\w.]+\.wordIndex\b/,
    use: "sameWordSelection / isWordSelected from @/domain/selection/identity",
  },
];

describe("no common inline domain derivations outside src/domain", () => {
  for (const pattern of FORBIDDEN) {
    it(`has no ${pattern.name} (use ${pattern.use})`, () => {
      const offenders: Array<{ file: string; line: number; text: string }> = [];

      for (const file of walk(SRC_ROOT)) {
        const rel = relative(SRC_ROOT, file).replace(/\\/g, "/");
        if (isWhitelisted(rel)) continue;
        if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) continue;

        const lines = readFileSync(file, "utf8").split("\n");
        lines.forEach((line, idx) => {
          const trimmed = line.trim();
          if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
          if (pattern.regex.test(line)) {
            offenders.push({ file: rel, line: idx + 1, text: trimmed });
          }
        });
      }

      expect(offenders).toEqual([]);
    });
  }
});
