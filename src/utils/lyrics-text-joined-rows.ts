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

// The lines a row can start with, in line order: those whose text is a prefix of the row.
function startsOf(row: string, linesByText: ReadonlyMap<string, readonly number[]>): number[] {
  const starts: number[] = [];
  for (let length = 1; length <= row.length; length++) starts.push(...(linesByText.get(row.slice(0, length)) ?? []));
  return starts.toSorted((a, b) => a - b);
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

// Two or more adjacent free lines whose texts spell the row, the run starting nearest `expected` winning.
function joinedRowRun(
  row: string,
  lineTexts: readonly string[],
  byText: ReadonlyMap<string, readonly number[]>,
  isFree: (index: number) => boolean,
  expected: number,
): JoinedRun | null {
  let nearest: JoinedRun | null = null;
  for (const start of startsOf(row, byText)) {
    if (!isFree(start)) continue;
    let spelled = lineTexts[start].length;
    for (let end = start + 1; end < lineTexts.length && isFree(end) && spelled < row.length; end++) {
      spelled += lineTexts[end].length;
      const seams = joinSeams(lineTexts.slice(start, end + 1), row);
      if (!seams) continue;
      if (!nearest || Math.abs(start - expected) < Math.abs(nearest.start - expected)) nearest = { start, end, seams };
      break;
    }
  }
  return nearest;
}

// -- Exports -------------------------------------------------------------------

export { joinedRowRun, linesByText };
