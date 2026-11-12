import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SRC_ROOT, walkSourceFiles } from "@/test/source-files";

// -- Helpers ------------------------------------------------------------------

const PACKAGE_ROOT = join(SRC_ROOT, "../packages/insync/src");

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
}

function isPackageInternal(specifier: string): boolean {
  return specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("node:");
}

// -- Tests --------------------------------------------------------------------

describe("insync boundary", () => {
  it("insync imports only itself and node built-ins", () => {
    const offenders = [...walkSourceFiles(PACKAGE_ROOT)].flatMap((file) =>
      importSpecifiers(readFileSync(file, "utf8"))
        .filter((specifier) => !isPackageInternal(specifier) && specifier !== "vitest")
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
