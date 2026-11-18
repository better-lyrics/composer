import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SRC_ROOT, walkSourceFiles } from "@/test/source-files";

// -- Helpers ------------------------------------------------------------------

const PACKAGE_ROOT = join(SRC_ROOT, "../packages/insync/src");

// Static (`from "x"`), side-effect (`import "x"` at a line start) and dynamic (`import("x")`) imports. The word
// "import" inside a string, as in a test title, is not one.
const IMPORT_SPECIFIER = /\bfrom\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']/gm;

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(IMPORT_SPECIFIER)].map((match) => match[1] ?? match[2] ?? match[3]);
}

// Third-party packages insync depends on directly (`packages/insync/package.json`).
const PACKAGE_DEPENDENCIES: ReadonlySet<string> = new Set(["fast-xml-parser"]);

function isPackageInternal(file: string, specifier: string): boolean {
  if (specifier.startsWith("node:") || specifier === "vitest" || PACKAGE_DEPENDENCIES.has(specifier)) return true;
  if (!specifier.startsWith(".")) return false;
  const target = relative(PACKAGE_ROOT, resolve(dirname(file), specifier));
  return !target.startsWith("..");
}

// -- Tests --------------------------------------------------------------------

describe("insync boundary", () => {
  it("insync imports only itself, node built-ins and its own dependencies", () => {
    const offenders = [...walkSourceFiles(PACKAGE_ROOT)].flatMap((file) =>
      importSpecifiers(readFileSync(file, "utf8"))
        .filter((specifier) => !isPackageInternal(file, specifier))
        .map((specifier) => `${file}: ${specifier}`),
    );
    expect(offenders).toEqual([]);
  });

  it("the app imports insync by package name only", () => {
    const offenders = [...walkSourceFiles(SRC_ROOT)].flatMap((file) =>
      importSpecifiers(readFileSync(file, "utf8"))
        .filter((specifier) => specifier.includes("packages/insync"))
        .map((specifier) => `${file}: ${specifier}`),
    );
    expect(offenders).toEqual([]);
  });
});
