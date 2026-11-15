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

// -- Functions -----------------------------------------------------------------

// Two or more adjacent free lines whose texts spell the row, the run starting nearest `expected` winning.
function joinedRowRun(
  row: string,
  lineTexts: readonly string[],
  isFree: (index: number) => boolean,
  expected: number,
): JoinedRun | null {
  let nearest: JoinedRun | null = null;
  for (let start = 0; start < lineTexts.length; start++) {
    if (!isFree(start) || !lineTexts[start] || !row.startsWith(lineTexts[start])) continue;
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

export { joinedRowRun };
