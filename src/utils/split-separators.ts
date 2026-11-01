// -- Types --------------------------------------------------------------------

type DashMode = "separator" | "literal";
type SeparatorKind = "pronunciation" | "word" | "dash";

interface GraphemeUnit {
  text: string;
  start: number;
  end: number;
}

interface SeparatorRun {
  firstIndex: number;
  point: number;
  kind: SeparatorKind;
}

// -- Constants ----------------------------------------------------------------

const DASH_CHARACTERS = new Set(["-", "\u2010", "\u2011", "\u2012", "\u2013", "\u2014", "\u2015"]);
const GRAPHEME_SEGMENTER = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const KIND_ORDER: readonly SeparatorKind[] = ["pronunciation", "word", "dash"];

// -- Helpers ------------------------------------------------------------------

function isWhitespaceSeparator(char: string): boolean {
  return char.length > 0 && char.trim().length === 0;
}

function isDashSeparator(char: string): boolean {
  return DASH_CHARACTERS.has(char);
}

function isUntimedSeparator(char: string): boolean {
  return isWhitespaceSeparator(char) || isDashSeparator(char);
}

function normalizeSplitPointAtSeparator(text: string, point: number): number {
  let normalized = point;
  while (normalized < text.length && isUntimedSeparator(text[normalized])) normalized++;
  return normalized;
}

function graphemeUnits(value: string): GraphemeUnit[] {
  const segments = [...GRAPHEME_SEGMENTER.segment(value)];
  return segments.map((segment, index) => ({
    text: segment.segment,
    start: segment.index,
    end: segments[index + 1]?.index ?? value.length,
  }));
}

function isSeparatorUnit(text: string, dashes: DashMode): boolean {
  return isWhitespaceSeparator(text) || (dashes === "separator" && isDashSeparator(text));
}

function kindOfRun(run: string): SeparatorKind {
  const spaces = [...run].filter(isWhitespaceSeparator).length;
  if (spaces === 0) return "dash";
  return spaces > 1 ? "word" : "pronunciation";
}

function separatorRuns(value: string, units: GraphemeUnit[], dashes: DashMode): SeparatorRun[] {
  const runs: SeparatorRun[] = [];
  let index = 0;
  while (index < units.length) {
    if (!isSeparatorUnit(units[index].text, dashes)) {
      index++;
      continue;
    }
    let last = index;
    while (last + 1 < units.length && isSeparatorUnit(units[last + 1].text, dashes)) last++;
    if (index > 0 && last < units.length - 1) {
      const point = units[last].end;
      runs.push({ firstIndex: index, point, kind: kindOfRun(value.slice(units[index].start, point)) });
    }
    index = last + 1;
  }
  return runs;
}

function separatorKinds(values: readonly string[], dashes: DashMode = "separator"): SeparatorKind[] {
  const present = new Set(
    values.flatMap((value) => separatorRuns(value, graphemeUnits(value), dashes)).map((run) => run.kind),
  );
  return KIND_ORDER.filter((kind) => present.has(kind));
}

// -- Exports ------------------------------------------------------------------

export { graphemeUnits, isSeparatorUnit, normalizeSplitPointAtSeparator, separatorKinds, separatorRuns };
export type { DashMode, SeparatorKind };
