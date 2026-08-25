import type { LineSyncedLine, LyricLine } from "@/domain/line/model";
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
  duration: number;
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
    const words = sel.type === "bg" ? line.backgroundWords : line.words;
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

function trackWords(track: StretchTrack): WordTiming[] {
  return (track.type === "word" ? track.line.words : track.line.backgroundWords) as WordTiming[];
}

function isFiniteWord(word: WordTiming | undefined): word is WordTiming {
  return !!word && Number.isFinite(word.begin) && Number.isFinite(word.end);
}

// -- Constraint derivation -----------------------------------------------------

// Every selected item maps affinely around the anchor A: newX = A + (x - A) * k
// with k > 0, which is strictly increasing — selected items can never start
// overlapping each other. Only non-selected neighbours and global bounds
// constrain k (per item, b = begin, e = end, L = left neighbour end or 0,
// R = right neighbour begin or duration):
//   min duration         k >= minWordDuration / (e - b)
//   grow past L (b < A)  k <= (A - L) / (A - b)
//   grow past R (e > A)  k <= (R - A) / (e - A)
//   shrink across L      k >= (L - A) / (b - A)   [b > A, L > A]
//   shrink across R      k >= (A - R) / (A - e)   [e < A, R < A]
// At k = 1 every bound is satisfied for valid input, so 1 is always feasible
// unless a word already sits below minWordDuration.
function deriveBounds(
  targets: StretchTargets,
  options: StretchClampOptions,
): { t0: number; t1: number; anchorTime: number; kLo: number; kHi: number } | null {
  // Non-finite duration (streams without metadata) or corrupt timings must not
  // leak NaN into the factor — every bound below is checked before use.
  if (!Number.isFinite(options.duration) || !Number.isFinite(options.minWordDuration)) return null;

  // Word-block extremes define the selection's sides (the grips). Line-synced
  // rows scale along but never define the anchor; a pure line-synced selection
  // falls back to its own extremes for the plain mapping API.
  let t0 = Number.POSITIVE_INFINITY;
  let t1 = Number.NEGATIVE_INFINITY;
  let hasWords = false;
  for (const track of targets.tracks.values()) {
    const words = trackWords(track);
    for (const idx of track.indices) {
      const word = words[idx];
      if (!isFiniteWord(word)) continue;
      hasWords = true;
      if (word.begin < t0) t0 = word.begin;
      if (word.end > t1) t1 = word.end;
    }
  }
  if (!hasWords) {
    for (const line of targets.lineSynced) {
      if (line.begin < t0) t0 = line.begin;
      if (line.end > t1) t1 = line.end;
    }
  }

  const span = t1 - t0;
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || span <= STRETCH_EPS) return null;
  const anchorTime = options.anchor === "end" ? t1 : t0;

  let kLo = 0;
  let kHi = Number.POSITIVE_INFINITY;

  for (const track of targets.tracks.values()) {
    const words = trackWords(track);
    for (const idx of track.indices) {
      const word = words[idx];
      if (!isFiniteWord(word)) continue;
      const b = word.begin;
      const e = word.end;
      if (e - b > STRETCH_EPS) kLo = Math.max(kLo, options.minWordDuration / (e - b));
      // Nearest non-selected neighbours, skipping selected indices.
      let leftEnd = 0;
      for (let i = idx - 1; i >= 0; i--) {
        if (!track.indices.has(i)) {
          leftEnd = words[i].end;
          break;
        }
      }
      let rightBegin = options.duration;
      for (let i = idx + 1; i < words.length; i++) {
        if (!track.indices.has(i)) {
          rightBegin = words[i].begin;
          break;
        }
      }
      if (b > anchorTime + STRETCH_EPS && leftEnd > anchorTime + STRETCH_EPS) {
        kLo = Math.max(kLo, (leftEnd - anchorTime) / (b - anchorTime));
      }
      if (b < anchorTime - STRETCH_EPS) {
        kHi = Math.min(kHi, (anchorTime - leftEnd) / (anchorTime - b));
      }
      if (e > anchorTime + STRETCH_EPS) {
        kHi = Math.min(kHi, (rightBegin - anchorTime) / (e - anchorTime));
      }
      if (e < anchorTime - STRETCH_EPS && rightBegin < anchorTime - STRETCH_EPS) {
        kLo = Math.max(kLo, (anchorTime - rightBegin) / (anchorTime - e));
      }
    }
  }

  // Line-synced rows: same affine map on begin/end. Rows may overlap in time,
  // so only min-duration and the global 0/duration bounds apply (mirrors
  // shiftLineSyncedRows in utils.ts).
  for (const line of targets.lineSynced) {
    const b = line.begin;
    const e = line.end;
    if (!Number.isFinite(b) || !Number.isFinite(e)) continue;
    if (e - b > STRETCH_EPS) kLo = Math.max(kLo, options.minWordDuration / (e - b));
    if (b < anchorTime - STRETCH_EPS) kHi = Math.min(kHi, anchorTime / (anchorTime - b));
    if (e > anchorTime + STRETCH_EPS) kHi = Math.min(kHi, (options.duration - anchorTime) / (e - anchorTime));
  }

  if (kLo > kHi + STRETCH_EPS) return null;
  return { t0, t1, anchorTime, kLo, kHi };
}

// -- Exports -------------------------------------------------------------------

export { deriveBounds, isFiniteWord, resolveStretchTargets, STRETCH_EPS, trackWords };
export type { StretchAnchor, StretchClampOptions, StretchSelectionRef };
