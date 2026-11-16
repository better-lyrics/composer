import { nearestAccepted } from "@/utils/nearest-accepted";

// -- Interfaces ----------------------------------------------------------------

interface JoinedRun {
  start: number;
  end: number;
  seams: string[];
}

// -- Helpers -------------------------------------------------------------------

// The texts typed between consecutive line texts when, in order, they spell the row; null when they do not.
function joinSeams(texts: readonly string[], row: string): string[] | null {
  const seams: string[] = [];
  let at = 0;
  for (let index = 0; index < texts.length; index++) {
    if (!row.startsWith(texts[index], at)) return null;
    at += texts[index].length;
    if (index === texts.length - 1) break;
    const rest = row.slice(at);
    const seam = rest.slice(0, rest.length - rest.trimStart().length);
    seams.push(seam);
    at += seam.length;
  }
  return at === row.length ? seams : null;
}

// The run of free lines from `start` that spells the row, ending at the first line that completes it.
function runFrom(
  start: number,
  row: string,
  lineTexts: readonly string[],
  isFree: (index: number) => boolean,
): JoinedRun | null {
  if (!isFree(start)) return null;
  let spelled = lineTexts[start].length;
  for (let end = start + 1; end < lineTexts.length && isFree(end) && spelled < row.length; end++) {
    spelled += lineTexts[end].length;
    const seams = joinSeams(lineTexts.slice(start, end + 1), row);
    if (seams) return { start, end, seams };
  }
  return null;
}

// -- Functions -----------------------------------------------------------------

// Each non-empty line text and the lines holding it, so a row looks up its starts instead of scanning every line.
function linesByText(lineTexts: readonly string[]): Map<string, number[]> {
  const byText = new Map<string, number[]>();
  lineTexts.forEach((text, index) => {
    if (!text) return;
    const lines = byText.get(text);
    if (lines) lines.push(index);
    else byText.set(text, [index]);
  });
  return byText;
}

// Two or more adjacent free lines whose texts spell the row, the run starting nearest `expected` winning and the
// earlier run on a tie. Only lines whose text starts the row can start a run, searched outward from `expected`.
function joinedRowRun(
  row: string,
  lineTexts: readonly string[],
  byText: ReadonlyMap<string, readonly number[]>,
  isFree: (index: number) => boolean,
  expected: number,
): JoinedRun | null {
  let nearest: JoinedRun | null = null;
  const distance = (run: JoinedRun) => Math.abs(run.start - expected);
  for (let length = 1; length <= row.length; length++) {
    const starts = byText.get(row.slice(0, length));
    const found = starts && nearestAccepted(starts, expected, (start) => runFrom(start, row, lineTexts, isFree));
    if (!found) continue;
    const run = found.value;
    if (
      !nearest ||
      distance(run) < distance(nearest) ||
      (distance(run) === distance(nearest) && run.start < nearest.start)
    )
      nearest = run;
  }
  return nearest;
}

// -- Exports -------------------------------------------------------------------

export { joinedRowRun, linesByText };
