import { describe, expect, it } from "vitest";
import { matchLines, productionSources, type ScannedSource, stylesheetSources } from "@/test/source-scan";

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
  ["views/timeline/shared-copies-hint.ts", "the drag chip is portalled to document.body"],
]);
const WRITES_ONLY_ON_STRIP_MOVE = new Map<string, string>([
  ["views/timeline/waveform-window.ts", "moves the WaveSurfer host only when its 8000 px window shifts"],
  ["views/timeline/spectrum/spectrum-canvas.tsx", "moves the canvas only when its 2-screen strip shifts"],
]);

const HIGHLIGHT_PSEUDO = /::selection|::highlight\(/;
const HIGHLIGHT_RULES_OWNER = "index.css";
const SELECTION_EXCLUSIONS = [
  ".word-face",
  "[data-timeline-row]",
  ".blyrics-word-group",
  ".blyrics-sweep-cell",
  ".blyrics-sweep-mask",
  ".blyrics-sweep-text",
  ".blyrics-sweep-glow",
];
const GLOBAL_ANCESTOR = /^(?:\*|:root|html|body)?$/;

const INHERITED_ARBITRARY_VALUE = /-\[inherit\]/;
const INHERIT_DECLARATION = /:\s*inherit\s*[;}]/g;
const CSS_BLOCK_NAME = /^[ \t]*(@utility\s+[\w-]+|\.[\w-]+)\s*\{/gm;
const STATIC_INHERIT_SOURCES = new Map<string, string>([
  ["ui/popover.tsx", "the panel restyles only when it opens or resizes"],
  ["ui/projects/project-art.tsx", "a static artwork frame"],
  ["views/library/project-card.tsx", "Library cards restyle only on hover"],
  ["views/library/project-row.tsx", "Library rows restyle only on hover"],
  ["views/library/resume-card.tsx", "the resume card restyles only on hover"],
  ["views/sync/sync-lane-line.tsx", "the lane line restyles only when the current line changes"],
  ["views/unison/profile-header.tsx", "a static header"],
]);
const STATIC_INHERIT_BLOCKS = new Map<string, string>([
  ["@utility surface-modal", "a modal restyles only when it opens or closes"],
  ["@utility workspace-card", "the editor and Library card restyle only on a layout change"],
  ["@utility banner-elevation", "a group banner restyles only while its ping runs"],
  [".key", "a key restyles only on hover and press"],
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

function topLevelParts(selectorList: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < selectorList.length; index++) {
    const char = selectorList[index];
    if (char === "(") depth++;
    else if (char === ")") depth--;
    else if (char === "," && depth === 0) {
      parts.push(selectorList.slice(start, index));
      start = index + 1;
    }
  }
  return [...parts, selectorList.slice(start)].map((part) => part.trim());
}

// Every selector in the stylesheet that ends in the pseudo, with the line it starts on.
function pseudoSelectors(css: string, pseudo: string): { line: number; selector: string }[] {
  const found: { line: number; selector: string }[] = [];
  for (let at = css.indexOf(pseudo); at !== -1; at = css.indexOf(pseudo, css.indexOf("{", at))) {
    const start = Math.max(css.lastIndexOf("{", at), css.lastIndexOf("}", at), css.lastIndexOf(";", at)) + 1;
    const line = css.slice(0, start).split("\n").length;
    for (const selector of topLevelParts(css.slice(start, css.indexOf("{", at)))) {
      if (selector.includes(pseudo)) found.push({ line, selector });
    }
  }
  return found;
}

// Each `prop: inherit` declaration with the @utility or class block it sits in.
function inheritDeclarations(css: string): { line: number; block: string }[] {
  return [...css.matchAll(INHERIT_DECLARATION)].map(({ index }) => ({
    line: css.slice(0, index).split("\n").length,
    block: [...css.slice(0, index).matchAll(CSS_BLOCK_NAME)].at(-1)?.[1] ?? "<top level>",
  }));
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

describe("highlight pseudo rules stay off animated subtrees", () => {
  const stylesheets = stylesheetSources();
  const ownerCss = stylesheets.find(({ relPath }) => relPath === HIGHLIGHT_RULES_OWNER)?.code ?? "";
  const guidance = [
    "In Chromium, an animated element that matches a global ::selection or ::highlight() rule restyles its whole",
    "subtree on every animation tick. Keep these rules in src/index.css, scoped away from animated parts.",
  ];

  it(`declares ::selection and ::highlight() only in src/${HIGHLIGHT_RULES_OWNER}`, () => {
    const offenders = offendersOf(
      [...stylesheets, ...productionSources(".")],
      HIGHLIGHT_PSEUDO,
      (relPath) => relPath === HIGHLIGHT_RULES_OWNER,
    );
    expect(report(offenders, ...guidance)).toBe("");
  });

  it("keeps one ::selection rule that excludes the animated Timeline and Braccato parts", () => {
    const rules = pseudoSelectors(ownerCss, "::selection");
    const excluding = rules.filter(({ selector }) => selector.startsWith(":not("));
    const problems = [
      ...rules.flatMap(({ line, selector }) =>
        excluding.length === 1 && selector.startsWith(":not(")
          ? []
          : [`src/${HIGHLIGHT_RULES_OWNER}:${line} ${selector}`],
      ),
      ...SELECTION_EXCLUSIONS.filter((part) => !excluding[0]?.selector.includes(part)).map(
        (part) => `${part} not excluded`,
      ),
    ];
    expect(
      report(problems, "Keep one ::selection rule whose :not() list names every animated part.", ...guidance),
    ).toBe("");
  });

  it("scopes every ::highlight() rule under an ancestor", () => {
    const rules = pseudoSelectors(ownerCss, "::highlight(");
    expect(rules.length).toBeGreaterThan(0);
    const unscoped = rules.flatMap(({ line, selector }) =>
      GLOBAL_ANCESTOR.test(selector.slice(0, selector.indexOf("::highlight(")).trim())
        ? [`src/${HIGHLIGHT_RULES_OWNER}:${line} ${selector}`]
        : [],
    );
    expect(report(unscoped, ...guidance)).toBe("");
  });
});

describe("non-inherited properties are never inherited explicitly", () => {
  const guidance = [
    "An explicit inherit of a non-inherited property (border-radius, align-items, max-height) restyles the child",
    "whenever its parent restyles; on Timeline words that was every zoom step. Share a custom property instead",
    "(--word-radius on .word-face in src/index.css), or add the file with the reason it never restyles per frame.",
  ];

  it("uses no -[inherit] arbitrary values outside static surfaces", () => {
    const offenders = offendersOf(productionSources("."), INHERITED_ARBITRARY_VALUE, (relPath) =>
      STATIC_INHERIT_SOURCES.has(relPath),
    );
    expect(report(offenders, ...guidance)).toBe("");
  });

  it("declares inherit in stylesheets only inside static blocks", () => {
    const offenders = stylesheetSources().flatMap(({ relPath, code }) =>
      inheritDeclarations(code).flatMap(({ line, block }) =>
        STATIC_INHERIT_BLOCKS.has(block) ? [] : [`src/${relPath}:${line} in ${block}`],
      ),
    );
    expect(report(offenders, ...guidance)).toBe("");
  });

  it("lists only files and blocks that still inherit", () => {
    const inheriting = new Set(
      offendersOf(productionSources("."), INHERITED_ARBITRARY_VALUE, () => false).map((at) => at.split(":")[0]),
    );
    const blocks = new Set(
      stylesheetSources().flatMap(({ code }) => inheritDeclarations(code).map(({ block }) => block)),
    );
    expect(staleEntries(STATIC_INHERIT_SOURCES.keys(), (relPath) => inheriting.has(`src/${relPath}`))).toEqual([]);
    expect(staleEntries(STATIC_INHERIT_BLOCKS.keys(), (block) => blocks.has(block))).toEqual([]);
  });
});
