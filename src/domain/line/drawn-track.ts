import { withAlignedTransliteration } from "@/domain/language/align";
import type { LanguagePieces, LineLanguages } from "insync/language";
import { trackPieces } from "@/domain/language/pieces";
import type { LineTrack, LyricLine, SpanTimedTrack, TrackRole } from "insync/line";
import { trackText } from "insync/line-text";
import {
  backgroundTrack,
  fieldWords,
  isExplicitBlock,
  isSpanTimed,
  mainTrack,
  type TrackField,
  timedSyllables,
  trackOf,
} from "insync/line-track";
import { withBackgroundTrack, withMainTrack, withTrackSyllables } from "@/domain/line/track-writes";
import { lineTimingWordId } from "insync/word-id";
import { wordFromSpaced } from "insync/word-spaced-words";
import type { WordTiming } from "insync/word-timing";
import { withoutSplitCharacter } from "insync/split-character-text";

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
  const explicit = isExplicitBlock(track);
  const syllables = [wordFromSpaced({ id, text, begin: track.begin, end: track.end, ...(explicit && { explicit }) })];
  spanBlockByTrack.set(track, { lineId, splitChar, syllables });
  return syllables;
}

// The syllables the Timeline draws for a track: its timed syllables, or one block over a line-synced track.
// The same track and split character always give the same array.
function drawnSyllables(line: LyricLine, role: TrackRole, splitChar: string): WordTiming[] {
  const track = trackOf(line, role);
  if (!track) return timedSyllables(track);
  return isSpanTimed(track) ? spanBlock(line.id, track, splitChar) : timedSyllables(track);
}

// The words an explicit mark acts on: a main track's timed syllables, or the background as the Timeline draws it.
function explicitFieldWords(line: LyricLine, field: TrackField, splitChar: string): WordTiming[] | undefined {
  if (field === "words") return fieldWords(line, field);
  const drawn = drawnSyllables(line, "bg", splitChar);
  return drawn.length > 0 ? drawn : undefined;
}

// -- Lines --------------------------------------------------------------------

function withDrawnTracks(line: LyricLine, splitChar: string): LyricLine {
  const main = mainTrack(line);
  const background = backgroundTrack(line);
  const drawnMain = isSpanTimed(main) ? withTrackSyllables(main, spanBlock(line.id, main, splitChar)) : main;
  const drawnBackground =
    background && isSpanTimed(background)
      ? withTrackSyllables(background, spanBlock(line.id, background, splitChar))
      : background;
  return withBackgroundTrack(withMainTrack(line, drawnMain), drawnBackground);
}

// The line as the Timeline draws it, for reads only: each span as one block, readings aligned to the drawn syllables.
function drawnLine(line: LyricLine, splitChar: string): LyricLine {
  const cached = drawnLineByLine.get(line);
  if (cached?.splitChar === splitChar) return cached.line;
  const drawn = withAlignedTransliteration(withDrawnTracks(line, splitChar), splitChar);
  drawnLineByLine.set(line, { splitChar, line: drawn });
  return drawn;
}

// -- Languages ----------------------------------------------------------------

// The languages the Timeline shows readings from.
function drawnLanguages(line: LyricLine, splitChar: string): LineLanguages | undefined {
  return drawnLine(line, splitChar).languages;
}

function drawnPieces(line: LyricLine, role: TrackRole, splitChar: string): LanguagePieces | undefined {
  return trackPieces({ languages: drawnLanguages(line, splitChar) }, role);
}

// -- Exports ------------------------------------------------------------------

export { drawnLanguages, drawnLine, drawnPieces, drawnSyllables, explicitFieldWords };
