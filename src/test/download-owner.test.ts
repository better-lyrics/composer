import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isTestFile, walkSourceFiles } from "@/test/source-files";

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OWNER = "lib/download-file.ts";

// These create object URLs to play or probe audio, not to download a file.
const OBJECT_URL_WHITELIST = new Set([
  OWNER,
  "stores/separation.ts",
  "audio/audio-engine.tsx",
  "audio/probe-audio-file.ts",
]);

interface Rule {
  name: string;
  regex: RegExp;
  use: string;
  includeTests: boolean;
  allowed: (relPath: string) => boolean;
}

const RULES: Rule[] = [
  {
    name: "UTC date stamp",
    regex: /toISOString\(\)\.slice\(0,\s*10\)/,
    use: "localDateStamp",
    includeTests: true,
    allowed: (relPath) => relPath === OWNER,
  },
  {
    name: "hand-rolled download anchor",
    regex: /\.download\s*=(?!=)/,
    use: "downloadBlob or downloadText",
    includeTests: false,
    allowed: (relPath) => relPath === OWNER,
  },
  {
    name: "object URL outside the download owner",
    regex: /createObjectURL\(/,
    use: "downloadBlob or downloadText",
    includeTests: false,
    allowed: (relPath) => OBJECT_URL_WHITELIST.has(relPath) || relPath.startsWith("test/"),
  },
];

function offendersOf(rule: Rule): string[] {
  const offenders: string[] = [];
  for (const file of walkSourceFiles(SRC_ROOT)) {
    const rel = relative(SRC_ROOT, file).replace(/\\/g, "/");
    if (rel.startsWith("test/e2e-repro/") || rule.allowed(rel)) continue;
    if (!rule.includeTests && isTestFile(rel)) continue;
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, idx) => {
        if (rule.regex.test(line)) offenders.push(`${rel}:${idx + 1}`);
      });
  }
  return offenders;
}

describe("every download goes through lib/download-file", () => {
  for (const rule of RULES) {
    it(`has no ${rule.name} (use ${rule.use})`, () => {
      expect(offendersOf(rule)).toEqual([]);
    });
  }
});
