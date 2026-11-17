import type { LanguagePieces, LineLanguages } from "./language";
import { withAlignedTransliteration } from "./language-align";
import { trackPieces } from "./language-pieces";
import type { LineTrack, LyricLine, SpanTimedTrack, Syllable, TrackRole } from "./line";
import { trackText } from "./line-text";
import { backgroundTrack, isSpanTimed, mainTrack, timedSyllables, trackOf, untimedSyllablesOf } from "./line-track";
import { withBackgroundTrack, withMainTrack, withTrackSyllables } from "./line-track-writes";
import { memoBySplitCharacter } from "./memo-by-identity";
import { withoutSplitCharacter } from "./split-character-text";
import { lineTimingWordId } from "./word-id";
import { wordFromSpaced } from "./word-spaced-words";
import type { WordTiming } from "./word-timing";

// -- Types --------------------------------------------------------------------

interface CachedSpanBlock {
  lineId: string;
  splitChar: string;
  syllables: WordTiming[];
}

// -- Caches -------------------------------------------------------------------

const NO_SYLLABLES: Syllable[] = [];
Object.freeze(NO_SYLLABLES);

const spanBlockByTrack = new WeakMap<LineTrack, CachedSpanBlock>();

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
function drawnSyllables(line: LyricLine, role: TrackRole, splitChar: string): WordTiming[] {
  const track = trackOf(line, role);
  if (!track) return timedSyllables(track);
  return isSpanTimed(track) ? spanBlock(line.id, track, splitChar) : timedSyllables(track);
}

// The untimed rest drawn after a track's timed syllables: none under a span block, which already covers the text.
function drawnUntimedSyllables(line: LyricLine, role: TrackRole): Syllable[] {
  const track = trackOf(line, role);
  return track && isSpanTimed(track) ? NO_SYLLABLES : untimedSyllablesOf(line, role);
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
const drawnLine = memoBySplitCharacter(
  (line: LyricLine, splitChar: string): LyricLine =>
    withAlignedTransliteration(withDrawnTracks(line, splitChar), splitChar),
);

// -- Languages ----------------------------------------------------------------

// The languages the Timeline shows readings from.
function drawnLanguages(line: LyricLine, splitChar: string): LineLanguages | undefined {
  return drawnLine(line, splitChar).languages;
}

function drawnPieces(line: LyricLine, role: TrackRole, splitChar: string): LanguagePieces | undefined {
  return trackPieces({ languages: drawnLanguages(line, splitChar) }, role);
}

// -- Exports ------------------------------------------------------------------

export { drawnLanguages, drawnLine, drawnPieces, drawnSyllables, drawnUntimedSyllables };
