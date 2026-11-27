import { effectiveBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import { memoByIdentity } from "@/utils/memo-by-identity";

// -- Types --------------------------------------------------------------------

interface TimedLine {
  line: LyricLine;
  begin: number;
  end: number;
}

// Timed lines sorted by begin, with the latest end reached so far and the line that reached it,
// so a lookup stops once no earlier line can reach the time.
interface LineTimeIndex {
  timed: TimedLine[];
  reach: number[];
  reachedBy: number[];
}

// -- Helpers ------------------------------------------------------------------

function buildIndex(lines: readonly LyricLine[], lineIds: ReadonlySet<string> | null): LineTimeIndex {
  const timed = lines
    .flatMap((line) => {
      if (lineIds && !lineIds.has(line.id)) return [];
      const bounds = effectiveBounds(line);
      return bounds && bounds.end > bounds.begin ? [{ line, begin: bounds.begin, end: bounds.end }] : [];
    })
    .toSorted((a, b) => a.begin - b.begin);
  const reach: number[] = [];
  const reachedBy: number[] = [];
  for (const [index, entry] of timed.entries()) {
    const previous = index > 0 ? reach[index - 1] : Number.NEGATIVE_INFINITY;
    reach.push(Math.max(previous, entry.end));
    reachedBy.push(entry.end > previous ? index : reachedBy[index - 1]);
  }
  return { timed, reach, reachedBy };
}

const allLinesIndex = memoByIdentity((lines: readonly LyricLine[]) => buildIndex(lines, null));

// A played selection keeps one id set, so its index is built once per edit like the full one.
const selectedLinesIndex = memoByIdentity((lineIds: ReadonlySet<string>) =>
  memoByIdentity((lines: readonly LyricLine[]) => buildIndex(lines, lineIds)),
);

// -- Functions ----------------------------------------------------------------

// The line the view follows: the last to start of the lines playing, each counted from `lead` before
// its start. With none playing it is the line nearest in time, so a gap or an intro still shows one.
function followedLineAt(
  lines: readonly LyricLine[],
  time: number,
  lead: number,
  lineIds: ReadonlySet<string> | null,
): LyricLine | null {
  const { timed, reach, reachedBy } = lineIds ? selectedLinesIndex(lineIds)(lines) : allLinesIndex(lines);
  let started = 0;
  let high = timed.length;
  while (started < high) {
    const middle = (started + high) >> 1;
    if (timed[middle].begin - lead <= time) started = middle + 1;
    else high = middle;
  }

  // Sorting is stable, so walking down through lines that start together ends on the first in line order.
  let found: TimedLine | null = null;
  for (let index = started - 1; index >= 0 && reach[index] > time; index--) {
    const entry = timed[index];
    if (found && entry.begin < found.begin) break;
    if (entry.end > time) found = entry;
  }
  if (found) return found.line;

  const previous = started > 0 ? timed[reachedBy[started - 1]] : undefined;
  const next = timed[started];
  if (!previous || !next) return (previous ?? next)?.line ?? null;
  return time - previous.end <= next.begin - lead - time ? previous.line : next.line;
}

// -- Exports ------------------------------------------------------------------

export { followedLineAt };
