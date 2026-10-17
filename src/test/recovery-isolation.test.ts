import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRY_FILES = [
  join(SRC_ROOT, "lib", "recovery.ts"),
  join(SRC_ROOT, "pages", "recover.tsx"),
  join(SRC_ROOT, "pages", "recover-project-list.tsx"),
];
const IMPORT_SPEC = /from\s+["']([^"']+)["']/g;
const TYPE_ONLY_IMPORT = /^import\s+type\s+[^;]*?from\s+["'][^"']+["'];?/gm;

function resolveModuleFile(base: string): string | undefined {
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return undefined;
}

function resolveImportSpec(fromFile: string, spec: string): string | undefined {
  if (spec.startsWith("@/")) return resolveModuleFile(join(SRC_ROOT, spec.slice(2)));
  if (spec.startsWith(".")) return resolveModuleFile(resolve(dirname(fromFile), spec));
  return undefined;
}

function importSpecsOf(file: string): string[] {
  const runtimeSource = readFileSync(file, "utf8").replace(TYPE_ONLY_IMPORT, "");
  return Array.from(runtimeSource.matchAll(IMPORT_SPEC), (match) => match[1]);
}

function transitiveImportClosure(entryFile: string): Set<string> {
  const visited = new Set<string>();
  const pending = [entryFile];
  while (pending.length > 0) {
    const file = pending.pop() as string;
    if (visited.has(file)) continue;
    visited.add(file);
    for (const spec of importSpecsOf(file)) {
      const resolved = resolveImportSpec(file, spec);
      if (resolved && !visited.has(resolved)) pending.push(resolved);
    }
  }
  return visited;
}

describe("recovery isolation", () => {
  for (const entryFile of ENTRY_FILES) {
    it(`${relative(SRC_ROOT, entryFile)}'s import graph never reaches src/stores`, () => {
      const closure = transitiveImportClosure(entryFile);
      const offenders = Array.from(closure)
        .filter((file) => file !== entryFile && file.includes(`${join(SRC_ROOT, "stores")}/`))
        .map((file) => relative(SRC_ROOT, file));
      expect(offenders).toEqual([]);
    });
  }
});
