import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { matchLines, productionSources } from "@/test/source-scan";
import { describe, expect, it } from "vitest";

const SLICE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../stores/project");

// -- Constants ----------------------------------------------------------------

const BUILD_CONDITION = /import\.meta\.env|process\.env|\bDEV\b|\bPROD\b/;
const FREEZE_IMPORT = /import \{ deepFreeze \} from "@\/stores\/project\/deep-freeze";/;
const ENTRY_LITERAL = /\{[^{}]*\blines\b[^{}]*\btimestamp\s*:/;
const TYPE_DECLARATION_BEFORE = /(?:interface\s+\w+|type\s+\w+\s*=)\s*$/;
const ENTRY_CAST = /\bas\s+HistoryEntry\b|\bsatisfies\s+HistoryEntry\b/;
const HISTORY_WRITE_CALL = /\b(?:commitHistory|amendCurrentStep)\(/;
const LYRIC_FIELD = /\b(?:lines|groups|agents)\b/;
const GENERIC_LINE_SETTER =
  /\b(?:setLines|setLinesWithHistory|updateLine|updateLineWithHistory|updateLinesWithHistory)\b/;
const LYRIC_WRITE_OWNERS = new Set(["stores/project/commit.ts", "stores/project/history-helpers.ts"]);
const NON_LYRIC_HISTORY_WRITERS = new Map<string, string>([
  ["stores/project/beat-grid-slice.ts", "writes the beat grid only"],
  ["stores/project/snap-points-slice.ts", "writes snap points only"],
]);

// -- Helpers ------------------------------------------------------------------

function sourceOf(relPath: string) {
  const source = productionSources("stores/project").find((scanned) => scanned.relPath === relPath);
  if (!source) throw new Error(`missing src/${relPath}`);
  return source.code;
}

function snapshotEntryBody(code: string): string {
  const start = code.indexOf("function snapshotEntry(");
  const end = code.indexOf("\nfunction ", start + 1);
  return start === -1 ? "" : code.slice(start, end === -1 ? undefined : end);
}

// -- Tests --------------------------------------------------------------------

describe("history has a single write path", () => {
  it("no slice except history-slice mutates history/historyIndex directly", () => {
    const offenders: string[] = [];
    for (const f of readdirSync(SLICE_DIR)) {
      if (!f.endsWith("-slice.ts") || f === "history-slice.ts") continue;
      const src = readFileSync(join(SLICE_DIR, f), "utf8");
      if (/\bhistory(Index)?\s*:/.test(src)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });
});

describe("lyric edits reach history only through commit", () => {
  it("records the command note on every entry", () => {
    expect(snapshotEntryBody(sourceOf("stores/project/history-helpers.ts"))).toMatch(
      /^function snapshotEntry\([^)]*\bnote: HistoryNote \| null\): HistoryEntry \{/,
    );
  });

  it("calls the history writers only from commit, history-helpers and the non-lyric slices", () => {
    const offenders = productionSources("")
      .filter(({ relPath }) => !LYRIC_WRITE_OWNERS.has(relPath) && !NON_LYRIC_HISTORY_WRITERS.has(relPath))
      .flatMap(({ relPath, code }) => matchLines(code, HISTORY_WRITE_CALL).map((line) => `${relPath}:${line}`));
    expect(offenders).toEqual([]);
  });

  it("keeps the non-lyric history writers away from lines, groups and agents", () => {
    const offenders = [...NON_LYRIC_HISTORY_WRITERS.keys()].filter((relPath) => LYRIC_FIELD.test(sourceOf(relPath)));
    expect(offenders).toEqual([]);
  });
});

describe("the Timeline changes lyrics only through named commands", () => {
  it("never calls the generic line setters", () => {
    const offenders = productionSources("views/timeline").flatMap(({ relPath, code }) =>
      matchLines(code, GENERIC_LINE_SETTER).map((line) => `${relPath}:${line}`),
    );
    expect(offenders).toEqual([]);
  });
});

describe("history entries are frozen in every build", () => {
  it("never makes the freeze depend on the build", () => {
    expect(matchLines(sourceOf("stores/project/deep-freeze.ts"), BUILD_CONDITION)).toEqual([]);
  });

  it("builds every entry in snapshotEntry through deepFreeze", () => {
    const code = sourceOf("stores/project/history-helpers.ts");
    expect(code).toMatch(FREEZE_IMPORT);
    expect(snapshotEntryBody(code)).toMatch(
      /^function snapshotEntry\([^)]*\): HistoryEntry \{\s*return deepFreeze\(\{/,
    );
  });

  it("builds no history entry outside snapshotEntry", () => {
    const offenders = productionSources("").flatMap(({ relPath, code }) => {
      const body = relPath === "stores/project/history-helpers.ts" ? snapshotEntryBody(code) : "";
      const literals = [...code.matchAll(new RegExp(ENTRY_LITERAL.source, "g"))].filter(
        (match) => !TYPE_DECLARATION_BEFORE.test(code.slice(0, match.index)) && !body.includes(match[0]),
      );
      return [...literals.map(() => relPath), ...matchLines(code, ENTRY_CAST).map((line) => `${relPath}:${line}`)];
    });
    expect(offenders).toEqual([]);
  });
});
