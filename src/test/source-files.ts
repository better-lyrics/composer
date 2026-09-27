import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// -- Constants ----------------------------------------------------------------

const TEST_FILE_SUFFIXES = [".test.ts", ".test.tsx", ".browser.test.tsx"];
const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// -- Helpers ------------------------------------------------------------------

function* walkSourceFiles(root: string): Generator<string> {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) yield* walkSourceFiles(full);
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) yield full;
  }
}

function isTestFile(relPath: string): boolean {
  return TEST_FILE_SUFFIXES.some((suffix) => relPath.endsWith(suffix));
}

// Matches whole files so a pattern can span a JSX tag broken across lines.
function findProductionMatches(pattern: RegExp, allowed: (relPath: string) => boolean): string[] {
  const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  const offenders: string[] = [];
  for (const file of walkSourceFiles(SRC_ROOT)) {
    const rel = relative(SRC_ROOT, file).split("\\").join("/");
    if (isTestFile(rel) || allowed(rel)) continue;
    const code = readFileSync(file, "utf8");
    for (const match of code.matchAll(global)) {
      offenders.push(`${rel}:${code.slice(0, match.index).split("\n").length}`);
    }
  }
  return offenders;
}

// -- Exports ------------------------------------------------------------------

export { findProductionMatches, isTestFile, walkSourceFiles };
