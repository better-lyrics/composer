import { withAlignedTransliteration } from "@/domain/language/align";
import type { LanguagePieces, LineLanguages } from "@/domain/language/model";
import { trackPieces } from "@/domain/language/pieces";
import type { LineTrack, LyricLine, SpanTimedTrack, TrackRole } from "@/domain/line/model";
import { trackText } from "@/domain/line/text";
import { isSpanTimed, mainTrack, timedSyllables, trackOf } from "@/domain/line/track";
import { withMainTrack } from "@/domain/line/track-writes";
import { lineTimingWordId } from "@/domain/word/id";
import { wordFromSpaced } from "@/domain/word/spaced-words";
import type { WordTiming } from "@/domain/word/timing";
import { getSplitCharacter, withoutSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

interface CachedSpanBlock {
  lineId: string;
  splitChar: string;
  syllables: WordTiming[];
}

interface CachedLine {
  splitChar: string;
  line: LyricLine;
}

// -- Caches -------------------------------------------------------------------

const spanBlockByTrack = new WeakMap<LineTrack, CachedSpanBlock>();
const drawnLineByLine = new WeakMap<LyricLine, CachedLine>();

// -- Syllables ----------------------------------------------------------------

function spanBlock(lineId: string, track: LineTrack & SpanTimedTrack, splitChar: string): WordTiming[] {
  const cached = spanBlockByTrack.get(track);
  if (cached?.lineId === lineId && cached.splitChar === splitChar) return cached.syllables;
  const text = withoutSplitCharacter(trackText(track, splitChar), splitChar);
  const id = lineTimingWordId(lineId, track.role);
  const syllables = [wordFromSpaced({ id, text, begin: track.begin, end: track.end })];
  spanBlockByTrack.set(track, { lineId, splitChar, syllables });
  return syllables;
}

// The syllables the Timeline draws for a track: its timed syllables, or one block over a line-synced track.
// The same track and split character always give the same array.
function drawnSyllables(line: LyricLine, role: TrackRole): WordTiming[] {
  const track = trackOf(line, role);
  if (!track) return timedSyllables(track);
  return isSpanTimed(track) ? spanBlock(line.id, track, getSplitCharacter()) : timedSyllables(track);
}

// -- Lines --------------------------------------------------------------------

function withDrawnMain(line: LyricLine): LyricLine {
  const main = mainTrack(line);
  if (!isSpanTimed(main)) return line;
  const { begin: _begin, end: _end, ...syllableTimed } = main;
  return withMainTrack(line, { ...syllableTimed, syllables: drawnSyllables(line, "main") });
}

// The line as the Timeline draws it, for reads only: a span as one block, readings aligned to the drawn syllables.
function drawnLine(line: LyricLine): LyricLine {
  const splitChar = getSplitCharacter();
  const cached = drawnLineByLine.get(line);
  if (cached?.splitChar === splitChar) return cached.line;
  const drawn = withAlignedTransliteration(withDrawnMain(line));
  drawnLineByLine.set(line, { splitChar, line: drawn });
  return drawn;
}

// -- Languages ----------------------------------------------------------------

// The languages the Timeline shows readings from.
function drawnLanguages(line: LyricLine): LineLanguages | undefined {
  return drawnLine(line).languages;
}

function drawnPieces(line: LyricLine, role: TrackRole): LanguagePieces | undefined {
  return trackPieces({ languages: drawnLanguages(line) }, role);
}

// -- Exports ------------------------------------------------------------------

export { drawnLanguages, drawnLine, drawnPieces, drawnSyllables };
