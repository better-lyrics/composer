import { mainWordsEdit, manualBackgroundWordEdit } from "./line-lane-word-edits";
import { drawnSyllables } from "./line-drawn-track";
import { mainTrack, trackRole } from "./line-track";
import { withMainTrack, withTrackSpan } from "./line-track-writes";
import type { LyricLine } from "./line";
import {
  STRETCH_EPS,
  type StretchClampOptions,
  type StretchSelectionRef,
  type StretchTargets,
  deriveBounds,
  resolveStretchTargets,
} from "./selection-stretch-targets";

// -- Types ---------------------------------------------------------------------

interface StretchResult {
  appliedFactor: number;
  updates: Array<{ id: string; updates: Partial<LyricLine> }>;
}

// -- Mapping -------------------------------------------------------------------

// Applies the affine map newX = anchorTime + (x - anchorTime) * k to already
// resolved targets. Pure geometry, no resolve and no clamp, so a drag can call
// it every frame with only k changing.
function mapStretchTargets(
  targets: StretchTargets,
  k: number,
  anchorTime: number,
  splitChar: string,
): StretchResult["updates"] {
  const mapTime = (x: number) => anchorTime + (x - anchorTime) * k;

  // Merge all track updates of one line into a single entry so
  // the stretch command never receives duplicate ids.
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
    const words = drawnSyllables(track.line, trackRole(track.type), splitChar);
    if (words.length === 0) continue;
    const updatedWords = words.map((word, i) =>
      track.indices.has(i) ? { ...word, begin: mapTime(word.begin), end: mapTime(word.end) } : word,
    );
    const entry = entryFor(track.line.id);
    entry.updates =
      track.type === "word"
        ? mainWordsEdit(track.line, updatedWords, entry.updates)
        : manualBackgroundWordEdit(track.line, updatedWords, splitChar, entry.updates);
  }
  for (const target of targets.lineSynced) {
    const entry = entryFor(target.id);
    const line = { ...target.line, ...entry.updates };
    const span = withTrackSpan(mainTrack(line), mapTime(target.begin), mapTime(target.end));
    entry.updates = { ...entry.updates, tracks: withMainTrack(line, span).tracks };
  }

  return [...updatesByLine.values()];
}

// -- Public API ----------------------------------------------------------------

// Maps the selected words (and any line-synced rows riding along) affinely
// around the anchor. The requested factor is clamped to the feasible interval
// derived from non-selected neighbours, minWordDuration and the audio bounds.
function stretchSelections(
  rawLines: LyricLine[],
  selections: ReadonlyArray<StretchSelectionRef>,
  requestedFactor: number,
  options: StretchClampOptions,
  splitChar: string,
): StretchResult {
  const noop: StretchResult = { appliedFactor: 1, updates: [] };
  if (!Number.isFinite(requestedFactor) || requestedFactor <= 0) return noop;

  const targets = resolveStretchTargets(rawLines, selections, splitChar);
  if (!targets) return noop;
  const bounds = deriveBounds(targets, options, splitChar);
  if (!bounds) return noop;

  const k = Math.min(Math.max(requestedFactor, bounds.kLo), bounds.kHi);
  if (!Number.isFinite(k) || Math.abs(k - 1) < STRETCH_EPS) return noop;

  return { appliedFactor: k, updates: mapStretchTargets(targets, k, bounds.anchorTime, splitChar) };
}

// -- Exports -------------------------------------------------------------------

export { mapStretchTargets, stretchSelections };
