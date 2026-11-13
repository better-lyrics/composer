import { withAlignedTransliteration } from "@/domain/language/align";
import type { LanguagePieces, LineLanguages } from "@/domain/language/model";
import { trackPieces } from "@/domain/language/pieces";
import type { LyricLine, MainTrack, TrackRole } from "@/domain/line/model";
import { trackText } from "@/domain/line/text";
import { backgroundTrack, isSpanTimed, mainTrack, timedSyllables } from "@/domain/line/track";
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

interface CachedLanguages {
  splitChar: string;
  languages: LineLanguages | undefined;
}

// -- Caches -------------------------------------------------------------------

const spanBlockByTrack = new WeakMap<MainTrack, CachedSpanBlock>();
const drawnLineByLine = new WeakMap<LyricLine, CachedLine>();
const languagesByLine = new WeakMap<LyricLine, CachedLanguages>();

// -- Syllables ----------------------------------------------------------------

function spanBlock(lineId: string, main: MainTrack & { begin: number; end: number }, splitChar: string): WordTiming[] {
  const cached = spanBlockByTrack.get(main);
  if (cached?.lineId === lineId && cached.splitChar === splitChar) return cached.syllables;
  const text = withoutSplitCharacter(trackText(main, splitChar), splitChar);
  const syllables = [wordFromSpaced({ id: lineTimingWordId(lineId), text, begin: main.begin, end: main.end })];
  spanBlockByTrack.set(main, { lineId, splitChar, syllables });
  return syllables;
}

// The syllables the Timeline draws for a track: its timed syllables, or one block over a line-synced main track.
// The same track and split character always give the same array.
function drawnSyllables(line: LyricLine, role: TrackRole): WordTiming[] {
  if (role === "bg") return timedSyllables(backgroundTrack(line));
  const main = mainTrack(line);
  return isSpanTimed(main) ? spanBlock(line.id, main, getSplitCharacter()) : timedSyllables(main);
}

// -- Lines --------------------------------------------------------------------

// The line as the Timeline draws it, for reads only: a line-synced line reads as one partly timed word.
function drawnLine(line: LyricLine): LyricLine {
  const main = mainTrack(line);
  if (!isSpanTimed(main)) return line;
  const splitChar = getSplitCharacter();
  const cached = drawnLineByLine.get(line);
  if (cached?.splitChar === splitChar) return cached.line;
  const { begin: _begin, end: _end, ...syllableTimed } = main;
  const drawn = withMainTrack(line, { ...syllableTimed, syllables: drawnSyllables(line, "main") });
  drawnLineByLine.set(line, { splitChar, line: drawn });
  return drawn;
}

// -- Languages ----------------------------------------------------------------

// The languages aligned to the drawn syllables, the ones the Timeline shows readings from.
function drawnLanguages(line: LyricLine): LineLanguages | undefined {
  const splitChar = getSplitCharacter();
  const cached = languagesByLine.get(line);
  if (cached?.splitChar === splitChar) return cached.languages;
  const { languages } = withAlignedTransliteration(drawnLine(line));
  languagesByLine.set(line, { splitChar, languages });
  return languages;
}

function drawnPieces(line: LyricLine, role: TrackRole): LanguagePieces | undefined {
  return trackPieces({ languages: drawnLanguages(line) }, role);
}

// -- Exports ------------------------------------------------------------------

export { drawnLanguages, drawnLine, drawnPieces, drawnSyllables };
