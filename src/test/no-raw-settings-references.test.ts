import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { walkScannedSources } from "@/test/source-files";

const RAW_SETTINGS_REFERENCE = /Settings\s*→|\bin Settings\b|\bfrom Settings\b|Settings, under/;

describe("no raw settings references", () => {
  it("points users at settings with SettingLink, never with copy like 'in Settings, under X'", () => {
    const offenders: Array<{ file: string; line: number; text: string }> = [];
    for (const { file, rel } of walkScannedSources()) {
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
