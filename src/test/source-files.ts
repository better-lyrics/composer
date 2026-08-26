import { readdirSync } from "node:fs";
import { join } from "node:path";

// -- Constants ----------------------------------------------------------------

const TEST_FILE_SUFFIXES = [".test.ts", ".test.tsx", ".browser.test.tsx"];

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

// -- Exports ------------------------------------------------------------------

export { isTestFile, walkSourceFiles };
