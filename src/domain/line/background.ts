import { effectiveBounds } from "@/domain/line/bounds";
import { syllablesFromFields } from "@/domain/line/line-from-fields";
import type { BackgroundSource, BackgroundTrack, LyricLine } from "@/domain/line/model";
import { backgroundText } from "@/domain/line/text";
import { backgroundTrack, timedSyllables, untimedSyllable } from "@/domain/line/track";
import { newBackgroundTrack, withBackgroundTrack, withTrackSyllables } from "@/domain/line/track-writes";
import type { WordTiming } from "@/domain/word/timing";
import { getSplitCharacter } from "@/utils/split-character";
import { createInitialBgWords } from "@/utils/sync-helpers";

// -- Types --------------------------------------------------------------------

interface BackgroundParams {
  text?: string;
  words?: readonly WordTiming[];
  source: BackgroundSource;
}

// -- Funnel -------------------------------------------------------------------

// The single chokepoint for writing a line's background track. Keeps its syllables and the source
// provenance flag coherent so the flag can never drift: an empty write drops the track.
function backgroundTrackFrom(lineId: string, params: BackgroundParams): BackgroundTrack | undefined {
  const text = params.text && params.text.trim().length > 0 ? params.text : undefined;
  const words = params.words && params.words.length > 0 ? [...params.words] : undefined;
  if (!text && !words) return undefined;
  const syllables = syllablesFromFields(text ?? "", words, getSplitCharacter());
  return withTrackSyllables(newBackgroundTrack(lineId, params.source), syllables);
}

function withBackground(line: LyricLine, params: BackgroundParams): LyricLine {
  return withBackgroundTrack(line, backgroundTrackFrom(line.id, params));
}

function withoutBackground(line: LyricLine): LyricLine {
  return withBackgroundTrack(line, undefined);
}

// Any timeline edit of a line's background words (retime, split, merge, add, delete, drag) is manual
// curation: a re-paste or re-extraction must not silently overwrite it. The words become the whole track.
function withManualBackgroundWords(line: LyricLine, words: readonly WordTiming[]): LyricLine {
  return withBackground(line, { words, source: "manual" });
}

function secondHalf(line: LyricLine): { begin: number; end?: number } | null {
  const bounds = effectiveBounds(line);
  return bounds && bounds.end > bounds.begin ? { begin: (bounds.begin + bounds.end) / 2, end: bounds.end } : null;
}

// The one seeding of untimed background lyrics: syllables keep their ids when the seeded words match them.
function seededBackground(line: LyricLine, span: { begin: number; end?: number } | null): LyricLine {
  const background = backgroundTrack(line);
  const text = backgroundText(line);
  if (!background || !text || !span || timedSyllables(background).length > 0) return line;
  const words = createInitialBgWords(text, span.begin, span.end);
  if (words.length === 0) return line;
  const untimed = background.syllables.map(untimedSyllable);
  const seeded =
    words.length === untimed.length
      ? words.map((word, index) => ({ ...untimed[index], begin: word.begin, end: word.end }))
      : words;
  return withBackgroundTrack(line, withTrackSyllables(background, seeded));
}

// Untimed background lyrics are timed over the second half of a timed line.
function withSeededBackground(line: LyricLine): LyricLine {
  return seededBackground(line, secondHalf(line));
}

// Untimed background lyrics are timed from where the line's first syllable was tapped.
function withBackgroundSeededFrom(line: LyricLine, begin: number): LyricLine {
  return seededBackground(line, { begin });
}

// -- Exports ------------------------------------------------------------------

export { withBackground, withBackgroundSeededFrom, withManualBackgroundWords, withSeededBackground, withoutBackground };
export type { BackgroundSource, BackgroundParams };
