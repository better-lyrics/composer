import { describe, expect, it } from "vitest";
import { hookCalls, matchLines, productionSources, stylesheetSources } from "@/test/source-scan";

// -- Constants ----------------------------------------------------------------

const WORD_BLOCK_BOXES_OWNER = "views/timeline/word-block-boxes.ts";
const PLAYHEAD_PATH_FILES = [
  "views/timeline/playhead-frame.ts",
  "views/timeline/timeline-playhead-mask.ts",
  "views/timeline/timeline-lights.ts",
  "views/timeline/word-label-pin.ts",
];
const WORD_BLOCK_QUERY_ALL = /\.querySelectorAll(?:<[^>]*>)?\(\s*(?:["'`][^"'`]*data-word-block|WORD_BLOCK_SELECTOR\b)/;
const QUERIES_BLOCKS_OUTSIDE_FRAMES = new Map<string, string>([
  ["views/timeline/pitch/pitch-lane.tsx", "markPitchedWords runs in the drawing effect; the frame callback only clips"],
  [
    "views/timeline/timeline-playhead-mask.ts",
    "boxesOutside reads only the drag ghost's few blocks, outside the scroll container",
  ],
]);

const GLOW_THEME = "views/preview/braccato-theme.css";
const CONTAINER_RULE = /^\.blyrics-container\s*\{([^}]*)\}/m;
const GLOW_COLOR_ALPHA = /--blyrics-glow-color:\s*color\([^)/]*\/\s*([\d.]+)\s*\)/;
const MAX_INVISIBLE_ALPHA = 0.5 / 255;

// -- Helpers ------------------------------------------------------------------

function isFrameSubscriber(code: string): boolean {
  return hookCalls(code, "subscribeFrame").length > 0 || hookCalls(code, "useFrameLoop").length > 0;
}

function containerGlowAlpha(): number | null {
  const css = stylesheetSources().find(({ relPath }) => relPath === GLOW_THEME)?.code ?? "";
  const alpha = CONTAINER_RULE.exec(css)?.[1].match(GLOW_COLOR_ALPHA)?.[1];
  return alpha === undefined ? null : Number(alpha);
}

// -- Tests --------------------------------------------------------------------

describe("per-frame Timeline code reads word block boxes from their owner", () => {
  const timeline = productionSources("views/timeline");
  const frameFiles = timeline.filter(
    ({ relPath, code }) =>
      relPath !== WORD_BLOCK_BOXES_OWNER && (PLAYHEAD_PATH_FILES.includes(relPath) || isFrameSubscriber(code)),
  );
  const querying = frameFiles.filter(({ code }) => WORD_BLOCK_QUERY_ALL.test(code));

  it("covers every playhead path file", () => {
    const scanned = new Set(frameFiles.map(({ relPath }) => relPath));
    expect(PLAYHEAD_PATH_FILES.filter((relPath) => !scanned.has(relPath))).toEqual([]);
  });

  it(`queries every word block only in ${WORD_BLOCK_BOXES_OWNER}`, () => {
    const offenders = querying.flatMap(({ relPath, code }) =>
      QUERIES_BLOCKS_OUTSIDE_FRAMES.has(relPath)
        ? []
        : matchLines(code, WORD_BLOCK_QUERY_ALL).map((line) => `src/${relPath}:${line}`),
    );
    const guidance = [
      `Read boxes through ${WORD_BLOCK_BOXES_OWNER}: it caches them in content coordinates and re-reads only`,
      "after a DOM mutation or a sentinel move. Querying and measuring every block per frame costs a full layout read.",
    ];
    expect(offenders.length === 0 ? "" : [...offenders, ...guidance].join("\n")).toBe("");
  });

  it("lists only files that still query word blocks", () => {
    const still = new Set(querying.map(({ relPath }) => relPath));
    expect([...QUERIES_BLOCKS_OUTSIDE_FRAMES.keys()].filter((relPath) => !still.has(relPath))).toEqual([]);
  });
});

describe("the preview container glow stays near invisible", () => {
  it(`sets --blyrics-glow-color on .blyrics-container with 0 < alpha < 0.5/255 in src/${GLOW_THEME}`, () => {
    const alpha = containerGlowAlpha();
    expect(alpha, "Braccato skips glow work on a word only when the container glow is invisible too").not.toBeNull();
    expect(alpha, "alpha 0 stops the glow animation on long words").toBeGreaterThan(0);
    expect(alpha, "a visible container glow makes Braccato draw glow on every short word").toBeLessThan(
      MAX_INVISIBLE_ALPHA,
    );
  });
});
