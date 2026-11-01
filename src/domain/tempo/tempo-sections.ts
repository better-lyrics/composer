import type { BeatGrid } from "@/domain/tempo/beat-grid";
import { beatIntervals } from "@/domain/tempo/beat-intervals";

// -- Types ---------------------------------------------------------------------

interface TempoSection {
  from: number;
  bpm: number;
}

// -- Constants -----------------------------------------------------------------

const EVEN_TOLERANCE_SECONDS = 0.0021;
const MIN_SECTION_BEATS = 16;
const SAME_TEMPO_RATIO = 0.08;

// -- Sections ------------------------------------------------------------------

function evenRuns(intervals: readonly number[]): Array<TempoSection & { beats: number }> {
  const runs: Array<TempoSection & { beats: number }> = [];
  let from = 0;
  while (from < intervals.length) {
    let to = from;
    let total = intervals[from];
    while (to + 1 < intervals.length && Math.abs(intervals[to + 1] - intervals[from]) <= EVEN_TOLERANCE_SECONDS) {
      to++;
      total += intervals[to];
    }
    const beats = to - from + 1;
    runs.push({ from, bpm: (60 * beats) / total, beats });
    from = to + 1;
  }
  return runs;
}

function tempoSections(grid: BeatGrid): TempoSection[] {
  const sections: Array<TempoSection & { beats: number }> = [];
  let lastBpm = 0;
  for (const run of evenRuns(beatIntervals(grid.beats))) {
    if (run.beats < MIN_SECTION_BEATS) continue;
    const current = sections.at(-1);
    if (current && Math.abs(run.bpm - lastBpm) / lastBpm < SAME_TEMPO_RATIO) {
      current.bpm = (current.bpm * current.beats + run.bpm * run.beats) / (current.beats + run.beats);
      current.beats += run.beats;
    } else {
      sections.push({ ...run });
    }
    lastBpm = run.bpm;
  }
  return sections.map(({ from, bpm }) => ({ from, bpm }));
}

// -- Exports -------------------------------------------------------------------

export { tempoSections };
