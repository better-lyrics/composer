import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const RAW_SETTINGS_REFERENCE = /Settings\s*→|\bin Settings\b|\bfrom Settings\b|Settings, under/;

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
      yield* walk(full);
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      yield full;
    }
  }
}

describe("no raw settings references", () => {
  it("points users at settings with SettingLink, never with copy like 'in Settings, under X'", () => {
    const offenders: Array<{ file: string; line: number; text: string }> = [];
    for (const file of walk(SRC_ROOT)) {
      const rel = relative(SRC_ROOT, file).replace(/\\/g, "/");
      if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) continue;
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          const trimmed = line.trim();
          if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
          if (RAW_SETTINGS_REFERENCE.test(line)) offenders.push({ file: rel, line: index + 1, text: trimmed });
        });
    }
    expect(offenders).toEqual([]);
  });
});
