import { manualBackgroundWordEdit } from "@/domain/line/background";
import type { LyricLine } from "@/domain/line/model";
import {
  STRETCH_EPS,
  type StretchClampOptions,
  type StretchSelectionRef,
  deriveBounds,
  resolveStretchTargets,
  trackWords,
} from "@/views/timeline/stretch-targets";

// -- Types ---------------------------------------------------------------------

interface StretchResult {
  appliedFactor: number;
  updates: Array<{ id: string; updates: Partial<LyricLine> }>;
}

// -- Public API ----------------------------------------------------------------

// Maps the selected words (and any line-synced rows riding along) affinely
// around the anchor: newX = anchorTime + (x - anchorTime) * k. The requested
// factor is clamped to the feasible interval derived from non-selected
// neighbours, minWordDuration and the audio bounds.
function stretchSelections(
  rawLines: LyricLine[],
  selections: ReadonlyArray<StretchSelectionRef>,
  requestedFactor: number,
  options: StretchClampOptions,
): StretchResult {
  const noop: StretchResult = { appliedFactor: 1, updates: [] };
  if (!Number.isFinite(requestedFactor) || requestedFactor <= 0) return noop;

  const targets = resolveStretchTargets(rawLines, selections);
  if (!targets) return noop;
  const bounds = deriveBounds(targets, options);
  if (!bounds) return noop;

  const k = Math.min(Math.max(requestedFactor, bounds.kLo), bounds.kHi);
  if (!Number.isFinite(k) || Math.abs(k - 1) < STRETCH_EPS) return noop;

  const mapTime = (x: number) => bounds.anchorTime + (x - bounds.anchorTime) * k;

  // Merge all track updates of one line into a single entry so
  // updateLinesWithHistory never receives duplicate ids.
  const updatesByLine = new Map<string, { id: string; updates: Partial<LyricLine> }>();
  const entryFor = (lineId: string) => {
    let entry = updatesByLine.get(lineId);
    if (!entry) {
      entry = { id: lineId, updates: {} };
      updatesByLine.set(lineId, entry);
    }
    return entry;
  };

  for (const track of targets.tracks.values()) {
    const words = trackWords(track);
    const updatedWords = words.map((word, i) =>
      track.indices.has(i) ? { ...word, begin: mapTime(word.begin), end: mapTime(word.end) } : word,
    );
    if (track.type === "word") {
      Object.assign(entryFor(track.line.id).updates, { words: updatedWords });
    } else {
      Object.assign(entryFor(track.line.id).updates, manualBackgroundWordEdit(updatedWords));
    }
  }
  for (const line of targets.lineSynced) {
    Object.assign(entryFor(line.id).updates, {
      begin: mapTime(line.begin),
      end: mapTime(line.end),
    });
  }

  return { appliedFactor: k, updates: [...updatesByLine.values()] };
}

// -- Exports -------------------------------------------------------------------

export { stretchSelections };
