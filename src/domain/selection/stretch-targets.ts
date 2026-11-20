import type { TimeRange } from "@/domain/group/shared-timing";
import type { LineSyncedLine, LyricLine } from "@/domain/line/model";
import { trackWords } from "@/domain/line/tracks";
import { isLineSynced, isWordSynced } from "@/domain/line/predicates";
import type { WordTiming } from "@/domain/word/timing";

// -- Types ---------------------------------------------------------------------

interface StretchSelectionRef {
  lineId: string;
  type: "word" | "bg";
  wordIndex: number;
}

// "start" pins the selection's earliest time (drag the right edge),
// "end" pins its latest time (drag the left edge).
type StretchAnchor = "start" | "end";

interface StretchClampOptions {
  rangeOf: (line: LyricLine) => TimeRange;
  minWordDuration: number;
  anchor?: StretchAnchor;
}

// A track is one word array of one line: (lineId × "word" | "bg").
interface StretchTrack {
  line: LyricLine;
  type: "word" | "bg";
  indices: Set<number>;
}

interface StretchTargets {
  tracks: Map<string, StretchTrack>;
  // Narrowed by the isLineSynced guard during partitioning, so begin/end are
  // plain numbers downstream — no `as number` assertions needed.
  lineSynced: LineSyncedLine[];
}

// -- Constants -----------------------------------------------------------------

// Floats at flush boundaries: clamps use inclusive bounds with an epsilon so a
// "grow to exactly touch the neighbour" request applies instead of shying off
// by a rounding error.
const STRETCH_EPS = 1e-6;

// -- Target resolution ---------------------------------------------------------

// Unlike the nudge partitioner, syllable groups are NOT expanded: a stretch
// range is exactly what the user selected. Expanding matters for CJK lines,
// where the whole line forms one space-delimited group — expansion would force
// every stretch to cover the entire sentence and make arbitrary contiguous
// sub-ranges unstretchable.
function resolveStretchTargets(
  rawLines: LyricLine[],
  selections: ReadonlyArray<StretchSelectionRef>,
): StretchTargets | null {
  const linesById = new Map<string, LyricLine>();
  for (const l of rawLines) linesById.set(l.id, l);

  const tracks = new Map<string, StretchTrack>();
  const seenWord = new Set<string>();
  const lineSynced: LineSyncedLine[] = [];
  const seenLineSynced = new Set<string>();

  const pushWord = (sel: StretchSelectionRef, line: LyricLine) => {
    const words = trackWords(line, sel.type);
    if (!words || words[sel.wordIndex] === undefined) return;
    const key = `${sel.lineId}:${sel.type}:${sel.wordIndex}`;
    if (seenWord.has(key)) return;
    seenWord.add(key);
    const trackKey = `${sel.lineId}:${sel.type}`;
    let track = tracks.get(trackKey);
    if (!track) {
      track = { line, type: sel.type, indices: new Set() };
      tracks.set(trackKey, track);
    }
    track.indices.add(sel.wordIndex);
  };

  for (const sel of selections) {
    const line = linesById.get(sel.lineId);
    if (!line) continue;
    // bg words ride along whatever timing shape the line has (same routing as
    // the nudge partitioner).
    if (sel.type === "bg" || isWordSynced(line)) {
      pushWord(sel, line);
    } else if (isLineSynced(line)) {
      if (seenLineSynced.has(sel.lineId)) continue;
      seenLineSynced.add(sel.lineId);
      lineSynced.push(line);
    }
  }

  if (tracks.size === 0 && lineSynced.length === 0) return null;
  return { tracks, lineSynced };
}

function isFiniteWord(word: WordTiming | undefined): word is WordTiming {
  return !!word && Number.isFinite(word.begin) && Number.isFinite(word.end);
}

// One owner for the "walk the finite selected word blocks across every track"
// traversal shared by selectionExtremes, deriveBounds and selectionGripEdges.
function* selectedFiniteWords(
  targets: StretchTargets,
): Generator<{ track: StretchTrack; words: WordTiming[]; idx: number; word: WordTiming }> {
  for (const track of targets.tracks.values()) {
    const words = trackWords(track.line, track.type) ?? [];
    for (const idx of track.indices) {
      const word = words[idx];
      if (!isFiniteWord(word)) continue;
      yield { track, words, idx, word };
    }
  }
}

// Outer time bounds of the selection: t0 = earliest begin, t1 = latest end over
// the finite selected word blocks (count of them). Word blocks define the grips;
// a purely line-synced selection (no word blocks) falls back to its rows so the
// plain mapping API still has extremes.
function selectionExtremes(targets: StretchTargets): {
  t0: number;
  t1: number;
  count: number;
  hasWords: boolean;
} {
  let t0 = Number.POSITIVE_INFINITY;
  let t1 = Number.NEGATIVE_INFINITY;
  let count = 0;
  for (const { word } of selectedFiniteWords(targets)) {
    count++;
    if (word.begin < t0) t0 = word.begin;
    if (word.end > t1) t1 = word.end;
  }
  const hasWords = count > 0;
  if (!hasWords) {
    for (const line of targets.lineSynced) {
      if (line.begin < t0) t0 = line.begin;
      if (line.end > t1) t1 = line.end;
    }
  }
  return { t0, t1, count, hasWords };
}

