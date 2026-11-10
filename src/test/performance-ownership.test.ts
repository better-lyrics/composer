import { type ScannedSource, matchLines, productionSources } from "@/test/source-scan";
import { describe, expect, it } from "vitest";

// Each rule pins one fix that keeps cost following the viewport instead of the song. A regression is invisible
// on a small project and costs seconds per edit on a 2000-line one, so these fail CI instead of waiting for a profile.

// -- Constants ----------------------------------------------------------------

const DEEP_COPY = /\bstructuredClone\(|JSON\.parse\(\s*JSON\.stringify\(|\b(?:cloneDeep|deepClone|deepCopy)\(/;
const HISTORY_ENTRY_SHAPE = /\bHistoryEntry\b|\bhistoryIndex\b/;

const EFFECTIVE_LINES_CALL = /\bgetEffectiveLines\(/;
const EFFECTIVE_LINES_CALLERS = new Map<string, string>([
  ["views/timeline/timeline-effective-lines.ts", "the owner: one shared array per lines change"],
  ["views/timeline/use-marquee.ts", "a pointer handler reads the lines once per marquee move, never in render"],
  ["views/timeline/timeline-syllable-splitter.tsx", "a shortcut handler reads one line when the splitter opens"],
  ["views/timeline/word-edit-overlay.tsx", "mounted only while one word is being edited"],
  ["views/timeline/loupe/loupe-card-body.tsx", "derives the single line under the loupe"],
  ["views/timeline/loupe/loupe-spectrum.tsx", "derives the single line under the loupe"],
]);

const GROUPING_SCAN_CALL = /(?<!function )\bfindRepeatingStandaloneSections\(/;
const GROUPING_SCAN_OWNER = "views/grouping/grouping-suggestions.ts";

const FRAME_SUBSCRIPTION = /\b(?:subscribeFrame|useFrameLoop)\(/;
const STYLE_WRITE = /\.style\.(?:setProperty\(|[\w$]+\s*=(?!=))/;
const PLAYBACK_STYLE_MARKER = "data-playback-style";
const DECLARES_PLAYBACK_STYLE = new Map<string, string>([
  ["views/timeline/overview/band-viewport.tsx", "views/timeline/overview/band-viewport.tsx"],
  ["views/timeline/beat-grid/beat-grid-canvas.tsx", "views/timeline/beat-grid/beat-grid-canvas.tsx"],
  ["views/timeline/pitch/pitch-lane.tsx", "views/timeline/pitch/pitch-lane.tsx"],
]);
const OUTSIDE_SCROLL_VIEWPORT = new Map<string, string>([
  ["views/timeline/cue-flash.tsx", "rendered by the playhead, a sibling of the scroll container"],
  ["views/timeline/snap-markers-overlay.tsx", "a sibling of the scroll container in timeline-panel.tsx"],
  ["views/timeline/loupe/edit-loupe.tsx", "the loupe card renders in a FloatingPortal"],
]);
const WRITES_ONLY_ON_STRIP_MOVE = new Map<string, string>([
  ["views/timeline/waveform-window.ts", "moves the WaveSurfer host only when its 8000 px window shifts"],
  ["views/timeline/spectrum/spectrum-canvas.tsx", "moves the canvas only when its 2-screen strip shifts"],
]);

// -- Helpers ------------------------------------------------------------------

function offendersOf(sources: ScannedSource[], pattern: RegExp, allowed: (relPath: string) => boolean): string[] {
  return sources.flatMap(({ relPath, code }) =>
    allowed(relPath) ? [] : matchLines(code, pattern).map((line) => `src/${relPath}:${line}`),
  );
}

function report(offenders: string[], ...guidance: string[]): string {
  return offenders.length === 0 ? "" : [...offenders, ...guidance].join("\n");
}

function staleEntries(allowed: Iterable<string>, stillMatching: (relPath: string) => boolean): string[] {
  return [...allowed].filter((relPath) => !stillMatching(relPath));
}

function framedStyleWriters(): ScannedSource[] {
  return productionSources("views/timeline").filter(
    ({ code }) => FRAME_SUBSCRIPTION.test(code) && STYLE_WRITE.test(code),
  );
}

// -- Tests --------------------------------------------------------------------

describe("history shares structure with the store", () => {
  it("never deep-copies state while building or restoring history entries", () => {
    const historyFiles = productionSources("stores/project").filter(({ code }) => HISTORY_ENTRY_SHAPE.test(code));
    expect(historyFiles.map(({ relPath }) => relPath)).toContain("stores/project/history-helpers.ts");
    const offenders = offendersOf(historyFiles, DEEP_COPY, () => false);
    expect(
      report(
        offenders,
        "History entries share the store's objects; dev and test builds deep-freeze them (stores/project/deep-freeze.ts).",
        "A deep copy per edit costs seconds on a long song. Store the references, and write changes immutably.",
      ),
    ).toBe("");
  });
});

describe("timeline effective lines have one computation per consumer group", () => {
  const sources = productionSources("views/timeline");

  it("derives effective lines only in the listed files", () => {
    const offenders = offendersOf(sources, EFFECTIVE_LINES_CALL, (relPath) => EFFECTIVE_LINES_CALLERS.has(relPath));
    expect(
      report(
        offenders,
        "Timeline components share one array: useTimelineEffectiveLines or timelineEffectiveLines",
        "(views/timeline/timeline-effective-lines.ts). A second array per render re-renders every row on each edit.",
      ),
    ).toBe("");
  });

  it("lists only files that still derive them", () => {
    const callers = new Set(offendersOf(sources, EFFECTIVE_LINES_CALL, () => false).map((at) => at.split(":")[0]));
    expect(staleEntries(EFFECTIVE_LINES_CALLERS.keys(), (relPath) => callers.has(`src/${relPath}`))).toEqual([]);
  });
});

describe("the grouping scan has one owner", () => {
  it(`calls findRepeatingStandaloneSections only from ${GROUPING_SCAN_OWNER}`, () => {
    const sources = productionSources(".");
    expect(offendersOf(sources, GROUPING_SCAN_CALL, () => false).join()).toContain(GROUPING_SCAN_OWNER);
    const offenders = offendersOf(sources, GROUPING_SCAN_CALL, (relPath) => relPath === GROUPING_SCAN_OWNER);
    expect(
      report(
        offenders,
        `Read suggestions through ${GROUPING_SCAN_OWNER}: it caches one scan, shares it, and skips timing-only edits.`,
      ),
    ).toBe("");
  });
});

describe("per-frame style writes in the Timeline are declared", () => {
  const writers = framedStyleWriters();
  const listed = (relPath: string) =>
    DECLARES_PLAYBACK_STYLE.has(relPath) ||
    OUTSIDE_SCROLL_VIEWPORT.has(relPath) ||
    WRITES_ONLY_ON_STRIP_MOVE.has(relPath);

  it("places every frame callback that writes a style in a list", () => {
    const offenders = writers.flatMap(({ relPath }) => (listed(relPath) ? [] : [`src/${relPath}`]));
    expect(
      report(
        offenders,
        "This file subscribes a frame callback and writes element styles.",
        `Inside the Timeline scroll viewport, mark the target with ${PLAYBACK_STYLE_MARKER}="<properties>"`,
        "(see views/timeline/playback-style-mutation.ts), or OverlayScrollbars re-measures layout every frame.",
        "Then add the file to DECLARES_PLAYBACK_STYLE, or to OUTSIDE_SCROLL_VIEWPORT with the reason.",
      ),
    ).toBe("");
  });

  it("finds the marker in the file that renders each declared target", () => {
    const sources = new Map(productionSources("views/timeline").map(({ relPath, code }) => [relPath, code]));
    const undeclared = [...DECLARES_PLAYBACK_STYLE].filter(
      ([, renderer]) => !sources.get(renderer)?.includes(PLAYBACK_STYLE_MARKER),
    );
    expect(undeclared.map(([writer, renderer]) => `src/${writer} -> src/${renderer}`)).toEqual([]);
  });

  it("lists only files that still write styles from a frame callback", () => {
    const writerPaths = new Set(writers.map(({ relPath }) => relPath));
    const allListed = [
      ...DECLARES_PLAYBACK_STYLE.keys(),
      ...OUTSIDE_SCROLL_VIEWPORT.keys(),
      ...WRITES_ONLY_ON_STRIP_MOVE.keys(),
    ];
    expect(staleEntries(allListed, (relPath) => writerPaths.has(relPath))).toEqual([]);
  });
});
