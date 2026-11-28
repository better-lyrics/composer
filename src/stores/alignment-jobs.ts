import { hasCjk } from "@/domain/alignment/cjk";
import { type LineReading, lineReadingFor } from "@/domain/alignment/language";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import { trackField } from "@/domain/line/tracks";
import type { WordTiming } from "@/domain/word/timing";
import type { PlannedLine } from "@/stores/alignment-plan";

// What a run's jobs need read before they start, and how their timing is written back.

// -- Types --------------------------------------------------------------------

/** A job's new word timing. */
interface AlignedJob {
  plan: PlannedLine;
  words: WordTiming[];
}

// -- Functions ----------------------------------------------------------------

/**
 * How the run reads the song's scripts, and whether any job needs the kanji
 * dictionary: lyrics or background vocals with Han read as Japanese.
 */
function readingsFor(
  project: { metadata: { language?: string }; lines: readonly LyricLine[] },
  planned: readonly PlannedLine[],
): { reading: LineReading; japanese: boolean } {
  const reading = lineReadingFor(project.metadata.language, project.lines);
  const text = (plan: PlannedLine) => (plan.track === "bg" ? (plan.line.backgroundText ?? "") : plan.line.text);
  return { reading, japanese: reading.hanReading === "ja" && planned.some((plan) => hasCjk(text(plan))) };
}

/** One update per line, so its lyrics and background vocals land together. */
function lineUpdatesFrom(jobs: readonly AlignedJob[]): LineUpdate[] {
  const byId = new Map<string, Partial<LyricLine>>();
  for (const { plan, words } of jobs) {
    byId.set(plan.line.id, { ...byId.get(plan.line.id), [trackField(plan.track)]: words });
  }
  return [...byId].map(([id, updates]) => ({ id, updates }));
}

// -- Exports ------------------------------------------------------------------

export type { AlignedJob };
export { lineUpdatesFrom, readingsFor };