// -- Constraint derivation -----------------------------------------------------

// Every selected item maps affinely around the anchor A: newX = A + (x - A) * k
// with k > 0, which is strictly increasing, so selected items can never start
// overlapping each other. Only non-selected neighbours and the line's time
// range constrain k (per item, b = begin, e = end, L = left neighbour end or
// range start, R = right neighbour begin or range end):
//   min duration         k >= minWordDuration / (e - b)
//   grow past L (b < A)  k <= (A - L) / (A - b)
//   grow past R (e > A)  k <= (R - A) / (e - A)
//   shrink across L      k >= (L - A) / (b - A)   [b > A, L > A]
//   shrink across R      k >= (A - R) / (A - e)   [e < A, R < A]
// At k = 1 every bound is satisfied for valid input, so 1 is always feasible
// unless a word already sits below minWordDuration.
interface FactorBounds {
  kLo: number;
  kHi: number;
}

interface StretchItem {
  begin: number;
  end: number;
  leftLimit: number;
  rightLimit: number;
}

function limitFactor(bounds: FactorBounds, anchorTime: number, minWordDuration: number, item: StretchItem): void {
  const { begin: b, end: e, leftLimit: left, rightLimit: right } = item;
  if (e - b > STRETCH_EPS) bounds.kLo = Math.max(bounds.kLo, minWordDuration / (e - b));
  if (b > anchorTime + STRETCH_EPS && left > anchorTime + STRETCH_EPS) {
    bounds.kLo = Math.max(bounds.kLo, (left - anchorTime) / (b - anchorTime));
  }
  if (b < anchorTime - STRETCH_EPS) bounds.kHi = Math.min(bounds.kHi, (anchorTime - left) / (anchorTime - b));
  if (e > anchorTime + STRETCH_EPS) bounds.kHi = Math.min(bounds.kHi, (right - anchorTime) / (e - anchorTime));
  if (e < anchorTime - STRETCH_EPS && right < anchorTime - STRETCH_EPS) {
    bounds.kLo = Math.max(bounds.kLo, (anchorTime - right) / (anchorTime - e));
  }
}

function deriveBounds(
  targets: StretchTargets,
  options: StretchClampOptions,
): { t0: number; t1: number; anchorTime: number; kLo: number; kHi: number } | null {
  // Non-finite range ends (streams without metadata) or corrupt timings must not
  // leak NaN into the factor: every bound below is checked before use.
  if (!Number.isFinite(options.minWordDuration)) return null;

  const { t0, t1 } = selectionExtremes(targets);

  const span = t1 - t0;
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || span <= STRETCH_EPS) return null;
  const anchorTime = options.anchor === "end" ? t1 : t0;

  const bounds: FactorBounds = { kLo: 0, kHi: Number.POSITIVE_INFINITY };

  for (const { track, words, idx, word } of selectedFiniteWords(targets)) {
    const range = options.rangeOf(track.line);
    if (!Number.isFinite(range.max)) return null;
    // Nearest non-selected neighbours, skipping selected indices.
    let leftLimit = range.min;
    for (let i = idx - 1; i >= 0; i--) {
      if (!track.indices.has(i)) {
        leftLimit = words[i].end;
        break;
      }
    }
    let rightLimit = range.max;
    for (let i = idx + 1; i < words.length; i++) {
      if (!track.indices.has(i)) {
        rightLimit = words[i].begin;
        break;
      }
    }
    limitFactor(bounds, anchorTime, options.minWordDuration, {
      begin: word.begin,
      end: word.end,
      leftLimit,
      rightLimit,
    });
  }

  // Line-synced rows: same affine map on begin/end. Rows may overlap in time,
  // so only min-duration and the row's time range apply (mirrors
  // shiftLineSyncedRows in utils.ts).
  for (const line of targets.lineSynced) {
    if (!Number.isFinite(line.begin) || !Number.isFinite(line.end)) continue;
    const range = options.rangeOf(line);
    if (!Number.isFinite(range.max)) return null;
    limitFactor(bounds, anchorTime, options.minWordDuration, {
      begin: line.begin,
      end: line.end,
      leftLimit: range.min,
      rightLimit: range.max,
    });
  }

  if (bounds.kLo > bounds.kHi + STRETCH_EPS) return null;
  return { t0, t1, anchorTime, ...bounds };
}

// -- Exports -------------------------------------------------------------------

export { deriveBounds, isFiniteWord, resolveStretchTargets, selectedFiniteWords, selectionExtremes, STRETCH_EPS };
export type { StretchAnchor, StretchClampOptions, StretchSelectionRef, StretchTargets };
