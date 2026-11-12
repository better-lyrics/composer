import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isTestFile, walkSourceFiles } from "@/test/source-files";

// -- Constants -----------------------------------------------------------------

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWED_SONNER_IMPORTERS = new Set(["utils/toast.ts", "ui/overlay-hosts.tsx"]);
const SONNER_IMPORT = /from\s+["']sonner["']/;

// -- Tests ---------------------------------------------------------------------

describe("every toast goes through utils/toast", () => {
  it("has no sonner import outside the toast owner and the Toaster host", () => {
    const offenders: string[] = [];
    for (const file of walkSourceFiles(SRC_ROOT)) {
      const rel = relative(SRC_ROOT, file).split("\\").join("/");
      if (isTestFile(rel) || ALLOWED_SONNER_IMPORTERS.has(rel)) continue;
      if (SONNER_IMPORT.test(readFileSync(file, "utf8"))) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});
