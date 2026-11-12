import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SRC_ROOT, walkSourceFiles } from "@/test/source-files";

// -- Helpers ------------------------------------------------------------------

const PACKAGE_ROOT = join(SRC_ROOT, "../packages/insync/src");

// Static (`from "x"`), side-effect (`import "x"`) and dynamic (`import("x")`) imports.
function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["']([^"']+)["']/g)].map((match) => match[1]);
}

function isPackageInternal(file: string, specifier: string): boolean {
  if (specifier.startsWith("node:") || specifier === "vitest") return true;
  if (!specifier.startsWith(".")) return false;
  const target = relative(PACKAGE_ROOT, resolve(dirname(file), specifier));
  return !target.startsWith("..");
}

// -- Tests --------------------------------------------------------------------

describe("insync boundary", () => {
  it("insync imports only itself and node built-ins", () => {
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
