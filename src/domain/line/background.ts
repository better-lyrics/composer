import { effectiveBounds } from "@/domain/line/bounds";
import { syllablesFromFields } from "@/domain/line/line-from-fields";
import type { BackgroundSource, BackgroundTrack, LyricLine } from "@/domain/line/model";
import { backgroundText } from "@/domain/line/text";
import { backgroundTrack, isSpanTimed, mainTrack, timedSyllables, untimedSyllable } from "@/domain/line/track";
import {
  newBackgroundTrack,
  trackTimingWrite,
  withBackgroundTrack,
  withTrackSpan,
  withTrackSyllables,
} from "@/domain/line/track-writes";
import { firstBegin, lastEnd } from "@/domain/word/bounds";
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
// provenance flag coherent so the flag can never drift: an empty write drops the track. A rewritten track keeps
// what the old one carried from its TTML.
function backgroundTrackFrom(line: LyricLine, params: BackgroundParams): BackgroundTrack | undefined {
  const text = params.text && params.text.trim().length > 0 ? params.text : undefined;
  const words = params.words && params.words.length > 0 ? [...params.words] : undefined;
  if (!text && !words) return undefined;
  const syllables = syllablesFromFields(text ?? "", words, getSplitCharacter());
  const passthrough = backgroundTrack(line)?.passthrough;
  const track = newBackgroundTrack(line.id, params.source);
  return withTrackSyllables(passthrough ? { ...track, passthrough } : track, syllables);
}

function withBackground(line: LyricLine, params: BackgroundParams): LyricLine {
  return withBackgroundTrack(line, backgroundTrackFrom(line, params));
}

function withoutBackground(line: LyricLine): LyricLine {
  return withBackgroundTrack(line, undefined);
}

// Any timeline edit of a line's background words (retime, split, merge, add, delete, drag) is manual
// curation: a re-paste or re-extraction must not silently overwrite it. The untimed rest stays, and the one
// block of a line-synced background moves its span.
function withManualBackgroundWords(line: LyricLine, words: readonly WordTiming[]): LyricLine {
  const background = backgroundTrack(line);
  if (!background) return withBackground(line, { words, source: "manual" });
  const written = trackTimingWrite(background, words);
  return withBackgroundTrack(line, written.syllables.length > 0 ? { ...written, source: "manual" } : undefined);
}

function secondHalf(line: LyricLine): { begin: number; end?: number } | null {
  const bounds = effectiveBounds(line);
  return bounds && bounds.end > bounds.begin ? { begin: (bounds.begin + bounds.end) / 2, end: bounds.end } : null;
}

// The one seeding of untimed background lyrics: syllables keep their ids when the seeded words match them, and a
// span track takes the seeded words' bounds. A background that has any timing is never seeded.
function seededBackground(
  line: LyricLine,
  span: { begin: number; end?: number } | null,
  asSpan = isSpanTimed(mainTrack(line)),
): LyricLine {
  const background = backgroundTrack(line);
  const text = backgroundText(line);
  if (!background || !text || !span || isSpanTimed(background) || timedSyllables(background).length > 0) return line;
  const words = createInitialBgWords(text, span.begin, span.end);
  if (words.length === 0) return line;
  if (asSpan) return withBackgroundTrack(line, withTrackSpan(background, firstBegin(words), lastEnd(words)));
  const untimed = background.syllables.map(untimedSyllable);
  const seeded =
    words.length === untimed.length
      ? words.map((word, index) => ({ ...untimed[index], begin: word.begin, end: word.end }))
      : words;
  return withBackgroundTrack(line, withTrackSyllables(background, seeded));
}

// Untimed background lyrics are timed over the second half of a timed line, at the main track's sync level.
function withSeededBackground(line: LyricLine): LyricLine {
  return seededBackground(line, secondHalf(line));
}

// Seeded as words whatever the main track's level, as 3.x seeded every line: for joining background words that
// carry their own timing, and for reading a record the way 3.x opened it.
function withSeededBackgroundWords(line: LyricLine): LyricLine {
  return seededBackground(line, secondHalf(line), false);
}

// Untimed background lyrics are timed from where the line's first syllable was tapped.
function withBackgroundSeededFrom(line: LyricLine, begin: number): LyricLine {
  return seededBackground(line, { begin });
}

// -- Exports ------------------------------------------------------------------

export {
  withBackground,
  withBackgroundSeededFrom,
  withManualBackgroundWords,
  withSeededBackground,
  withSeededBackgroundWords,
  withoutBackground,
};
export type { BackgroundSource, BackgroundParams };
